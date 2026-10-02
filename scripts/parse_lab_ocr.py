#!/usr/bin/env python3
"""
Laboratory Report OCR and PDF Parser for KTP.
Extracts lab tests, values, units, and dates from medical PDF reports and scanned images.
Maps detected values to KTP labTests catalog.
"""

import sys
import os
import json
import re
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple

# KTP Lab Catalog definition
CATALOG_TESTS = [
    {"id": 1, "name": "Hemoglobin", "unit": "g/L", "patterns": [r"hemoglobin", r"\bhgb\b", r"\bhb\b"]},
    {"id": 2, "name": "WBC", "unit": "x10^9/L", "patterns": [r"\bwbc\b", r"white blood", r"leukocyte", r"w\.b\.c"]},
    {"id": 3, "name": "Platelets", "unit": "x10^9/L", "patterns": [r"platelet", r"\bplt\b"]},
    {"id": 4, "name": "Creatinine", "unit": "umol/L", "patterns": [r"creatinine", r"\bcrea\b", r"serum creatinine"]},
    {"id": 5, "name": "BUN", "unit": "mmol/L", "patterns": [r"\bbun\b", r"blood urea nitrogen", r"\burea\b"]},
    {"id": 6, "name": "FBS", "unit": "mmol/L", "patterns": [r"\bfbs\b", r"fasting blood sugar", r"fasting glucose", r"\bglucose\b"]},
    {"id": 7, "name": "Sodium", "unit": "mmol/L", "patterns": [r"\bsodium\b", r"\bna\b", r"serum sodium", r"wnipos"]},
    {"id": 8, "name": "Potassium", "unit": "mmol/L", "patterns": [r"\bpotassium\b", r"\bk\b", r"serum potassium"]},
    {"id": 9, "name": "ALT (SGPT)", "unit": "U/L", "patterns": [r"\balt\b", r"\bsgpt\b", r"alanine aminotransferase"]},
    {"id": 10, "name": "Tacrolimus trough", "unit": "ng/mL", "patterns": [r"tacrolimus", r"\btacro\b", r"fk-?506", r"prograf", r"advagraf"]},
    {"id": 11, "name": "Total cholesterol", "unit": "mmol/L", "patterns": [r"total cholesterol", r"\bcholesterol\b", r"\bchol\b"]},
    {"id": 12, "name": "Triglycerides", "unit": "mmol/L", "patterns": [r"triglyceride", r"\btrig\b", r"\btg\b"]},
    {"id": 13, "name": "HDL", "unit": "mmol/L", "patterns": [r"\bhdl\b", r"hdl cholesterol", r"hdl-c"]},
    {"id": 14, "name": "LDL", "unit": "mmol/L", "patterns": [r"\bldl\b", r"ldl cholesterol", r"ldl-c"]},
    {"id": 15, "name": "CMV PCR", "unit": "IU/mL", "patterns": [r"cmv pcr", r"cmv dna", r"cytomegalovirus pcr", r"cmv quantitative"]},
]

def extract_text_from_excel(filepath: str) -> Tuple[str, List[str]]:
    """Extract text from Excel workbook (.xlsx, .xls) or CSV using openpyxl or csv."""
    lines = []
    full_text = ""
    ext = os.path.splitext(filepath)[1].lower()
    if ext == ".csv":
        import csv
        try:
            with open(filepath, mode="r", encoding="utf-8-sig", errors="replace") as f:
                reader = csv.reader(f)
                for row in reader:
                    row_vals = [str(c).strip() for c in row if c and str(c).strip()]
                    if row_vals:
                        line = "   ".join(row_vals)
                        lines.append(line)
                        full_text += line + "\n"
        except Exception as e:
            sys.stderr.write(f"[CSV Extract Error] {e}\n")
        return full_text, lines

    try:
        import openpyxl
        wb = openpyxl.load_workbook(filepath, data_only=True)
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            for row in ws.iter_rows(values_only=True):
                row_vals = [str(c).strip() for c in row if c is not None and str(c).strip() != ""]
                if row_vals:
                    line = "   ".join(row_vals)
                    lines.append(line)
                    full_text += line + "\n"
    except Exception as e:
        sys.stderr.write(f"[Excel Extract Error] {e}\n")
    return full_text, lines

