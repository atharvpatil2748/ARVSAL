"""
converter.py — LibreOffice Headless PDF Converter
==================================================
Converts manuscript.docx → manuscript.pdf using LibreOffice in headless
mode. Runs after every document mutation so the PDF is always up-to-date.

Why headless soffice instead of the libreoffice-convert npm package:
  - This is a standalone Python process — the npm module is not available.
  - soffice --headless is the same underlying mechanism the npm package uses.
  - Equivalent to: soffice --headless --convert-to pdf --outdir <dir> <docx>

Important: Only one LibreOffice process may run at a time (file lock).
The converter enforces a simple file-based mutex for that reason.
"""

import subprocess
import time
import os
from pathlib import Path

from config import SOFFICE_EXE, MANUSCRIPT_DOCX, MANUSCRIPT_PDF, BOOK_DIR


# ── Mutex: prevent concurrent soffice invocations ────────────────────────────
_LOCK_FILE = BOOK_DIR / ".soffice.lock"
_LOCK_TIMEOUT = 60   # seconds before giving up on a stale lock


def _acquire_lock() -> bool:
    """Return True if lock acquired, False on timeout."""
    deadline = time.monotonic() + _LOCK_TIMEOUT
    while time.monotonic() < deadline:
        try:
            # Atomic create — fails if file exists
            fd = os.open(str(_LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.close(fd)
            return True
        except FileExistsError:
            time.sleep(1)
    return False


def _release_lock() -> None:
    try:
        _LOCK_FILE.unlink(missing_ok=True)
    except OSError:
        pass


# ── Core conversion ───────────────────────────────────────────────────────────

def convert_to_pdf() -> bool:
    """
    Convert the current manuscript.docx to manuscript.pdf.

    Returns:
        True on success, False on failure.
    """
    if not MANUSCRIPT_DOCX.exists():
        print("[Converter] ⚠ manuscript.docx not found — skipping PDF conversion.")
        return False

    if not SOFFICE_EXE.exists():
        print(f"[Converter] ⚠ soffice.exe not found at: {SOFFICE_EXE}")
        return False

    if not _acquire_lock():
        print("[Converter] ⚠ Could not acquire soffice lock — another conversion is running.")
        return False

    try:
        print("[Converter] 🖨 Converting manuscript.docx → manuscript.pdf …")
        t0 = time.monotonic()

        cmd = [
            str(SOFFICE_EXE),
            "--headless",
            "--convert-to", "pdf",
            "--outdir", str(BOOK_DIR),
            str(MANUSCRIPT_DOCX),
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=60,       # 60s hard timeout for large documents
            cwd=str(BOOK_DIR),
            creationflags=0x08000000,   # CREATE_NO_WINDOW on Windows
        )

        elapsed = time.monotonic() - t0

        if result.returncode != 0:
            err_text = result.stderr.decode(errors="replace").strip()
            print(f"[Converter] ❌ soffice failed (code {result.returncode}): {err_text}")
            return False

        # soffice outputs "<docx_name>.pdf" in --outdir
        # The file will be named "manuscript.pdf" which matches MANUSCRIPT_PDF
        generated = BOOK_DIR / "manuscript.pdf"
        if not generated.exists():
            print("[Converter] ❌ PDF not found after conversion.")
            return False

        print(f"[Converter] ✅ PDF ready ({elapsed:.1f}s) → {generated}")
        return True

    except subprocess.TimeoutExpired:
        print("[Converter] ⏰ soffice TIMEOUT after 60s.")
        return False

    except Exception as exc:
        print(f"[Converter] ❌ Unexpected error: {exc}")
        return False

    finally:
        _release_lock()
