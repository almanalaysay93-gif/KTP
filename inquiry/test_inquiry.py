"""
Comprehensive test suite for rule-based inquiry chatbot modules.
Tests normalize, match_inquiry, responses, uncertainty handling,
service authentication, live context enrichment, and greetings.
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
from chat_service import ThreadedHTTPServer, InquiryRequestHandler, create_service


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

    def test_greetings(self):
        # P3: "hi", "hello", "good morning" must return GREETING, never match random questions
        greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "kumusta"]
        for g in greetings:
            with self.subTest(greeting=g):
                res = self.matcher.match(query=g)
                self.assertEqual(res["match_type"], InquiryMatcher.MATCH_GREETING)
                self.assertIsNone(res["topic"])
                self.assertEqual(len(res["candidate_topics"]), 8)

    def test_short_unsupported_text(self):
        # P3: "a", "x" must not match random questions containing 'a'
        for s in ["a", "x", "??", "b"]:
            with self.subTest(short_input=s):
                res = self.matcher.match(query=s)
                self.assertIn(res["match_type"], [InquiryMatcher.MATCH_NONE, InquiryMatcher.MATCH_EMPTY])
                self.assertIsNone(res["topic"])

    def test_known_questions(self):
        queries = [
            ("What services do you offer?", "services"),
            ("What are your operating hours?", "hours"),
            ("Where are you located?", "location"),
            ("What documents do I need to bring for dialysis?", "requirements"),
            ("How much does hemodialysis cost?", "fees"),
            ("What is your telephone contact number?", "contact"),
            ("What seminars are scheduled?", "trainings"),
            ("What clinical areas or units are active?", "areas"),
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
            ("show upcoming training schedule", "trainings"),
            ("show hospital departments and wards", "areas"),
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
        ambiguous_query = "What are the requirements, documents, fees, and costs for treatment?"
        res = self.matcher.match(query=ambiguous_query)
        self.assertEqual(res["match_type"], InquiryMatcher.MATCH_MULTIPLE)
        self.assertIsNone(res["topic"])
        self.assertTrue(len(res["candidate_topics"]) >= 2)


class TestResponses(unittest.TestCase):
    def setUp(self):
        self.matcher = InquiryMatcher()
        self.faq = load_faq()
        self.topics = self.faq["topics"]

    def test_response_for_greeting(self):
        match_result = self.matcher.match(query="hi")
        resp = format_inquiry_response(match_result, self.topics, self.faq)
        self.assertTrue(resp["success"])
        self.assertEqual(resp["match_type"], "GREETING")
        self.assertIn("Hello! Welcome", resp["answer"])
        self.assertEqual(len(resp["candidate_topics"]), 8)

    def test_response_for_db_failure_distinction(self):
        # P2: preserve distinction between failed query and empty results
        match_result = self.matcher.match(topic_id="trainings")
        resp_failed = format_inquiry_response(
            match_result,
            self.topics,
            self.faq,
            context={"trainings_status": "failed"},
        )
        self.assertFalse(resp_failed["success"])
        self.assertIn("unavailable", resp_failed["answer"])
        self.assertFalse(resp_failed["live_synced"])

        resp_success_empty = format_inquiry_response(
            match_result,
            self.topics,
            self.faq,
            context={"trainings_status": "success", "upcoming_trainings": []},
        )
        self.assertTrue(resp_success_empty["success"])
        self.assertIn("no upcoming seminars", resp_success_empty["answer"])
        self.assertTrue(resp_success_empty["live_synced"])

    def test_response_authorization_staff_counts(self):
        # P2: restrict internal staff counts to authorized sessions
        match_result = self.matcher.match(topic_id="areas")
        ctx_unauth = {
            "areas_status": "success",
            "is_authorized": False,
            "active_areas": [{"name": "Hemodialysis Unit", "staffCount": 14}],
            "total_active_staff": 40,
        }
        resp_unauth = format_inquiry_response(match_result, self.topics, self.faq, context=ctx_unauth)
        self.assertNotIn("active staff assigned", resp_unauth["answer"])
        self.assertNotIn("Total Active Staff Tracked", resp_unauth["answer"])

        ctx_auth = {
            "areas_status": "success",
            "is_authorized": True,
            "active_areas": [{"name": "Hemodialysis Unit", "staffCount": 14}],
            "total_active_staff": 40,
        }
        resp_auth = format_inquiry_response(match_result, self.topics, self.faq, context=ctx_auth)
        self.assertIn("14 active staff assigned", resp_auth["answer"])
        self.assertIn("Total Active Staff Tracked: 40", resp_auth["answer"])


class TestChatServiceHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = 5098
        cls.test_secret = "test-secret-key-12345"
        os.environ["INQUIRY_SERVICE_SECRET"] = cls.test_secret

        create_service()
        cls.httpd = ThreadedHTTPServer(("127.0.0.1", cls.port), InquiryRequestHandler)
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        os.environ.pop("INQUIRY_SERVICE_SECRET", None)

    def test_health_endpoint_public(self):
        # Health endpoint must remain unauthenticated for probes
        req = Request(f"http://127.0.0.1:{self.port}/health")
        with urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "ok")
            self.assertEqual(data["service"], "skti-inquiry-service")

    def test_auth_rejection_without_secret(self):
        # P1: Unauthenticated request must return 401 when INQUIRY_SERVICE_SECRET is set
        payload = json.dumps({"query": "What are your hours?"}).encode("utf-8")
        req = Request(
            f"http://127.0.0.1:{self.port}/api/inquiry",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with self.assertRaises(HTTPError) as ctx:
            urlopen(req)
        self.assertEqual(ctx.exception.code, 401)

    def test_auth_success_with_bearer_token(self):
        payload = json.dumps({"query": "What are your hours?"}).encode("utf-8")
        req = Request(
            f"http://127.0.0.1:{self.port}/api/inquiry",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.test_secret}",
            },
            method="POST",
        )
        with urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertEqual(data["topic_id"], "hours")

    def test_auth_success_with_x_secret_header(self):
        payload = json.dumps({"topic_id": "fees"}).encode("utf-8")
        req = Request(
            f"http://127.0.0.1:{self.port}/api/inquiry",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Inquiry-Secret": self.test_secret,
            },
            method="POST",
        )
        with urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertEqual(data["topic_id"], "fees")


if __name__ == "__main__":
    unittest.main()