def extract_text_from_pdf(filepath: str) -> Tuple[str, List[str]]:
    """Extract text from digital PDF using pypdf."""
    lines = []
    full_text = ""
    try:
        import pypdf
        reader = pypdf.PdfReader(filepath)
        for page in reader.pages:
            text = page.extract_text() or ""
            full_text += text + "\n"
            for line in text.split("\n"):
                cleaned = line.strip()
                if cleaned:
                    lines.append(cleaned)
    except Exception as e:
        sys.stderr.write(f"[PDF Extract Error] {e}\n")
    return full_text, lines

def extract_text_with_ocr(filepath: str) -> List[str]:
    """Extract text lines using RapidOCR with 2D horizontal line clustering."""
    lines = []
    try:
        from rapidocr_onnxruntime import RapidOCR
        engine = RapidOCR()
        result, _ = engine(filepath)
        if not result:
            return lines

        raw_lines = []
        for box, text, score in result:
            if not text or not str(text).strip():
                continue
            yc = (box[0][1] + box[2][1]) / 2.0
            xl = box[0][0]
            matched = False
            for r_line in raw_lines:
                if abs(r_line["yc"] - yc) < 14:
                    r_line["tokens"].append((xl, str(text).strip()))
                    r_line["yc"] = (r_line["yc"] + yc) / 2.0
                    matched = True
                    break
            if not matched:
                raw_lines.append({"yc": yc, "tokens": [(xl, str(text).strip())]})

        raw_lines.sort(key=lambda l: l["yc"])

        for r_line in raw_lines:
            r_line["tokens"].sort(key=lambda t: t[0])
            line_str = " ".join(t[1] for t in r_line["tokens"])
            if line_str.strip():
                lines.append(line_str.strip())
    except Exception as e:
        sys.stderr.write(f"[OCR Error] {e}\n")
    return lines

def parse_date(text: str) -> Optional[str]:
    """Detect collection or service date from text."""
    date_patterns = [
        # YYYY-MM-DD
        r"\b(20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b",
        # MM/DD/YYYY
        r"\b(0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])[-/](20\d{2})\b",
        # DD-Mon-YYYY (e.g. 20-Sep-2026)
        r"\b(0[1-9]|[12]\d|3[01])[-/\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/\s](20\d{2})\b",
    ]

    date_context_regex = re.compile(r"(?:date|collected|drawn|reported|sampled)[:\s]+([^\n\r,]+)", re.IGNORECASE)
    matches = date_context_regex.findall(text)
    candidate_strings = matches if matches else [text]

    month_map = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
    }

    for c_str in candidate_strings:
        for p in date_patterns:
            m = re.search(p, c_str, re.IGNORECASE)
            if m:
                groups = m.groups()
                try:
                    if len(groups) == 3:
                        if len(groups[0]) == 4:
                            y, m_val, d = int(groups[0]), int(groups[1]), int(groups[2])
                        elif groups[1].lower()[:3] in month_map:
                            d, m_val, y = int(groups[0]), month_map[groups[1].lower()[:3]], int(groups[2])
                        else:
                            m_val, d, y = int(groups[0]), int(groups[1]), int(groups[2])
                        return f"{y:04d}-{m_val:02d}-{d:02d}"
                except Exception:
                    continue
    return None

def strip_known_noise(text: str) -> str:
    """Remove known noise strings like FK506 or 10^9 that contain numbers."""
    cleaned = re.sub(r"fk-?506", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"10\^9", "", cleaned)
    cleaned = re.sub(r"\bx10\^9/l\b", "", cleaned, flags=re.IGNORECASE)
    return cleaned

