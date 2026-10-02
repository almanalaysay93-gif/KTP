#!/usr/bin/env python3
"""
Patient list reader for KTP.

Reads a patient list from an Excel workbook (.xlsx), a CSV file, a PDF with a text layer,
or plain text (.txt, for example the text that the browser reads from a photo).
Prints one JSON document: the patients that it found, with a warning for each guess.

The reader does not write to the database. The server checks each patient again
before a save.

Usage:
    python scripts/patient_list_reader.py <file>
    python scripts/patient_list_reader.py --stdin     (JSON on stdin: {"fileName": "...", "base64": "..."})

A photo (.png, .jpg) is read only when the optional package rapidocr_onnxruntime is installed.
"""

import base64
import csv
import io
import json
import os
import re
import sys
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

MAX_ROWS = 200

# Field name -> column headings that mean this field. Headings are compared after normalize().
ALIASES: Dict[str, List[str]] = {
    "hrn": ["hrn", "hospital record number", "hospital record no", "hospital number", "hospital no",
            "record number", "record no", "mrn", "patient number", "patient no", "case number", "case no"],
    "name": ["name", "patient name", "full name", "patient", "name of patient"],
    "lastName": ["last name", "lastname", "surname", "family name"],
    "firstName": ["first name", "firstname", "given name"],
    "middleName": ["middle name", "middlename", "middle initial", "mi", "m i"],
    "suffix": ["suffix", "name suffix", "ext", "name ext"],
    "patientType": ["type", "patient type", "category", "recipient donor", "recipient or donor", "r d"],
    "sex": ["sex", "gender"],
    "birthDate": ["birth date", "birthdate", "date of birth", "dob", "birthday", "bday"],
    "contactNumber": ["contact", "contact number", "contact no", "mobile", "mobile number", "mobile no",
                      "phone", "phone number", "cellphone", "cp number", "cp no", "tel", "telephone"],
    "accountEmail": ["email", "e mail", "gmail", "email address", "gmail account", "account email",
                     "enrolled gmail account"],
    "stage": ["stage", "clinical stage", "phase", "workup stage", "work up stage", "current stage"],
    "surgeryDate": ["transplant date", "date of transplant", "kt date", "date of kt", "surgery date",
                    "date of surgery", "donation date", "date of donation", "operation date"],
    "riskCategory": ["risk", "risk category", "cdte", "cdte risk", "immunologic risk"],
    "followupMonths": ["follow up", "followup", "follow up interval", "followup interval",
                       "follow up months", "followup months"],
    "status": ["status", "patient status"],
    "nephrologist": ["nephrologist", "attending nephrologist", "attending", "attending physician"],
    "fellow": ["fellow", "fellow in charge", "fic"],
    "linkedRecipientHrn": ["recipient hrn", "linked recipient", "linked recipient hrn", "hrn of recipient",
                           "recipient"],
}
HEADING_TO_FIELD = {heading: field for field, headings in ALIASES.items() for heading in headings}
OUTPUT_FIELDS = [field for field in ALIASES if field != "name"]

STAGES = {
    "orientation": "Orientation",
    "phase1": "Phase1", "phasei": "Phase1", "p1": "Phase1", "1": "Phase1", "phase1workup": "Phase1",
    "phase2": "Phase2", "phaseii": "Phase2", "p2": "Phase2", "2": "Phase2", "phase2workup": "Phase2",
    "clearances": "Clearances", "clearance": "Clearances",
    "philhealthz": "PhilHealthZ", "philhealth": "PhilHealthZ", "zbenefit": "PhilHealthZ",
    "zpackage": "PhilHealthZ", "philhealthzpackage": "PhilHealthZ", "philhealthzbenefit": "PhilHealthZ",
    "phase3": "Phase3", "phaseiii": "Phase3", "p3": "Phase3", "3": "Phase3", "phase3preadmission": "Phase3",
    "postkt": "PostKT", "posttransplant": "PostKT", "postkidneytransplant": "PostKT", "transplanted": "PostKT",
    "postdonation": "PostDonation", "postnephrectomy": "PostDonation", "donated": "PostDonation",
}
SUFFIXES = {"jr": "Jr.", "sr": "Sr.", "ii": "II", "iii": "III", "iv": "IV", "v": "V"}
MONTHS = {name: number for number, names in enumerate(
    [("jan", "january"), ("feb", "february"), ("mar", "march"), ("apr", "april"), ("may",), ("jun", "june"),
     ("jul", "july"), ("aug", "august"), ("sep", "sept", "september"), ("oct", "october"),
     ("nov", "november"), ("dec", "december")], start=1) for name in names}
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE = re.compile(r"(?:\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}")
HRN_TOKEN = re.compile(r"\b[A-Z]{0,4}-?\d[\d-]{3,}\b")


