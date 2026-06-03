"""
transcriber.py — DEPRECATED
============================
This module has been retired as of the Text-In / PDF-Out refactor.

The book engine no longer accepts voice messages or audio files.
Users dictate via mobile keyboard voice-typing (OS-level), which
delivers plain text directly into the Telegram chat. The text is
then routed through:

  state_machine.py -> llm_processor.py -> doc_builder.py -> converter.py

Nothing in this file is imported or executed by the active pipeline.
It is retained for reference only. Safe to delete.

If audio transcription is re-enabled in the future, restore the
original implementation from git history or the implementation plan.
"""

raise ImportError(
    "transcriber.py is deprecated. "
    "The book engine now operates in Text-In / PDF-Out mode. "
    "Remove this import."
)
