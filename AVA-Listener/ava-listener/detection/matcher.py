"""
AVAListener — Wake Phrase Matcher
====================================
Two-gate matching strategy:

  Gate 1 (HARD): anchor_present()
      The wake token or a registered variant must appear in the hypothesis.
      Uses Jaro-Winkler (jellyfish) — outperforms Soundex/Metaphone for
      invented words like "arvsal".

  Gate 2 (SOFT): best_match()
      Score the hypothesis window against every canonical wake phrase via
      rapidfuzz token_set_ratio + context word presence + stability.

Variant architecture (Phase 3)
--------------------------------
  Variants are no longer a global flat list. They live inside each WAKEWORD
  entry in settings.py and are aggregated at import time by variants.py.
  matcher.py uses variants.py's get_variants() — a single-call API that
  returns the deduplicated, lowercased anchor set.

  best_match() now returns a 3-tuple:
      (score: float, canonical_phrase: str, matched_variant: str)

  The engine uses matched_variant for richer logs:
      matched_variant='our whistle' → canonical='arvsal'

  Callers that only unpack 2 values still work correctly because Python
  allows:  score, phrase = best_match(...)  — wait, it now returns 3 values.
  → engine.py and test_pipeline.py have been updated to unpack all 3.
"""
import jellyfish
from rapidfuzz import fuzz
from typing import List, Tuple, Optional

from config.settings import (
    CONTEXT_WORDS,
    WAKE_PHRASES,
    JARO_THRESHOLD,
    FUZZY_THRESHOLD,
    WEIGHT_MATCH,
    WEIGHT_CONTEXT,
    WEIGHT_STABILITY,
    PHRASE_PRIORITY_MODE,
)
from detection.variants import get_variants, get_canonical


# ── Gate 1: Anchor presence ───────────────────────────────────────────────────

def anchor_present(text: str) -> bool:
    """
    Hard gate: returns True only if the wake token (or a recognizable variant)
    appears somewhere in `text`.

    Strategy:
      1. Exact substring: check space-stripped tokens against space-stripped
         variants. Catches "ar sal" → strip → "arsal" matching "arsal" variant.
      2. Jaro-Winkler: compare each individual token against each variant.
         Length-guarded: only compare tokens whose length difference <= 2 to
         prevent short common words ("a", "I") from matching long variants.
    """
    tokens = text.lower().split()
    variants = get_variants()   # deduplicated list from WAKEWORDS

    for variant in variants:
        v = variant.replace(" ", "")
        v_words = variant.split()
        n_words  = len(text.lower().split())

        # ── Multi-token variant exact match (e.g. "our whistle") ────────────────
        # Length guard: don't match a 2-word variant inside a 1-word text or a
        # 10-word text (prevents 'our sal' matching 'ourselves').
        if " " in variant:
            if abs(n_words - len(v_words)) <= 2:
                if variant in text.lower():
                    return True
            # Stripped fallback
            text_stripped = "".join(text.lower().split())
            if abs(len(text_stripped) - len(v)) <= 3 and v in text_stripped:
                return True

        # ── Single-token exact substring match ─────────────────────────────────
        for tok in tokens:
            tok_stripped = tok.replace(" ", "")
            if v in tok_stripped or tok_stripped in v:
                if abs(len(tok_stripped) - len(v)) <= 2:
                    return True

        # ── Jaro-Winkler per individual token (length-guarded) ──────────────────
        for tok in tokens:
            if abs(len(tok) - len(v)) > 2:
                continue
            if jellyfish.jaro_winkler_similarity(tok, v) >= JARO_THRESHOLD:
                return True

    return False


# ── Gate 2: Phrase + context scoring ─────────────────────────────────────────

def _context_score(text: str, phrase: str) -> float:
    """
    Score how well context words (hey / wake up / listen) are present.
    Returns 1.0 for bare "arvsal" (no context required).
    """
    ctx_words = CONTEXT_WORDS.get(phrase, [])
    if not ctx_words:
        return 1.0
    text_words = set(text.lower().split())
    matched = sum(1 for w in ctx_words if w in text_words)
    return matched / len(ctx_words)


def _stability_score(window: List[Tuple[str, int]]) -> float:
    """
    Fraction of hypotheses in window that have stability >= 2 (seen 2+ frames).
    Rewards windows where ASR has settled on consistent text.
    """
    if not window:
        return 0.0
    stable = sum(1 for _, stab in window if stab >= 2)
    return stable / len(window)


