/**
 * Deepgram dictation hook for the homepage mic button.
 *
 * Architecture v5.5, Section 10.5:
 *   The mic button on /home must use the same Deepgram pipeline as the Live page.
 *   NOT browser SpeechRecognition. Must feel like Google voice typing.
 *
 * When active: opens Deepgram WebSocket, streams mic audio, returns live transcript.
 * onInterim fires with in-progress text (for display in the input field).
 * onFinal fires with the complete utterance (for sending as a message).
 */

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface UseDeepgramDictationOptions {
  active: boolean;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (msg: string) => void;
}

export function useDeepgramDictation({
  active,
  onInterim,
  onFinal,
  onError,
}: UseDeepgramDictationOptions) {
  // Use refs for callbacks to avoid recreating connections when callbacks change
  const onInterimRef = useRef(onInterim);
  const onFinalRef = useRef(onFinal);
  const onErrorRef = useRef(onError);

  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (!active) return;

    let socket: WebSocket | null = null;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let processor: ScriptProcessorNode | null = null;
    let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
    let turnTakingTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const parts: string[] = [];

    const cleanup = () => {
      cancelled = true;
      if (turnTakingTimer) clearTimeout(turnTakingTimer);
      if (keepaliveTimer) clearInterval(keepaliveTimer);
      processor?.disconnect();
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close().catch(() => {});
      }
      stream?.getTracks().forEach((t) => t.stop());
      if (socket && socket.readyState === WebSocket.OPEN) {
        try { socket.send(JSON.stringify({ type: "CloseStream" })); } catch {}
        socket.close(1000);
      }
    };

    const start = async () => {
      try {
        // 1. Get Deepgram token
        const tokenRes = await supabase.functions.invoke("voice-stt", { body: {} });
        if (cancelled) return;

        if (tokenRes.error || !tokenRes.data?.url || !tokenRes.data?.key) {
          onErrorRef.current?.("Voice service unavailable");
          return;
        }

        // 2. Get microphone
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: { ideal: 16000 },
          },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

        // 3. Open Deepgram WebSocket
        socket = new WebSocket(tokenRes.data.url, ["token", tokenRes.data.key]);
        socket.binaryType = "arraybuffer";

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Connection timed out")), 10000);
          socket!.onopen = () => { clearTimeout(timeout); resolve(); };
          socket!.onerror = () => { clearTimeout(timeout); reject(new Error("Connection failed")); };
        });
        if (cancelled) return;

        // 4. Set up audio capture
        audioContext = new AudioContext({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(stream);
        processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          // Silence output to prevent feedback
          e.outputBuffer.getChannelData(0).fill(0);

          if (!socket || socket.readyState !== WebSocket.OPEN) return;

          const input = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          try { socket.send(int16.buffer); } catch {}
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        // 5. Handle Deepgram messages
        socket.onmessage = (event: MessageEvent) => {
          if (typeof event.data !== "string") return;

          let msg: { type: string; channel?: { alternatives?: { transcript: string }[] }; is_final?: boolean; speech_final?: boolean };
          try { msg = JSON.parse(event.data); } catch { return; }

          if (msg.type === "Results") {
            const transcript = msg.channel?.alternatives?.[0]?.transcript || "";

            if (!msg.is_final) {
              // Interim: show accumulated parts + current interim
              const current = parts.join(" ");
              onInterimRef.current((current + " " + transcript).trim());
              return;
            }

            // Final result
            if (transcript.trim()) {
              if (turnTakingTimer) { clearTimeout(turnTakingTimer); turnTakingTimer = null; }
              parts.push(transcript.trim());
              onInterimRef.current(parts.join(" "));
            }

            if (msg.speech_final) {
              // 700ms turn-taking timer: wait for user to finish speaking
              if (turnTakingTimer) clearTimeout(turnTakingTimer);
              turnTakingTimer = setTimeout(() => {
                const full = parts.splice(0).join(" ").trim();
                if (full) onFinalRef.current(full);
              }, 700);
            }
          }

          if (msg.type === "UtteranceEnd") {
            if (turnTakingTimer) { clearTimeout(turnTakingTimer); turnTakingTimer = null; }
            const full = parts.splice(0).join(" ").trim();
            if (full) onFinalRef.current(full);
          }
        };

        socket.onclose = () => {
          // Flush any remaining text
          const full = parts.splice(0).join(" ").trim();
          if (full) onFinalRef.current(full);
        };

        socket.onerror = () => {
          onErrorRef.current?.("Voice connection error");
        };

        // 6. Keepalive
        keepaliveTimer = setInterval(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            try { socket.send(JSON.stringify({ type: "KeepAlive" })); } catch {}
          }
        }, 8000);

      } catch (err) {
        console.error("[DICTATION] Failed:", err);
        onErrorRef.current?.("Microphone access denied or voice service unavailable");
      }
    };

    start();
    return cleanup;
  }, [active]);
}
