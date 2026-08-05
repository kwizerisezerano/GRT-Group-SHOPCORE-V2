import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGINS: z.string().default(""),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),
  BCRYPT_COST: z.coerce.number().default(10),

  // PII protection (lib/crypto.ts). Both are 32-byte keys as 64 hex chars,
  // generated with `openssl rand -hex 32`, and must differ from each other.
  // No defaults on purpose: booting with a fallback key would silently write
  // data nobody can decrypt later.
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32)"),
  BLIND_INDEX_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "BLIND_INDEX_KEY must be 64 hex characters (openssl rand -hex 32)"),
  FRONTEND_URL: z.string().default("http://127.0.0.1:5173"),
  RESEND_API_KEY: z.string().default(""),
  RESEND_FROM_EMAIL: z.string().default("ShopCore <no-reply@shopcore.local>"),

  // File storage (lib/storage.ts): "local" writes under backend/uploads and
  // serves it back via the /uploads static route; "s3" targets any
  // S3-compatible endpoint (AWS S3, MinIO, Cloudflare R2, ...).
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_PUBLIC_BASE_URL: z.string().default(""), // s3 only: public URL prefix to read objects back from
  STORAGE_S3_REGION: z.string().default("auto"),
  STORAGE_S3_ENDPOINT: z.string().default(""), // leave empty for real AWS S3; set for MinIO/R2/etc.
  STORAGE_S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  STORAGE_S3_ACCESS_KEY_ID: z.string().default(""),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
};
