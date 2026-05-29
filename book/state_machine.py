"""
state_machine.py — BookSession State Machine
============================================
Orchestrates the text-to-book pipeline by coordinating:
  llm_processor -> doc_builder -> converter

Text-In / PDF-Out mode:
  The engine accepts typed Marathi text only. Voice transcription has been
  retired. All incoming strings pass through the two-gate router:

    Gate 1 — Command: structural triggers (paragraph/chapter flush)
    Gate 2 — Prose:   gemma4:e4b polish -> docx append -> PDF compile

Context model (Active Paragraph History):
  context_buffer.json stores 'current_paragraph_content': every polished
  sentence generated since the last paragraph flush. Passed to gemma4:e4b
  on every new clip so the model maintains tonal continuity.

  On /next_paragraph: 'current_paragraph_content' wiped, paragraph counter incremented.
  On /next_chapter:   'current_paragraph_content' wiped, chapter counter incremented.

Command interception (Multi-Layer, Pre-LLM):
  ALL text is run through _intercept_commands() BEFORE it reaches the LLM
  or doc_builder. Command keywords are stripped so they never spill into
  the manuscript.

Python 3.8+ compatible (no X | Y union type-hint syntax).
"""

import json
import re
from datetime import datetime
from pathlib import Path
from enum import Enum, auto
from typing import Tuple, List

import llm_processor
import doc_builder
import converter

from config import (
    CONTEXT_BUFFER_FILE,
    CONTEXT_WINDOW_SIZE,
    CMD_NEXT_PARAGRAPH_MARATHI,
    CMD_NEXT_PARAGRAPH_SLASH,
    CMD_NEXT_CHAPTER_MARATHI,
    CMD_NEXT_CHAPTER_SLASH,
)


class State(Enum):
    IDLE         = auto()
    TRANSCRIBING = auto()
    POLISHING    = auto()
    APPENDING    = auto()


# ── context_buffer.json schema ────────────────────────────────────────────────
#
# {
#   "version": 2,
#   "chapter": 1,
#   "paragraph": 1,
#   "current_paragraph_content": [      <- ← THE KEY CHANGE
#       "पहिले वाक्य.",
#       "दुसरे वाक्य.",
#       ...
#   ],
#   "last_updated": "2026-05-27T21:00:00"
# }


