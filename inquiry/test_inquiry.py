"""
Unit and integration test suite for NurseTrack rule-based assistant microservice.
Tests normalization, greetings, 8 supervisor task topics, live context formatting,
unauthorized internal data protection, and service authentication.
"""
import unittest
import os
import json
import time
import urllib.request
import urllib.error
import threading
from normalize import normalize_text, tokenize
from match_inquiry import InquiryMatcher, GREETINGS
from responses import format_inquiry_response
from chat_service import create_server


class TestNormalize(unittest.TestCase):
    def test_clean_spaces_punct_case(self):
        raw = "  Hello,   NurseTrack!! What's the STATUS of licenses?  "
        expected = "hello nursetrack what s the status of licenses"
        self.assertEqual(normalize_text(raw), expected)

    def test_tokenize(self):
        tokens = tokenize("What are the expiring licenses?")
        self.assertIn("expiring", tokens)
        self.assertIn("licenses", tokens)


class TestMatchInquiry(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.matcher = InquiryMatcher()

    def test_greetings(self):
        """Greetings must match MATCH_GREETING cleanly without false matching topics."""
        for g in ["hi", "hello", "good morning", "good afternoon", "hey", "kumusta"]:
            res = self.matcher.match(g)
            self.assertEqual(
                res["match_type"],
                InquiryMatcher.MATCH_GREETING,
                f"Failed on greeting: '{g}' (got {res['match_type']})"
            )

    def test_short_and_empty_inputs(self):
        """Short inputs (< 3 chars) and empty queries must be rejected or marked empty."""
        empty_res = self.matcher.match("")
        self.assertEqual(empty_res["match_type"], InquiryMatcher.MATCH_EMPTY)

        for short_str in ["a", "x", "ok"]:
            res = self.matcher.match(short_str)
            self.assertEqual(
                res["match_type"],
                InquiryMatcher.MATCH_NONE,
                f"Short string '{short_str}' should be MATCH_NONE"
            )
        # Punctuation only
        punct_res = self.matcher.match("??")
        self.assertEqual(punct_res["match_type"], InquiryMatcher.MATCH_EMPTY)

    def test_all_8_topic_buttons(self):
        """Direct topic button click must return EXACT_TOPIC for all 8 topics."""
        expected_ids = [
            "needs_attention",
            "find_staff",
            "license_status",
            "training_followup",
            "upcoming_seminars",
            "area_assignments",
            "calendar",
            "reports",
        ]
        for t_id in expected_ids:
            res = self.matcher.match("", topic_id=t_id)
            self.assertEqual(res["match_type"], InquiryMatcher.MATCH_EXACT_TOPIC)
            self.assertIsNotNone(res["topic"])
            self.assertEqual(res["topic"]["id"], t_id)

    def test_known_questions(self):
        """Standard questions for all 8 supervisor tasks must match their respective topics."""
        samples = [
            ("What needs attention?", "needs_attention"),
            ("Show expiring and overdue records", "needs_attention"),
            ("Find staff", "find_staff"),
            ("Search for nurse or attendant", "find_staff"),
            ("What is the PRC license status?", "license_status"),
            ("Show expiring licenses", "license_status"),
            ("Show training follow-up items", "training_followup"),
            ("Which trainings have missing evidence?", "training_followup"),
            ("What seminars are upcoming?", "upcoming_seminars"),
            ("Show scheduled seminars and LDI", "upcoming_seminars"),
            ("Show staff assignments by clinical area", "area_assignments"),
            ("What is on the calendar?", "calendar"),
            ("What reports can I export?", "reports"),
            ("Export to Excel", "reports"),
        ]
        for query, expected_id in samples:
            res = self.matcher.match(query)
            self.assertIn(
                res["match_type"],
                [InquiryMatcher.MATCH_EXACT_PHRASE, InquiryMatcher.MATCH_SINGLE],
                f"Failed to match sample question: '{query}'"
            )
            self.assertEqual(res["topic"]["id"], expected_id)

    def test_alternate_wording(self):
        """Alternate phrasing should score highest on correct topic."""
        phrases = [
            ("licenses expiring", "license_status"),
            ("find nurse Maria", "find_staff"),
            ("missing certificate", "training_followup"),
            ("upcoming seminar", "upcoming_seminars"),
            ("clinical unit assignments", "area_assignments"),
            ("what is scheduled today", "calendar"),
            ("compliance report export", "reports"),
            ("dashboard alerts", "needs_attention"),
        ]
        for query, expected_id in phrases:
            res = self.matcher.match(query)
            self.assertIn(
                res["match_type"],
                [InquiryMatcher.MATCH_EXACT_PHRASE, InquiryMatcher.MATCH_SINGLE],
                f"Failed on alternate phrase: '{query}' (got {res['match_type']})"
            )
            self.assertEqual(res["topic"]["id"], expected_id)

    def test_ambiguous_questions(self):
        """Query with mixed intents should trigger multiple matches or clear top."""
        res = self.matcher.match("license report")
        # Matches license_status and reports
        self.assertIn(res["match_type"], [InquiryMatcher.MATCH_MULTIPLE, InquiryMatcher.MATCH_SINGLE])
        if res["match_type"] == InquiryMatcher.MATCH_MULTIPLE:
            candidate_ids = [c["id"] for c in res["candidate_topics"]]
            self.assertIn("license_status", candidate_ids)
            self.assertIn("reports", candidate_ids)


class TestResponses(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.matcher = InquiryMatcher()
        cls.faq = cls.matcher.faq
        cls.topics = cls.matcher.topics

    def test_empty_query_response(self):
        match_res = {"match_type": InquiryMatcher.MATCH_EMPTY}
        resp = format_inquiry_response(match_res, self.topics, self.faq)
        self.assertTrue(resp["success"])
        self.assertIn("NurseTrack Assistant", resp["answer"])
        self.assertEqual(len(resp["related_topics"]), 8)

    def test_greeting_response(self):
        match_res = {"match_type": InquiryMatcher.MATCH_GREETING}
        resp = format_inquiry_response(match_res, self.topics, self.faq)
        self.assertTrue(resp["success"])
        self.assertIn("NurseTrack Assistant", resp["answer"])
        self.assertEqual(len(resp["candidate_topics"]), 8)

    def test_unauthorized_internal_data_protection(self):
        """Public / unauthenticated sessions must NOT see internal staff or compliance data."""
        for t_id in ["needs_attention", "find_staff", "license_status", "training_followup"]:
            match_res = self.matcher.match("", topic_id=t_id)
            resp = format_inquiry_response(match_res, self.topics, self.faq, context={"is_authorized": False})
            self.assertTrue(resp["success"])
            self.assertIn("Supervisor authentication required", resp["answer"])
            self.assertEqual(resp["action_links"][0]["url"], "/dashboard")

    def test_dynamic_alerts_context(self):
        """Authorized needs_attention query formats live action center alerts."""
        match_res = self.matcher.match("", topic_id="needs_attention")
        mock_ctx = {
            "is_authorized": True,
            "alerts_status": "success",
            "alerts_summary": {
                "total": 3,
                "licenseUrgent": 2,
                "trainingUrgent": 1,
                "topItems": [{"title": "Maria Santos — license expired"}],
            },
        }
        resp = format_inquiry_response(match_res, self.topics, self.faq, context=mock_ctx)
        self.assertTrue(resp["success"])
        self.assertTrue(resp["live_synced"])
        self.assertIn("NurseTrack Action Center", resp["answer"])
        self.assertIn("Maria Santos", resp["answer"])
        self.assertEqual(resp["action_links"][0]["url"], "/dashboard")

    def test_dynamic_staff_lookup(self):
        """Searching nurse returns matching staff member and link."""
        match_res = self.matcher.match("find nurse Dela Cruz")
        mock_ctx = {
            "is_authorized": True,
            "staff_status": "success",
            "matched_staff": [
                {
                    "name": "Juan Dela Cruz",
                    "staffType": "Registered Nurse",
                    "areaName": "Hemodialysis Unit",
                    "prcLicenseNumber": "0123456",
                }
            ],
        }
        resp = format_inquiry_response(match_res, self.topics, self.faq, context=mock_ctx)
        self.assertTrue(resp["success"])
        self.assertIn("Juan Dela Cruz", resp["answer"])
        self.assertIn("Hemodialysis Unit", resp["answer"])
        self.assertEqual(resp["action_links"][0]["url"], "/nurses")

    def test_db_failure_messaging(self):
        """Database query failure produces clean unavailable message with action link."""
        match_res = self.matcher.match("", topic_id="license_status")
        mock_ctx = {
            "is_authorized": True,
            "licenses_status": "failed",
        }
        resp = format_inquiry_response(match_res, self.topics, self.faq, context=mock_ctx)
        self.assertFalse(resp["success"])
        self.assertEqual(resp["match_type"], "DB_UNAVAILABLE")
        self.assertIn("unavailable", resp["answer"].lower())
        self.assertEqual(resp["action_links"][0]["url"], "/licenses")


class TestChatServiceAuthAndEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = 59997
        cls.secret = "test-secret-nursetrack-456"
        cls.server = create_server(host="127.0.0.1", port=cls.port, secret=cls.secret)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.2)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_health_probe_public(self):
        url = f"http://127.0.0.1:{self.port}/health"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "ok")

    def test_auth_rejected_without_secret(self):
        url = f"http://127.0.0.1:{self.port}/api/inquiry"
        req = urllib.request.Request(
            url,
            data=json.dumps({"query": "What needs attention?"}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req)
        self.assertEqual(ctx.exception.code, 401)

    def test_auth_accepted_with_secret(self):
        url = f"http://127.0.0.1:{self.port}/api/inquiry"
        req = urllib.request.Request(
            url,
            data=json.dumps({"query": "What needs attention?", "context": {"is_authorized": True}}).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.secret}",
            }
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertEqual(data["topic_id"], "needs_attention")


if __name__ == "__main__":
    unittest.main()
