"""
AVAListener — Central Configuration
All tunable parameters live here. No magic numbers anywhere else.
"""
import os

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")

# ── ASR / Audio ───────────────────────────────────────────────────────────────
SAMPLE_RATE  = 16000
BLOCK_SIZE   = 1600   # 100ms chunks — optimal latency/stability balance
TRAILING_PAD_FRAMES = 2  # silent chunks fed to Sherpa after VAD gates off (200ms)
NUM_THREADS  = 2      # Sherpa ONNX inference threads

# Sherpa endpoint detection (seconds of silence before stream finalizes)
ENDPOINT_RULE1_SILENCE  = 0.6   # 600ms trailing silence to finalize (wakeword-tuned)
ENDPOINT_RULE2_SILENCE  = 1.2   # hard commit sooner
ENDPOINT_RULE3_UTTERANCE = 20.0  # max utterance length

# Silence reset: how many consecutive silent chunks before ASR stream resets
SILENCE_RESET_FRAMES = 30       # 30 × 100ms = 3s — extended so endpoint fires before reset

# ── VAD & Endpointing (Phase 4A) ────────────────────────────────────────────────────────
VAD_AGGRESSIVENESS       = 1        # 0=least, 3=most aggressive (reduced to 1 to preserve soft speech)
VAD_FRAME_SAMPLES        = 480      # 30ms at 16kHz (WebRTC max)
RMS_FLOOR                = 0.005    # Absolute minimum energy to be considered speech fallback
SILERO_THRESHOLD         = 0.15     # Reduced for calibration; tune upward later
DEBUG_VAD_BYPASS         = True     # If True, logs VAD stats but lets ALL audio reach ASR

# Adaptive noise floor and speech confirmation
NOISE_FLOOR_MULTIPLIER   = 1.8      # energy must exceed [noise_floor * multiplier]
NOISE_HISTORY_FRAMES     = 40       # ~4s of recent silence RMS values used for median
MIN_SPEECH_FRAMES        = 3        # consecutive speech-positive frames before speech_start
MIN_SILENCE_FRAMES       = 8        # consecutive silence frames before speech_end
MIN_SPEECH_MS            = 250      # minimal acceptable speech segment before confidence begins
MIN_VALID_UTTERANCE_MS   = 600      # utterances shorter than this are treated as noise

# Smart reset / stream lifetime policy
RESET_COOLDOWN_SECONDS   = 15.0     # seconds between ASR stream resets
IDLE_STREAM_TIMEOUT_S    = 60.0     # reset when the stream stays idle this long

# ── Detection — Multi-Wakeword Schema ─────────────────────────────────────────
#
# Each wakeword entry:
#   "phrase"     — canonical wakeword returned in wake events and logs
#   "threshold"  — per-phrase EMA-smoothed confidence required to fire
#   "variants"   — phonetic/ASR-misrecognition transcriptions of this phrase
#                  The anchor gate checks these; they ARE NOT matched against
#                  the fuzzy scorer. Only the canonical phrase is fuzzy-scored.
#
# Design principles:
#   - Variants are co-located with the phrase they belong to (single source of truth)
#   - Adding a new wakeword = one dict entry here, zero changes elsewhere
#   - Variants are deduplicated and lowercased at import time by variants.py
#   - Future extensions (per-variant thresholds, phonetic metadata, multilingual
#     labels) slot in as extra keys on each dict without touching other files.
#
WAKEWORDS = [
    {
        "phrase":    "arvsal",
        "threshold": 0.72,
        "variants": [
            # Exact spellings
            "arvsal",
            "arsal",
            "arzal",
            "arsel",
            "armsel",
            # Space-separated / tokenized
            "arv sal",
            "ar sal",
            # Phonetic near-matches
            "our whistle",
            "or whistle",
            "ourvsel",
            "aircel",
            "ahsal",
            "arv",
        ],
    },
    {
        "phrase":    "hey arvsal",
        "threshold": 0.68,
        "variants": [
            "hey arvsal",
            "hey arsal",
            "hey arsel",
            "hey armsel",
            "hey arzal",
            "hey ar sal",
            "he arbezal",
            "hey our whistle",
            "hey or whistle",
            "wake up our whistle",
            "wake upon whistle",
        ],
    },
    {
        "phrase":    "wake up arvsal",
        "threshold": 0.68,
        "variants": [
            "wake up arvsal",
            "wake up arsal",
            "wake up arsel",
            "wake up our whistle",
            "wake upon whistle",
            "wreak up arvsal",
            "wreak up arsel",
            "wreak up our whistle",
        ],
    },
    {
        "phrase":    "listen arvsal",
        "threshold": 0.72,
        "variants": [
            "listen arvsal",
            "listen arsal",
            "listen arsel",
            "listen our whistle",
        ],
    },
    {
        "phrase":    "listen buddy",
        "threshold": 0.72,
        "variants": [
            "list buddy",
            "listen bud",
            "listen bad",
            "listen badie",
        ],
    },
    {
        "phrase":    "listen",
        "threshold": 0.72,
        "variants": [
            "listen",
            "listen",
            "listen",
            "listen",
        ],
    },
]

