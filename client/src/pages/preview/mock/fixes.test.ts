import { describe, expect, it } from "vitest";
import { initialsOf, SIZES, PAIR_OVERLAPS, PAIR_BADGES } from "@/components/clay/ClayAvatar";

describe("U8 preview fixes verification", () => {
  describe("initialsOf", () => {
    it("derives initials for comma-formatted names", () => {
      expect(initialsOf("Villacorta, Analyn F.")).toBe("AV");
      expect(initialsOf("Villacorta, Ramil M.")).toBe("RV");
      expect(initialsOf("Dela Cruz, Juan")).toBe("JD");
    });

    it("derives initials for standard first last names", () => {
      expect(initialsOf("Analyn Villacorta")).toBe("AV");
      expect(initialsOf("Lorna Santos")).toBe("LS");
    });

    it("handles single name and empty string", () => {
      expect(initialsOf("Lorna")).toBe("L");
      expect(initialsOf("")).toBe("");
      expect(initialsOf("   ")).toBe("");
    });
  });

  describe("ClayAvatar sizing and overlap", () => {
    it("uses tight tracking on compact sizes to fit initials without clipping", () => {
      expect(SIZES[32]).toContain("text-[11px]");
      expect(SIZES[32]).toContain("tracking-tight");
      expect(SIZES[40]).toContain("text-[13px]");
      expect(SIZES[40]).toContain("tracking-tight");
    });

    it("uses proportional size-aware overlap in avatar pairs", () => {
      expect(PAIR_OVERLAPS[32]).toBe("-ml-1.5");
      expect(PAIR_OVERLAPS[40]).toBe("-ml-2");
      expect(PAIR_OVERLAPS[56]).toBe("-ml-2.5");
      expect(PAIR_OVERLAPS[72]).toBe("-ml-3");
    });

    it("scales exchange badge dimensions with avatar size", () => {
      expect(PAIR_BADGES[32].badge).toContain("size-4");
      expect(PAIR_BADGES[40].badge).toContain("size-5");
      expect(PAIR_BADGES[56].badge).toContain("size-6");
      expect(PAIR_BADGES[72].badge).toContain("size-7");
    });
  });
});
