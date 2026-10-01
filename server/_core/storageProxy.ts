import type { Express } from "express"
import { storageGetSignedUrl } from "../storage"
import { ENV } from "./env"
import * as db from "../db"

export function registerStorageProxy(app: Express) {
  app.get("/storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0]
    if (!key) {
      res.status(400).send("Missing storage key")
      return
    }

    try {
      // 1. If S3 is configured, redirect to S3 signed URL
      if (ENV.s3BucketName) {
        const url = await storageGetSignedUrl(key)
        if (url !== `/storage/${key}`) {
          res.set("Cache-Control", "no-store")
          return res.redirect(307, url)
        }
      }

      // 2. Check database storage record
      const stored = await db.getStoredFileByStorageKey(key)
      if (stored) {
        res.setHeader("Content-Type", stored.fileType || "application/octet-stream")
        res.setHeader("Content-Length", stored.fileSize)
        res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800")
        return res.status(200).send()
      }

      res.status(404).send("File not found")
    } catch (err) {
      console.error("[StorageProxy] failed:", err)
      res.status(502).send("Storage proxy error")
    }
  })
}
