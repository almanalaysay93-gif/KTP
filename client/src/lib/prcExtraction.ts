/**
 * PRC ID card OCR text parsing and field extraction.
 *
 * Extracts:
 * - PRC license number (Registration No.) — preserves leading zeros.
 * - Issue date (Registration Date).
 * - Expiry date (Valid Until).
 *
 * Rules:
 * - Preserve leading zeros for license numbers.
 * - Never infer expiry dates (e.g. do not add 3 years to issue date).
 * - Leave ambiguous or missing values unresolved (undefined).
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export interface ExtractedPrcFields {
  licenseNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  rawText: string;
}

export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1950 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

export function formatYmd(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Attempt to parse a date string into YYYY-MM-DD.
 * Supports:
 * - Month DD, YYYY (e.g. "OCTOBER 24, 2018", "Oct 24 2018")
 * - DD Month YYYY (e.g. "24 OCTOBER 2018")
 * - MM/DD/YYYY or MM-DD-YYYY (e.g. "10/24/2018")
 * - YYYY-MM-DD or YYYY/MM/DD (e.g. "2018-10-24")
 */
export function parseDateString(text: string): string | undefined {
  if (!text) return undefined;
  const clean = text.trim();

  // Pattern 1: ISO YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = clean.match(/\b(19\d\d|20\d\d)[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) return formatYmd(y, m, d);
  }

  // Pattern 2: Month DD, YYYY (e.g. "OCTOBER 24, 2018", "OCT 24 2018")
  const monthNameMatch = clean.match(
    /\b([a-zA-Z]{3,9})\.?\s+(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?,?\s+(19\d\d|20\d\d)\b/i
  );
  if (monthNameMatch) {
    const mName = monthNameMatch[1].toLowerCase().replace(/\.$/, "");
    const m = MONTHS[mName];
    const d = parseInt(monthNameMatch[2], 10);
    const y = parseInt(monthNameMatch[3], 10);
    if (m && isValidCalendarDate(y, m, d)) return formatYmd(y, m, d);
  }

  // Pattern 3: DD Month YYYY (e.g. "24 OCTOBER 2018")
  const dayMonthMatch = clean.match(
    /\b(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\s+([a-zA-Z]{3,9})\.?,?\s+(19\d\d|20\d\d)\b/i
  );
  if (dayMonthMatch) {
    const d = parseInt(dayMonthMatch[1], 10);
    const mName = dayMonthMatch[2].toLowerCase().replace(/\.$/, "");
    const m = MONTHS[mName];
    const y = parseInt(dayMonthMatch[3], 10);
    if (m && isValidCalendarDate(y, m, d)) return formatYmd(y, m, d);
  }

  // Pattern 4: MM/DD/YYYY or MM-DD-YYYY
  const mdyMatch = clean.match(/\b(0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])[-/](19\d\d|20\d\d)\b/);
  if (mdyMatch) {
    const m = parseInt(mdyMatch[1], 10);
    const d = parseInt(mdyMatch[2], 10);
    const y = parseInt(mdyMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) return formatYmd(y, m, d);
  }

  return undefined;
}

const REG_NO_PATTERNS = [
  /(?:registration\s*(?:no|number|num)?\.?|reg\.?\s*(?:no|num|number)?\.?|lic(?:ense)?\.?\s*(?:no|num|number)?\.?|prc\s*(?:no|num)?\.?)[:\s-]*([0-9]{6,8})\b/i,
];

const ISSUE_DATE_KEYWORDS = [
  /date\s+of\s+registration/i,
  /registration\s+date/i,
  /reg\.?\s+date/i,
  /date\s+issued/i,
  /issue\s+date/i,
  /\bissued\b/i,
];

const EXPIRY_DATE_KEYWORDS = [
  /valid\s+until/i,
  /valid\s+thru/i,
  /valid\s+through/i,
  /expiration\s+date/i,
  /expiry\s+date/i,
  /exp\.?\s+date/i,
  /\bexpires\b/i,
];

/**
 * Extract PRC fields from raw OCR text.
 */
export function extractPrcFields(rawText: string): ExtractedPrcFields {
  if (!rawText || !rawText.trim()) {
    return { rawText: rawText ?? "" };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let licenseNumber: string | undefined;
  let issueDate: string | undefined;
  let expiryDate: string | undefined;

  // 1. Extract PRC License Number
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pat of REG_NO_PATTERNS) {
      const match = line.match(pat);
      if (match && match[1]) {
        licenseNumber = match[1];
        break;
      }
    }
    if (licenseNumber) break;

    // Check if label is on this line, and number is on next line
    if (/(?:registration\s*(?:no|number|num)?\.?|reg\.?\s*(?:no|num|number)?\.?|lic(?:ense)?\.?\s*(?:no|num|number)?\.?)[:\s]*$/i.test(line)) {
      if (i + 1 < lines.length) {
        const nextMatch = lines[i + 1].match(/\b([0-9]{6,8})\b/);
        if (nextMatch) {
          licenseNumber = nextMatch[1];
          break;
        }
      }
    }
  }

  // 2. Extract Issue Date
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isIssueKeyword = ISSUE_DATE_KEYWORDS.some((kw) => kw.test(line));
    if (isIssueKeyword) {
      // First look on the same line
      const parsed = parseDateString(line);
      if (parsed) {
        issueDate = parsed;
        break;
      }
      // If not on same line, look at the next line
      if (i + 1 < lines.length) {
        const nextParsed = parseDateString(lines[i + 1]);
        if (nextParsed) {
          issueDate = nextParsed;
          break;
        }
      }
    }
  }

  // 3. Extract Expiry Date (NEVER INFER)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isExpiryKeyword = EXPIRY_DATE_KEYWORDS.some((kw) => kw.test(line));
    if (isExpiryKeyword) {
      // First look on the same line
      const parsed = parseDateString(line);
      if (parsed) {
        expiryDate = parsed;
        break;
      }
      // If not on same line, look at the next line
      if (i + 1 < lines.length) {
        const nextParsed = parseDateString(lines[i + 1]);
        if (nextParsed) {
          expiryDate = nextParsed;
          break;
        }
      }
    }
  }

  return {
    licenseNumber,
    issueDate,
    expiryDate,
    rawText,
  };
}
