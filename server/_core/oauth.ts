import type { Express } from "express";
/** Old bookmarks must never start an external identity-provider flow. */
export function registerOAuthRoutes(app: Express) {
  for (const path of [
    "/api/oauth/start",
    "/api/oauth/callback",
    "/api/oauth/logout",
  ]) {
    app.all(path, (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res
        .status(410)
        .json({
          error: "Google sign-in has been removed. Use the local password.",
        });
    });
  }
}
