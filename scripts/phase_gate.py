#!/usr/bin/env python3
"""Phase gate: a patient may not move to the next stage until the current stage is complete.

Reads the JSON written by scripts/export_gate_data.mjs (stdlib only, read-only).

  python scripts/phase_gate.py check   --input gate.json            # audit every patient
  python scripts/phase_gate.py advance --input gate.json --hrn KTP-MOCK-0007 --to Phase2

Exit codes: 0 = allowed / all consistent, 1 = blocked / violations found, 2 = usage or data error.

Completion rules for leaving a stage (as-indicated items never block; Done or NA counts as complete):
  every stage   name, sex, birth date, contact number, nephrologist, fellow, consent recorded
  Orientation   orientation + initial nephrology assessment milestones; donors: linked recipient
  Phase1        all phase 1 labs and imaging
  Phase2        all phase 2 items + HTEC evaluation and approval
  Clearances    all clearances (incl. ethics committee); recipients: CDTE milestone + risk category
  PhilHealthZ   PhilHealth Z Package qualification and application
  Phase3        all phase 3 items; entering PostKT / PostDonation also needs a surgery date
"""
from __future__ import annotations

import argparse
import json
import sys

RECIPIENT_STAGES = ["Orientation", "Phase1", "Phase2", "Clearances", "PhilHealthZ", "Phase3", "PostKT"]
DONOR_STAGES = ["Orientation", "Phase1", "Phase2", "Clearances", "Phase3", "PostDonation"]
SURGERY_STAGES = {"PostKT", "PostDonation"}
PROFILE_FIELDS = {
    "firstName": "first name", "lastName": "last name", "sex": "sex", "birthDate": "birth date",
    "contactNumber": "contact number", "nephrologistId": "nephrologist", "fellowId": "fellow",
    "consentAcceptedAt": "consent",
}


def stages_for(patient: dict) -> list[str]:
    return DONOR_STAGES if patient["patientType"] == "Donor" else RECIPIENT_STAGES


def gate_stage(item: dict, patient_type: str) -> str | None:
    """Mirror of gateStage() in server/mockChecklist.ts."""
    if item["appliesTo"] not in ("Both", patient_type):
        return None
    if item.get("phase") is not None:
        return f"Phase{item['phase']}"
    if item["category"] == "Clearance":
        return "Clearances"
    if item["category"] != "Milestone":
        return None
    name = item["name"].lower()
    if "orientation" in name or "initial nephrology" in name:
        return "Orientation"
    if "htec" in name:
        return "Phase2"
    if "cdte" in name:
        return "Clearances"
    if "philhealth" in name:
        return "PhilHealthZ"
    return None


def missing_to_leave(patient: dict, stage: str, catalog: list[dict], progress: dict) -> list[str]:
    """Everything still missing before `patient` may leave `stage`."""
    missing = [f"profile: {label}" for field, label in PROFILE_FIELDS.items() if patient.get(field) in (None, "")]
    if stage == "Orientation" and patient["patientType"] == "Donor" and not patient.get("linkedRecipientId"):
        missing.append("profile: linked recipient")
    if stage == "Clearances" and patient["patientType"] == "Recipient" and not patient.get("riskCategory"):
        missing.append("profile: risk category")
    for item in catalog:
        if item["asIndicated"] or gate_stage(item, patient["patientType"]) != stage:
            continue
        status = progress.get(item["id"])
        if status not in ("Done", "NA"):
            missing.append(f"{item['category'].lower()}: {item['name']} ({status or 'no record'})")
    return missing


def check_advance(patient: dict, target: str, catalog: list[dict], progress: dict) -> list[str]:
    stages = stages_for(patient)
    if target not in stages:
        return [f"{target} is not a {patient['patientType'].lower()} stage"]
    current = stages.index(patient["stage"])
    if stages.index(target) != current + 1:
        return [f"can only advance one stage: {patient['stage']} -> {stages[current + 1] if current + 1 < len(stages) else '(final)'}"]
    missing = missing_to_leave(patient, patient["stage"], catalog, progress)
    if target in SURGERY_STAGES and not patient.get("surgeryDate"):
        missing.append("profile: surgery date")
    return missing


def load(path: str) -> tuple[list[dict], list[dict], dict[int, dict]]:
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    progress: dict[int, dict] = {}
    for row in data["checklist"]:
        progress.setdefault(int(row["patientId"]), {})[int(row["catalogId"])] = row["status"]
    return data["patients"], data["catalog"], progress


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="mode", required=True)
    check = sub.add_parser("check", help="audit every patient's earlier stages")
    check.add_argument("--input", required=True)
    check.add_argument("--hrn-prefix", default="", help="only patients whose HRN starts with this")
    advance = sub.add_parser("advance", help="may this patient move to the next stage?")
    advance.add_argument("--input", required=True)
    advance.add_argument("--hrn", required=True)
    advance.add_argument("--to", required=True)
    args = parser.parse_args()

    try:
        patients, catalog, progress = load(args.input)
    except (OSError, ValueError, KeyError) as error:
        print(f"error: cannot read {args.input}: {error}", file=sys.stderr)
        return 2

    if args.mode == "advance":
        patient = next((p for p in patients if p["hrn"] == args.hrn), None)
        if patient is None:
            print(f"error: no patient with HRN {args.hrn}", file=sys.stderr)
            return 2
        missing = check_advance(patient, args.to, catalog, progress.get(patient["id"], {}))
        if missing:
            print(f"BLOCKED {args.hrn}: {patient['stage']} -> {args.to}")
            for line in missing:
                print(f"  - {line}")
            return 1
        print(f"ALLOWED {args.hrn}: {patient['stage']} -> {args.to}")
        return 0

    checked = violations = 0
    for patient in patients:
        if not patient["hrn"].startswith(args.hrn_prefix):
            continue
        checked += 1
        stages = stages_for(patient)
        if patient["stage"] not in stages:
            print(f"{patient['hrn']}: invalid stage {patient['stage']}")
            violations += 1
            continue
        current = stages.index(patient["stage"])
        problems = [f"{s}: {m}" for s in stages[:current] for m in missing_to_leave(patient, s, catalog, progress.get(patient["id"], {}))]
        if patient["stage"] in SURGERY_STAGES and not patient.get("surgeryDate"):
            problems.append("profile: surgery date")
        if patient["stage"] not in SURGERY_STAGES and patient.get("surgeryDate"):
            problems.append("profile: surgery date set before transplant")
        if problems:
            violations += 1
            print(f"{patient['hrn']} ({patient['patientType']}, {patient['stage']}) advanced with incomplete data:")
            for line in sorted(set(problems)):
                print(f"  - {line}")
    print(f"checked {checked} patients: {checked - violations} consistent, {violations} with violations")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
