"""
engine.py — ARVSAL Text-to-Book Engine (Main Entry Point)
==========================================================
Pure text-in / PDF-out pipeline. The user types directly from their
mobile keyboard (using the OS voice-typing feature) and every message
is routed through:

  Command Gate  -> paragraph/chapter flush (no LLM call)
  Prose Gate    -> gemma4:e4b polish -> manuscript.docx append -> PDF

No audio files, no ffmpeg, no Whisper. The bot accepts ONLY plain text
from the authorized Telegram chat.

Run independently of the main ARVSAL JS backend:
    cd arvsal/book
    python engine.py

Design:
  - Long-polls the Telegram Bot API (timeout=30s) for minimal latency.
  - Persists the last processed update_id so restarts skip old messages.
  - Only accepts messages from AUTHORIZED_CHAT_IDS (read from .env).
  - Sends a Markdown status reply + the updated manuscript.pdf after
    every successful prose append.

Python 3.8+ compatible (no X | Y union type-hint syntax).
"""

import sys
import time
from pathlib import Path

import requests

from config import (
    TELEGRAM_BOT_TOKEN,
    AUTHORIZED_CHAT_IDS,
    TELEGRAM_POLL_TIMEOUT,
    TELEGRAM_RETRY_DELAY,
    OFFSET_FILE,
    validate_config,
)
from state_machine import BookSession


# ── Telegram API helpers ──────────────────────────────────────────────────────

BASE_URL = "https://api.telegram.org/bot{}".format(TELEGRAM_BOT_TOKEN)


