import os
import subprocess
import json
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

pdf_path = os.path.join("scripts", "test_sample_lab.pdf")
c = canvas.Canvas(pdf_path, pagesize=letter)

# Header
c.setFont("Helvetica-Bold", 14)
c.drawString(50, 750, "Southern Philippines Medical Center")
c.setFont("Helvetica", 10)
c.drawString(50, 735, "Organ Transplant Services - Clinical Laboratory Report")
c.drawString(50, 715, "Date Collected: 2026-09-22")
c.drawString(50, 700, "Patient: Santos, Maria  HRN: REC-002  Age: 42  Sex: F")

# Table Header
c.setFont("Helvetica-Bold", 10)
c.drawString(50, 660, "Test Description")
c.drawString(240, 660, "Result")
c.drawString(320, 660, "Unit")
c.drawString(400, 660, "Reference Range")
c.line(50, 655, 550, 655)

# Rows
c.setFont("Helvetica", 10)
rows = [
    ("Hemoglobin (Hgb)", "128", "g/L", "120 - 150"),
    ("White Blood Cell (WBC)", "6.8", "x10^9/L", "4.5 - 11.0"),
    ("Platelet count", "245", "x10^9/L", "150 - 450"),
    ("Serum Creatinine", "88.0", "umol/L", "50 - 110"),
    ("Blood Urea Nitrogen (BUN)", "4.8", "mmol/L", "2.5 - 7.1"),
    ("Fasting Blood Sugar (FBS)", "5.2", "mmol/L", "3.9 - 6.1"),
    ("Tacrolimus trough level (FK506)", "8.4", "ng/mL", "5.0 - 10.0"),
    ("Total Cholesterol", "4.6", "mmol/L", "< 5.2"),
    ("Triglycerides", "1.5", "mmol/L", "< 1.7"),
]

y = 635
for name, val, unit, ref in rows:
    c.drawString(50, y, name)
    c.drawString(240, y, val)
    c.drawString(320, y, unit)
    c.drawString(400, y, ref)
    y -= 25

c.save()
print(f"Generated {pdf_path}")

out = subprocess.check_output(["python", "scripts/parse_lab_ocr.py", pdf_path])
res = json.loads(out)
print("SUCCESS:", res.get("success"))
print("DETECTED_DATE:", res.get("detectedDate"))
print("EXTRACTED_COUNT:", res.get("extractedCount"))
for t in res.get("tests", []):
    print(f"  {t['testName']}: {t['value']} {t['unit']}")
