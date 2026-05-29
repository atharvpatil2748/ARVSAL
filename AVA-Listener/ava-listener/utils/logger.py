"""
AVAListener — Logger
CRITICAL: All output goes to stderr. stdout is owned exclusively by stdout_bridge.py.

Log levels:
  DEBUG      — all frame-level diagnostics (VAD, ONNX, Sherpa per-frame)
  INFO       — lifecycle events only (wake, speech start/end, stream reset, errors)
  PRODUCTION — errors + wake events only (default when launched from Electron)

Controlled by env var:
  ARVSAL_WAKE_DEBUG=1  → forces DEBUG level
  ARVSAL_LOG_LEVEL=INFO|DEBUG|PRODUCTION

Per-subsystem debug toggles (all default off in PRODUCTION):
  DEBUG_VAD=1      → per-frame VAD probability logs
  DEBUG_ONNX=1     → Silero ONNX input/output per frame
  DEBUG_SHERPA=1   → Sherpa hypothesis per frame
  DEBUG_WAKE=1     → EMA/scoring detail per frame
"""
import logging
import os
import sys

# ── Environment-driven log level ─────────────────────────────────────────────

_ENV_LEVEL = os.environ.get("ARVSAL_LOG_LEVEL", "INFO").strip().lower()
_IS_DEBUG  = os.environ.get("ARVSAL_WAKE_DEBUG", "0") == "1"

LEVEL_MAP = {
    "silent": logging.CRITICAL + 10,
    "error": logging.ERROR,
    "warn": logging.WARNING,
    "warning": logging.WARNING,
    "info": logging.INFO,
    "debug": logging.DEBUG,
    "trace": 5,
}

logging.addLevelName(5, "TRACE")

_ROOT_LEVEL = LEVEL_MAP.get(_ENV_LEVEL, logging.INFO)
if _IS_DEBUG:
    _ROOT_LEVEL = logging.DEBUG

# ── Per-subsystem toggles ─────────────────────────────────────────────

DEBUG_VAD    = _IS_DEBUG or os.environ.get("DEBUG_VAD",    "0") == "1"
DEBUG_ONNX   = _IS_DEBUG or os.environ.get("DEBUG_ONNX",   "0") == "1"
DEBUG_SHERPA = _IS_DEBUG or os.environ.get("DEBUG_SHERPA", "0") == "1"
DEBUG_WAKE   = _IS_DEBUG or os.environ.get("DEBUG_WAKE",   "0") == "1"
DEBUG_TRANSPORT = os.environ.get("DEBUG_TRANSPORT", "0") == "1"
DEBUG_TELEMETRY = os.environ.get("DEBUG_TELEMETRY", "0") == "1"

# ASR transcript logging flags
DEBUG_TRANSCRIPTS = _IS_DEBUG or os.environ.get("DEBUG_TRANSCRIPTS", "0") == "1"
DEBUG_TRANSCRIPT_PARTIAL = DEBUG_TRANSCRIPTS or os.environ.get("DEBUG_TRANSCRIPT_PARTIAL", "0") == "1"
DEBUG_TRANSCRIPT_FINAL = DEBUG_TRANSCRIPTS or os.environ.get("DEBUG_TRANSCRIPT_FINAL", "0") == "1"

# ── Logger factory ────────────────────────────────────────────────────────────

_handler = logging.StreamHandler(sys.stderr)
_handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)-7s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
))


def _trace(self, message, *args, **kwargs):
    if self.isEnabledFor(5):
        self._log(5, message, args, **kwargs)


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.addHandler(_handler)
        logger.setLevel(_ROOT_LEVEL)
    if not hasattr(logger, "trace"):
        setattr(logger, "trace", _trace.__get__(logger, logging.Logger))
    return logger
