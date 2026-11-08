export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// Public Google OAuth web client. Token exchange still needs GOOGLE_CLIENT_SECRET
// for this same client. Skip the stale Manus/template id if it is still in Vercel env.
export const GOOGLE_OAUTH_CLIENT_ID =
  "565079022798-kqtsnn59fqb4s0umj4t9nq7dijb9ojrq.apps.googleusercontent.com";
const STALE_GOOGLE_CLIENT_ID_PREFIX = "226276580382-";

export function resolveGoogleClientId(
  ...candidates: Array<string | undefined | null>
): string {
  for (const raw of candidates) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    if (value.startsWith(STALE_GOOGLE_CLIENT_ID_PREFIX)) continue;
    return value;
  }
  return GOOGLE_OAUTH_CLIENT_ID;
}

// One-time nonce cookie that binds an OAuth login to the browser that started
// it. The `__Host-` prefix forces the cookie host-only (Secure, Path=/, no
// Domain), so a sibling *.manus.space site cannot plant a matching value in a
// victim's browser.
export const OAUTH_STATE_COOKIE = "__Host-oauth_state";
export const OAUTH_STATE_COOKIE_PLAIN = "oauth_state";

// `state` carries the callback redirect URI (used at token exchange) plus the
// CSRF nonce. Defined here so the client encoder and server decoder never drift.
export type OAuthState = { redirectUri: string; nonce?: string };

const toUrlSafeBase64 = (value: string): string =>
  value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const fromUrlSafeBase64 = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").replace(/ /g, "+");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return normalized + pad;
};

export const encodeOAuthState = (state: OAuthState): string =>
  toUrlSafeBase64(btoa(JSON.stringify(state)));

export const decodeOAuthState = (state: string): OAuthState => {
  let decoded: string;
  try {
    decoded = atob(fromUrlSafeBase64(state));
  } catch {
    // Malformed base64 (e.g. attacker-supplied garbage). Return no nonce so the
    // callback's CSRF guard rejects it with 403 — never throw, since the caller
    // runs outside the request handler's try/catch.
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
    // Legacy links: `state` was a bare base64(redirectUri) with no nonce.
  }
  return { redirectUri: decoded };
};
