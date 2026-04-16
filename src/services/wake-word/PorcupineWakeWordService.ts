/**
 * PorcupineWakeWordService
 *
 * Real Picovoice Porcupine WASM wake word detection.
 * Implements the existing `WakeWordService` interface (see ./types) so it
 * can be swapped in for `MockWakeWordService` with zero API changes.
 *
 * Architecture reference: Seven Mynd Master Architecture v5.5, Section 4.4.
 *   - Wake word runs entirely locally via WASM in a Web Worker.
 *   - No audio is sent to servers until the wake word is confirmed.
 *   - Custom "Hey Seven" keyword with graceful fallback to built-in "Computer"
 *     if the custom model fails to load.
 *
 * Bundle budget: the Porcupine SDK (~3.5MB WASM) is loaded via dynamic import
 * inside `startListening()`. It is NOT included in the main bundle.
 * Main bundle budget is <500KB gzipped (Section 19.6).
 *
 * Privacy: the microphone is only requested at the moment `startListening()`
 * is called — which only happens after the user explicitly enables Always
 * Listening in Settings.
 *
 * Model files (shipped from /public):
 *   /porcupine/porcupine_params.pv                (general English model)
 *   /porcupine/Hey-Seven_en_wasm_v4_0_0.ppn       (custom keyword, v4)
 *
 * Access key is read from import.meta.env.VITE_PICOVOICE_ACCESS_KEY.
 */

import type { WakeWordService, WakeWordServiceConfig } from "./types";

const CUSTOM_KEYWORD_PATH = "/porcupine/Hey-Seven_en_wasm_v4_0_0.ppn";
const CUSTOM_KEYWORD_LABEL = "Hey Seven";
const FALLBACK_KEYWORD_LABEL = "Computer";
const MODEL_PATH = "/porcupine/porcupine_params.pv";
const DEFAULT_WAKE_WORD = "Hey Seven";

/** Minimal shape of the worker we depend on — keeps us resilient to
 *  non-essential SDK method changes. */
interface InternalPorcupineWorker {
  release: () => Promise<void>;
}

interface InternalWebVoiceProcessor {
  subscribe: (consumer: unknown) => Promise<void>;
  unsubscribe: (consumer: unknown) => Promise<void>;
}

type ServiceState = "idle" | "starting" | "running" | "stopping";

export class PorcupineWakeWordService implements WakeWordService {
  private config: WakeWordServiceConfig | null = null;
  private worker: InternalPorcupineWorker | null = null;
  private wvp: InternalWebVoiceProcessor | null = null;
  private state: ServiceState = "idle";
  private wakeWord = DEFAULT_WAKE_WORD;
  private usingFallback = false;

