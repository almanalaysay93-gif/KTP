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

interface LabelToken {
  type: "license" | "issue" | "expiry";
  start: number;
  end: number;
}

const REG_NO_LABEL_REGEX = /(?:registration\s*(?:no|number|num)\.?|reg\.?\s*(?:no|num|number)\.?|lic(?:ense)?\s*(?:no|num|number)?\.?|prc\s*(?:no|num)?\.?|registration[:\s-])[:\s-]*/i;
const ISSUE_DATE_LABEL_REGEX = /(?:date\s+of\s+registration|registration\s+date|reg\.?\s+date|date\s+issued|issue\s+date|\bissued\b)[:\s-]*/i;
const EXPIRY_DATE_LABEL_REGEX = /(?:valid\s+until|valid\s+thru|valid\s+through|expiration\s+date|expiry\s+date|exp\.?\s+date|\bexpires\b)[:\s-]*/i;

function findLabelsInLine(line: string): LabelToken[] {
  const tokens: LabelToken[] = [];

  const search = (regex: RegExp, type: "license" | "issue" | "expiry") => {
    const r = new RegExp(regex.source, "gi");
    let match;
    while ((match = r.exec(line)) !== null) {
      tokens.push({ type, start: match.index, end: match.index + match[0].length });
    }
  };

  search(REG_NO_LABEL_REGEX, "license");
  search(ISSUE_DATE_LABEL_REGEX, "issue");
  search(EXPIRY_DATE_LABEL_REGEX, "expiry");

  // Sort by start index
  tokens.sort((a, b) => a.start - b.start);

  // Filter overlapping tokens (keep earliest/longest)
  const nonOverlapping: LabelToken[] = [];
  let lastEnd = -1;
  for (const t of tokens) {
    if (t.start >= lastEnd) {
      nonOverlapping.push(t);
      lastEnd = t.end;
    }
  }
  return nonOverlapping;
}

/**
 * Extract PRC fields from raw OCR text with strict label boundary parsing.
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const labels = findLabelsInLine(line);

    for (let j = 0; j < labels.length; j++) {
      const label = labels[j];
      const nextLabel = labels[j + 1];
      // Slice text belonging strictly between this label and the next label on the same line
      const sameLineText = line.slice(label.end, nextLabel ? nextLabel.start : line.length).trim();

      if (label.type === "license" && !licenseNumber) {
        if (sameLineText) {
          const match = sameLineText.match(/\b([0-9]{6,8})\b/);
          if (match) licenseNumber = match[1];
        } else if (i + 1 < lines.length) {
          // Only check next line if next line has no label of its own (never cross labels)
          const nextLineLabels = findLabelsInLine(lines[i + 1]);
          if (nextLineLabels.length === 0) {
            const nextMatch = lines[i + 1].match(/\b([0-9]{6,8})\b/);
            if (nextMatch) licenseNumber = nextMatch[1];
          }
        }
      }

      if (label.type === "issue" && !issueDate) {
        if (sameLineText) {
          const parsed = parseDateString(sameLineText);
          if (parsed) issueDate = parsed;
        } else if (i + 1 < lines.length) {
          // Never cross into another label on the next line
          const nextLineLabels = findLabelsInLine(lines[i + 1]);
          if (nextLineLabels.length === 0) {
            const nextParsed = parseDateString(lines[i + 1]);
            if (nextParsed) issueDate = nextParsed;
          }
        }
      }

      if (label.type === "expiry" && !expiryDate) {
        if (sameLineText) {
          const parsed = parseDateString(sameLineText);
          if (parsed) expiryDate = parsed;
        } else if (i + 1 < lines.length) {
          // Never cross into another label on the next line
          const nextLineLabels = findLabelsInLine(lines[i + 1]);
          if (nextLineLabels.length === 0) {
            const nextParsed = parseDateString(lines[i + 1]);
            if (nextParsed) expiryDate = nextParsed;
          }
        }
      }
    }
  }

  // Conflicting dates resolution: if issue date is after expiry date, leave unresolved for review
  if (issueDate && expiryDate && issueDate > expiryDate) {
    issueDate = undefined;
    expiryDate = undefined;
  }

  return {
    licenseNumber,
    issueDate,
    expiryDate,
    rawText,
  };
}
