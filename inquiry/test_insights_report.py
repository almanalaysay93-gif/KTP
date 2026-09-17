"""
Tests for the rule-based Insights report: section boundaries and the HTTP endpoint.
"""
import json
import os
import sys
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from chat_service import create_server  # noqa: E402
from insights_report import NOTHING, DigestError, build_report  # noqa: E402

TODAY = "2026-09-17"


def lic(name, expiry, area="Hemodialysis", renewed=False):
    return {"name": name, "area": area, "credential": "PRC License", "expiry_date": expiry, "renewed": renewed}


DIGEST = {
    "today_manila": TODAY,
    "areas": [{"name": "Hemodialysis"}, {"name": "Transplant Ward"}, {"name": "OR"}, {"name": "Dialysis Annex"}],
    "staff": (
        [{"name": f"HD {i}", "area": "Hemodialysis"} for i in range(9)]
        + [{"name": f"TW {i}", "area": "Transplant Ward"} for i in range(3)]
        + [{"name": "OR 1", "area": "OR"}]
    ),
    "licenses": [
        lic("Expired Ana", "2026-09-10"),  # -7 days
        lic("Today Ben", "2026-09-17"),  # 0 days
        lic("Thirty Cara", "2026-10-17"),  # 30 days -> S1
        lic("ThirtyOne Dan", "2026-10-18", area="Transplant Ward"),  # 31 days -> S2
        lic("OneEighty Eva", "2027-03-16"),  # 180 days -> S2
        lic("OneEightyOne Fe", "2027-03-17"),  # 181 days -> neither
        lic("Renewed Gil", "2026-09-01", renewed=True),  # renewed -> neither
    ],
    "trainings": [
        {"name": "Ana", "area": "Hemodialysis", "training": "BLS", "date": "2026-11-16"},  # +60 -> in
        {"name": "Ben", "area": "Hemodialysis", "training": "ACLS", "date": "2026-11-17"},  # +61 -> out
        {"name": "Cara", "area": "OR", "training": "IV Therapy", "date": TODAY},  # today -> in
        {"name": "Dan", "area": "OR", "training": "Old", "date": "2026-09-16"},  # past -> out
    ],
    "coverage": [
        {"area": "Hemodialysis", "required_checks": 8, "compliant_checks": 6},
        {"area": "OR", "required_checks": 0, "compliant_checks": 0},
    ],
}


def section(report, code):
    return next(s for s in report["sections"] if s["code"] == code)["lines"]


class TestSections(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report = build_report(DIGEST)

    def test_s1_urgent_includes_expired_today_and_30_days(self):
        lines = section(self.report, "S1")
        self.assertEqual(len(lines), 3)
        self.assertTrue(lines[0].startswith("Expired Ana (Hemodialysis): PRC License expired 7 days ago"))
        self.assertIn("Today Ben", lines[1])
        self.assertIn("expires today", lines[1])
        self.assertIn("Thirty Cara", lines[2])
        self.assertIn("expires in 30 days", lines[2])

    def test_s2_due_covers_31_to_180_grouped_by_area(self):
        lines = section(self.report, "S2")
        self.assertEqual(lines, [
            "Hemodialysis (1): OneEighty Eva (180 days).",
            "Transplant Ward (1): ThirtyOne Dan (31 days).",
        ])

    def test_renewed_and_181_days_are_left_out(self):
        text = self.report["text"]
        self.assertNotIn("Renewed Gil", text)
        self.assertNotIn("OneEightyOne Fe", text)

    def test_s3_trainings_today_to_60_days(self):
        lines = section(self.report, "S3")
        self.assertEqual(lines, [
            "2026-09-17: IV Therapy for Cara (OR).",
            "2026-11-16: BLS for Ana (Hemodialysis).",
        ])

    def test_s4_staffing_flags_imbalance_and_low_counts(self):
        lines = section(self.report, "S4")
        # counts 9, 3, 1, 0 -> median 2
        self.assertEqual(lines[:4], [
            "Hemodialysis: 9 staff members.",
            "Transplant Ward: 3 staff members.",
            "OR: 1 staff member.",
            "Dialysis Annex: 0 staff members.",
        ])
        self.assertIn("Observation: Hemodialysis has 9 staff, more than 2 times the median of 2.", lines)
        self.assertNotIn("Observation: Transplant Ward has 3 staff, more than 2 times the median of 2.", lines)
        self.assertIn("Observation: OR has 1 staff member.", lines)
        self.assertIn("Observation: Dialysis Annex has 0 staff members.", lines)

    def test_s5_coverage(self):
        self.assertEqual(section(self.report, "S5"), [
            "Hemodialysis: 75% (6 of 8 checks).",
            "OR: no required trainings set.",
        ])

    def test_empty_sections_say_nothing_to_report(self):
        report = build_report({"today_manila": TODAY})
        for s in report["sections"]:
            self.assertEqual(s["lines"], [NOTHING])
        self.assertEqual(report["generated_for"], TODAY)

    def test_bad_digest_is_rejected(self):
        for bad in [{}, {"today_manila": "17/09/2026"}, {"today_manila": TODAY, "licenses": "x"},
                    {"today_manila": TODAY, "licenses": [lic("X", "not-a-date")]}]:
            with self.assertRaises(DigestError):
                build_report(bad)


class TestEndpoint(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = create_server(host="127.0.0.1", port=0, secret="test-secret-value")
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        os.environ.pop("INQUIRY_SERVICE_SECRET", None)

    def post(self, body, token="test-secret-value"):
        req = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/api/insights/report",
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as err:
            return err.code, json.loads(err.read())

    def test_returns_report(self):
        status, data = self.post({"digest": DIGEST})
        self.assertEqual(status, 200)
        self.assertTrue(data["success"])
        self.assertEqual([s["code"] for s in data["sections"]], ["S1", "S2", "S3", "S4", "S5"])

    def test_rejects_bad_digest(self):
        status, data = self.post({"digest": {"today_manila": "bad"}})
        self.assertEqual(status, 400)
        self.assertIn("today_manila", data["error"])

    def test_requires_secret(self):
        status, _ = self.post({"digest": DIGEST}, token="wrong")
        self.assertEqual(status, 401)


if __name__ == "__main__":
    unittest.main()