  async startListening(config: WakeWordServiceConfig): Promise<void> {
    if (this.state === "running" || this.state === "starting") return;

    const accessKey = import.meta.env.VITE_PICOVOICE_ACCESS_KEY as
      | string
      | undefined;

    if (!accessKey) {
      config.onError(
        "Picovoice access key missing. Set VITE_PICOVOICE_ACCESS_KEY in your environment."
      );
      return;
    }

    this.state = "starting";
    this.config = config;

    try {
      // Dynamic imports keep the ~3.5MB WASM SDK out of the main bundle.
      const [porcupineModule, wvpModule] = await Promise.all([
        import("@picovoice/porcupine-web"),
        import("@picovoice/web-voice-processor"),
      ]);

      const { PorcupineWorker, BuiltInKeyword } = porcupineModule;
      const { WebVoiceProcessor } = wvpModule;

      const detectionCallback = (detection: {
        label?: string;
        index?: number;
      }) => {
        if (this.state !== "running") return;
        const label =
          detection?.label ??
          (this.usingFallback
            ? FALLBACK_KEYWORD_LABEL
            : CUSTOM_KEYWORD_LABEL);
        try {
          this.config?.onWakeWordDetected(label);
        } catch (cbErr) {
          // eslint-disable-next-line no-console
          console.error(
            "[PorcupineWakeWordService] detection handler threw:",
            cbErr
          );
        }
      };

      const processErrorCallback = (err: Error) => {
        this.config?.onError(
          err?.message ?? "Wake word worker encountered an error"
        );
      };

      let worker: InternalPorcupineWorker;

      // Primary path: load the custom "Hey Seven" keyword.
      try {
        worker = (await PorcupineWorker.create(
          accessKey,
          [
            {
              publicPath: CUSTOM_KEYWORD_PATH,
              label: CUSTOM_KEYWORD_LABEL,
            },
          ],
          detectionCallback,
          { publicPath: MODEL_PATH },
          { processErrorCallback }
        )) as unknown as InternalPorcupineWorker;
        this.usingFallback = false;
        this.wakeWord = CUSTOM_KEYWORD_LABEL;
      } catch (customErr) {
        // eslint-disable-next-line no-console
        console.warn(
          "[PorcupineWakeWordService] Custom 'Hey Seven' keyword failed to load, " +
            "falling back to built-in 'Computer'. Cause:",
          customErr
        );

        // If it's an auth error, fallback will fail too — bail.
        if (this.isAuthError(customErr)) {
          config.onError(
            "Invalid Picovoice access key. Please check VITE_PICOVOICE_ACCESS_KEY."
          );
          this.state = "idle";
          this.config = null;
          return;
        }

        try {
          worker = (await PorcupineWorker.create(
            accessKey,
            [BuiltInKeyword.Computer],
            detectionCallback,
            { publicPath: MODEL_PATH },
            { processErrorCallback }
          )) as unknown as InternalPorcupineWorker;
          this.usingFallback = true;
          this.wakeWord = FALLBACK_KEYWORD_LABEL;
        } catch (fallbackErr) {
          config.onError(this.classifyError(fallbackErr));
          this.state = "idle";
          this.config = null;
          return;
        }
      }

      this.worker = worker;

      // Wire microphone -> worker. This is where the browser prompts for mic
      // permission if the user has not granted it yet.
      try {
        await WebVoiceProcessor.subscribe(worker);
        this.wvp = WebVoiceProcessor as unknown as InternalWebVoiceProcessor;
      } catch (micErr) {
        await this.safeReleaseWorker();
        this.worker = null;
        config.onError(this.classifyError(micErr));
        this.state = "idle";
        this.config = null;
        return;
      }

      this.state = "running";
      config.onListeningChange(true);
    } catch (err) {
      config.onError(this.classifyError(err));
      await this.safeReleaseWorker();
      this.worker = null;
      this.wvp = null;
      this.state = "idle";
      this.config = null;
    }
  }

  stopListening(): void {
    if (this.state === "idle" || this.state === "stopping") return;
    const cfg = this.config;
    this.state = "stopping";

    // Fire-and-forget teardown — the service presents a synchronous
    // stopListening surface to match the existing WakeWordService contract.
    void (async () => {
      try {
        if (this.wvp && this.worker) {
          try {
            await this.wvp.unsubscribe(this.worker);
          } catch {
            // Ignore — worker may already be detached.
          }
        }
        await this.safeReleaseWorker();
      } finally {
        this.worker = null;
        this.wvp = null;
        this.usingFallback = false;
        this.state = "idle";
        this.config = null;
        cfg?.onListeningChange(false);
      }
    })();
  }

  isListening(): boolean {
    return this.state === "running";
  }

  setWakeWord(word: string): void {
    // The active keyword file is baked in at load time — we can't hot-swap
    // without re-creating the worker. Store the preference for when the
    // user next toggles the service off/on.
    this.wakeWord = word || DEFAULT_WAKE_WORD;
  }

  getWakeWord(): string {
    return this.wakeWord;
  }

  /** Exposed so Settings can display "using fallback keyword" state. */
  isUsingFallbackKeyword(): boolean {
    return this.usingFallback;
  }

  private async safeReleaseWorker(): Promise<void> {
    if (!this.worker) return;
    try {
      await this.worker.release();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        "[PorcupineWakeWordService] worker.release failed:",
        err
      );
    }
  }

  private isAuthError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    return /access[_ ]?key|invalid|unauthor|403|401/i.test(msg);
  }

  private classifyError(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err ?? "Unknown");

    if (/access[_ ]?key|invalid|unauthor|403|401/i.test(raw)) {
      return "Invalid Picovoice access key. Please check VITE_PICOVOICE_ACCESS_KEY.";
    }
    if (
      /permission|denied|notallowed|user ?gesture|secure ?context/i.test(raw)
    ) {
      return "Microphone access denied. Please allow microphone access in your browser settings.";
    }
    if (/model|ppn|\.pv\b|fetch|load|404|network/i.test(raw)) {
      return "Wake word model failed to load. Please check your connection and try again.";
    }
    return raw;
  }
}

export default PorcupineWakeWordService;
