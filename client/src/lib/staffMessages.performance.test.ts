import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  fileURLToPath(new URL("../pages/StaffMessages.tsx", import.meta.url)),
  "utf8",
);

describe("Staff Messages initial load", () => {
  it("does not fetch composer data until the compose dialog opens", () => {
    expect(pageSource).not.toContain("trpc.nurses.list.useQuery()");
    expect(pageSource).not.toContain("trpc.areas.list.useQuery()");
    expect(pageSource).toMatch(
      /trpc\.nurses\.initial\.useQuery\(undefined,\s*\{\s*enabled:\s*isComposeOpen,?\s*\}\)/,
    );
  });
});