def normalize(text: Any) -> str:
    """Lower case, letters and digits only, single spaces."""
    return re.sub(r"[^a-z0-9]+", " ", str(text or "").lower()).strip()


def clean(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return re.sub(r"\s+", " ", str(value)).strip()


def iso(year: int, month: int, day: int) -> Optional[str]:
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def full_year(year: int) -> int:
    """A year with two digits: this century when that is not in the future, else the last century."""
    if year >= 100:
        return year
    year += 2000
    return year if year <= date.today().year + 1 else year - 100


def parse_date(value: Any, label: str, warnings: List[str]) -> str:
    """Returns YYYY-MM-DD, or the text as it is (with a warning) when the date is not clear."""
    if value is None or value == "":
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, (int, float)) and 10000 < float(value) < 80000:
        # Excel serial date.
        return (date(1899, 12, 30) + timedelta(days=int(value))).isoformat()
    text = clean(value)
    match = re.fullmatch(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?", text)
    if match:
        found = iso(int(match[1]), int(match[2]), int(match[3]))
        if found:
            return found
    match = re.fullmatch(r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})", text)
    if match:
        first, second, year = int(match[1]), int(match[2]), full_year(int(match[3]))
        if first > 12:
            found = iso(year, second, first)
        else:
            found = iso(year, first, second)
            if found and second <= 12 and first != second:
                warnings.append(f"{label} {text} was read as month/day/year.")
        if found:
            return found
    match = re.fullmatch(r"(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{2,4})", text)
    if match and match[2].lower() in MONTHS:
        found = iso(full_year(int(match[3])), MONTHS[match[2].lower()], int(match[1]))
        if found:
            return found
    match = re.fullmatch(r"([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})", text)
    if match and match[1].lower() in MONTHS:
        found = iso(full_year(int(match[3])), MONTHS[match[1].lower()], int(match[2]))
        if found:
            return found
    warnings.append(f"{label} \"{text}\" is not a date that the reader knows. Use YYYY-MM-DD.")
    return text


def split_name(text: str, warnings: List[str]) -> Dict[str, str]:
    """"Last, First M." or "First Last" into parts."""
    parts = {"lastName": "", "firstName": "", "middleName": "", "suffix": ""}
    text = clean(text)
    if not text:
        return parts
    if "," in text:
        last, rest = [piece.strip() for piece in text.split(",", 1)]
        tokens = rest.replace(",", " ").split()
    else:
        tokens = text.split()
        last = tokens.pop() if len(tokens) > 1 else ""
        if last and normalize(last) in SUFFIXES and len(tokens) > 1:
            parts["suffix"] = SUFFIXES[normalize(last)]
            last = tokens.pop()
        warnings.append(f"Name \"{text}\" has no comma. The last word was used as the last name.")
    kept = []
    for token in tokens:
        if normalize(token) in SUFFIXES and not parts["suffix"]:
            parts["suffix"] = SUFFIXES[normalize(token)]
        else:
            kept.append(token)
    last_tokens = last.split()
    if last_tokens and normalize(last_tokens[-1]) in SUFFIXES and len(last_tokens) > 1 and not parts["suffix"]:
        parts["suffix"] = SUFFIXES[normalize(last_tokens.pop())]
        last = " ".join(last_tokens)
    if len(kept) > 1 and re.fullmatch(r"[A-Za-z]\.?", kept[-1]):
        parts["middleName"] = kept.pop().rstrip(".")
    parts["lastName"] = last
    parts["firstName"] = " ".join(kept)
    return parts


