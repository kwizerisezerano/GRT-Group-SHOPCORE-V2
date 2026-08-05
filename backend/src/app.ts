import path from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { openApiSpec } from "./docs/openapi";
import { sendSuccess } from "./lib/apiResponse";
import { sseHandler } from "./lib/realtime";
import { resolveRequestLanguage } from "./middleware/language";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requireAuth } from "./middleware/auth";
import { authRouter } from "./modules/auth/auth.routes";
import { workspaceRouter } from "./modules/workspace/workspace.routes";

export function createApp() {
  const app = express();

  // CSP is disabled because it otherwise blocks swagger-ui's inline
  // assets; this service only ever renders its own docs page and JSON
  // responses, so that's an acceptable trade for a working /api/docs.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  // Before every route, so even a 404 or a crash is answered in the
  // caller's language.
  app.use(resolveRequestLanguage);

  app.get("/api/health", (_req, res) =>
    sendSuccess(res, { messageKey: "common.healthy", data: { status: "ok" } })
  );

  app.get("/api/openapi.json", (_req, res) => res.json(openApiSpec));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Local-disk storage driver's public read path (lib/storage.ts); a no-op
  // mount when STORAGE_DRIVER=s3, since objects are read directly from the
  // S3-compatible endpoint instead.
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  // Generic SSE channel (lib/realtime.ts) - modules publish() to a channel
  // name and any authenticated client can subscribe here to it by name.
  app.get("/api/realtime/:channel", requireAuth, sseHandler((req) => req.params.channel));

  app.use("/api/auth", authRouter);
  app.use("/api/workspace", workspaceRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
