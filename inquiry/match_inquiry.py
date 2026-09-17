"""
Matching engine for rule-based inquiry chatbot.
Matches topic buttons, exact normalized phrases, and whole-word keyword rules.
Eliminates partial substring false-positives and handles greetings gracefully.
"""
import os
import json
from typing import Dict, Any, List, Optional, Set
from normalize import normalize_text, tokenize


def load_faq(faq_path: Optional[str] = None) -> Dict[str, Any]:
    if not faq_path:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        faq_path = os.path.join(base_dir, "faq.json")
    with open(faq_path, "r", encoding="utf-8") as f:
        return json.load(f)


GREETINGS: Set[str] = {
    "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
    "greetings", "kumusta", "kamusta", "morning", "afternoon", "evening",
}

# Domain context words that appear across hospital operations
DOMAIN_CONTEXT_WORDS: Set[str] = {
    "spmc", "skti", "nursetrack", "hospital", "supervisor", "nurse", "nurses", "staff"
}

# Strong primary intent triggers per topic (whole word matches only)
INTENT_TRIGGERS: Dict[str, Set[str]] = {
    "needs_attention": {
        "attention", "urgent", "alert", "alerts", "overdue", "critical", "priority", "remediation"
    },
    "find_staff": {
        "staff", "nurse", "nurses", "attendant", "attendants", "roster", "lookup", "directory", "employee"
    },
    "license_status": {
        "license", "licenses", "prc", "renewal", "renewals", "credential", "credentials", "expired", "expiring"
    },
    "training_followup": {
        "evidence", "certificate", "certificates", "followup", "pending", "attendance", "submitted"
    },
    "upcoming_seminars": {
        "seminar", "seminars", "workshop", "workshops", "ldi", "venue", "venues"
    },
    "area_assignments": {
        "area", "areas", "unit", "units", "ward", "wards", "assignment", "assignments", "station", "stations"
    },
    "calendar": {
        "calendar", "event", "events", "today", "tomorrow", "week", "month"
    },
    "reports": {
        "report", "reports", "export", "exports", "excel", "spreadsheet", "download", "masterlist"
    }
}


