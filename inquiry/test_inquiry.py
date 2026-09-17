"""
Comprehensive test suite for rule-based inquiry chatbot modules.
Tests normalize, match_inquiry, responses, and uncertainty handling.
"""
import unittest
import os
import sys
import json
import threading
from urllib.request import Request, urlopen
from urllib.error import HTTPError

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from normalize import clean_letter_case, clean_punctuation, clean_spaces, normalize_text, tokenize
from match_inquiry import InquiryMatcher, load_faq
from responses import format_inquiry_response
from chat_service import run_server, ThreadedHTTPServer, InquiryRequestHandler, create_service


class TestNormalize(unittest.TestCase):
    def test_clean_letter_case(self):
        self.assertEqual(clean_letter_case("SPMC SKTI Dialysis"), "spmc skti dialysis")
        self.assertEqual(clean_letter_case(""), "")
        self.assertEqual(clean_letter_case(None), "")

    def test_clean_punctuation(self):
        self.assertEqual(clean_punctuation("What are your hours?!"), "What are your hours  ")
        self.assertEqual(clean_punctuation("Cost: $100 / session."), "Cost   100   session ")
        self.assertEqual(clean_punctuation("foo_bar-baz"), "foo bar baz")

    def test_clean_spaces(self):
        self.assertEqual(clean_spaces("   hello   world \n \t "), "hello world")
        self.assertEqual(clean_spaces(""), "")
        self.assertEqual(clean_spaces(None), "")

    def test_normalize_text(self):
        self.assertEqual(
            normalize_text("  Where is SPMC SKTI located, Davao City?  "),
            "where is spmc skti located davao city",
        )
        self.assertEqual(normalize_text(""), "")

    def test_tokenize(self):
        tokens = tokenize("dialysis dialysis shifts hours")
        self.assertEqual(tokens, ["dialysis", "shifts", "hours"])


class TestMatchInquiry(unittest.TestCase):
    def setUp(self):
        self.matcher = InquiryMatcher()
        self.faq = load_faq()
        self.topics = self.faq["topics"]

    def test_exact_topic_button_click(self):
        res = self.matcher.match(topic_id="services")
        self.assertEqual(res["match_type"], InquiryMatcher.MATCH_EXACT_TOPIC)
        self.assertEqual(res["topic"]["id"], "services")
        self.assertEqual(res["confidence"], 1.0)

        res_hours = self.matcher.match(topic_id="hours")
        self.assertEqual(res_hours["topic"]["id"], "hours")

    def test_known_questions(self):
        queries = [
            ("What services do you offer?", "services"),
            ("What are your operating hours?", "hours"),
            ("Where are you located?", "location"),
            ("What documents do I need to bring for dialysis?", "requirements"),
            ("How much does hemodialysis cost?", "fees"),
            ("What is your telephone contact number?", "contact"),
        ]
        for q, expected_id in queries:
            with self.subTest(query=q):
                res = self.matcher.match(query=q)
                self.assertIn(
                    res["match_type"],
                    [InquiryMatcher.MATCH_EXACT_PHRASE, InquiryMatcher.MATCH_SINGLE],
                )
                self.assertEqual(res["topic"]["id"], expected_id)

    def test_alternate_wording(self):
        queries = [
            ("when can i go to dialysis clinic", "hours"),
            ("can you tell me where the kidney building is situated in bajada", "location"),
            ("what papers do i need to prepare for admission", "requirements"),
            ("is hemodialysis covered by philhealth 156 sessions", "fees"),
            ("give me the phone number to call the clinic desk", "contact"),
            ("do you do peritoneal dialysis and kidney transplants", "services"),
        ]
        for q, expected_id in queries:
            with self.subTest(query=q):
                res = self.matcher.match(query=q)
                self.assertIn(
                    res["match_type"],
                    [InquiryMatcher.MATCH_EXACT_PHRASE, InquiryMatcher.MATCH_SINGLE],
                )
                self.assertEqual(res["topic"]["id"], expected_id)

    def test_empty_input(self):
        res_empty = self.matcher.match(query="")
        self.assertEqual(res_empty["match_type"], InquiryMatcher.MATCH_EMPTY)
        self.assertIsNone(res_empty["topic"])

        res_spaces = self.matcher.match(query="     \n  \t ")
        self.assertEqual(res_spaces["match_type"], InquiryMatcher.MATCH_EMPTY)

    def test_unsupported_topics(self):
        unsupported = [
            "Can you tell me a funny joke?",
            "What is the current stock price of Apple?",
            "Who won the basketball championship?",
            "Write a poem about sunflowers",
        ]
        for q in unsupported:
            with self.subTest(query=q):
                res = self.matcher.match(query=q)
                self.assertEqual(res["match_type"], InquiryMatcher.MATCH_NONE)
                self.assertIsNone(res["topic"])

    def test_ambiguous_questions(self):
        # Query mentioning both requirements and fees
        ambiguous_query = "What are the requirements, documents, fees, and costs for treatment?"
        res = self.matcher.match(query=ambiguous_query)
        self.assertEqual(res["match_type"], InquiryMatcher.MATCH_MULTIPLE)
        self.assertIsNone(res["topic"])
        self.assertTrue(len(res["candidate_topics"]) >= 2)
        candidate_ids = [c["id"] for c in res["candidate_topics"]]
        self.assertTrue("requirements" in candidate_ids or "fees" in candidate_ids)