def title_name(text: str) -> str:
    """ALL CAPITALS to Title Case. Text with lower case letters stays as it is."""
    return text.title() if text and text == text.upper() and any(c.isalpha() for c in text) else text


def finish(raw: Dict[str, Any], source_row: int) -> Optional[Dict[str, Any]]:
    """Normalizes one record. Returns None for a record with no HRN, no name, and no e-mail."""
    warnings: List[str] = []
    row: Dict[str, Any] = {field: "" for field in OUTPUT_FIELDS}
    name_parts = split_name(clean(raw.get("name")), warnings) if clean(raw.get("name")) else {}
    for field in ("lastName", "firstName", "middleName", "suffix"):
        row[field] = title_name(clean(raw.get(field)) or name_parts.get(field, ""))
    row["hrn"] = clean(raw.get("hrn"))
    row["accountEmail"] = clean(raw.get("accountEmail")).lower()
    if not (row["hrn"] or row["lastName"] or row["firstName"] or row["accountEmail"]):
        return None

    kind = normalize(raw.get("patientType"))
    row["linkedRecipientHrn"] = clean(raw.get("linkedRecipientHrn"))
    if kind.startswith("r") or "recipient" in kind:
        row["patientType"] = "Recipient"
    elif kind.startswith("d") or "donor" in kind:
        row["patientType"] = "Donor"
    elif kind:
        row["patientType"] = clean(raw.get("patientType"))
        warnings.append(f"Type \"{row['patientType']}\" is not Recipient or Donor.")
    elif row["linkedRecipientHrn"]:
        row["patientType"] = "Donor"
        warnings.append("No type. The patient has a linked recipient, so the type was set to Donor.")

    sex = normalize(raw.get("sex"))
    row["sex"] = "M" if sex in ("m", "male") else "F" if sex in ("f", "female") else ""
    if sex and not row["sex"]:
        warnings.append(f"Sex \"{clean(raw.get('sex'))}\" is not M or F.")

    row["birthDate"] = parse_date(raw.get("birthDate"), "Birth date", warnings)
    row["surgeryDate"] = parse_date(raw.get("surgeryDate"), "Surgery date", warnings)
    row["contactNumber"] = clean(raw.get("contactNumber"))

    stage_text = clean(raw.get("stage"))
    stage = STAGES.get(re.sub(r"[^a-z0-9]", "", stage_text.lower()), "")
    if stage == "PostKT" and row["patientType"] == "Donor":
        stage = "PostDonation"
    if stage_text and not stage:
        warnings.append(f"Stage \"{stage_text}\" is not a stage that the reader knows.")
    row["stage"] = stage or stage_text

    risk = normalize(raw.get("riskCategory"))
    row["riskCategory"] = "High" if risk.startswith("high") else "StandardLow" if risk and (
        "standard" in risk or "low" in risk) else ""
    if risk and not row["riskCategory"]:
        warnings.append(f"Risk \"{clean(raw.get('riskCategory'))}\" is not High, Standard, or Low.")

    months = re.search(r"[1-3]", clean(raw.get("followupMonths")))
    row["followupMonths"] = int(months.group()) if months else ""

    status = normalize(raw.get("status"))
    row["status"] = status.capitalize() if status in ("active", "inactive", "deceased", "transferred") else ""

    row["nephrologist"] = clean(raw.get("nephrologist"))
    row["fellow"] = clean(raw.get("fellow"))
    row["row"] = source_row
    row["warnings"] = warnings
    return row


def find_header(grid: List[List[Any]]) -> Optional[Tuple[int, Dict[int, str], List[str]]]:
    """The first row, in the first 20, with two or more known headings and an HRN or a name heading."""
    for index, cells in enumerate(grid[:20]):
        columns: Dict[int, str] = {}
        unknown: List[str] = []
        for position, cell in enumerate(cells):
            heading = normalize(cell)
            if not heading:
                continue
            field = HEADING_TO_FIELD.get(heading)
            if field and field not in columns.values():
                columns[position] = field
            else:
                unknown.append(clean(cell))
        fields = set(columns.values())
        if len(fields) >= 2 and fields & {"hrn", "name", "lastName"}:
            return index, columns, unknown
    return None