class InquiryMatcher:
    MATCH_EXACT_TOPIC = "EXACT_TOPIC"
    MATCH_EXACT_PHRASE = "EXACT_PHRASE"
    MATCH_GREETING = "GREETING"
    MATCH_SINGLE = "SINGLE_MATCH"
    MATCH_MULTIPLE = "MULTIPLE_MATCHES"
    MATCH_NONE = "NO_MATCH"
    MATCH_EMPTY = "EMPTY_QUERY"

    def __init__(self, faq_path: Optional[str] = None):
        self.faq = load_faq(faq_path)
        self.topics = self.faq.get("topics", [])
        self.topics_by_id = {t["id"]: t for t in self.topics}
        self._precompute_index()

    def _precompute_index(self):
        """Index normalized questions, multi-word aliases, and single keywords."""
        self.normalized_topics = {}
        for topic in self.topics:
            t_id = topic["id"]
            norm_name = normalize_text(topic["name"])
            norm_questions = [normalize_text(q) for q in topic.get("questions", [])]

            multi_word_keywords = []
            single_word_keywords = set()

            for kw in topic.get("keywords", []):
                norm_kw = normalize_text(kw)
                if not norm_kw:
                    continue
                if " " in norm_kw:
                    multi_word_keywords.append(norm_kw)
                else:
                    single_word_keywords.add(norm_kw)

            # Sort multi-word keywords by descending length for greedy phrase matching
            multi_word_keywords.sort(key=len, reverse=True)

            self.normalized_topics[t_id] = {
                "raw": topic,
                "norm_name": norm_name,
                "norm_questions": norm_questions,
                "multi_word_keywords": multi_word_keywords,
                "single_word_keywords": single_word_keywords,
            }

    def match(self, query: str, topic_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Evaluate user input against FAQ knowledge base.
        Returns match dict with:
        - match_type
        - confidence (float)
        - topic (dict or None)
        - candidate_topics (list of dicts)
        - matched_keywords (list of str)
        """
        # 1. Direct Topic Button Click
        if topic_id:
            cleaned_id = topic_id.strip()
            if cleaned_id in self.topics_by_id:
                topic = self.topics_by_id[cleaned_id]
                return {
                    "match_type": self.MATCH_EXACT_TOPIC,
                    "confidence": 1.0,
                    "topic": topic,
                    "candidate_topics": [topic],
                    "matched_keywords": [topic["name"]],
                }

        norm_query = normalize_text(query)
        if not norm_query:
            return {
                "match_type": self.MATCH_EMPTY,
                "confidence": 0.0,
                "topic": None,
                "candidate_topics": self.topics,
                "matched_keywords": [],
            }

        # 3. Direct topic ID in query
        if norm_query in self.topics_by_id:
            topic = self.topics_by_id[norm_query]
            return {
                "match_type": self.MATCH_EXACT_TOPIC,
                "confidence": 1.0,
                "topic": topic,
                "candidate_topics": [topic],
                "matched_keywords": [norm_query],
            }

        # 4. Greetings detection (prevents false matches on "hi", "hello", etc.)
        if norm_query in GREETINGS:
            return {
                "match_type": self.MATCH_GREETING,
                "confidence": 1.0,
                "topic": None,
                "candidate_topics": self.topics,
                "matched_keywords": [norm_query],
            }

        # 5. Short unsupported input (< 3 chars, e.g. "a", "x", "??")
        if len(norm_query) < 3:
            return {
                "match_type": self.MATCH_NONE,
                "confidence": 0.0,
                "topic": None,
                "candidate_topics": self.topics,
                "matched_keywords": [],
            }

        # 6. Exact question or full topic name match (whole match only, NO partial substrings)
        padded_query = f" {norm_query} "
        for t_id, indexed in self.normalized_topics.items():
            if norm_query == indexed["norm_name"]:
                return {
                    "match_type": self.MATCH_EXACT_PHRASE,
                    "confidence": 1.0,
                    "topic": indexed["raw"],
                    "candidate_topics": [indexed["raw"]],
                    "matched_keywords": [norm_query],
                }
            for q in indexed["norm_questions"]:
                # Exact normalized match or query contains the complete question phrase with word boundaries
                if norm_query == q or (len(q) >= 12 and f" {q} " in padded_query):
                    return {
                        "match_type": self.MATCH_EXACT_PHRASE,
                        "confidence": 0.98,
                        "topic": indexed["raw"],
                        "candidate_topics": [indexed["raw"]],
                        "matched_keywords": [q],
                    }

        # Special query heuristics:
        # "find nurse ...", "search nurse ...", "who is nurse ...", "look up staff ..."
        if (norm_query.startswith("find nurse") or
            norm_query.startswith("search nurse") or
            norm_query.startswith("find staff") or
            norm_query.startswith("look up nurse") or
            norm_query.startswith("look up staff") or
            norm_query.startswith("search staff")):
            topic = self.topics_by_id["find_staff"]
            return {
                "match_type": self.MATCH_SINGLE,
                "confidence": 0.95,
                "topic": topic,
                "candidate_topics": [topic],
                "matched_keywords": ["find staff"],
            }

        # 7. Whole-word Keyword and Intent scoring
        scores: Dict[str, float] = {t["id"]: 0.0 for t in self.topics}
        matched_kw_map: Dict[str, List[str]] = {t["id"]: [] for t in self.topics}
        tokens = tokenize(norm_query)
        token_set = set(tokens)

        # Check intent triggers first (highest priority)
        matched_intents: Dict[str, int] = {}
        for t_id, triggers in INTENT_TRIGGERS.items():
            intersection = triggers.intersection(token_set)
            if intersection:
                matched_intents[t_id] = len(intersection)
                scores[t_id] += len(intersection) * 4.0
                matched_kw_map[t_id].extend(list(intersection))

        for t_id, indexed in self.normalized_topics.items():
            # Check multi-word keywords with exact boundary padding (weight: 3.5)
            for mw in indexed["multi_word_keywords"]:
                if f" {mw} " in padded_query:
                    scores[t_id] += 3.5
                    matched_kw_map[t_id].append(mw)

            # Check single word keywords (skip if already scored as intent trigger)
            for token in tokens:
                if token in indexed["single_word_keywords"] and token not in matched_kw_map[t_id]:
                    # General domain words (like "nurse") shouldn't over-skew if other intents present
                    if token in DOMAIN_CONTEXT_WORDS and t_id == "find_staff" and any(k != "find_staff" for k in matched_intents):
                        continue
                    scores[t_id] += 1.8
                    matched_kw_map[t_id].append(token)

        # Filter out scores below threshold (minimum 2.5 required)
        ranked = sorted(
            [(t_id, scores[t_id]) for t_id in scores if scores[t_id] >= 2.5],
            key=lambda x: x[1],
            reverse=True,
        )

        if not ranked:
            return {
                "match_type": self.MATCH_NONE,
                "confidence": 0.0,
                "topic": None,
                "candidate_topics": self.topics,
                "matched_keywords": [],
            }

        top_id, top_score = ranked[0]

        # Check for ambiguity / close tie (within 1.0 point and >= 2 candidates)
        close_candidates = [
            self.topics_by_id[t_id]
            for t_id, s in ranked
            if (top_score - s) <= 1.0 and s >= 3.0
        ]

        if len(close_candidates) > 1:
            return {
                "match_type": self.MATCH_MULTIPLE,
                "confidence": float(round(top_score / 10.0, 2)),
                "topic": None,
                "candidate_topics": close_candidates,
                "matched_keywords": matched_kw_map[top_id],
            }

        # Clear winner
        matched_topic = self.topics_by_id[top_id]
        return {
            "match_type": self.MATCH_SINGLE,
            "confidence": min(1.0, float(round(top_score / 10.0, 2))),
            "topic": matched_topic,
            "candidate_topics": [matched_topic],
            "matched_keywords": matched_kw_map[top_id],
        }