class TestResponses(unittest.TestCase):
    def setUp(self):
        self.matcher = InquiryMatcher()
        self.faq = load_faq()
        self.topics = self.faq["topics"]

    def test_response_for_single_match(self):
        match_result = self.matcher.match(query="Where is the dialysis center located?")
        resp = format_inquiry_response(match_result, self.topics, self.faq)
        self.assertTrue(resp["success"])
        self.assertEqual(resp["topic_id"], "location")
        self.assertIn("J.P. Laurel Avenue", resp["answer"])
        self.assertTrue(len(resp["related_topics"]) > 0)

    def test_response_for_empty_input(self):
        match_result = self.matcher.match(query="")
        resp = format_inquiry_response(match_result, self.topics, self.faq)
        self.assertTrue(resp["success"])
        self.assertIsNone(resp["topic_id"])
        self.assertEqual(resp["match_type"], "EMPTY_QUERY")
        self.assertEqual(len(resp["candidate_topics"]), len(self.topics))

    def test_response_for_ambiguous_matches(self):
        match_result = self.matcher.match(query="What are the requirements and fees?")
        resp = format_inquiry_response(match_result, self.topics, self.faq)
        self.assertTrue(resp["success"])
        self.assertIsNone(resp["topic_id"])
        self.assertEqual(resp["match_type"], "MULTIPLE_MATCHES")
        self.assertIn("matches multiple topics", resp["answer"])
        self.assertTrue(len(resp["candidate_topics"]) >= 2)

    def test_response_for_unsupported_question(self):
        match_result = self.matcher.match(query="Tell me about quantum physics")
        resp = format_inquiry_response(match_result, self.topics, self.faq)
        self.assertTrue(resp["success"])
        self.assertIsNone(resp["topic_id"])
        self.assertEqual(resp["match_type"], "NO_MATCH")
        self.assertIn("SPMC Trunkline", resp["answer"])
        self.assertEqual(len(resp["candidate_topics"]), len(self.topics))


class TestChatServiceHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = 5098
        create_service()
        cls.httpd = ThreadedHTTPServer(("127.0.0.1", cls.port), InquiryRequestHandler)
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def test_health_endpoint(self):
        req = Request(f"http://127.0.0.1:{self.port}/health")
        with urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "ok")
            self.assertEqual(data["service"], "skti-inquiry-service")

    def test_topics_endpoint(self):
        req = Request(f"http://127.0.0.1:{self.port}/api/inquiry/topics")
        with urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertEqual(len(data["topics"]), 8)

    def test_chat_query_endpoint(self):
        payload = json.dumps({"query": "What are your operating hours?"}).encode("utf-8")
        req = Request(
            f"http://127.0.0.1:{self.port}/api/inquiry",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertEqual(data["topic_id"], "hours")
            self.assertIn("8:00 AM", data["answer"])

    def test_chat_topic_id_endpoint(self):
        payload = json.dumps({"topic_id": "fees"}).encode("utf-8")
        req = Request(
            f"http://127.0.0.1:{self.port}/api/inquiry",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertEqual(data["topic_id"], "fees")
            self.assertIn("156", data["answer"])

    def test_chat_live_context_enrichment(self):
        # Option D1: test live database context injection
        payload = json.dumps({
            "topic_id": "trainings",
            "context": {
                "upcoming_trainings": [
                    {"trainingName": "Basic Life Support (BLS)", "scheduledDate": "2026-10-20"},
                    {"trainingName": "Dialysis Machine Safety", "scheduledDate": "2026-11-05"}
                ],
                "active_areas": [
                    {"name": "SKTI Hemodialysis Unit", "staffCount": 18},
                    {"name": "Peritoneal Dialysis Unit", "staffCount": 6}
                ],
                "total_active_staff": 48
            }
        }).encode("utf-8")
        req = Request(
            f"http://127.0.0.1:{self.port}/api/inquiry",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertEqual(data["topic_id"], "trainings")
            self.assertIn("Basic Life Support (BLS)", data["answer"])
            self.assertIn("2026-10-20", data["answer"])
            self.assertTrue(data.get("live_synced"))


if __name__ == "__main__":
    unittest.main()