def rows_from_grid(grid: List[List[Any]], first_row_number: int = 1) -> Optional[Dict[str, Any]]:
    header = find_header(grid)
    if not header:
        return None
    index, columns, unknown = header
    rows = []
    for offset, cells in enumerate(grid[index + 1:], start=index + 1):
        raw = {field: cells[position] if position < len(cells) else None for position, field in columns.items()}
        row = finish(raw, first_row_number + offset)
        if row:
            rows.append(row)
    return {"rows": rows, "unmappedColumns": unknown}


def rows_from_labels(lines: List[str]) -> List[Dict[str, Any]]:
    """A form: one "Label: value" on each line. A second HRN line starts the next patient."""
    records: List[Tuple[int, Dict[str, Any]]] = []
    current: Dict[str, Any] = {}
    first_line = 1
    for number, line in enumerate(lines, start=1):
        match = re.match(r"\s*([^:]{2,40}):\s*(.+)$", line)
        field = HEADING_TO_FIELD.get(normalize(match[1])) if match else None
        if not field:
            continue
        if field in current and field in ("hrn", "name", "lastName"):
            records.append((first_line, current))
            current, first_line = {}, number
        if not current:
            first_line = number
        current[field] = match[2].strip()
    if current:
        records.append((first_line, current))
    rows = [finish(raw, number) for number, raw in records if len(raw) >= 2]
    return [row for row in rows if row]


def rows_from_loose_lines(lines: List[str]) -> List[Dict[str, Any]]:
    """Last resort for text from a photo: each line with a "Last, First" name and an HRN or an e-mail."""
    rows = []
    for number, line in enumerate(lines, start=1):
        email = EMAIL.search(line)
        rest = EMAIL.sub(" ", line)
        phone = PHONE.search(rest)
        rest = PHONE.sub(" ", rest)
        dates = re.findall(r"\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}", rest)
        for found in dates:
            rest = rest.replace(found, " ")
        hrn = HRN_TOKEN.search(rest)
        if hrn:
            rest = rest.replace(hrn.group(), " ", 1)
        name = re.search(r"([A-Za-z][A-Za-z .'-]+,\s*[A-Za-z][A-Za-z .'-]+)", rest)
        if not name or not (hrn or email):
            continue
        words = normalize(rest.replace(name.group(), " ")).split()
        raw = {
            "hrn": hrn.group() if hrn else "", "name": name.group(), "accountEmail": email.group() if email else "",
            "contactNumber": phone.group() if phone else "",
            "birthDate": dates[0] if dates else "", "surgeryDate": dates[1] if len(dates) > 1 else "",
            "patientType": "Donor" if "donor" in words else "Recipient" if "recipient" in words else "",
            "sex": "M" if ("m" in words or "male" in words) else "F" if ("f" in words or "female" in words) else "",
        }
        row = finish(raw, number)
        if row:
            row["warnings"].append("This line had no column headings. Check each field.")
            rows.append(row)
    return rows


def parse_text_lines(lines: List[str]) -> Dict[str, Any]:
    lines = [line.rstrip() for line in lines if line.strip()]
    grid = [[cell.strip() for cell in re.split(r"\t|\s*\|\s*|\s{2,}", line.strip())] for line in lines]
    table = rows_from_grid(grid)
    if table and table["rows"]:
        return table
    rows = rows_from_labels(lines) or rows_from_loose_lines(lines)
    return {"rows": rows, "unmappedColumns": []}


def read_xlsx(data: bytes) -> Dict[str, Any]:
    import openpyxl
    workbook = openpyxl.load_workbook(io.BytesIO(data), data_only=True, read_only=True)
    for sheet in workbook.worksheets:
        grid = [list(cells) for cells in sheet.iter_rows(values_only=True)]
        table = rows_from_grid(grid)
        if table:
            return table
    return {"rows": [], "unmappedColumns": []}


