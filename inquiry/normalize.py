"""
Text normalization module for rule-based inquiry chatbot.
Cleans letter case, punctuation, and whitespace.
"""
import re
import unicodedata
from typing import List


def clean_letter_case(text: str) -> str:
    """Convert text to lowercase."""
    if not isinstance(text, str):
        return ""
    return text.lower()


def clean_punctuation(text: str) -> str:
    """
    Remove punctuation and symbols, replacing them with a space.
    Retains alphanumeric characters and standard word characters.
    """
    if not isinstance(text, str):
        return ""
    # Normalize unicode (e.g. accented characters)
    text = unicodedata.normalize("NFKD", text)
    # Replace non-alphanumeric characters (excluding basic ASCII letters & numbers) with space
    cleaned = re.sub(r"[^\w\s]", " ", text)
    # Replace underscores that \w might include
    cleaned = cleaned.replace("_", " ")
    return cleaned


def clean_spaces(text: str) -> str:
    """
    Collapse multiple whitespace characters (spaces, tabs, newlines) into a single space,
    and strip leading and trailing whitespace.
    """
    if not isinstance(text, str):
        return ""
    return re.sub(r"\s+", " ", text).strip()


def normalize_text(text: str) -> str:
    """
    Full normalization pipeline:
    1. Clean letter case (lowercase).
    2. Clean punctuation.
    3. Clean whitespace.
    """
    if not text:
        return ""
    lower = clean_letter_case(text)
    no_punct = clean_punctuation(lower)
    return clean_spaces(no_punct)


def tokenize(text: str) -> List[str]:
    """Tokenize normalized text into unique word list preserving order."""
    normalized = normalize_text(text)
    if not normalized:
        return []
    tokens = normalized.split()
    seen = set()
    unique_tokens = []
    for token in tokens:
        if token not in seen:
            seen.add(token)
            unique_tokens.append(token)
    return unique_tokens
