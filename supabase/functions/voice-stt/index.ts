/**
 * Voice STT Edge Function — Deepgram Nova-2 WebSocket Proxy
 *
 * Architecture v5.5, Section 4.6:
 *   Deepgram Nova-2 provides sub-300ms first-word latency, 100+ language
 *   auto-detection, and WebSocket streaming. Server-side proxy protects the
 *   API key. Barge-in handled client-side.
 *
 * Protocol:
 *   Client → wss://<supabase>/functions/v1/voice-stt?token=<JWT>&apikey=<ANON>
 *   Proxy  → wss://api.deepgram.com/v1/listen  (auth via subprotocol)
 *
 * Messages from proxy to client:
 *   { type: "ready" }                — Deepgram connection established
 *   { type: "error", message: "…" }  — connection or auth error
 *   (raw Deepgram JSON)              — transcript results, utterance events
 *
 * Messages from client to proxy:
 *   Binary (ArrayBuffer)             — PCM16 audio frames at 16 kHz mono
 *   { type: "close" }               — graceful shutdown request
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  // ─── CORS preflight ───
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ─── Reject non-WebSocket requests ───
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response(
      JSON.stringify({ error: "Expected WebSocket upgrade" }),
      {
        status: 426,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // ─── Extract auth token from query params ───
  // Browser WebSocket constructor cannot set custom headers, so we
  // pass the Supabase JWT and anon key as URL query parameters.
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Missing auth token" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // ─── Validate user auth ───
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[voice-stt] Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn("[voice-stt] Auth failed:", authError?.message || "no user");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // ─── Validate Deepgram API key ───
  const deepgramKey = Deno.env.get("DEEPGRAM_API_KEY");
  if (!deepgramKey) {
    console.error("[voice-stt] Missing DEEPGRAM_API_KEY");
    return new Response(
      JSON.stringify({ error: "STT service not configured" }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // ─── Auth valid — upgrade client connection to WebSocket ───
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  // Track Deepgram socket for cleanup
  let dgSocket: WebSocket | null = null;
  let isClosing = false;

  // ─── Client WebSocket lifecycle ───
  clientSocket.onopen = () => {
    console.log(`[voice-stt] Client connected (user: ${user.id.slice(0, 8)}…)`);

    // ─── Build Deepgram URL ───
    // Architecture v5.5, Section 4.6: Nova-2, 100+ language auto-detection,
    // sub-300ms first-word latency.
    // Auth via 'key' query parameter (Deepgram's documented WebSocket auth method
    // for environments that cannot set custom HTTP headers).
    const dgParams = new URLSearchParams({
      key: deepgramKey,
      model: "nova-2",
      detect_language: "true",
      smart_format: "true",
      interim_results: "true",
      utterance_end_ms: "1000",
      vad_events: "true",
      encoding: "linear16",
      sample_rate: "16000",
      channels: "1",
    });

    const dgUrl = `wss://api.deepgram.com/v1/listen?${dgParams.toString()}`;

    // ─── Connect to Deepgram ───
    try {
      dgSocket = new WebSocket(dgUrl);
    } catch (err) {
      console.error("[voice-stt] Failed to create Deepgram WebSocket:", err);
      sendToClient(clientSocket, {
        type: "error",
        message: "Failed to connect to speech recognition service",
      });
      clientSocket.close(1011, "Deepgram connection failed");
      return;
    }

    dgSocket.onopen = () => {
      console.log("[voice-stt] Deepgram connected");
      sendToClient(clientSocket, { type: "ready" });
    };

    dgSocket.onmessage = (event: MessageEvent) => {
      // Forward Deepgram transcript data to client as-is
      if (clientSocket.readyState === WebSocket.OPEN) {
        try {
          clientSocket.send(
            typeof event.data === "string"
              ? event.data
              : event.data
          );
        } catch (err) {
          console.error("[voice-stt] Error forwarding to client:", err);
        }
      }
    };

    dgSocket.onerror = (event: Event) => {
      console.error("[voice-stt] Deepgram WebSocket error:", event);
      if (!isClosing && clientSocket.readyState === WebSocket.OPEN) {
        sendToClient(clientSocket, {
          type: "error",
          message: "Speech recognition connection error",
        });
      }
    };

    dgSocket.onclose = (event: CloseEvent) => {
      console.log(
        `[voice-stt] Deepgram closed: code=${event.code} reason=${event.reason}`
      );
      if (!isClosing && clientSocket.readyState === WebSocket.OPEN) {
        // Deepgram disconnected unexpectedly — notify client
        sendToClient(clientSocket, {
          type: "error",
          message: "Speech recognition disconnected",
        });
        clientSocket.close(1001, "Deepgram disconnected");
      }
    };
  };

  clientSocket.onmessage = (event: MessageEvent) => {
    if (!dgSocket || dgSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    // Check for JSON control messages from client
    if (typeof event.data === "string") {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "close") {
          // Graceful shutdown: tell Deepgram to finalize
          dgSocket.send(JSON.stringify({ type: "CloseStream" }));
          return;
        }
      } catch {
        // Not JSON — ignore (shouldn't happen for text messages)
      }
      return;
    }

    // Forward binary audio data to Deepgram
    try {
      dgSocket.send(event.data);
    } catch (err) {
      console.error("[voice-stt] Error forwarding audio to Deepgram:", err);
    }
  };

  clientSocket.onclose = (event: CloseEvent) => {
    console.log(
      `[voice-stt] Client disconnected: code=${event.code} reason=${event.reason}`
    );
    isClosing = true;

    // Close Deepgram connection gracefully
    if (dgSocket) {
      if (dgSocket.readyState === WebSocket.OPEN) {
        try {
          dgSocket.send(JSON.stringify({ type: "CloseStream" }));
        } catch {
          // Ignore — we're closing anyway
        }
      }
      try {
        dgSocket.close();
      } catch {
        // Ignore
      }
      dgSocket = null;
    }
  };

  clientSocket.onerror = (event: Event) => {
    console.error("[voice-stt] Client WebSocket error:", event);
    isClosing = true;
    if (dgSocket) {
      try {
        dgSocket.close();
      } catch {
        // Ignore
      }
      dgSocket = null;
    }
  };

  return response;
});

// ─── Helpers ───

function sendToClient(
  socket: WebSocket,
  data: Record<string, unknown>
): void {
  if (socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(data));
    } catch (err) {
      console.error("[voice-stt] Failed to send to client:", err);
    }
  }
}
