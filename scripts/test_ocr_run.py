from PIL import Image, ImageDraw
import subprocess
import json
import os

# Create a clean test image simulating a lab sheet
img = Image.new("RGB", (800, 600), color=(255, 255, 255))
d = ImageDraw.Draw(img)

# Draw simulated lab results
d.text((50, 40), "Southern Philippines Medical Center - Kidney Transplant Unit", fill=(0, 0, 0))
d.text((50, 70), "Date Collected: 2026-09-20", fill=(0, 0, 0))
d.text((50, 100), "Patient: Dela Cruz, Juan  HRN: REC-001", fill=(0, 0, 0))
d.text((50, 150), "TEST NAME                  RESULT       UNIT        REFERENCE", fill=(0, 0, 0))
d.text((50, 190), "Serum Creatinine           92.5         umol/L      (60-110)", fill=(0, 0, 0))
d.text((50, 230), "Tacrolimus trough          7.8          ng/mL       (5.0-10.0)", fill=(0, 0, 0))
d.text((50, 270), "Blood Urea Nitrogen BUN    5.4          mmol/L      (2.5-7.1)", fill=(0, 0, 0))
d.text((50, 310), "Sodium                     139          mmol/L      (135-145)", fill=(0, 0, 0))
d.text((50, 350), "Potassium                  4.2          mmol/L      (3.5-5.0)", fill=(0, 0, 0))
d.text((50, 390), "ALT SGPT                   28           U/L         (<41)", fill=(0, 0, 0))

test_img_path = os.path.join("scripts", "test_sample_lab.png")
img.save(test_img_path)

out = subprocess.check_output(["python", "scripts/parse_lab_ocr.py", test_img_path])
res = json.loads(out)
print("SUCCESS:", res.get("success"))
print("DETECTED_DATE:", res.get("detectedDate"))
print("EXTRACTED_COUNT:", res.get("extractedCount"))
for t in res.get("tests", []):
    print(f"  {t['testName']}: {t['value']} {t['unit']}")
