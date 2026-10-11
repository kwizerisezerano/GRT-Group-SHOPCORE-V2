import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v2 as cloudinary } from "cloudinary";
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

/**
 * Cloudinary driver — the storage backend the requirements call for.
 *
 * Cloudinary owns the bytes; the database keeps only the returned URL and
 * the public_id needed to delete or transform the asset later. `bucket` maps
 * onto a Cloudinary folder, so the existing per-bucket call sites work
 * unchanged across all three drivers.
 */
class CloudinaryStorageDriver implements StorageDriver {
  constructor(config: { cloudName: string; apiKey: string; apiSecret: string }) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  async upload({ bucket, filename, contentType, buffer }: UploadFileInput): Promise<UploadFileResult> {
    // resource_type "auto" lets Cloudinary handle images, video and raw
    // documents (PDF invoices, CSV imports) through one code path.
    const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: bucket,
      public_id: path.parse(keyFor(filename)).name,
      resource_type: "auto",
      overwrite: false,
    });

    // The key is Cloudinary's public_id: the handle needed to delete or
    // transform the asset. Persist it alongside the URL — a URL alone is not
    // enough to manage the asset later.
    return { key: result.public_id, url: result.secure_url };
  }

  getUrl(_bucket: string, key: string): string {
    // `key` is already a fully-qualified public_id including the folder.
    return cloudinary.url(key, { secure: true });
  }

  async delete(_bucket: string, key: string): Promise<void> {
    await cloudinary.uploader.destroy(key, { resource_type: "image", invalidate: true });
  }
}

function buildStorageDriver(): StorageDriver {
  if (env.STORAGE_DRIVER === "cloudinary") {
    const missing = (
      [
        ["CLOUDINARY_CLOUD_NAME", env.CLOUDINARY_CLOUD_NAME],
        ["CLOUDINARY_API_KEY", env.CLOUDINARY_API_KEY],
        ["CLOUDINARY_API_SECRET", env.CLOUDINARY_API_SECRET],
      ] as const
    )
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      // Fail at boot rather than at the first upload, which would otherwise
      // be discovered by a user losing their file.
      throw new Error(
        `STORAGE_DRIVER=cloudinary requires ${missing.join(", ")} to be set`
      );
    }

    return new CloudinaryStorageDriver({
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
    });
  }

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
