import { describe, it, expect } from "vitest";
import { extractPrcFields, parseDateString, isValidCalendarDate } from "./prcExtraction";

describe("PRC OCR Text Extraction (T1)", () => {
  it("extracts fields from clear OCR text", () => {
    const text = `
      PROFESSIONAL REGULATION COMMISSION
      PROFESSIONAL IDENTIFICATION CARD
      REGISTRATION NO. 0123456
      NAME: SANTOS, MARIA CLARA
      PROFESSION: REGISTERED NURSE
      DATE OF REGISTRATION: OCTOBER 24, 2018
      VALID UNTIL: 10/24/2021
    `;
    const res = extractPrcFields(text);
    expect(res.licenseNumber).toBe("0123456");
    expect(res.issueDate).toBe("2018-10-24");
    expect(res.expiryDate).toBe("2021-10-24");
  });

  it("strictly preserves leading zeros in license numbers", () => {
    const text = `
      REG. NO.: 0045678
      REG. DATE: 05/15/2020
      VALID UNTIL: 05/15/2023
    `;
    const res = extractPrcFields(text);
    expect(res.licenseNumber).toBe("0045678");
    expect(res.licenseNumber?.startsWith("00")).toBe(true);
    expect(res.issueDate).toBe("2020-05-15");
    expect(res.expiryDate).toBe("2023-05-15");
  });

  it("handles number and date split across consecutive lines", () => {
    const text = `
      Registration No.
      0765432
      Date of Registration
      11/02/2019
      Valid Until
      11/02/2022
    `;
    const res = extractPrcFields(text);
    expect(res.licenseNumber).toBe("0765432");
    expect(res.issueDate).toBe("2019-11-02");
    expect(res.expiryDate).toBe("2022-11-02");
  });

  it("leaves missing fields unresolved and NEVER infers expiry dates", () => {
    const text = `
      REGISTRATION NO. 0987654
      DATE OF REGISTRATION: 01/10/2022
    `;
    const res = extractPrcFields(text);
    expect(res.licenseNumber).toBe("0987654");
    expect(res.issueDate).toBe("2022-01-10");
    // MUST NOT infer 2025-01-10 (no +3 year inference)
    expect(res.expiryDate).toBeUndefined();
  });

  it("leaves ambiguous dates unresolved", () => {
    const text = `
      REGISTRATION NO. 0123456
      RANDOM TEXT WITHOUT PROPER DATE FORMAT 99/99/9999
    `;
    const res = extractPrcFields(text);
    expect(res.licenseNumber).toBe("0123456");
    expect(res.issueDate).toBeUndefined();
    expect(res.expiryDate).toBeUndefined();
  });

  it("handles unreadable or gibberish OCR text gracefully", () => {
    const gibberish = "###@@!?? xxxxx qqq 1234 --- ~~~~";
    const res = extractPrcFields(gibberish);
    expect(res.licenseNumber).toBeUndefined();
    expect(res.issueDate).toBeUndefined();
    expect(res.expiryDate).toBeUndefined();
    expect(res.rawText).toBe(gibberish);
  });

  it("handles empty or whitespace-only OCR text", () => {
    const res = extractPrcFields("   \n\t  ");
    expect(res.licenseNumber).toBeUndefined();
    expect(res.issueDate).toBeUndefined();
    expect(res.expiryDate).toBeUndefined();
  });

  it("validates calendar boundaries properly", () => {
    expect(isValidCalendarDate(2020, 2, 29)).toBe(true); // leap year
    expect(isValidCalendarDate(2021, 2, 29)).toBe(false); // non-leap year
    expect(isValidCalendarDate(2021, 4, 31)).toBe(false); // April has 30 days
    expect(isValidCalendarDate(2021, 13, 1)).toBe(false); // month 13
    expect(isValidCalendarDate(1900, 1, 1)).toBe(false); // year out of range
  });

  it("parses multiple date formats into standard YYYY-MM-DD", () => {
    expect(parseDateString("Issued: JANUARY 5, 2023")).toBe("2023-01-05");
    expect(parseDateString("Expires: 15 AUG 2026")).toBe("2026-08-15");
    expect(parseDateString("Date: 12/31/2024")).toBe("2024-12-31");
    expect(parseDateString("Invalid 02/30/2023")).toBeUndefined();
  });

  it("respects label boundaries on the same line without assigning expiry to issue date (F5)", () => {
    const text = "Date Issued: OCTOBER 24, 2024 Valid Until: OCTOBER 24, 2027";
    const res = extractPrcFields(text);
    expect(res.issueDate).toBe("2024-10-24");
    expect(res.expiryDate).toBe("2027-10-24");
  });

  it("never crosses another label on the next line when a field is missing (F5)", () => {
    const text = `
      Date of Registration
      Valid Until: OCTOBER 24, 2027
    `;
    const res = extractPrcFields(text);
    expect(res.issueDate).toBeUndefined();
    expect(res.expiryDate).toBe("2027-10-24");
  });

  it("leaves conflicting dates unresolved for manual review when issue date is after expiry date (F5)", () => {
    const text = "Date Issued: OCTOBER 24, 2027 Valid Until: OCTOBER 24, 2024";
    const res = extractPrcFields(text);
    expect(res.issueDate).toBeUndefined();
    expect(res.expiryDate).toBeUndefined();
  });
});

