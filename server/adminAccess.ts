export const FULL_ACCESS_EMAILS = [
  "nncluster@spmcdvo.net",
  "share@spmcdvo.net",
  "almanalaysay93@gmail.com",
] as const;

export function hasFullAccess(email: string | null | undefined): boolean {
  if (process.env.KTP_LOCAL_MODE === "1")
    return email?.trim().toLowerCase() === "local.admin@localhost";
  return FULL_ACCESS_EMAILS.some(
    allowed => allowed === email?.trim().toLowerCase()
  );
}

export function roleForEmail(
  email: string | null | undefined
): "admin" | "user" {
  return hasFullAccess(email) ? "admin" : "user";
}
