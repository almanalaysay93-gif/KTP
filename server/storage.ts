// File storage via a real S3 (or S3-compatible) bucket with automatic database fallback.
// When S3 is unconfigured or unavailable, files are persisted directly into the database.
import type { S3Client } from "@aws-sdk/client-s3";
import { ENV } from "./_core/env";
import * as db from "./db";

let _client: S3Client | null = null;

async function getClient(): Promise<S3Client | null> {
  if (!ENV.s3BucketName) {
    return null;
  }
  if (!_client) {
    const { S3Client: Client } = await import("@aws-sdk/client-s3");
    _client = new Client(ENV.s3Region ? { region: ENV.s3Region } : {});
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

  if (ENV.s3BucketName) {
    const client = await getClient();
    if (client) {
      try {
        const { PutObjectCommand } = await import("@aws-sdk/client-s3");
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
  }

  // Fallback to database metadata record
  await db.saveStoredFile({
    fileName: key.split("/").pop() || key,
    fileType: contentType,
    fileSize: buffer.length,
    storageKey: key,
  });
  return { key, url: `/storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  if (!ENV.s3BucketName) {
    return `/storage/${key}`;
  }
  const client = await getClient();
  if (!client) {
    return `/storage/${key}`;
  }
  const [{ GetObjectCommand }, { getSignedUrl }] = await Promise.all([
    import("@aws-sdk/client-s3"),
    import("@aws-sdk/s3-request-presigner"),
  ]);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: ENV.s3BucketName, Key: key }), { expiresIn: 300 });
}

export async function storageDelete(relKey: string | null | undefined): Promise<void> {
  if (!relKey) return;
  const key = normalizeKey(relKey);
  if (ENV.s3BucketName) {
    const client = await getClient();
    if (client) {
      try {
        const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        await client.send(
          new DeleteObjectCommand({
            Bucket: ENV.s3BucketName,
            Key: key,
          }),
        );
      } catch (err) {
        console.warn("[Storage] S3 DeleteObject failed:", err);
      }
    }
  }
  await db.deleteStoredFile(key);
}

