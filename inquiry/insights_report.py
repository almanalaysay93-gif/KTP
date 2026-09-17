"""
Rule-based Insights report for NurseTrack supervisors.

The Node server reads the database and sends a digest. This module turns the
digest into fixed report sections. It makes no model call and never reads the
system clock: every date rule uses the digest's `today_manila`.

Digest shape:
{
  "today_manila": "YYYY-MM-DD",
  "areas":     [{"name": str}],                                   # active areas
  "staff":     [{"name": str, "area": str}],                      # active staff
  "licenses":  [{"name": str, "area": str, "credential": str,
                 "expiry_date": "YYYY-MM-DD", "renewed": bool}],  # latest per person
  "trainings": [{"name": str, "area": str, "training": str,
                 "date": "YYYY-MM-DD"}],                          # status Scheduled
  "coverage":  [{"area": str, "required_checks": int,
                 "compliant_checks": int}]                        # from the compliance rule
}
"""
from datetime import date, timedelta
from statistics import median
from typing import Any, Dict, List

URGENT_DAYS = 30
SOON_DAYS = 180
TRAINING_WINDOW_DAYS = 60
IMBALANCE_FACTOR = 2
LOW_STAFF_MAX = 1
NOTHING = "Nothing to report."


class DigestError(ValueError):
    """The digest does not have the expected shape."""


def _parse_date(value: Any, field: str) -> date:
    if not isinstance(value, str):
        raise DigestError(f"{field} must be a YYYY-MM-DD string")
    try:
        return date.fromisoformat(value[:10])
    except ValueError as exc:
        raise DigestError(f"{field} is not a valid date: {value!r}") from exc


def _records(digest: Dict[str, Any], key: str) -> List[Dict[str, Any]]:
    value = digest.get(key, [])
    if not isinstance(value, list) or not all(isinstance(item, dict) for item in value):
        raise DigestError(f"{key} must be a list of objects")
    return value


def _plural(count: int, word: str) -> str:
    return f"{count} {word}" if count == 1 else f"{count} {word}s"


def _license_days(item: Dict[str, Any], today: date) -> int:
    return (_parse_date(item.get("expiry_date"), "licenses.expiry_date") - today).days


def section_urgent_licenses(licenses: List[Dict[str, Any]], today: date) -> List[str]:
    """S1: expired, or expiring in 30 days or less. Lowest days first."""
    rows = []
    for item in licenses:
        if item.get("renewed"):
            continue
        days = _license_days(item, today)
        if days <= URGENT_DAYS:
            rows.append((days, item))
    rows.sort(key=lambda r: (r[0], str(r[1].get("name", ""))))
    lines = []
    for days, item in rows:
        when = f"expired {_plural(-days, 'day')} ago" if days < 0 else "expires today" if days == 0 else f"expires in {_plural(days, 'day')}"
        lines.append(f"{item.get('name')} ({item.get('area')}): {item.get('credential')} {when}, on {item.get('expiry_date')}.")
    return lines


def section_licenses_due(licenses: List[Dict[str, Any]], today: date) -> List[str]:
    """S2: expiring in 31 to 180 days, grouped by area."""
    by_area: Dict[str, List[tuple]] = {}
    for item in licenses:
        if item.get("renewed"):
            continue
        days = _license_days(item, today)
        if URGENT_DAYS < days <= SOON_DAYS:
            by_area.setdefault(str(item.get("area")), []).append((days, str(item.get("name"))))
    lines = []
    for area in sorted(by_area):
        people = sorted(by_area[area])
        names = ", ".join(f"{name} ({days} days)" for days, name in people)
        lines.append(f"{area} ({len(people)}): {names}.")
    return lines


def section_upcoming_trainings(trainings: List[Dict[str, Any]], today: date) -> List[str]:
    """S3: scheduled from today to today + 60 days, by date."""
    end = today + timedelta(days=TRAINING_WINDOW_DAYS)
    rows = []
    for item in trainings:
        when = _parse_date(item.get("date"), "trainings.date")
        if today <= when <= end:
            rows.append((when, str(item.get("training")), str(item.get("name")), item))
    rows.sort(key=lambda r: (r[0], r[1], r[2]))
    return [f"{when.isoformat()}: {training} for {name} ({item.get('area')})." for when, training, name, item in rows]


def section_staffing(areas: List[Dict[str, Any]], staff: List[Dict[str, Any]]) -> List[str]:
    """S4: staff count per area, with observations for imbalance and very low counts."""
    counts: Dict[str, int] = {str(a.get("name")): 0 for a in areas}
    for person in staff:
        area = str(person.get("area"))
        counts[area] = counts.get(area, 0) + 1
    if not counts:
        return []
    ordered = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    lines = [f"{area}: {_plural(count, 'staff member')}." for area, count in ordered]
    mid = median(counts.values())
    for area, count in ordered:
        if mid > 0 and count > IMBALANCE_FACTOR * mid:
            lines.append(f"Observation: {area} has {count} staff, more than {IMBALANCE_FACTOR} times the median of {mid:g}.")
    for area, count in ordered:
        if count <= LOW_STAFF_MAX:
            lines.append(f"Observation: {area} has {_plural(count, 'staff member')}.")
    return lines


def section_coverage(coverage: List[Dict[str, Any]]) -> List[str]:
    """S5: required-training coverage per area."""
    lines = []
    for item in coverage:
        required = int(item.get("required_checks") or 0)
        compliant = int(item.get("compliant_checks") or 0)
        if required == 0:
            lines.append(f"{item.get('area')}: no required trainings set.")
        else:
            pct = round(compliant * 100 / required)
            lines.append(f"{item.get('area')}: {pct}% ({compliant} of {required} checks).")
    return lines


def build_report(digest: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(digest, dict):
        raise DigestError("digest must be an object")
    today = _parse_date(digest.get("today_manila"), "today_manila")
    licenses = _records(digest, "licenses")
    trainings = _records(digest, "trainings")
    areas = _records(digest, "areas")
    staff = _records(digest, "staff")
    coverage = _records(digest, "coverage")

    sections = [
        ("S1", "Urgent licenses (expired or due within 30 days)", section_urgent_licenses(licenses, today)),
        ("S2", "Licenses due in 31 to 180 days", section_licenses_due(licenses, today)),
        ("S3", "Trainings and seminars in the next 60 days", section_upcoming_trainings(trainings, today)),
        ("S4", "Staffing by area", section_staffing(areas, staff)),
        ("S5", "Required-training coverage by area", section_coverage(coverage)),
    ]
    out_sections = [{"code": code, "title": title, "lines": lines or [NOTHING]} for code, title, lines in sections]
    text_parts = [f"NurseTrack Insights for {today.isoformat()}"]
    for section in out_sections:
        text_parts.append("")
        text_parts.append(section["title"])
        text_parts.extend(f"- {line}" for line in section["lines"])
    return {
        "success": True,
        "generated_for": today.isoformat(),
        "sections": out_sections,
        "text": "\n".join(text_parts),
    }
