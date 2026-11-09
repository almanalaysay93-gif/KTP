import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
const { isAllowedUrl } = createRequire(import.meta.url)(
  "../src/desktop/policy.cjs"
);
const origin = "http://127.0.0.1:31234";
describe("desktop local network boundary", () => {
  it("allows only its own service and internal document resources", () => {
    for (const url of [
      origin + "/login",
      origin + "/api/trpc/auth.me",
      "about:blank",
      "about:srcdoc",
      "data:text/html,Loading",
      "blob:" + origin + "/fixture",
    ]) {
      expect(isAllowedUrl(url, origin)).toBe(true);
    }
  });
  it("blocks remote pages, other local services, files and deceptive URLs", () => {
    for (const url of [
      "https://accounts.google.com",
      "https://supabase.com",
      "http://127.0.0.1:31235",
      "http://localhost:31234",
      "https://127.0.0.1:31234",
      "file:///etc/passwd",
      "javascript:alert(1)",
      origin + "@attacker.invalid",
      "http://secret@127.0.0.1:31234/",
      "blob:https://attacker.invalid/fixture",
      "not a url",
    ]) {
      expect(isAllowedUrl(url, origin)).toBe(false);
    }
    expect(isAllowedUrl(origin + "/login", undefined)).toBe(false);
  });
});
