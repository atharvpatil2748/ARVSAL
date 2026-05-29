"""
AVAListener — Wake Phrase Variants
====================================
Single source of truth for the anchor variant set used by the anchor gate.

Variants are co-located inside each WAKEWORD entry in settings.py.
This module flattens them into a deduplicated, lowercased list at import time.

Public API
----------
  get_variants() -> list[str]
      All unique anchor strings across every wakeword.

  get_canonical(variant: str) -> str | None
      Map a variant back to its canonical phrase.
      Returns None if the variant is not registered.

  get_wakeword_for_phrase(phrase: str) -> dict | None
      Return the full wakeword config dict for a canonical phrase.
      Useful for per-phrase metadata (threshold, future fields).

Future extension points
-----------------------
  - Multilingual variants: add a "language" key per wakeword entry.
  - Runtime-loaded variants: replace WAKEWORDS import with a loader that
    reads from a JSON/YAML file, then call _build_index() at startup.
  - Adaptive/generated variants: call _build_index() after a variants update.
  - Per-variant thresholds: add {"variant": str, "threshold": float} dicts
    inside the "variants" list and update get_canonical() to return the dict.
  - Phonetic metadata: add "ipa" or "phoneme" keys per variant dict.
"""
from __future__ import annotations
from typing import Optional
from config.settings import WAKEWORDS


# ── Index structures (built once at import time) ──────────────────────────────

def _build_index(
    wakewords: list[dict],
) -> tuple[list[str], dict[str, str], dict[str, dict]]:
    """
    Build three lookup structures from the WAKEWORDS list.

    Returns:
        all_variants     — deduplicated, lowercased list of all anchor strings
        variant_to_canon — maps every variant → its canonical phrase
        phrase_to_entry  — maps canonical phrase → full wakeword dict
    """
    all_variants:     list[str]       = []
    variant_to_canon: dict[str, str]  = {}
    phrase_to_entry:  dict[str, dict] = {}

    seen: set[str] = set()

    for entry in wakewords:
        canonical  = entry["phrase"].strip().lower()
        raw_variants: list = entry.get("variants", [])

        phrase_to_entry[canonical] = entry

        for raw in raw_variants:
            v = raw.strip().lower()
            if not v:
                continue
            if v not in seen:
                seen.add(v)
                all_variants.append(v)
            # Last writer wins if the same variant appears in two wakewords.
            # This is intentional — keep the most specific (later-defined) mapping.
            variant_to_canon[v] = canonical

    return all_variants, variant_to_canon, phrase_to_entry


_ALL_VARIANTS, _VARIANT_TO_CANON, _PHRASE_TO_ENTRY = _build_index(WAKEWORDS)


# ── Public API ────────────────────────────────────────────────────────────────

def get_variants() -> list[str]:
    """
    Return the deduplicated, lowercased list of all anchor variants.

    Internally flattens all ``"variants"`` lists from WAKEWORDS, e.g.:
        ["arvsal", "arsal", "arzal", "our whistle", "hey arvsal", ...]

    The anchor gate in matcher.py calls this to check whether the ASR
    hypothesis contains a recognizable form of any registered wakeword.
    """
    return _ALL_VARIANTS


def get_canonical(variant: str) -> Optional[str]:
    """
    Map a matched variant string back to its canonical phrase.

    Example:
        get_canonical("our whistle")    → "arvsal"
        get_canonical("wreak up arsel") → "wake up arvsal"
        get_canonical("unknown text")   → None

    Used by the engine to log which wakeword was matched even when the
    ASR transcribed a non-canonical form.
    """
    return _VARIANT_TO_CANON.get(variant.strip().lower())


def get_wakeword_for_phrase(phrase: str) -> Optional[dict]:
    """
    Return the full wakeword config dict for a canonical phrase.

    Example:
        get_wakeword_for_phrase("arvsal")
        → {"phrase": "arvsal", "threshold": 0.72, "variants": [...]}

    Useful for runtime threshold lookup, per-wakeword metadata, or
    building adaptive variant sets without touching matcher.py.
    """
    return _PHRASE_TO_ENTRY.get(phrase.strip().lower())