def read_csv(data: bytes) -> Dict[str, Any]:
    text = data.decode("utf-8-sig", errors="replace")
    try:
        dialect = csv.Sniffer().sniff(text[:4000], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    table = rows_from_grid(list(csv.reader(io.StringIO(text), dialect)))
    return table or {"rows": [], "unmappedColumns": []}


def read_pdf(data: bytes) -> Dict[str, Any]:
    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(data))
    lines: List[str] = []
    for page in reader.pages:
        try:
            text = page.extract_text(extraction_mode="layout") or ""
        except Exception:
            text = page.extract_text() or ""
        lines.extend(text.split("\n"))
    if not any(line.strip() for line in lines):
        return {"rows": [], "unmappedColumns": [], "error": "This PDF has no text layer. Upload a photo of the page, or the Excel file."}
    return parse_text_lines(lines)


def read_image(data: bytes, extension: str) -> Dict[str, Any]:
    try:
        from parse_lab_ocr import extract_text_with_ocr  # same folder: text lines from RapidOCR
        import rapidocr_onnxruntime  # noqa: F401
    except Exception:
        return {"rows": [], "unmappedColumns": [], "error": "This reader cannot read a photo. Send the text of the photo as a .txt file."}
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as handle:
        handle.write(data)
        path = handle.name
    try:
        return parse_text_lines(extract_text_with_ocr(path))
    finally:
        os.unlink(path)


def parse_bytes(data: bytes, file_name: str) -> Dict[str, Any]:
    """Reads one file. The result always has success, source, rows, unmappedColumns, and message or error."""
    extension = os.path.splitext(file_name)[1].lower()
    result: Dict[str, Any]
    try:
        if extension in (".xlsx", ".xlsm"):
            source, result = "excel", read_xlsx(data)
        elif extension == ".xls":
            source, result = "excel", {"rows": [], "unmappedColumns": [], "error": "Old Excel files (.xls) are not read. Save the file as .xlsx or .csv."}
        elif extension in (".csv", ".tsv"):
            source, result = "csv", read_csv(data)
        elif extension == ".pdf":
            source, result = "pdf", read_pdf(data)
        elif extension == ".txt":
            source, result = "text", parse_text_lines(data.decode("utf-8-sig", errors="replace").split("\n"))
        elif extension in (".png", ".jpg", ".jpeg", ".webp", ".bmp"):
            source, result = "image", read_image(data, extension)
        else:
            source, result = "unknown", {"rows": [], "unmappedColumns": [], "error": f"File type \"{extension or file_name}\" is not read. Use Excel (.xlsx), CSV, PDF, or a photo."}
    except Exception as error:  # A damaged file must give a message, not a crash.
        return {"success": False, "source": extension.lstrip("."), "rows": [], "unmappedColumns": [], "error": f"Could not read the file: {error}"}

    rows = result.get("rows", [])
    output: Dict[str, Any] = {
        "success": "error" not in result, "source": source, "rows": rows[:MAX_ROWS],
        "unmappedColumns": result.get("unmappedColumns", []),
    }
    if "error" in result:
        output["error"] = result["error"]
    elif not rows:
        output["message"] = "No patient was found. The file needs a heading row with HRN and the patient name."
    elif len(rows) > MAX_ROWS:
        output["message"] = f"The file has {len(rows)} patients. Only the first {MAX_ROWS} were read."
    else:
        output["message"] = f"{len(rows)} {'patient' if len(rows) == 1 else 'patients'} found."
    return output


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--stdin":
        request = json.loads(sys.stdin.read())
        data, file_name = base64.b64decode(request["base64"]), str(request["fileName"])
    elif len(sys.argv) == 2:
        file_name = sys.argv[1]
        with open(file_name, "rb") as handle:
            data = handle.read()
    else:
        sys.stderr.write(__doc__ or "")
        sys.exit(2)
    sys.stdout.write(json.dumps(parse_bytes(data, file_name), ensure_ascii=True))


if __name__ == "__main__":
    main()
