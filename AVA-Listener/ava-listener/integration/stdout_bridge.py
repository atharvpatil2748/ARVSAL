"""
AVAListener — stdout Bridge
CRITICAL RULE: This is the ONLY module that writes to stdout.
All other modules must use utils/logger.py (→ stderr).

Wire protocol: one JSON object per line, always terminated with \n.
Node.js reads stdout line by line and parses each line as JSON.
"""
import sys
import json
import time
import threading
from config.settings import HEARTBEAT_INTERVAL_S


# ── Event emitters ────────────────────────────────────────────────────────────

def _emit(payload: dict) -> None:
    """Write a single JSON line to stdout and flush immediately."""
    line = json.dumps(payload, separators=(",", ":"))
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def emit_wake(phrase: str, raw_confidence: float, smooth_confidence: float, latency_ms: float = 0.0) -> None:
    """Emit a wake detection event."""
    _emit({
        "event":             "wake",
        "phrase":            phrase,
        "raw_confidence":    round(raw_confidence, 3),
        "smooth_confidence": round(smooth_confidence, 3),
        "latency_ms":        round(latency_ms, 1),
        "ts":                time.time(),
    })


def emit_status(status: str, detail: str = "") -> None:
    """Emit a lifecycle status event (ready / stopped / error)."""
    _emit({
        "event":  "status",
        "status": status,
        "detail": detail,
        "ts":     time.time(),
    })


def emit_error(message: str) -> None:
    """Emit a recoverable error event."""
    _emit({
        "event":   "error",
        "message": message,
        "ts":      time.time(),
    })


# ── Heartbeat ─────────────────────────────────────────────────────────────────

def start_heartbeat() -> None:
    """
    Start a daemon thread that emits a heartbeat every HEARTBEAT_INTERVAL_S.
    Node.js uses this to detect silent crashes (if heartbeat stops → restart).
    Daemon=True means it dies automatically when main thread exits.
    """
    start_time = time.time()

    def _loop():
        while True:
            time.sleep(HEARTBEAT_INTERVAL_S)
            _emit({
                "event":     "heartbeat",
                "uptime_s":  round(time.time() - start_time, 1),
                "ts":        time.time(),
            })

    t = threading.Thread(target=_loop, daemon=True, name="heartbeat")
    t.start()
