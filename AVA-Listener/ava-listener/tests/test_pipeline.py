# -*- coding: utf-8 -*-
"""
AVAListener -- Offline Test Pipeline (Phase 3)
Tests the detection pipeline WITHOUT a microphone.
Feed pre-recorded hypotheses and verify anchor gate + scoring behavior.

Usage:
    cd wakeword
    venv\\Scripts\\python tests\\test_pipeline.py

Test sections:
  1. Anchor Gate Tests
  2. Pipeline Tests (score + confidence + threshold)
  3. Variant Schema Tests (variant→canonical mapping, deduplication)
"""
import sys
import os

# Force UTF-8 output on Windows so Unicode prints correctly
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from detection.matcher import best_match, anchor_present
from detection.variants import get_variants, get_canonical, get_wakeword_for_phrase
from confidence.scorer import compute_confidence
from decision.cooldown import CooldownGate

# ── Per-phrase threshold lookup ───────────────────────────────────────────────
from config.settings import WAKEWORDS, DEFAULT_THRESHOLD
_PHRASE_THRESHOLDS = {w["phrase"]: w["threshold"] for w in WAKEWORDS}

def _threshold_for(phrase: str) -> float:
    return _PHRASE_THRESHOLDS.get(phrase, DEFAULT_THRESHOLD)


# ── Test data ─────────────────────────────────────────────────────────────────
# (description, list of (hypothesis, stability) pairs, expect_trigger: bool)
TEST_CASES = [
    # ── True positives — canonical phrases ───────────────────────────────────
    ("bare arvsal",           [("arvsal", 3)],                     True),
    ("hey arvsal",            [("hey arvsal", 4)],                 True),
    ("wake up arvsal",        [("wake up arvsal", 3)],             True),
    ("listen arvsal",         [("listen arvsal", 2)],              True),

    # ── True positives — phonetic variants ───────────────────────────────────
    ("arsal variant",         [("hey arsal", 3)],                  True),
    ("arsel variant",         [("hey arsel", 2)],                  True),
    ("ar sal spaced",         [("hey ar sal", 3)],                 True),
    ("our whistle",           [("our whistle", 3)],                True),   # NEW: real misrecognition
    ("wake up our whistle",   [("wake up our whistle", 3)],        True),   # NEW: from live logs
    ("wreak up our whistle",  [("wreak up our whistle", 3)],       False),  # two substitutions; needs EMA live
    ("hey our whistle",       [("hey our whistle", 4)],            True),   # NEW: variant

    # ── True positives — multi-chunk buildup ─────────────────────────────────
    ("arzal variant",         [("arzal", 3)],                      True),   # registered variant → triggers with variant-boost
    ("arzal with context",    [("hey arzal", 4), ("hey arzal", 5)], True),
    ("multi-chunk buildup",   [("hey", 0), ("hey arv", 1),
                               ("hey arvsal", 3)],                 True),

    # ── False positives (must NOT trigger) ───────────────────────────────────
    ("empty",                 [],                                   False),
    ("random speech",         [("the weather is nice today", 4)],  False),
    ("context only no anchor",[("wake up", 3)],                    False),
    ("hey alone",             [("hey", 5)],                        False),
    ("wake up ourselves",     [("wake up ourselves", 4)],          False),
    ("unrelated high stability",[("open the browser please", 6)],  False),
    ("arsenal false",         [("arsenal football club", 3)],      False),
]


# ── Anchor Gate Tests ─────────────────────────────────────────────────────────

def run_anchor_tests() -> bool:
    anchor_cases = [
        # Canonical phrases
        ("arvsal",              True),
        ("arsal",               True),
        ("ar sal",              True),
        ("arsel",               True),
        ("arsenal",             True),
        ("hey arvsal",          True),
        ("wake up arvsal",      True),
        # Phonetic variants (must now pass — embedded in WAKEWORDS)
        ("our whistle",         True),
        ("or whistle",          True),
        ("wake up our whistle", True),
        ("wreak up our whistle",True),
        ("hey our whistle",     True),
        # Must NOT pass
        ("wake up",             False),
        ("hey",                 False),
        ("hello world",         False),
    ]

    print(f"\n{'='*56}")
    print("  Anchor Gate Tests")
    print(f"{'='*56}")
    all_ok = True
    for text, expected in anchor_cases:
        result = anchor_present(text)
        ok = result == expected
        if not ok:
            all_ok = False
        mark = "PASS" if ok else "FAIL"
        print(f"  [{mark}]  anchor_present({text!r:<26}) = {result}  (expected {expected})")
    print(f"{'='*56}\n")
    return all_ok


