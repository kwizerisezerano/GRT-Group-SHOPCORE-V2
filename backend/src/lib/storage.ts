import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env";

export type UploadFileInput = {
  bucket: string;
  filename: string;
  contentType: string;
  buffer: Buffer;
};

export type UploadFileResult = { key: string; url: string };

export interface StorageDriver {
  upload(input: UploadFileInput): Promise<UploadFileResult>;
  getUrl(bucket: string, key: string): string;
  delete(bucket: string, key: string): Promise<void>;
}

function keyFor(filename: string) {
  const ext = path.extname(filename);
  return `${Date.now()}-${randomUUID()}${ext}`;
}

/** Dev-friendly default: writes under backend/uploads/<bucket>/, served back via the /uploads static route in app.ts. */
class LocalDiskStorageDriver implements StorageDriver {
  private root = path.resolve(process.cwd(), "uploads");

  async upload({ bucket, filename, buffer }: UploadFileInput): Promise<UploadFileResult> {
    const key = keyFor(filename);
    const dir = path.join(this.root, bucket);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, key), buffer);
    return { key, url: this.getUrl(bucket, key) };
  }

  getUrl(bucket: string, key: string): string {
    return `/uploads/${bucket}/${key}`;
  }

  async delete(bucket: string, key: string): Promise<void> {
    await fs.rm(path.join(this.root, bucket, key), { force: true });
  }
}

/** Prod driver: any S3-compatible endpoint (AWS S3, MinIO, Cloudflare R2, ...), selected via env. */
class S3StorageDriver implements StorageDriver {
  private client: S3Client;

  constructor(
    private publicBaseUrl: string,
    clientConfig: { region: string; endpoint?: string; forcePathStyle?: boolean; accessKeyId: string; secretAccessKey: string }
  ) {
    this.client = new S3Client({
      region: clientConfig.region,
      endpoint: clientConfig.endpoint || undefined,
      forcePathStyle: clientConfig.forcePathStyle,
      credentials: { accessKeyId: clientConfig.accessKeyId, secretAccessKey: clientConfig.secretAccessKey },
    });
  }

  async upload({ bucket, filename, contentType, buffer }: UploadFileInput): Promise<UploadFileResult> {
    const key = keyFor(filename);
    await this.client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType })
    );
    return { key, url: this.getUrl(bucket, key) };
  }

  getUrl(bucket: string, key: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, "")}/${bucket}/${key}`;
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}

function buildStorageDriver(): StorageDriver {
  if (env.STORAGE_DRIVER === "s3") {
    return new S3StorageDriver(env.STORAGE_PUBLIC_BASE_URL, {
      region: env.STORAGE_S3_REGION,
      endpoint: env.STORAGE_S3_ENDPOINT || undefined,
      forcePathStyle: env.STORAGE_S3_FORCE_PATH_STYLE,
      accessKeyId: env.STORAGE_S3_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_S3_SECRET_ACCESS_KEY,
    });
  }

  return new LocalDiskStorageDriver();
}

export const storage: StorageDriver = buildStorageDriver();