class BookSession:
    """
    Singleton session that processes Telegram updates and drives the
    voice-to-book pipeline.
    """

    def __init__(self):
        self.state = State.IDLE
        # Active Paragraph History — accumulated polished sentences
        # for the paragraph currently being compiled.
        self._current_paragraph_content = []   # type: List[str]
        self._chapter_num  = 1
        self._para_num     = 1
        self._load_context()
        doc_builder.initialise()
        print("[Session] BookSession ready. Chapter={} Para={} Sentences={}".format(
            self._chapter_num, self._para_num,
            len(self._current_paragraph_content)
        ))

    # ── Context buffer persistence ─────────────────────────────────────────

    def _load_context(self):
        # type: () -> None
        """Load the Active Paragraph History from disk (survives restarts)."""
        if CONTEXT_BUFFER_FILE.exists():
            try:
                data = json.loads(
                    CONTEXT_BUFFER_FILE.read_text(encoding="utf-8")
                )
                self._current_paragraph_content = data.get(
                    "current_paragraph_content", []
                )
                self._chapter_num = data.get("chapter", 1)
                self._para_num    = data.get("paragraph", 1)
                print("[Session] Loaded context: {} sentence(s) in current paragraph.".format(
                    len(self._current_paragraph_content)
                ))
            except (json.JSONDecodeError, KeyError, ValueError):
                self._current_paragraph_content = []
        else:
            self._current_paragraph_content = []

    def _save_context(self):
        # type: () -> None
        """Persist the Active Paragraph History atomically."""
        data = {
            "version": 2,
            "chapter":  self._chapter_num,
            "paragraph": self._para_num,
            "current_paragraph_content": self._current_paragraph_content,
            "last_updated": datetime.now().isoformat(timespec="seconds"),
        }
        tmp = CONTEXT_BUFFER_FILE.with_suffix(".json.tmp")
        tmp.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        tmp.replace(CONTEXT_BUFFER_FILE)

    def _push_sentence(self, polished):
        # type: (str) -> None
        """
        Append a polished sentence to the current paragraph content.
        Trims to CONTEXT_WINDOW_SIZE to cap memory use while keeping
        the most recent context for the LLM.
        """
        if polished.strip():
            self._current_paragraph_content.append(polished.strip())
            # Keep only the most recent N sentences if buffer is very long
            if len(self._current_paragraph_content) > CONTEXT_WINDOW_SIZE:
                self._current_paragraph_content = (
                    self._current_paragraph_content[-CONTEXT_WINDOW_SIZE:]
                )
            self._save_context()

    def _flush_paragraph_context(self):
        # type: () -> None
        """Wipe current_paragraph_content; increment paragraph counter."""
        self._current_paragraph_content = []
        self._para_num += 1
        self._save_context()

    def _flush_chapter_context(self):
        # type: () -> None
        """Wipe all paragraph content; increment chapter counter."""
        self._current_paragraph_content = []
        self._chapter_num += 1
        self._para_num = 1
        self._save_context()

    # ── Multi-layer command interception (Task 2) ──────────────────────────

    @staticmethod
    def _sanitize(text):
        # type: (str) -> str
        """
        Pre-process any incoming string before command detection or LLM routing.
        - Collapse whitespace runs to a single space.
        - Strip leading/trailing whitespace.
        """
        text = re.sub(r"[ \t\u200b\u200c\u200d\ufeff]+", " ", text)
        return text.strip()

    @staticmethod
    def _intercept_commands(text):
        # type: (str) -> Tuple[str, str, str]
        """
        Scan text for commands using aggressive, case-insensitive boundary logic.
        If a command is detected, execution stops and NO prose is passed to the LLM.
        """
        clean_input = text.strip().lower().replace("/", "")
        
        # ── Paragraph Commands (Exact matches only)
        para_keywords = ["next_paragraph", "nextparagraph", "पुढील परिच्छेद", "नवीन परिच्छेद"]
        if clean_input in para_keywords:
            return ("paragraph", "", "")

        # ── Chapter Commands (Starts with)
        chap_keywords = ["next_chapter", "nextchapter", "पुढील धडा", "नवीन धडा"]
        for keyword in chap_keywords:
            if clean_input.startswith(keyword):
                # Extract trailing text as the chapter title
                title = clean_input[len(keyword):].strip()
                # Restore original capitalization for the title by slicing original text
                # We need to find where the keyword ended in the original string.
                # Since we stripped slashes and lowercased, a simple substring might fail.
                # A safer way: just take the last N chars from the original string.
                if title:
                    # rough extraction to keep case
                    title_idx = text.lower().replace("/", "").find(title)
                    if title_idx != -1:
                        # try to get original case
                        # for safety, just use the extracted slice but capitalize if english
                        title = title.title() if title.isascii() else title
                
                return ("chapter", title or "नवीन प्रकरण", "")

        # ── No command found — treat as pure prose
        return ("prose", "", text)

    # ── Pipeline stages ────────────────────────────────────────────────────

    def _run_prose_pipeline(self, raw_text):
        # type: (str) -> Tuple[bool, str]
        """
        Shared pipeline for any raw prose string (from voice or text):
          sanitize -> polish -> append -> PDF.

        Returns (success, status_message).
        """
        sanitized = llm_processor.sanitize_transcript(raw_text)
        if not sanitized:
            return (False, "Transcript was empty after sanitization.")

        self.state = State.POLISHING
        polished = llm_processor.polish_transcript(
            sanitized,
            self._current_paragraph_content,
        )

        self.state = State.APPENDING
        doc_builder.append_text(polished)
        self._push_sentence(polished)

        pdf_ok = converter.convert_to_pdf()
        self.state = State.IDLE

        status = (
            "*मजकूर जोडला गेला.*\n"
            "Raw: _{}_\n"
            "Polished: _{}_"
        ).format(
            raw_text[:120].replace("_", " "),
            polished[:120].replace("_", " "),
        )
        if not pdf_ok:
            status += "\nPDF update failed (docx saved)."
        return (True, status)

    def process_text(self, text):
        # type: (str) -> Tuple[bool, str]
        """
        Process a direct Telegram text message (the only input mode).
          sanitize -> command intercept -> route (command | prose pipeline).
        """
        sanitized = self._sanitize(text)
        if not sanitized:
            return (False, "")

        cmd_type, arg, residual = self._intercept_commands(sanitized)
        reply_parts = []

        if cmd_type == "paragraph":
            doc_builder.flush_paragraph()
            self._flush_paragraph_context()
            converter.convert_to_pdf()
            reply_parts.append("*नवीन परिच्छेद सुरू झाला.*")
            # Halt execution here, no LLM processing for residual
            return (True, "\n".join(reply_parts))

        elif cmd_type == "chapter":
            doc_builder.flush_chapter(arg)
            self._flush_chapter_context()
            converter.convert_to_pdf()
            reply_parts.append("*नवीन प्रकरण: {}*".format(arg))
            # Halt execution here, no LLM processing for residual
            return (True, "\n".join(reply_parts))

        # If it's pure prose, run the LLM pipeline
        if cmd_type == "prose":
            ok, prose_status = self._run_prose_pipeline(sanitized)
            reply_parts.append(prose_status)

        return (True, "\n".join(reply_parts) if reply_parts else "")

    def get_pdf_path(self):
        # type: () -> object  # Path or None
        """Return MANUSCRIPT_PDF if it exists, else None."""
        from config import MANUSCRIPT_PDF
        return MANUSCRIPT_PDF if MANUSCRIPT_PDF.exists() else None

    def get_state(self):
        # type: () -> str
        return self.state.name