# ── Pipeline Tests ────────────────────────────────────────────────────────────

def run_tests() -> bool:
    passed = 0
    failed = 0

    print(f"\n{'='*75}")
    print(f"  AVAListener -- Pipeline Test ({len(TEST_CASES)} cases)")
    print(f"{'='*75}")

    for name, window, expect_trigger in TEST_CASES:
        score, phrase, matched_variant = best_match(window)
        confidence = compute_confidence(score, len(window), 0)
        threshold  = _threshold_for(phrase)
        triggered  = confidence >= threshold

        ok = triggered == expect_trigger
        status = "[PASS]" if ok else "[FAIL]"

        if ok:
            passed += 1
        else:
            failed += 1

        print(
            f"  {status}  {name:<28} "
            f"score={score:.2f}  conf={confidence:.2f}  threshold={threshold:.2f}  "
            f"phrase={phrase!r:<20}  variant={matched_variant!r}"
        )

    print(f"{'='*75}")
    print(f"  Results: {passed}/{len(TEST_CASES)} passed", end="")
    if failed:
        print(f"  ({failed} FAILED)")
    else:
        print("  — all good ✓")
    print(f"{'='*75}\n")

    return failed == 0


# ── Variant Schema Tests ──────────────────────────────────────────────────────

def run_variant_tests() -> bool:
    """
    Test the variants.py public API:
      - get_variants()         returns a non-empty deduplicated list
      - get_canonical(variant) maps correctly to canonical phrase
      - get_wakeword_for_phrase returns the full entry dict
      - deduplication works
    """
    print(f"\n{'='*56}")
    print("  Variant Schema Tests")
    print(f"{'='*56}")

    all_ok = True
    cases: list[tuple[str, object, object]] = []

    # ── Deduplication ─────────────────────────────────────────────────────────
    variants = get_variants()
    dedup_ok = len(variants) == len(set(variants))
    cases.append(("deduplication: no duplicates in get_variants()", True, dedup_ok))

    # ── All variants are lowercase ─────────────────────────────────────────────
    lowercase_ok = all(v == v.lower() for v in variants)
    cases.append(("all variants are lowercase", True, lowercase_ok))

    # ── Canonical mappings ─────────────────────────────────────────────────────
    canon_cases = [
        ("arvsal",              "arvsal"),
        ("arsal",               "arvsal"),
        ("our whistle",         "arvsal"),
        ("or whistle",          "arvsal"),
        ("hey arvsal",          "hey arvsal"),
        ("hey arsel",           "hey arvsal"),
        ("hey our whistle",     "hey arvsal"),
        ("wake up our whistle", "wake up arvsal"),
        ("wreak up arsel",      "wake up arvsal"),
        ("listen arsal",        "listen arvsal"),
        ("nonexistent phrase",  None),
    ]
    for variant, expected_canon in canon_cases:
        result = get_canonical(variant)
        ok = result == expected_canon
        cases.append((f"get_canonical({variant!r}) = {expected_canon!r}", expected_canon, result))

    # ── get_wakeword_for_phrase ────────────────────────────────────────────────
    entry = get_wakeword_for_phrase("arvsal")
    cases.append(("get_wakeword_for_phrase('arvsal') returns dict", True, isinstance(entry, dict)))
    if isinstance(entry, dict):
        cases.append(("  ... has 'variants' key", True, "variants" in entry))
        cases.append(("  ... has 'threshold' key", True, "threshold" in entry))
        cases.append(("  ... 'our whistle' in variants", True, "our whistle" in entry.get("variants", [])))

    cases.append(("get_wakeword_for_phrase('unknown') = None", None, get_wakeword_for_phrase("unknown")))

    # ── Multi-wakeword: all canonical phrases present ─────────────────────────
    for w in WAKEWORDS:
        phrase = w["phrase"]
        entry  = get_wakeword_for_phrase(phrase)
        cases.append((f"phrase {phrase!r} in index", True, entry is not None))

    # ── Print results ─────────────────────────────────────────────────────────
    for desc, expected, actual in cases:
        ok = actual == expected
        if not ok:
            all_ok = False
        mark = "PASS" if ok else "FAIL"
        print(f"  [{mark}]  {desc}")
        if not ok:
            print(f"         expected={expected!r}  actual={actual!r}")

    print(f"{'='*56}\n")
    return all_ok


if __name__ == "__main__":
    anchor_ok  = run_anchor_tests()
    variant_ok = run_variant_tests()
    pipeline_ok = run_tests()
    sys.exit(0 if (anchor_ok and variant_ok and pipeline_ok) else 1)