def parse_lab_lines(lines: List[str]) -> List[Dict[str, Any]]:
    """Parse text lines and extract matched catalog tests with values."""
    results = []
    seen_test_ids = set()
    val_regex = re.compile(r"([0-9]+(?:\.[0-9]+)?)")
    num_only_line_regex = re.compile(r"^[<>≤≥]?\s*([0-9]+(?:\.[0-9]+)?)$")

    for i, line in enumerate(lines):
        lower_line = line.lower()
        for test in CATALOG_TESTS:
            test_id = test["id"]
            if test_id in seen_test_ids:
                continue

            matched = False
            match_end = -1
            for pat in test["patterns"]:
                m = re.search(pat, lower_line)
                if m:
                    matched = True
                    match_end = max(match_end, m.end())

            if not matched:
                continue

            # Strategy A: Check same-line value (after test name)
            cleaned_line = strip_known_noise(line)
            sub_line = cleaned_line[match_end:] if match_end > 0 and match_end < len(cleaned_line) else cleaned_line
            numbers = val_regex.findall(sub_line)

            num_str = None
            if numbers:
                num_str = numbers[0].strip()
            else:
                # Strategy B: Check consecutive next lines (digital PDF table format)
                for offset in range(1, 4):
                    if i + offset < len(lines):
                        cand = lines[i + offset].strip()
                        m_num = num_only_line_regex.search(cand)
                        if m_num:
                            num_str = m_num.group(1).strip()
                            break

            if not num_str:
                continue

            try:
                val_float = float(num_str)
            except ValueError:
                continue

            unit = test["unit"]
            # Check for unit on same line or next line
            context_text = lower_line + " " + (lines[i+1].lower() if i+1 < len(lines) else "")

            # If Creatinine in mg/dL, convert to umol/L (multiply by 88.4)
            if test_id == 4 and "mg/dl" in context_text:
                val_float = round(val_float * 88.4, 1)
                val_str = str(val_float)
            # If FBS in mg/dL, convert to mmol/L (divide by 18.018)
            elif test_id == 6 and "mg/dl" in context_text:
                val_float = round(val_float / 18.018, 2)
                val_str = str(val_float)
            # If BUN in mg/dL, convert to mmol/L (divide by 2.8)
            elif test_id == 5 and "mg/dl" in context_text:
                val_float = round(val_float / 2.8, 2)
                val_str = str(val_float)
            else:
                val_str = str(val_float) if "." in num_str else str(int(val_float))

            seen_test_ids.add(test_id)
            results.append({
                "labTestId": test_id,
                "testName": test["name"],
                "value": val_str,
                "unit": unit,
                "rawText": line[:120],
                "confidence": 0.95
            })
            break

    results.sort(key=lambda x: x["labTestId"])
    return results

def process_document(filepath: str) -> Dict[str, Any]:
    """Inspect and extract lab data from file."""
    if not os.path.exists(filepath):
        return {"success": False, "error": f"File not found: {filepath}"}

    ext = os.path.splitext(filepath)[1].lower()
    full_text = ""
    lines = []

    if ext in [".xlsx", ".xls", ".csv"]:
        full_text, lines = extract_text_from_excel(filepath)
    elif ext == ".pdf":
        full_text, lines = extract_text_from_pdf(filepath)
        if len(full_text.strip()) < 30:
            lines = extract_text_with_ocr(filepath)
            full_text = "\n".join(lines)
    else:
        # Image file
        lines = extract_text_with_ocr(filepath)
        full_text = "\n".join(lines)

    if not lines:
        return {
            "success": True,
            "detectedDate": None,
            "tests": [],
            "message": "No text detected in document"
        }

    detected_date = parse_date(full_text)
    tests = parse_lab_lines(lines)

    return {
        "success": True,
        "detectedDate": detected_date,
        "tests": tests,
        "lineCount": len(lines),
        "extractedCount": len(tests)
    }

def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: python parse_lab_ocr.py <path_to_lab_report>\n")
        sys.exit(1)

    filepath = sys.argv[1]
    res = process_document(filepath)
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    main()
