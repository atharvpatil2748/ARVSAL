"""
config.py — ARVSAL Book Engine Configuration
=============================================
Loads all paths and credentials from the parent ARVSAL .env file.
This module is READ-ONLY with respect to the JS codebase — it never
modifies any existing file.

Text-In / PDF-Out mode:
  Whisper, ffmpeg, and all audio paths have been removed.
  The engine accepts typed text only; Ollama + LibreOffice remain.

Resolved values (verified by system scan on 2026-05-27):
  SOFFICE    : C:/Program Files/LibreOffice/program/soffice.exe
  OLLAMA_EXE : C:/Users/athar/AppData/Local/Programs/Ollama/ollama.exe
"""

import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# ── Locate repo root (.env lives there) ──────────────────────────────────────
# book/ is one level below arvsal/, so __file__ -> book/ -> arvsal/
_BOOK_DIR  = Path(__file__).resolve().parent   # arvsal/book/
_REPO_ROOT = _BOOK_DIR.parent                  # arvsal/

# Load .env from the ARVSAL root — READ ONLY, never written
_ENV_PATH = _REPO_ROOT / ".env"
if not _ENV_PATH.exists():
    raise FileNotFoundError(
        "[BookEngine] ARVSAL .env not found at: {}\n"
        "The book engine must live inside the ARVSAL repository.".format(_ENV_PATH)
    )
load_dotenv(dotenv_path=_ENV_PATH, override=False)


# ── Telegram ─────────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")  # type: str
TELEGRAM_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID", "")    # type: str

# Comma-separated list of authorized senders — only TELEGRAM_CHAT_ID by default
AUTHORIZED_CHAT_IDS = [                                    # type: List[str]
    cid.strip()
    for cid in os.getenv("BOOK_AUTHORIZED_CHATS", TELEGRAM_CHAT_ID).split(",")
    if cid.strip()
]


# ── Ollama ────────────────────────────────────────────────────────────────────
OLLAMA_EXE = Path(os.getenv("OLLAMA_EXE", r"C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe"))
OLLAMA_MODEL       = "gemma4:e4b"  # forced per specification
OLLAMA_TIMEOUT_SEC = 120


# ── LibreOffice headless ──────────────────────────────────────────────────────
SOFFICE_EXE = Path(os.getenv("SOFFICE_EXE", r"C:\Program Files\LibreOffice\program\soffice.exe"))


# ── Book engine internal paths ────────────────────────────────────────────────
BOOK_DIR            = _BOOK_DIR
MANUSCRIPT_DOCX     = _BOOK_DIR / "manuscript.docx"
MANUSCRIPT_PDF      = _BOOK_DIR / "manuscript.pdf"
CONTEXT_BUFFER_FILE = _BOOK_DIR / "context_buffer.json"
OFFSET_FILE         = _BOOK_DIR / ".last_update_id"


# ── Context window settings ───────────────────────────────────────────────────
# Max sentences retained in current_paragraph_content before trimming.
CONTEXT_WINDOW_SIZE = 20


# ── Telegram polling ──────────────────────────────────────────────────────────
TELEGRAM_POLL_TIMEOUT = 30   # seconds (long-poll)
TELEGRAM_RETRY_DELAY  = 5    # seconds between error retries


# ── Command interceptors (Marathi + slash equivalents) ────────────────────────
CMD_NEXT_PARAGRAPH_MARATHI = "पुढील परिच्छेद"
CMD_NEXT_PARAGRAPH_SLASH   = "/next_paragraph"
CMD_NEXT_CHAPTER_MARATHI   = "पुढील धडा"
CMD_NEXT_CHAPTER_SLASH     = "/next_chapter"


# ── Startup validation ────────────────────────────────────────────────────────
def validate_config():
    # type: () -> List[str]
    """
    Returns a list of warnings for any missing critical resource.
    The engine CAN start with warnings but features will be degraded.
    """
    issues = []

    if not TELEGRAM_BOT_TOKEN:
        issues.append("TELEGRAM_BOT_TOKEN is empty — Telegram polling disabled.")
    if not TELEGRAM_CHAT_ID:
        issues.append("TELEGRAM_CHAT_ID is empty — no authorized chat configured.")
    if not OLLAMA_EXE.exists():
        issues.append("ollama.exe not found: {}".format(OLLAMA_EXE))
    if not SOFFICE_EXE.exists():
        issues.append("soffice.exe not found: {}".format(SOFFICE_EXE))

    return issues