def _tg_get(method, **params):
    # type: (str, ...) -> object
    """GET a Telegram Bot API method. Returns parsed JSON dict or None on error."""
    try:
        resp = requests.get(
            "{}/{}".format(BASE_URL, method),
            params=params,
            timeout=TELEGRAM_POLL_TIMEOUT + 5,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("ok"):
            print("[Telegram] API error ({}): {}".format(
                method, data.get("description")
            ))
            return None
        return data
    except Exception as exc:
        print("[Telegram] GET {} failed: {}".format(method, exc))
        return None


def _tg_post(method, **kwargs):
    # type: (str, ...) -> object
    """POST a Telegram Bot API method. Returns parsed JSON or None on error."""
    try:
        resp = requests.post(
            "{}/{}".format(BASE_URL, method),
            timeout=60,
            **kwargs
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        print("[Telegram] POST {} failed: {}".format(method, exc))
        return None


def send_message(chat_id, text, parse_mode="Markdown"):
    # type: (str, str, str) -> None
    """Send a plain text message to chat_id."""
    _tg_post(
        "sendMessage",
        data={"chat_id": chat_id, "text": text, "parse_mode": parse_mode},
    )


def send_document(chat_id, file_path, caption=""):
    # type: (str, Path, str) -> None
    """Upload a file to chat_id."""
    try:
        with open(str(file_path), "rb") as f:
            _tg_post(
                "sendDocument",
                data={"chat_id": chat_id, "caption": caption},
                files={"document": f},
            )
    except Exception as exc:
        print("[Telegram] sendDocument failed: {}".format(exc))


def send_action(chat_id, action="typing"):
    # type: (str, str) -> None
    """Send a chat action bubble (typing indicator)."""
    _tg_post("sendChatAction", data={"chat_id": chat_id, "action": action})


# ── Update ID persistence ─────────────────────────────────────────────────────

def _load_offset():
    # type: () -> int
    if OFFSET_FILE.exists():
        try:
            return int(OFFSET_FILE.read_text().strip())
        except ValueError:
            pass
    return 0


def _save_offset(offset):
    # type: (int) -> None
    OFFSET_FILE.write_text(str(offset))


# ── Text message handler ──────────────────────────────────────────────────────

def handle_text(update, session):
    # type: (dict, BookSession) -> None
    """
    Route a plain text message through the two-gate pipeline:

      Gate 1 — Command: structural triggers flush paragraph/chapter state.
      Gate 2 — Prose:   text is polished by gemma4:e4b and appended to docx.

    After either gate, the updated manuscript.pdf is sent back.
    """
    msg     = update["message"]
    chat_id = str(msg["chat"]["id"])
    text    = msg.get("text", "").strip()

    if not text:
        return

    # Log first 80 chars for debugging (truncated for safety)
    print("[Engine] Text from {}: \"{}\"".format(chat_id, text[:80]))
    send_action(chat_id, "typing")

    ok, status = session.process_text(text)

    if status:
        send_message(chat_id, status)

    # Always attempt to send the latest PDF regardless of gate taken
    if ok:
        pdf = session.get_pdf_path()
        if pdf:
            send_document(chat_id, pdf, caption="Updated manuscript")


# ── Startup checks ────────────────────────────────────────────────────────────

def startup_check():
    # type: () -> bool
    """Print configuration warnings and abort if credentials are missing."""
    issues = validate_config()
    for issue in issues:
        print("[Engine] WARN: {}".format(issue))

    if not TELEGRAM_BOT_TOKEN:
        print("[Engine] FATAL: No TELEGRAM_BOT_TOKEN. Cannot start.")
        return False

    if not AUTHORIZED_CHAT_IDS:
        print("[Engine] FATAL: No authorized chat IDs. Cannot start.")
        return False

    return True


# ── Main polling loop ─────────────────────────────────────────────────────────

def run():
    # type: () -> None
    """
    Main Telegram long-poll loop. Blocks indefinitely.
    Graceful on network errors — retries after TELEGRAM_RETRY_DELAY seconds.
    Only plain text messages from AUTHORIZED_CHAT_IDS are processed.
    All other message types (voice, audio, photo, sticker, etc.) are silently
    ignored — this is now a text-only pipeline.
    """
    print("=" * 60)
    print("  ARVSAL Text-to-Book Engine  (Text-In / PDF-Out)")
    print("  Authorized chats: {}".format(AUTHORIZED_CHAT_IDS))
    print("  Poll timeout    : {}s".format(TELEGRAM_POLL_TIMEOUT))
    print("=" * 60)

    if not startup_check():
        sys.exit(1)

    session = BookSession()
    last_update_id = _load_offset()
    print("[Engine] Resuming from update_id={}".format(last_update_id))

    # Startup notification — brief usage reminder
    for chat_id in AUTHORIZED_CHAT_IDS:
        send_message(
            chat_id,
            "*Book Engine चालू झाला.* (Text-In / PDF-Out)\n\n"
            "मोबाइल कीबोर्डवर बोलून टाइप करा — प्रत्येक संदेश थेट पुस्तकात जाईल.\n\n"
            "*आदेश:*\n"
            "`पुढील परिच्छेद` किंवा `/next_paragraph` — नवीन परिच्छेद\n"
            "`पुढील धडा [शीर्षक]` किंवा `/next_chapter [Title]` — नवीन प्रकरण",
        )

    while True:
        try:
            offset = last_update_id + 1 if last_update_id else None
            data = _tg_get(
                "getUpdates",
                offset=offset,
                timeout=TELEGRAM_POLL_TIMEOUT,
                # Only subscribe to message updates — ignore inline, callback, etc.
                allowed_updates='["message"]',
            )

            if data is None:
                print("[Engine] Polling error — retrying in {}s ...".format(
                    TELEGRAM_RETRY_DELAY
                ))
                time.sleep(TELEGRAM_RETRY_DELAY)
                continue

            updates = data.get("result", [])

            for update in updates:
                uid = update["update_id"]
                last_update_id = uid
                _save_offset(uid)

                msg = update.get("message")
                if not msg:
                    continue

                chat_id = str(msg["chat"]["id"])

                # Authorization gate — silently drop unauthorized senders
                if chat_id not in AUTHORIZED_CHAT_IDS:
                    print("[Engine] Unauthorized message from {} — ignored.".format(
                        chat_id
                    ))
                    continue

                # Text-only gate — ignore voice, audio, photo, sticker, etc.
                if "text" in msg:
                    handle_text(update, session)
                else:
                    # Inform the user we only accept typed text in this mode
                    msg_type = next(
                        (k for k in ("voice", "audio", "photo", "video",
                                     "document", "sticker", "animation")
                         if k in msg),
                        "unknown"
                    )
                    send_message(
                        chat_id,
                        "हे {} संदेश स्वीकारले जात नाहीत.\n"
                        "कृपया मोबाइल कीबोर्डचा व्हॉइस-टाइपिंग वापरून "
                        "मराठी मजकूर पाठवा.".format(msg_type)
                    )

        except KeyboardInterrupt:
            print("\n[Engine] Shutting down gracefully.")
            for chat_id in AUTHORIZED_CHAT_IDS:
                send_message(chat_id, "Book engine बंद झाला.")
            break

        except Exception as exc:
            print("[Engine] Unhandled error in poll loop: {}".format(exc))
            time.sleep(TELEGRAM_RETRY_DELAY)


if __name__ == "__main__":
    run()
