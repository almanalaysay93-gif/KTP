// File storage via a real S3 (or S3-compatible) bucket with automatic database fallback.
// When S3 is unconfigured or unavailable, files are persisted directly into the database.
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";
import * as db from "./db";

let _client: S3Client | null = null;

function getClient(): S3Client | null {
  if (!ENV.s3BucketName) {
    return null;
  }
  if (!_client) {
    _client = new S3Client(ENV.s3Region ? { region: ENV.s3Region } : {});
  }
  return _client;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const buffer = typeof data === "string" ? Buffer.from(data, "utf-8") : Buffer.from(data);

  const client = getClient();
  if (client && ENV.s3BucketName) {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: ENV.s3BucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      return { key, url: `/storage/${key}` };
    } catch (err) {
      console.warn("[Storage] S3 PutObject failed, falling back to database storage:", err);
    }
  }

  // Fallback to database storage
  await db.saveStoredFile(key, buffer.toString("base64"), contentType, buffer.length);
  return { key, url: `/storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const client = getClient();
  const key = normalizeKey(relKey);
  if (!client || !ENV.s3BucketName) {
    return `/storage/${key}`;
  }
  return getSignedUrl(client, new GetObjectCommand({ Bucket: ENV.s3BucketName, Key: key }), { expiresIn: 300 });
}

