import { EventEmitter } from "node:events";
import { Request, Response } from "express";

/**
 * In-process pub/sub backing the generic SSE endpoint below. This does NOT
 * fan out across multiple Node instances - fine for a single-instance
 * deployment; revisit with Redis pub/sub only if the backend is ever scaled
 * out horizontally. Chosen (over Supabase Realtime's Postgres CDC) for the
 * two latency-sensitive channels identified in the migration plan
 * (workspace-chat-{id}, platform-active-support-sessions-live); the three
 * dashboard-style channels use plain polling instead and need no code here.
 */
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

/** Call this from a service after a write to push an update to subscribers of `channel`. */
export function publish(channel: string, event: string, data: unknown) {
  emitter.emit(channel, { event, data });
}

/**
 * Generic SSE route handler: streams whatever's published on `channel` (via
 * `publish`, above) to the connected client until it disconnects.
 * `getChannel` typically reads a route param, e.g. `(req) => req.params.channel`,
 * so one mount can serve many channel instances (`workspace-chat-{workspaceId}`).
 */
export function sseHandler(getChannel: (req: Request) => string) {
  return (req: Request, res: Response) => {
    const channel = getChannel(req);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("retry: 3000\n\n");

    const listener = (payload: { event: string; data: unknown }) => {
      res.write(`event: ${payload.event}\n`);
      res.write(`data: ${JSON.stringify(payload.data)}\n\n`);
    };

    emitter.on(channel, listener);

    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      emitter.off(channel, listener);
    });
  };
}
