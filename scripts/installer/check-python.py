#!/usr/bin/env python3
"""Offline installer smoke test; fixtures contain no patient information.

Build: python.exe scripts/installer/check-python.py --embedded
Host OCR verification: python scripts/installer/check-python.py
"""

import argparse
import importlib.metadata
import importlib.util
import io
import json
from pathlib import Path
import socket
import struct
import sys
import tempfile
from unittest.mock import patch

sys.dont_write_bytecode = True


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def deny_network(*_args, **_kwargs):
    raise RuntimeError("Installer smoke tests must run without network access")


def load_script(directory, name):
    path = directory / (name + ".py")
    require(path.is_file(), "Missing application parser: " + name)
    spec = importlib.util.spec_from_file_location("installer_check_" + name, path)
    require(spec is not None and spec.loader is not None, "Cannot load parser: " + name)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def check_runtime(embedded):
    require(sys.version_info[:2] == (3, 12), "Expected Python 3.12")
    require(struct.calcsize("P") == 8, "Expected a 64-bit Python runtime")
    if embedded:
        require(sys.platform == "win32", "Embedded installer runtime must run on Windows")
        require(sys.version_info[:3] == (3, 12, 10), "Expected pinned CPython 3.12.10")
        require(sys.flags.isolated == 1, "Embedded runtime must keep _pth isolation enabled")
        runtime = Path(sys.executable).parent
        settings = (runtime / "python312._pth").read_text(encoding="utf-8")
        require("import site" in settings.splitlines(), "Embedded import site is disabled")
        require("Lib/site-packages" in settings.splitlines(), "Embedded site-packages path is missing")
        for name in ("msvcp140.dll", "vcruntime140.dll", "vcruntime140_1.dll"):
            require((runtime / name).is_file(), "Missing app-local MSVC library: " + name)
        for name, version in {
            "openpyxl": "3.1.5", "pypdf": "6.18.0", "rapidocr-onnxruntime": "1.4.4",
            "PyMuPDF": "1.26.6", "Pillow": "13.0.0", "msvc-runtime": "14.51.36231",
        }.items():
            require(importlib.metadata.version(name) == version, "Unexpected installed version: " + name)


def check_parsers(directory):
    import cv2
    import fitz
    import numpy as np
    import onnxruntime
    import openpyxl
    import pypdf
    from PIL import Image, ImageDraw, ImageFont
    import rapidocr_onnxruntime
    from rapidocr_onnxruntime import RapidOCR

    require(bool(cv2.__version__), "OpenCV native module could not be loaded")
    require("CPUExecutionProvider" in onnxruntime.get_available_providers(), "ONNX CPU provider is unavailable")
    models = Path(rapidocr_onnxruntime.__file__).parent / "models"
    for name in ("ch_PP-OCRv4_det_infer.onnx", "ch_PP-OCRv4_rec_infer.onnx", "ch_ppocr_mobile_v2.0_cls_infer.onnx"):
        path = models / name
        require(path.is_file() and path.stat().st_size > 100_000, "Missing bundled OCR model: " + name)
    engine = RapidOCR(intra_op_num_threads=1, inter_op_num_threads=1)
    image = Image.new("RGB", (1300, 350), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=44)
    for y, text in ((35, "SYNTHETIC INSTALLER TEST"), (120, "Creatinine 92.5 umol/L"), (210, "Sodium 139 mmol/L")):
        draw.text((45, y), text, font=font, fill="black")
    recognized, _ = engine(np.array(image))
    require(bool(recognized), "Offline OCR could not read the synthetic image")
    lines = [str(row[1]) for row in recognized]

    lab_parser = load_script(directory, "parse_lab_ocr")
    patient_parser = load_script(directory, "patient_list_reader")
    ocr_tests = lab_parser.parse_lab_lines(lines)
    require(any(row["labTestId"] == 4 and row["value"] == "92.5" for row in ocr_tests),
            "Synthetic OCR results did not reach the lab parser")

    workbook = openpyxl.Workbook()
    workbook.active.append(["HRN", "Last Name", "First Name", "Type"])
    workbook.active.append(["INSTALLER-001", "Fixture", "Synthetic", "Recipient"])
    buffer = io.BytesIO()
    workbook.save(buffer)
    imported = patient_parser.parse_bytes(buffer.getvalue(), "synthetic.xlsx")
    require(imported.get("success") and len(imported.get("rows", [])) == 1, "Synthetic spreadsheet import failed")
    require(imported["rows"][0]["hrn"] == "INSTALLER-001", "Spreadsheet columns were not mapped")
    csv_imported = patient_parser.parse_bytes(
        b"HRN,Last Name,First Name,Type\nINSTALLER-002,Fixture,Synthetic,Recipient\n", "synthetic.csv")
    require(csv_imported.get("success") and len(csv_imported.get("rows", [])) == 1, "Synthetic CSV import failed")

    with tempfile.TemporaryDirectory(prefix="ktp-installer-check-") as temporary:
        path = Path(temporary) / "synthetic.pdf"
        with fitz.open() as document:
            page = document.new_page()
            page.insert_text((72, 72), "SYNTHETIC INSTALLER TEST\nDate Collected: 2026-01-01\nCreatinine 92.5 umol/L\nSodium 139 mmol/L")
            document.save(path)
        reader = pypdf.PdfReader(path)
        require("Creatinine" in (reader.pages[0].extract_text() or ""), "Synthetic PDF text extraction failed")
        parsed = lab_parser.process_document(str(path))
        require(parsed.get("success") and any(row["labTestId"] == 4 and row["value"] == "92.5" for row in parsed.get("tests", [])),
                "Synthetic PDF lab parsing failed")

    return {"ocrModels": 3, "ocrLabResults": len(ocr_tests), "spreadsheetRows": 1, "csvRows": 1, "pdfLabResults": len(parsed["tests"])}


def main():
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument("--embedded", action="store_true", help="Require the pinned Windows embedded runtime")
    arguments.add_argument("--scripts-directory", type=Path, default=Path(__file__).resolve().parents[1])
    options = arguments.parse_args()
    check_runtime(options.embedded)
    # RapidOCR must use the models in its wheel, with no hidden first-run download.
    with patch.object(socket.socket, "connect", deny_network), patch.object(socket.socket, "connect_ex", deny_network), patch.object(socket, "create_connection", deny_network):
        results = check_parsers(options.scripts_directory.resolve())
    print(json.dumps({"success": True, "python": sys.version.split()[0], "offline": True, **results}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Portable Python verification failed: " + str(error), file=sys.stderr)
        sys.exit(1)
