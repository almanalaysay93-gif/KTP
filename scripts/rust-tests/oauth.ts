import assert from "node:assert/strict";
/** Removed cloud sign-in routes must not redirect or contact a provider. */
export async function testOAuth(origin: string) {
  for (const route of ["start", "callback", "logout"]) {
    const response = await fetch(`${origin}/api/oauth/${route}`, { redirect: "manual" });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("location"), null);
  }
  console.log("PASS: removed Rust Google OAuth endpoints are unavailable");
}
