"""
Matching engine for rule-based inquiry chatbot.
Matches topic buttons, exact phrases, and keyword rules with ambiguity detection.
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


# Domain entities present across the entire facility
DOMAIN_CONTEXT_WORDS = {
    "spmc", "skti", "dialysis", "hemodialysis", "kidney", "nephrology",
    "clinic", "center", "hospital", "patient", "treatment", "care"
}

# Strong primary intent triggers per topic
INTENT_TRIGGERS: Dict[str, Set[str]] = {
    "services": {
        "service", "services", "offer", "offers", "treatment", "treatments",
        "procedure", "procedures", "peritoneal", "pd", "capd", "transplant",
        "transplantation", "crrt", "inpatient", "outpatient"
    },
    "hours": {
        "hour", "hours", "schedule", "schedules", "shift", "shifts", "when",
        "open", "opening", "closed", "closing", "weekend", "weekends", "sunday",
        "saturday", "night", "time", "times"
    },
    "location": {
        "location", "locations", "address", "where", "direction", "directions",
        "building", "floor", "annex", "complex", "bajada", "locate", "map",
        "pavilion", "wayfinding"
    },
    "requirements": {
        "requirement", "requirements", "document", "documents", "paper", "papers",
        "abstract", "clearance", "prescription", "lab", "labs", "laboratory",
        "needed", "prerequisite", "prerequisites", "mdr", "hepa", "hbsag", "hcv"
    },
    "fees": {
        "fee", "fees", "cost", "costs", "philhealth", "156", "payment", "pay",
        "copay", "assistance", "malasakit", "mss", "discount", "covered", "coverage", "free"
    },
    "contact": {
        "contact", "contacts", "phone", "telephone", "trunkline", "call",
        "number", "numbers", "email", "hotline", "extension", "local"
    }
}


class InquiryMatcher:
    MATCH_EXACT_TOPIC = "EXACT_TOPIC"
    MATCH_EXACT_PHRASE = "EXACT_PHRASE"
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

            multi_word_keywords.sort(key=lambda s: len(s), reverse=True)

            self.normalized_topics[t_id] = {
                "id": t_id,
                "name": topic["name"],
                "norm_name": norm_name,
                "norm_questions": norm_questions,
                "multi_word_keywords": multi_word_keywords,
                "single_word_keywords": single_word_keywords,
                "raw": topic,
            }

    def match(self, query: Optional[str] = None, topic_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Evaluate inquiry against rules:
        1. Topic button click (topic_id) -> EXACT_TOPIC
        2. Empty/whitespace input -> EMPTY_QUERY
        3. Exact question or topic name -> EXACT_PHRASE
        4. Intent and keyword scoring -> SINGLE_MATCH, MULTIPLE_MATCHES, or NO_MATCH
        """
        # 1. Topic button click
        if topic_id:
            cleaned_topic_id = topic_id.strip().lower()
            if cleaned_topic_id in self.topics_by_id:
                topic = self.topics_by_id[cleaned_topic_id]
                return {
                    "match_type": self.MATCH_EXACT_TOPIC,
                    "confidence": 1.0,
                    "topic": topic,
                    "candidate_topics": [topic],
                    "matched_keywords": [cleaned_topic_id],
                }

        # 2. Empty query check
        if not query or not query.strip():
            return {
                "match_type": self.MATCH_EMPTY,
                "confidence": 0.0,
                "topic": None,
                "candidate_topics": self.topics,
                "matched_keywords": [],
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

        # Exact question or topic name match
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
                if norm_query == q or (len(q) > 10 and (q in norm_query or norm_query in q)):
                    return {
                        "match_type": self.MATCH_EXACT_PHRASE,
                        "confidence": 0.98,
                        "topic": indexed["raw"],
                        "candidate_topics": [indexed["raw"]],
                        "matched_keywords": [q],
                    }

        # 4. Keyword and Intent scoring
        scores: Dict[str, float] = {t["id"]: 0.0 for t in self.topics}
        matched_kw_map: Dict[str, List[str]] = {t["id"]: [] for t in self.topics}
        tokens = tokenize(norm_query)
        token_set = set(tokens)
        padded_query = f" {norm_query} "

        # Check intent triggers first (highest priority)
        matched_intents: Dict[str, int] = {}
        for t_id, triggers in INTENT_TRIGGERS.items():
            intersection = triggers.intersection(token_set)
            if intersection:
                matched_intents[t_id] = len(intersection)
                scores[t_id] += len(intersection) * 4.0
                matched_kw_map[t_id].extend(list(intersection))

        for t_id, indexed in self.normalized_topics.items():
            # Check multi-word keywords (weight: 3.5)
            for mw in indexed["multi_word_keywords"]:
                if f" {mw} " in padded_query:
                    scores[t_id] += 3.5
                    matched_kw_map[t_id].append(mw)

            # Check single word keywords (skip if already scored as intent trigger)
            for token in tokens:
                if token in indexed["single_word_keywords"] and token not in matched_kw_map[t_id]:
                    # General domain words (like "dialysis") shouldn't artificially skew towards 'services'
                    # if a specific intent like 'hours' or 'location' was triggered
                    if token in DOMAIN_CONTEXT_WORDS and t_id == "services" and any(k != "services" for k in matched_intents):
                        continue
                    scores[t_id] += 1.8
                    matched_kw_map[t_id].append(token)

        # Filter out scores below threshold
        ranked = sorted(
            [(t_id, scores[t_id]) for t_id in scores if scores[t_id] >= 2.5],
            key=lambda x: x[1],
            reverse=True,
        )

        # No match or out of scope
        if not ranked:
            return {
                "match_type": self.MATCH_NONE,
                "confidence": 0.0,
                "topic": None,
                "candidate_topics": self.topics,
                "matched_keywords": [],
            }

        top_id, top_score = ranked[0]
        top_topic = self.topics_by_id[top_id]

        # Check for ambiguity: multiple matches with close high scores
        # e.g., second candidate is within 75% of top candidate and both have distinct intent
        close_candidates = [
            self.topics_by_id[r[0]] for r in ranked if r[1] >= max(3.0, top_score * 0.75)
        ]

        if len(close_candidates) > 1:
            return {
                "match_type": self.MATCH_MULTIPLE,
                "confidence": round(top_score / (top_score + ranked[1][1]), 2),
                "topic": None,
                "candidate_topics": close_candidates,
                "matched_keywords": matched_kw_map[top_id] + matched_kw_map[ranked[1][0]],
            }

        # Clear single match
        return {
            "match_type": self.MATCH_SINGLE,
            "confidence": min(1.0, round(top_score / 5.0, 2)),
            "topic": top_topic,
            "candidate_topics": [top_topic],
            "matched_keywords": matched_kw_map[top_id],
        }