def _build_weighted_text(window: List[Tuple[str, int]]) -> str:
    """
    Build a combined string where stable hypotheses are repeated
    to give them higher weight in token_set_ratio scoring.
    Max 4× repetition for very stable (stability >= 6).
    """
    parts = []
    for text, stab in window:
        weight = 1 + min(stab // 2, 3)
        parts.extend([text] * weight)
    return " ".join(parts).lower()


def _find_matched_variant(combined: str, window: List[Tuple[str, int]]) -> str:
    """
    Identify which registered variant triggered the anchor gate.

    Checks each individual hypothesis in the window against the variant list.
    Returns the longest matching variant found (most specific match).
    Returns "" if no specific variant is identified (anchor gate passed via
    Jaro-Winkler on a token, not a direct string match).
    """
    texts_to_check = [combined] + [h for h, _ in window]
    best_variant   = ""

    for variant in get_variants():
        for text in texts_to_check:
            if variant in text.lower():
                if len(variant) > len(best_variant):
                    best_variant = variant
                    break

    return best_variant


def _resolve_phrase_candidate(candidates: list[tuple[float, str]]) -> str:
    """Resolve overlapping phrase candidates by configured priority mode."""
    if not candidates:
        return ""

    if PHRASE_PRIORITY_MODE == "score":
        return max(candidates, key=lambda item: item[0])[1]

    # Prefer the longest phrase when scores are similar; fallback to canonical
    # lexicographic order to produce deterministic overlap suppression.
    candidates.sort(key=lambda item: (item[0], len(item[1]), item[1]), reverse=True)
    return candidates[0][1]


# ── Public API ────────────────────────────────────────────────────────────────

def best_match(
    window: List[Tuple[str, int]],
) -> Tuple[float, str, str]:
    """
    Given a list of (text, stability) pairs from the rolling window,
    return (best_score 0–1, canonical_phrase, matched_variant).

    Returns (0.0, "", "") immediately if anchor gate fails.

    Score composition:
      WEIGHT_MATCH     × fuzzy phrase similarity
      WEIGHT_CONTEXT   × context word presence
      WEIGHT_STABILITY × stability of hypotheses in window

    matched_variant
      The specific variant string that triggered the anchor gate (best guess).
      Used by the engine for diagnostic logging:
          matched_variant='our whistle' → canonical='arvsal'
    """
    if not window:
        return 0.0, "", ""

    combined = _build_weighted_text(window)

    # HARD GATE — fast reject if no anchor token detected
    if not anchor_present(combined):
        return 0.0, "", ""

    # Identify matched variant (for logging — does not affect scoring)
    matched_variant = _find_matched_variant(combined, window)

    stab_score  = _stability_score(window)
    phrase_candidates: list[tuple[float, str]] = []

    # Build the set of canonical phrases to score.
    # Always score all WAKE_PHRASES (standard fuzzy matching).
    # Additionally, if the anchor gate fired via a specific registered variant,
    # ensure that variant's canonical phrase is included as a candidate.
    # This guarantees that "our whistle" (variant of "arvsal") can win even
    # when token_set_ratio("our whistle", "arvsal") is low.
    canonical_candidate = get_canonical(matched_variant) if matched_variant else ""
    phrases_to_score = list(WAKE_PHRASES)
    if canonical_candidate and canonical_candidate not in phrases_to_score:
        phrases_to_score.append(canonical_candidate)

    for phrase in phrases_to_score:
        # Score 1: against combined weighted text (better for multi-word phrases)
        fuzzy_combined = fuzz.token_set_ratio(combined, phrase.lower()) / 100.0

        # Score 2: best score against any individual hypothesis in window.
        fuzzy_individual = max(
            fuzz.token_set_ratio(h_text, phrase.lower()) / 100.0
            for h_text, _ in window
        )

        # Score 3: score against the matched variant itself, then scale by
        # canonical phrase similarity — gives a path for "our whistle" → "arvsal".
        # If the fuzzy match between hypothesis and canonical is weak but the
        # variant is an explicit registration, boost with a variant-match score.
        fuzzy_via_variant = 0.0
        if canonical_candidate == phrase and matched_variant:
            # Variant is explicitly registered → treat as a strong match signal.
            # Score how well combined text matches the matched_variant string,
            # then use that as a proxy for the canonical phrase.
            var_sim = fuzz.token_set_ratio(combined, matched_variant) / 100.0
            fuzzy_via_variant = var_sim * 0.85  # slight discount vs direct phrase match

        # Take the best of all three signals
        fuzzy = max(fuzzy_combined, fuzzy_individual, fuzzy_via_variant)

        # Only proceed if above minimum fuzzy threshold
        if fuzzy < (FUZZY_THRESHOLD / 100.0):
            continue

        ctx = _context_score(combined, phrase)

        score = (
            (fuzzy        * WEIGHT_MATCH)
            + (ctx        * WEIGHT_CONTEXT)
            + (stab_score * WEIGHT_STABILITY)
        )

        phrase_candidates.append((score, phrase))

    best_phrase = _resolve_phrase_candidate(phrase_candidates)
    best_score = max((score for score, _ in phrase_candidates), default=0.0)
    return best_score, best_phrase, matched_variant