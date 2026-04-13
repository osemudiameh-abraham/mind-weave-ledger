import { useCallback, useRef, useEffect, useState } from "react";

interface UseAudioCaptureOptions {
  /** Whether mic capture is active */
  active: boolean;
  /** Sample rate (default 16000 — ideal for STT / Deepgram) */
  sampleRate?: number;
  /** Buffer size in samples before emitting (default 4096) */
  bufferSize?: number;
  /** Called with raw PCM Float32 audio data */
  onAudioData?: (data: Float32Array, sampleRate: number) => void;
  /** Called with RMS volume level 0-1 for visualization */
  onVolumeLevel?: (level: number) => void;
  /** Called on error */
  onError?: (msg: string) => void;
}

/**
 * Captures microphone audio using Web Audio API.
 * Provides raw PCM Float32 data for STT backends and volume levels for UI.
 *
 * Audio is captured at the requested sample rate (default 16kHz mono) and
 * emitted via onAudioData. The RealLiveService converts Float32 → Int16
 * before sending to the Deepgram WebSocket proxy.
 *
 * IMPORTANT: Output buffer is zeroed to prevent mic audio from playing back
 * through speakers. ScriptProcessorNode must be connected to destination for
 * onaudioprocess events to fire, but we silence the output.
 */
export const useAudioCapture = ({
  active,
  sampleRate = 16000,
  bufferSize = 4096,
  onAudioData,
  onVolumeLevel,
  onError,
}: UseAudioCaptureOptions) => {
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeRafRef = useRef<number | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Use refs for callbacks to avoid recreating AudioContext when callbacks change
  const onAudioDataRef = useRef(onAudioData);
  const onVolumeLevelRef = useRef(onVolumeLevel);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onAudioDataRef.current = onAudioData;
  }, [onAudioData]);

  useEffect(() => {
    onVolumeLevelRef.current = onVolumeLevel;
  }, [onVolumeLevel]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const startCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: { ideal: sampleRate },
        },
      });

      streamRef.current = stream;
      setHasPermission(true);

      const audioContext = new AudioContext({ sampleRate });
      contextRef.current = audioContext;

      // Log actual sample rate (browser may not honor the requested rate)
      if (audioContext.sampleRate !== sampleRate) {
        console.warn(
          `[AUDIO] Requested ${sampleRate}Hz but got ${audioContext.sampleRate}Hz`
        );
      }

      const source = audioContext.createMediaStreamSource(stream);

      // Analyser for volume visualization (drives LiveAurora waveform)
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      source.connect(analyser);

      // ScriptProcessor for raw PCM data
      // NOTE: ScriptProcessorNode is deprecated but AudioWorklet requires
      // a separate file and has CORS complexity. ScriptProcessor is stable
      // across all target browsers and sufficient for 16kHz mono.
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const inputData = e.inputBuffer.getChannelData(0);

        // CRITICAL: Zero output buffer to prevent mic audio from playing
        // through speakers. Without this, enabling audio capture causes a
        // feedback loop. ScriptProcessorNode must be connected to destination
        // for onaudioprocess to fire, but we silence the output.
        const outputData = e.outputBuffer.getChannelData(0);
        outputData.fill(0);

        // Copy input data (buffer is reused by the audio engine)
        const dataCopy = new Float32Array(inputData.length);
        dataCopy.set(inputData);
        onAudioDataRef.current?.(dataCopy, audioContext.sampleRate);
      };

      source.connect(processor);
      // Must connect to destination for events to fire (browser requirement)
      processor.connect(audioContext.destination);

      // Volume monitoring loop (drives UI visualization at ~60fps)
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length / 255;
        onVolumeLevelRef.current?.(avg);
        volumeRafRef.current = requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch (err) {
      console.error("[AUDIO] Mic access failed:", err);
      setHasPermission(false);
      onErrorRef.current?.("Microphone access denied");
    }
  }, [sampleRate, bufferSize]);

  const stopCapture = useCallback(() => {
    // Stop volume monitoring
    if (volumeRafRef.current) {
      cancelAnimationFrame(volumeRafRef.current);
      volumeRafRef.current = null;
    }

    // Disconnect audio nodes
    processorRef.current?.disconnect();
    processorRef.current = null;
    analyserRef.current = null;

    // Close audio context
    if (contextRef.current && contextRef.current.state !== "closed") {
      contextRef.current.close().catch(() => {
        // Ignore — context may already be closed
      });
    }
    contextRef.current = null;

    // Stop mic stream tracks
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    // Reset volume to 0 when capture stops
    onVolumeLevelRef.current?.(0);
  }, []);

  useEffect(() => {
    if (active) {
      startCapture();
    } else {
      stopCapture();
    }
    return stopCapture;
  }, [active, startCapture, stopCapture]);

  return { hasPermission };
};
