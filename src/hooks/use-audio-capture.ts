import { useCallback, useRef, useEffect, useState } from "react";

interface UseAudioCaptureOptions {
  /** Whether mic capture is active */
  active: boolean;
  /** Sample rate (default 16000 — ideal for STT) */
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
 * Provides raw PCM data ready for STT backends and volume levels for UI.
 *
 * Backend integration: Forward the Float32Array audio chunks via
 * WebSocket to your STT service (Deepgram, Google STT, ElevenLabs, etc.)
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

  const startCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: sampleRate },
        },
      });

      streamRef.current = stream;
      setHasPermission(true);

      const audioContext = new AudioContext({ sampleRate });
      contextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      // Analyser for volume visualization
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      source.connect(analyser);

      // ScriptProcessor for raw PCM data (AudioWorklet would be ideal for production)
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Copy data since the buffer is reused
        const dataCopy = new Float32Array(inputData.length);
        dataCopy.set(inputData);
        onAudioData?.(dataCopy, audioContext.sampleRate);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Volume monitoring loop
      if (onVolumeLevel) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkVolume = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length / 255;
          onVolumeLevel(avg);
          volumeRafRef.current = requestAnimationFrame(checkVolume);
        };
        checkVolume();
      }
    } catch {
      setHasPermission(false);
      onError?.("Microphone access denied");
    }
  }, [sampleRate, bufferSize, onAudioData, onVolumeLevel, onError]);

  const stopCapture = useCallback(() => {
    if (volumeRafRef.current) {
      cancelAnimationFrame(volumeRafRef.current);
      volumeRafRef.current = null;
    }
    processorRef.current?.disconnect();
    processorRef.current = null;
    analyserRef.current = null;
    contextRef.current?.close();
    contextRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
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