# Backward-compat derived list — matcher.py still reads this for the phrase loop.
# variants.py builds the anchor set from WAKEWORDS directly.
WAKE_PHRASES = [w["phrase"] for w in WAKEWORDS]

# Fallback threshold for any matched phrase not found in WAKEWORDS.
DEFAULT_THRESHOLD = 0.78

# ── Matching ──────────────────────────────────────────────────────────────────

# Context words expected before the wake token, keyed by canonical phrase.
# Used by matcher._context_score() to reward proper preamble presence.
CONTEXT_WORDS = {
    "arvsal":           [],
    "hey arvsal":       ["hey"],
    "wake up arvsal":   ["wake", "up"],
    "listen arvsal":    ["listen"],
}

# Jaro-Winkler similarity threshold for anchor matching (0–1)
JARO_THRESHOLD = 0.82

# rapidfuzz token_set_ratio threshold (0–100)
# Anchor gate (JARO 0.82) is the hard semantic guard; fuzzy can be looser here.
FUZZY_THRESHOLD = 65

# ── Confidence ────────────────────────────────────────────────────────────────
# Engine uses DEFAULT_THRESHOLD + per-phrase WAKEWORDS thresholds.
# CONFIDENCE_THRESHOLD kept as alias for scorer.py backward compat.
DEFAULT_THRESHOLD    = 0.78
CONFIDENCE_THRESHOLD = DEFAULT_THRESHOLD
WINDOW_SECONDS       = 3.5     # rolling hypothesis window width

# Weights inside compute_confidence()
WEIGHT_MATCH      = 0.65
WEIGHT_CONTEXT    = 0.20
WEIGHT_STABILITY  = 0.15

# EMA confidence smoothing (smoothed = α·raw + (1-α)·prev)
# Use asymmetric alpha for faster rise and smoother decay.
EMA_RISE_ALPHA   = 0.70
EMA_DECAY_ALPHA  = 0.30

# Stability saturation cap — stab > CAP adds no scoring benefit
STABILITY_CAP = 12

# ── Cooldown ──────────────────────────────────────────────────────────────────
COOLDOWN_SECONDS = 2.0   # hard block after any trigger

# ── Audio pipeline queue ──────────────────────────────────────────────────────
AUDIO_QUEUE_MAX      = 20    # warn when queue > this (2s backlog)
WORKER_QUEUE_TIMEOUT = 1.0   # worker blocks this long on empty queue (clean shutdown)

# ── IPC / Bridge ─────────────────────────────────────────────────────────────
HEARTBEAT_INTERVAL_S = 5.0   # heartbeat emit frequency

# ── Phrase arbitration / runtime policy ───────────────────────────────────────
PHRASE_PRIORITY_MODE = "longest"  # longest / score / canonical

# ── Telemetry / production diagnostics ───────────────────────────────────────
METRICS_TO_DISK = False
METRICS_FILE_PATH = os.path.join(BASE_DIR, "runtime_metrics.json")

# ── Logging defaults (can be overridden with environment variables) ────────
LOG_LEVEL = "info"
LOG_DEBUG_SUBSYSTEMS = {
    "vad": False,
    "asr": False,
    "matcher": False,
    "transport": False,
    "telemetry": False,
}

# ── ASR Transcript Logging ────────────────────────────────────────────────────
# Enable structured realtime transcript logging for debugging and observability
DEBUG_TRANSCRIPTS = False  # Log all partial and final transcripts with metadata
DEBUG_TRANSCRIPT_PARTIAL = False  # Log only partial transcripts (high volume)
DEBUG_TRANSCRIPT_FINAL = False    # Log only final transcripts (low volume)
