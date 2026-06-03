# ARVSAL Manual Restructure Execution Guide
**Version:** 1.0 | **Generated:** 2026-05-30 | **Source Reports:** 9 architecture analysis documents
**Purpose:** Complete human-executable migration handbook. A developer following this guide must never need to consult any other report.

> [!IMPORTANT]
> This is a **documentation-only guide**. No file has been moved, renamed, or edited in its creation. All commands in this guide are for the developer to execute manually at their own pace. Read each phase fully before starting it.

---

# TABLE OF CONTENTS

| Section | Title |
|---------|-------|
| 1 | Executive Summary |
| 2 | Prerequisites & Safety |
| 3 | Migration Phases Overview |
| 4 | Runtime Migration Guide (External Dependencies) |
| 5 | Folder Restructure Guide |
| 6 | Import Refactor Guide |
| 7 | Dead Code Cleanup Guide |
| 8 | Configuration Migration Guide |
| 9 | Startup Graph Impact Analysis |
| 10 | Verification Checklist |
| 11 | Rollback Playbook |
| 12 | Final Execution Timeline |

---

# SECTION 1 — EXECUTIVE SUMMARY

## 1.1 Current Architecture Overview

ARVSAL is a production-active, Electron-based AI voice assistant running on Windows. The current state is:

```
arvsal/                          ← Git repository root
├── electron/                    ← Electron shell (main process + renderer)
├── backend/                     ← Node.js Express server — 1828-line MONOLITH
│   ├── agent/                   ← Autonomous screen-action agent (11 files)
│   ├── arvsal-vision/           ← OmniTool vision submodule (Git)
│   ├── email/                   ← Email integration (Puppeteer)
│   ├── logs/                    ← Runtime log files (next to source)
│   ├── profiles/                ← Wake-word profiles (misplaced config)
│   ├── python_worker/           ← YOLO UI detector (Python)
│   ├── safety/                  ← Risk/confirmation engine
│   ├── tools/                   ← Tool registry
│   └── utils/                   ← Temp manager + power monitor
├── book/                        ← Standalone Python Text-In/PDF-Out engine
├── frontend/                    ← Legacy browser UI (unused)
├── whisper.cpp/                 ← Git submodule (compiled STT binary + models)
├── .wwebjs_auth/                ← WhatsApp session (root level — wrong)
├── .wwebjs_cache/               ← WhatsApp cache (root level — wrong)
└── cookies.json                 ← Email cookies (root level — wrong)
```

**Critical problems in the current architecture:*| Problem | Impact |
|---------|--------|
| `backend/server.js` is 1828 lines — a monolith containing all routes, helpers, constants, and business logic | Impossible to test, maintain, or extend individual features |
| 7+ hardcoded absolute Windows paths (e.g., `C:\Users\athar\Downloads\ffmpeg...`) | Zero portability — breaks on any other machine or after OS reinstall |
| All external binaries (FFmpeg, Piper, Whisper) live outside the repository | Cannot clone-and-run; no self-contained setup |
| Runtime data (`.json` files, logs) stored next to source code | Pollutes git history; data leaks into commits |
| Session files (`.wwebjs_auth/`, `cookies.json`) at repo root | Security risk; ugly project structure |
| ~12 dead/stub files still present | Confuses contributors; wastes cognitive overhead |
| ~110 source files in a flat `backend/` directory | No domain separation; hard to navigate |
| 487 MB duplicate Whisper model at `whisper.cpp/ggml-small.en.bin` | Massive wasted disk space |

## 1.2 Target Architecture Overview

The V2 architecture restructures ARVSAL into a clean, domain-driven layout:

```
arvsal/
├── apps/            ← Electron shell ONLY (no business logic)
├── core/            ← Pure AI logic (intent, memory, reasoning, personality)
├── providers/       ← LLM + AI provider clients (Ollama, OpenAI, Gemini, Groq)
├── agents/          ← Autonomous agent system + skills
├── modules/         ← Feature subsystems (STT, TTS, Vision, Wake, Reflection)
├── integrations/    ← External service bridges (Telegram, WhatsApp, Email)
├── tools/           ← Agentic tool system
├── safety/          ← Risk and safety management
├── utils/           ← Shared pure utility functions
├── actions/         ← Intent action implementations
├── data/            ← Runtime data files (gitignored)
├── runtime/         ← External binaries + models (gitignored)
├── vision/          ← arvsal-vision Python submodule (top-level)
├── book/            ← Standalone book engine (unchanged)
├── stt/             ← whisper.cpp submodule (organized)
├── config/          ← Static configuration (profiles, .env.example)
└── docs/            ← All documentation
```

## 1.3 Why Restructuring Is Needed

1. **Portability:** Hardcoded `C:\Users\athar\Downloads\` paths make ARVSAL impossible to run on any other machine without manually editing source files.
2. **Maintainability:** 3. **Security:** `totp_secret.json`, `cookies.json`, and `.wwebjs_auth/` are at or near the repo root with inadequate gitignore guards.
4. **Developer Experience:** Flat `backend/` with 110+ files gives no structural signal about what each file does or which domain it belongs to.
5. **Data Hygiene:** 1.2 MB episodic memory JSON, 620 KB vector store, and 5.9 MB screenshot are committed alongside source code.
6. **Disk Waste:** A 487 MB duplicate Whisper model exists at `whisper.cpp/ggml-small.en.bin`.

## 1.4 Expected Benefits

| Benefit | How Achieved |
|---------|-------------|
| Clone-and-run portability | `runtime/` directory + env vars replace all hardcoded paths |
| Testable components | Domain-separated modules can be tested in isolation |
| Onboarding speed | New contributors navigate by domain (`core/`, `agents/`, `modules/`) |
| Safe data separation | `data/` is gitignored; source is clean |
| Reduced repo size | Dead code, duplicate model, and runtime artifacts removed |
| Import clarity | `@core/memory/episodicMemory` is self-documenting vs `../../episodicMemory` |

## 1.5 Expected Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Import breakage after file moves | HIGH | Move one domain at a time; smoke test after each domain |
| `server.js` state | MEDIUM | Keep backend/server.js intact during this migration to preserve global state |
| `whatsapp-web.js` session path breakage | MEDIUM | Explicitly set `dataPath` in whatsappBridge.js config |
| Lazy `require()` inside switch-cases becoming invalid | MEDIUM | Convert to top-level imports |
| Whisper DLL loading failure after binary move | MEDIUM | Ensure `cwd` is set to `runtime/whisper/bin/` (already done in whisperManager.js) |
| `module-alias` bootstrap order errors | MEDIUM | Register aliases as FIRST line in every entry point |
| Book engine Python paths breaking | LOW | Simple `os.getenv()` changes in `book/config.py` |

---

# SECTION 2 — PREREQUISITES & SAFETY

> [!CAUTION]
> Do not begin any migration phase without completing ALL steps in this section. A missed backup has caused permanent data loss in past migrations.

## 2.1 Git Checkpoints

Execute these commands **before touching any file**:

```bash
# Step 1: Ensure working tree is clean
git status

# If there are uncommitted changes, stash them first:
git stash push -m "pre-restructure-stash"

# Step 2: Create a safety tag at the current HEAD
git tag pre-restructure-v1

# Step 3: Create the migration branch
git checkout -b restructure-v2

# Step 4: Verify you are on the new branch
git branch --show-current
# Expected output: restructure-v2

# Step 5: Confirm the tag exists
git tag --list "pre-restructure*"
# Expected output: pre-restructure-v1
```

## 2.2 Backups to Create

### 2.2.1 Runtime Data Backup (CRITICAL)
The memory JSON files are your AI's "brain." Back them up before touching anything.

```powershell
# Create backup directory outside repo
New-Item -ItemType Directory -Path "C:\arvsal-backup-$(Get-Date -Format 'yyyyMMdd')" -Force

# Copy all runtime data files
Copy-Item "C:\Users\athar\Desktop\arvsal\backend\memory.json" `
  "C:\arvsal-backup-$(Get-Date -Format 'yyyyMMdd')\" -Force
Copy-Item "C:\Users\athar\Desktop\arvsal\backend\episodic_memory.json" `
  "C:\arvsal-backup-$(Get-Date -Format 'yyyyMMdd')\" -Force
Copy-Item "C:\Users\athar\Desktop\arvsal\backend\vector_store.json" `
  "C:\arvsal-backup-$(Get-Date -Format 'yyyyMMdd')\" -Force
Copy-Item "C:\Users\athar\Desktop\arvsal\backend\reflection_memory.json" `
  "C:\arvsal-backup-$(Get-Date -Format 'yyyyMMdd')\" -Force
Copy-Item "C:\Users\athar\Desktop\arvsal\backend\chat_history.json" `
  "C:\arvsal-backup-$(Get-Date -Format 'yyyyMMdd')\" -Force
Copy-Item "C:\Users\athar\Desktop\arvsal\backend\totp_secret.json" `
  "C:\arvsal-backup-$(Get-Date -Format 'yyyyMMdd')\" -Force
Copy-Item "C:\Users\athar\Desktop\arvsal\cookies.json" `
  "C:\arvsal-backup-$(Get-Date -Format 'yyyyMMdd')\" -Force

Write-Host "Backup complete at: C:\arvsal-backup-$(Get-Date -Format 'yyyyMMdd')"
```

### 2.2.2 WhatsApp Session Backup
```powershell
# WhatsApp session — losing this requires re-scanning QR code
Copy-Item "C:\Users\athar\Desktop\arvsal\.wwebjs_auth" `
  "C:\arvsal-backup-$(Get-Date -Format 'yyyyMMdd')\.wwebjs_auth" -Recurse -Force
```

### 2.2.3 Binary Backup Record
Document current binary locations (do not copy these — just record):
```
FFmpeg:   C:\Users\athar\Downloads\ffmpeg-8.0.1-essentials_build\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe
Piper:    C:\Users\athar\Downloads\piper_windows_amd64\piper\piper.exe
Whisper:  C:\Users\athar\Desktop\arvsal\whisper.cpp\build\bin\whisper-cli.exe
Python:   C:\Users\athar\AppData\Local\Python\pythoncore-3.14-64\python.exe
Ollama:   C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe
```

## 2.3 Branch Strategy

```
main (or master)
  └── restructure-v2          ← All migration work happens here
        ├── phase/A-runtime   ← Optional: sub-branch per phase
        ├── phase/B-data
        ├── phase/C-deadcode
        ├── phase/D-restructure
        ├── phase/E-global-state
        ├── phase/F-aliases
        └── phase/G-config
```

**Recommended sub-branch workflow per phase:*```bash
# At start of each phase
git checkout restructure-v2
git checkout -b phase/A-runtime

# After phase completes and smoke test passes
git checkout restructure-v2
git merge phase/A-runtime
git tag phase-A-complete
git branch -d phase/A-runtime
```

## 2.4 Rollback Strategy

### Full Rollback (Emergency)
```bash
# Return to exact pre-migration state
git checkout main
git tag  # Verify pre-restructure-v1 exists

# Hard reset to the tag
git checkout -b recovery-$(date +%Y%m%d)
git reset --hard pre-restructure-v1
```

### Phase-Level Rollback
```bash
# Roll back a single phase (example: roll back phase D)
git log --oneline -20          # Find the commit before phase D started
git revert HEAD~5..HEAD        # Revert last 5 commits (adjust count)
# OR
git reset --hard phase-C-complete  # Reset to last known-good tag
```

### Binary Path Emergency Restore
If runtime binaries break, immediately revert `.env` to original hardcoded paths:
```bash
# In .env — restore originals to get back online immediately
ARVSAL_FFMPEG_PATH=C:\Users\athar\Downloads\ffmpeg-8.0.1-essentials_build\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe
ARVSAL_PIPER_PATH=C:\Users\athar\Downloads\piper_windows_amd64\piper\piper.exe
```

---

# SECTION 3 — MIGRATION PHASES OVERVIEW

## Phase Map

| Phase | Name | Day | Risk | Effort |
|-------|------|-----|------|--------|
| A | Runtime Consolidation | Day 1 AM | 🟡 MEDIUM | 3 hrs |
| B | Data Isolation | Day 1 PM | 🟡 MEDIUM | 2 hrs |
| C | Dead Code Removal | Day 2 AM | 🟢 LOW | 1 hr |
| D | Directory Restructuring | Day 2 PM – Day 3 | 🟡 MEDIUM | 6 hrs |
| F | Import Alias System | Day 5 AM | 🟡 MEDIUM | 3 hrs |
| G | Book Engine + Final Config | Day 5 PM | 🟢 LOW | 2 hrs |

> [!IMPORTANT]
> Phases must be executed **strictly in order**. Each phase has a mandatory smoke test. Do not start the next phase until the smoke test for the current phase passes completely.

## Phase A — Runtime Consolidation

**Objective:** Move all external binaries (FFmpeg, Piper, Whisper) into a self-contained `runtime/` directory inside the repo. Update all hardcoded paths to use environment variables with fallback to the new `runtime/` locations.

**Estimated Effort:** 3 hours

**Risk Level:** 🟡 MEDIUM — Binary path changes affect STT and TTS pipelines directly.

**Required Validation:** Start backend server; confirm voice input (Whisper STT) and voice output (Piper TTS) both work end-to-end.

## Phase B — Data Isolation

**Objective:** Move all runtime-generated data files (JSON memory stores, session cookies, WhatsApp auth) out of the source tree into a dedicated `data/` directory. Update all path references.

**Estimated Effort:** 2 hours

**Risk Level:** 🟡 MEDIUM — Memory files are the AI's state; corruption or misplaced path means data loss.

**Required Validation:** Confirm memory loads correctly, WhatsApp authentication succeeds, email cookies are read properly.

## Phase C — Dead Code Removal

**Objective:** Delete confirmed dead files, stub files, orphaned assets, and the 487 MB duplicate Whisper model.

**Estimated Effort:** 1 hour

**Risk Level:** 🟢 LOW — Files are verified non-referenced before deletion.

**Required Validation:** Full startup with zero `Cannot find module` errors.

## Phase D — Directory Restructuring

**Objective:** Move all source files from the flat `backend/` tree into the domain-organized V2 structure (`core/`, `providers/`, `modules/`, `agents/`, `integrations/`, `tools/`, `safety/`, `utils/`, `actions/`, `apps/`). Update all import paths within each domain as it moves.

**Estimated Effort:** 6 hours

**Risk Level:** 🟡 MEDIUM — Largest number of file operations; import breakage is the primary risk.

**Required Validation:** Smoke test after each domain move (not just at the end).

## 

**Objective:** Keep backend/server.js intact during this migration.

> [!NOTE]
> ### Phase-1 Architecture Boundary
> This migration preserves `backend/server.js` intentionally. 
> 
> **Goal:**
> - eliminate hardcoded paths
> - organize domains
> - isolate runtime data
> - improve maintainability
> 
> This is NOT a final architecture commitment.
> 
> Future ARVSAL versions may:
> - split the monolith
> - introduce service boundaries
> - introduce distributed agents
> - introduce multi-process execution
> 
> after state ownership has been fully mapped and tested.

**NOT APPLICABLE:** Shared state extraction
*(These steps are NOT APPLICABLE because server.js will remain intact.)**Global State Preservation:*When moving files, ensure only one instance exists for:
* memory state
* chat history
* audio queues
* LLM state
* runtime state

Warn against creating duplicate singleton instances.

**Estimated Effort:** 1 hour

**Risk Level:** 🟡 MEDIUM — State preservation is critical. Do NOT split backend/server.js.

**Required Validation:** Full E2E test.

## Phase E — Import Alias System

**Objective:** Install `module-alias` and replace all brittle relative import paths (`../../something`) with clean `@namespace` aliases (`@core/memory/episodicMemory`).

**Estimated Effort:** 3 hours

**Risk Level:** 🟡 MEDIUM — Bootstrap order matters; aliases must register before any module loads.

**Required Validation:** Complete end-to-end system test; zero import errors.

## Phase G — Book Engine + Final Config

**Objective:** Update `book/config.py` hardcoded Python paths to use environment variables. Move wake word profiles to `config/profiles/`. Create `.env.example`. Update `.gitignore`.

**Estimated Effort:** 2 hours

**Risk Level:** 🟢 LOW — Book engine is standalone; changes are isolated to Python config.

**Required Validation:** Run `node scripts/health-check.js`; run book engine once to confirm Ollama and LibreOffice paths resolve.


---

# SECTION 4 — RUNTIME MIGRATION GUIDE

> [!IMPORTANT]
> Copy binaries — do NOT move them yet. Keep originals intact until smoke tests pass. Only delete originals after Phase A validation succeeds.

---

## 4.1 FFmpeg

**Current Location:*```
C:\Users\athar\Downloads\ffmpeg-8.0.1-essentials_build\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe
```

**Target Location:*```
arvsal\runtime\ffmpeg\bin\ffmpeg.exe
```

**Reason:** Hardcoded absolute user path in 3 identical locations in `server.js`. Makes project non-portable.

**Files Affected:*- `backend/server.js` — lines 439, 560, 636 (FFmpeg spawn for audio conversion)
- `backend/visualService.js` — line 29 (FFmpeg via system PATH for webcam — separate handling)

**Migration Steps:*```powershell
# 1. Create target directory
New-Item -ItemType Directory -Path "arvsal\runtime\ffmpeg\bin" -Force

# 2. Copy entire ffmpeg essentials build
Copy-Item "C:\Users\athar\Downloads\ffmpeg-8.0.1-essentials_build\ffmpeg-8.0.1-essentials_build\bin\*" `
  "arvsal\runtime\ffmpeg\bin\" -Force

# 3. Add to .env
Add-Content ".env" "`nARVSAL_FFMPEG_PATH=./runtime/ffmpeg/bin/ffmpeg.exe"

# 4. In backend/server.js — replace the 3 hardcoded lines with:
# const ffmpegExe = process.env.ARVSAL_FFMPEG_PATH || path.resolve(__dirname, "../runtime/ffmpeg/bin/ffmpeg.exe");
```

**Path changes required (backend/server.js):*- Line 439: Replace hardcoded ffmpegExe string → use env var
- Line 560: Same replacement
- Line 636: Same replacement

**Validation:*```bash
# Test FFmpeg binary works
arvsal\runtime\ffmpeg\bin\ffmpeg.exe -version
# Expected: ffmpeg version 8.0.1 ...

# Test audio pipeline: send a voice command in UI, confirm transcript appears
```

**Rollback:*```powershell
# Revert .env to original path
# Set ARVSAL_FFMPEG_PATH=C:\Users\athar\Downloads\ffmpeg-8.0.1-essentials_build\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe
```

---

## 4.2 Piper TTS Binary

**Current Location:*```
C:\Users\athar\Downloads\piper_windows_amd64\piper\piper.exe
```

**Target Location:*```
arvsal\runtime\piper\piper.exe
```

**Reason:** Hardcoded in `server.js` lines 201 and 698 (speakLocally helper + /speak route).

**Files Affected:*- `backend/server.js` — line 201 (speakLocally)
- `backend/server.js` — line 698 (/speak route)
- `backend/ttsEngine.js` — line 5 (dead code, but still has path)

**Migration Steps:*```powershell
# 1. Create target directories
New-Item -ItemType Directory -Path "arvsal\runtime\piper\models" -Force

# 2. Copy entire piper directory
Copy-Item "C:\Users\athar\Downloads\piper_windows_amd64\piper\*" `
  "arvsal\runtime\piper\" -Recurse -Force

# 3. Add to .env
Add-Content ".env" "`nARVSAL_PIPER_PATH=./runtime/piper/piper.exe"
```

**Path changes required:*- `server.js` line 201: `const piperExe = process.env.ARVSAL_PIPER_PATH || path.resolve(__dirname, "../runtime/piper/piper.exe");`
- `server.js` line 698: Same as above

**Validation:*```bash
# Test Piper binary
arvsal\runtime\piper\piper.exe --version

# Test TTS: say "hello" command, confirm audio response plays
```

**Rollback:*Set `ARVSAL_PIPER_PATH=C:\Users\athar\Downloads\piper_windows_amd64\piper\piper.exe` in `.env`

---

## 4.3 Piper ONNX Voice Model

**Current Location:*```
C:\Users\athar\Downloads\piper_windows_amd64\piper\en_US-ryan-high.onnx
C:\Users\athar\Downloads\piper_windows_amd64\piper\en_US-ryan-high.onnx.json
```

**Target Location:*```
arvsal\runtime\piper\models\en_US-ryan-high.onnx
arvsal\runtime\piper\models\en_US-ryan-high.onnx.json
```

**Reason:** Voice model path is hardcoded in server.js lines 203-204 and 700-701.

**Files Affected:*- `backend/server.js` — lines 203-204 (speakLocally model arg)
- `backend/server.js` — lines 700-701 (/speak route model arg)
- `backend/ttsEngine.js` — line 7 (dead code)

**Migration Steps:*```powershell
# Models are already copied in step 4.2 (entire piper dir was copied)
# Move model file to models/ subdirectory
New-Item -ItemType Directory "arvsal\runtime\piper\models" -Force
Move-Item "arvsal\runtime\piper\en_US-ryan-high.onnx" "arvsal\runtime\piper\models\"
Move-Item "arvsal\runtime\piper\en_US-ryan-high.onnx.json" "arvsal\runtime\piper\models\"

# Add to .env
Add-Content ".env" "`nARVSAL_PIPER_MODEL=./runtime/piper/models/en_US-ryan-high.onnx"
```

**Path changes required:*- `server.js` line 203: `const modelPath = process.env.ARVSAL_PIPER_MODEL || path.resolve(__dirname, "../runtime/piper/models/en_US-ryan-high.onnx");`
- `server.js` line 700: Same replacement

**Validation:*```bash
# TTS produces audio with Ryan voice (confirm voice sounds correct, not robotic default)
```

**Rollback:*Set `ARVSAL_PIPER_MODEL=C:\Users\athar\Downloads\piper_windows_amd64\piper\en_US-ryan-high.onnx` in `.env`

---

## 4.4 Piper WAV Temp File

**Current Location:*```
C:\Users\athar\Downloads\piper_windows_amd64\piper\arvsal.wav
```
*(Written by ttsEngine.js — a dead code file)**Target Location:*```
arvsal\runtime\temp\tts\arvsal.wav
```

**Reason:** Writing temp output inside a binary directory is incorrect. Temp files belong in `runtime/temp/`.

**Files Affected:*- `backend/ttsEngine.js` — line 10 (dead code — file will be deleted in Phase C)
- `backend/server.js` — uses inline Piper spawn, not ttsEngine; WAV output path must also be set here

**Migration Steps:*```powershell
New-Item -ItemType Directory -Path "arvsal\runtime\temp\tts" -Force
Add-Content ".env" "`nARVSAL_TTS_WAV=./runtime/temp/tts/arvsal.wav"
```

**Path changes required in server.js:*- In `speakLocally()` and `/speak` route — update the `-f` wav output argument to use:
  `process.env.ARVSAL_TTS_WAV || path.resolve(__dirname, "../runtime/temp/tts/arvsal.wav")`

**Validation:** TTS audio plays successfully after command.

**Rollback:** Set `ARVSAL_TTS_WAV` back to original path in `.env`

---

## 4.5 Whisper CLI Binary

**Current Location:*```
whisper.cpp\build\bin\whisper-cli.exe
(resolved via: path.resolve(__dirname, "../whisper.cpp/build/bin/whisper-cli.exe"))
```

**Target Location:*```
arvsal\runtime\whisper\bin\whisper-cli.exe
```

**Reason:** Keeps compiled binary alongside source submodule. Better to isolate in `runtime/`.

**Files Affected:*- `backend/whisperManager.js` — lines 5-8 (`WHISPER_EXE` constant)
- `backend/whisperManager.js` — line 64 (`execFile` call with `cwd` = whisperDir)

**Migration Steps:*```powershell
New-Item -ItemType Directory -Path "arvsal\runtime\whisper\bin" -Force

# Copy whisper binary AND all required DLLs
Copy-Item "arvsal\whisper.cpp\build\bin\*" "arvsal\runtime\whisper\bin\" -Force

Add-Content ".env" "`nARVSAL_WHISPER_EXE=./runtime/whisper/bin/whisper-cli.exe"
```

**Path changes required (whisperManager.js):*```js
// Line 5-8 — OLD
const WHISPER_EXE = path.resolve(__dirname, "../whisper.cpp/build/bin/whisper-cli.exe");

// NEW
const WHISPER_EXE = process.env.ARVSAL_WHISPER_EXE ||
  path.resolve(__dirname, "../runtime/whisper/bin/whisper-cli.exe");
```

> [!WARNING]
> `whisper-cli.exe` requires `ggml.dll`, `whisper.dll`, and other DLLs in the same directory. The `cwd` passed to `execFile` must be `path.dirname(WHISPER_EXE)`. Verify this is set correctly after the move.

**Validation:*```bash
arvsal\runtime\whisper\bin\whisper-cli.exe --version
# Speak a test phrase; confirm transcript appears in UI
```

**Rollback:** Remove `ARVSAL_WHISPER_EXE` from `.env` (whisperManager.js will fall back to relative path)

---

## 4.6 Whisper Small English Model

**Current Location:*```
whisper.cpp\models\ggml-small.en.bin   (PRIMARY — used)
whisper.cpp\ggml-small.en.bin          (DUPLICATE — 487 MB — DELETE in Phase C)
```

**Target Location:*```
arvsal\runtime\whisper\models\ggml-small.en.bin
```

**Files Affected:*- `backend/whisperManager.js` — lines 12-15 (`SMALL_MODEL_PATH` constant)

**Migration Steps:*```powershell
New-Item -ItemType Directory -Path "arvsal\runtime\whisper\models" -Force
Copy-Item "arvsal\whisper.cpp\models\ggml-small.en.bin" "arvsal\runtime\whisper\models\" -Force
Add-Content ".env" "`nARVSAL_WHISPER_SMALL_MODEL=./runtime/whisper/models/ggml-small.en.bin"
```

**Path changes required (whisperManager.js lines 12-15):*```js
const SMALL_MODEL_PATH = process.env.ARVSAL_WHISPER_SMALL_MODEL ||
  path.resolve(__dirname, "../runtime/whisper/models/ggml-small.en.bin");
```

**Validation:** Voice input transcribes correctly (short utterance test).

**Rollback:** Remove `ARVSAL_WHISPER_SMALL_MODEL` from `.env`

---

## 4.7 Whisper Medium Model

**Current Location:*```
whisper.cpp\models\ggml-medium.bin
(resolved via path.resolve(__dirname, "../whisper.cpp/models/ggml-medium.bin") in server.js)
```

**Target Location:*```
arvsal\runtime\whisper\models\ggml-medium.bin
```

**Files Affected:*- `backend/server.js` — line 537-540 (`MEDIUM_MODEL_PATH` constant)

**Migration Steps:*```powershell
# Note: This file is ~1.5 GB — copy may take several minutes
Copy-Item "arvsal\whisper.cpp\models\ggml-medium.bin" "arvsal\runtime\whisper\models\" -Force
Add-Content ".env" "`nARVSAL_WHISPER_MEDIUM_MODEL=./runtime/whisper/models/ggml-medium.bin"
```

**Path changes required (server.js line 537):*```js
const MEDIUM_MODEL_PATH = process.env.ARVSAL_WHISPER_MEDIUM_MODEL ||
  path.resolve(__dirname, "../runtime/whisper/models/ggml-medium.bin");
```

**Validation:** Final audio transcription (used in `/audio/final` route) produces correct transcript.

**Rollback:** Remove `ARVSAL_WHISPER_MEDIUM_MODEL` from `.env`

---

## 4.8 Telegram Download Folder

**Current Location:*```
C:\Users\athar\Downloads
(hardcoded in backend/telegramService.js line 93)
```

**Target Location:*```
arvsal\runtime\downloads\
```

**Reason:** Telegram file downloads going into the user's personal Downloads folder is incorrect. All ARVSAL runtime I/O should be self-contained.

**Files Affected:*- `backend/telegramService.js` — line 93: `const saveFolder = "C:\\Users\\athar\\Downloads"`

**Migration Steps:*```powershell
New-Item -ItemType Directory -Path "arvsal\runtime\downloads" -Force
Add-Content ".env" "`nARVSAL_DOWNLOAD_DIR=./runtime/downloads"
```

**Path changes required (telegramService.js line 93):*```js
const saveFolder = process.env.ARVSAL_DOWNLOAD_DIR ||
  path.resolve(__dirname, "../runtime/downloads");
```

**Validation:** Send a file to the Telegram bot; confirm it appears in `runtime/downloads/`.

**Rollback:** Set `ARVSAL_DOWNLOAD_DIR=C:\Users\athar\Downloads` in `.env`

---

## 4.9 Ollama Executable (embeddingModel.js)

**Current Location:*```
C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe
(hardcoded in backend/embeddingModel.js line 13)
```

**Target:** Rely on system PATH (do not bundle Ollama).

**Files Affected:*- `backend/embeddingModel.js` — line 13: `const OLLAMA_PATH = "C:\\Users\\athar\\...\\ollama.exe"`

**Migration Steps:*```powershell
Add-Content ".env" "`nARVSAL_OLLAMA_PATH=ollama"
```

**Path changes required (embeddingModel.js line 13):*```js
const OLLAMA_PATH = process.env.ARVSAL_OLLAMA_PATH || "ollama";
```

**Validation:** Memory embedding still works (add a fact, ask ARVSAL to recall it).

**Rollback:** Set `ARVSAL_OLLAMA_PATH=C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe`

---

## 4.10 Python Executable (pythonBridge.js)

**Current Location:*```
C:\Users\athar\AppData\Local\Python\pythoncore-3.14-64\python.exe
(hardcoded in backend/agent/pythonBridge.js line 13)
```

**Target:** Rely on system PATH.

**Files Affected:*- `backend/agent/pythonBridge.js` — line 13: `const PYTHON = "C:\\Users\\athar\\...\\python.exe"`

**Migration Steps:*```powershell
Add-Content ".env" "`nARVSAL_PYTHON_PATH=python"
```

**Path changes required (pythonBridge.js line 13):*```js
const PYTHON = process.env.ARVSAL_PYTHON_PATH || "python";
```

**Validation:** Issue a screen agent command; YOLO vision worker executes without error.

**Rollback:** Set `ARVSAL_PYTHON_PATH` to full absolute path.

---

## 4.11 nircmd.exe (systemActions.js)

**Current Location:*```
C:\Windows\System32\nircmd.exe
(hardcoded in backend/systemActions.js line 15)
```

**Target Location:*```
arvsal\runtime\nircmd\nircmd.exe
```

**Reason:** `nircmd.exe` is a third-party utility placed non-standardly in System32. Should be bundled.

**Files Affected:*- `backend/systemActions.js` — line 15: `const NIRCMD = "C:\\Windows\\System32\\nircmd.exe"`

**Migration Steps:*```powershell
New-Item -ItemType Directory -Path "arvsal\runtime\nircmd" -Force
Copy-Item "C:\Windows\System32\nircmd.exe" "arvsal\runtime\nircmd\" -Force
Add-Content ".env" "`nARVSAL_NIRCMD_PATH=./runtime/nircmd/nircmd.exe"
```

**Path changes required (systemActions.js line 15):*```js
const NIRCMD = process.env.ARVSAL_NIRCMD_PATH ||
  path.resolve(__dirname, "../runtime/nircmd/nircmd.exe");
```

**Validation:** Volume control command ("turn up volume") executes correctly.

**Rollback:** Set `ARVSAL_NIRCMD_PATH=C:\Windows\System32\nircmd.exe`

---

## 4.12 YOLO Vision Model

**Current Location:*```
backend\python_worker\models\yolov8n.pt  (6.5 MB)
```

**Target Location:*```
arvsal\runtime\models\vision\yolov8n.pt
```

**Files Affected:*- `backend/python_worker/config.py` — line 2: `YOLO_MODEL_PATH = "models/ui_yolo.pt"` (CWD-relative)
- `backend/python_worker/yolo_detector.py` — line 7: `YOLO("models/yolo_ui.pt")` (different name — inconsistency!)

> [!WARNING]
> **Model name inconsistency:** `config.py` references `ui_yolo.pt` while `yolo_detector.py` references `yolo_ui.pt`. Verify which file actually exists and fix the reference before moving.

**Migration Steps:*```powershell
New-Item -ItemType Directory -Path "arvsal\runtime\models\vision" -Force
Copy-Item "arvsal\backend\python_worker\models\yolov8n.pt" "arvsal\runtime\models\vision\" -Force
```

**Path changes required:*- `python_worker/config.py`: Use `os.path.join(os.path.dirname(__file__), "../../runtime/models/vision/yolov8n.pt")`
- `python_worker/yolo_detector.py`: Same path update, fixing the filename inconsistency to `yolov8n.pt`

**Validation:** Run the Python worker directly; confirm YOLO loads without error.

**Rollback:** Restore original relative paths in `config.py` and `yolo_detector.py`.

---

## 4.13 WhatsApp Session Data

**Current Location:*```
arvsal\.wwebjs_auth\     (authentication tokens — auto-generated)
arvsal\.wwebjs_cache\    (Chromium cache — auto-generated)
```

**Target Location:*```
arvsal\runtime\sessions\whatsapp\.wwebjs_auth\
arvsal\runtime\cache\whatsapp\.wwebjs_cache\
```

**Files Affected:*- `backend/whatsappBridge.js` — default `dataPath` is process CWD

**Migration Steps:*```powershell
New-Item -ItemType Directory -Path "arvsal\runtime\sessions\whatsapp" -Force
New-Item -ItemType Directory -Path "arvsal\runtime\cache\whatsapp" -Force

# Copy existing session (do NOT move until validated)
Copy-Item "arvsal\.wwebjs_auth" "arvsal\runtime\sessions\whatsapp\" -Recurse -Force
Add-Content ".env" "`nARVSAL_WHATSAPP_SESSION_DIR=./runtime/sessions/whatsapp"
```

**Path changes required (whatsappBridge.js):*```js
const { Client, LocalAuth } = require("whatsapp-web.js");
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: process.env.ARVSAL_WHATSAPP_SESSION_DIR ||
      path.resolve(__dirname, "../runtime/sessions/whatsapp")
  })
});
```

**Validation:** WhatsApp client connects without re-scanning QR code.

**Rollback:** Remove `ARVSAL_WHATSAPP_SESSION_DIR` from `.env` (defaults back to CWD).

---

## 4.14 Email Session Cookies

**Current Location:*```
arvsal\cookies.json   (root level)
```

**Target Location:*```
arvsal\runtime\sessions\email\cookies.json
```

**Files Affected:*- `backend/email/emailFetcher.js` — line 17: `fs.readFileSync("cookies.json")` (CWD-relative — fragile)
- `backend/email/saveSession.js` — writes `cookies.json`

**Migration Steps:*```powershell
New-Item -ItemType Directory -Path "arvsal\runtime\sessions\email" -Force
Copy-Item "arvsal\cookies.json" "arvsal\runtime\sessions\email\" -Force
Add-Content ".env" "`nARVSAL_EMAIL_COOKIES=./runtime/sessions/email/cookies.json"
```

**Path changes required:*- `emailFetcher.js` line 17: `fs.readFileSync(process.env.ARVSAL_EMAIL_COOKIES || path.resolve(__dirname, "../../runtime/sessions/email/cookies.json"))`
- `saveSession.js`: Same path for write target

**Validation:** Issue an email fetch command; confirm emails load correctly.

**Rollback:** Restore `cookies.json` to root; revert `emailFetcher.js` to `readFileSync("cookies.json")`.

---

## 4.15 Ollama (book/config.py) and LibreOffice

**Current Locations:*```
C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe  (book/config.py line 51)
C:\Program Files\LibreOffice\program\soffice.exe         (book/config.py line 59)
```

**Target:** System PATH (document as prerequisites).

**Files Affected:** `book/config.py` lines 50-60

**Migration Steps:*```powershell
Add-Content ".env" "`nARVSAL_SOFFICE_PATH=soffice"
```

**Path changes required (book/config.py):*```python
import os
OLLAMA_EXE  = Path(os.getenv("ARVSAL_OLLAMA_PATH", r"C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe"))
SOFFICE_EXE = Path(os.getenv("ARVSAL_SOFFICE_PATH", r"C:\Program Files\LibreOffice\program\soffice.exe"))
```

**Validation:** Run book engine; generate a short book; confirm PDF output.

**Rollback:** Remove env vars; hardcoded defaults remain as fallback in the `os.getenv()` calls.

<!-- SECTIONS_7_TO_9 -->
<!-- SECTIONS_10_TO_12 -->

---

# SECTION 5 � FOLDER RESTRUCTURE GUIDE

> [!IMPORTANT]
> **Migration Safety Enhancement:** Do NOT move more than one domain in a single commit. Each domain move must be committed and smoke-tested independently. This dramatically reduces debugging complexity and simplifies rollback.
> 
> **Examples:*> Commit 1 → `core/intent`
> Commit 2 → `core/memory`
> Commit 3 → `providers`
> Commit 4 → `agents`
> Commit 5 → `modules`
> etc.

> [!NOTE]
> Execute moves domain by domain. Update all imports within a domain immediately after moving its files. Smoke test after each domain. Do NOT batch all moves together.

## 5.1 Pre-Move: Create All Target Directories

Run this first to create the entire V2 directory skeleton:

```powershell
$dirs = @(
  "apps\electron","apps\renderer\styles","apps\renderer\assets",
  
  "core\intent","core\memory","core\reasoning","core\personality",
  "providers\llm","providers\external",
  "agents\skills",
  "modules\stt","modules\tts","modules\vision","modules\wake","modules\reflection","modules\aeye",
  "integrations\telegram","integrations\whatsapp","integrations\email",
  "tools","safety","utils","actions",
  "data\memory","data\sessions\email","data\sessions\whatsapp","data\security","data\cache\whatsapp",
  "config\profiles",
  "docs\archive",
  "stt"
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Path $d -Force }
Write-Host "All target directories created."
```

---

## 5.2 Domain A � Electron Shell ? apps/

| Current Path | New Path | Risk | Dependencies Impacted |
|-------------|----------|------|-----------------------|
| `electron/main.js` | `apps/electron/main.js` | LOW | Import of `../backend/wakeWord` breaks ? update to new wakeWord path |

> [!IMPORTANT]
> **Critical Fix 1:** Update `package.json` main entry.
> Current location: `electron/main.js`
> New location: `apps/electron/main.js`
> Exact file requiring update: `package.json` (at project root).
| `electron/preload.js` | `apps/electron/preload.js` | LOW | None |
| `electron/renderer/index.html` | `apps/renderer/index.html` | LOW | CSS link tags must update relative paths |
| `electron/renderer/ui.js` | `apps/renderer/ui.js` | LOW | Likely unused stub |
| `electron/renderer/animations.css` | `apps/renderer/styles/animations.css` | LOW | index.html `<link>` tags |
| `electron/renderer/components.css` | `apps/renderer/styles/components.css` | LOW | index.html `<link>` tags |
| `electron/renderer/effects.css` | `apps/renderer/styles/effects.css` | LOW | index.html `<link>` tags |
| `electron/renderer/layout.css` | `apps/renderer/styles/layout.css` | LOW | index.html `<link>` tags |
| `electron/renderer/states.css` | `apps/renderer/styles/states.css` | LOW | index.html `<link>` tags |
| `electron/renderer/theme.css` | `apps/renderer/styles/theme.css` | LOW | index.html `<link>` tags |
| `electron/renderer/yes_sir.wav` | `apps/renderer/assets/yes_sir.wav` | LOW | index.html audio src |
| `electron/arv-sal_en_windows_v4_0_0.ppn` | **DO NOT DELETE UNTIL VERIFIED** | HIGH | Require validation of all wake-word references before removal. |

**Validation:** `npm start` opens Electron window; UI renders; wake word triggers.

**Rollback:** `git revert` the domain-A commit.

---

## 5.3 Domain B � Core Intent ? core/intent/

| Current Path | New Path | Risk | Import Updates Required |
|-------------|----------|------|------------------------|
| `backend/intentClassifier.js` | `core/intent/intentClassifier.js` | MEDIUM | server.js, intentEngine.js |
| `backend/intentEngine.js` | `core/intent/intentEngine.js` | MEDIUM | server.js |
| `backend/intentPrompt.js` | `core/intent/intentPrompt.js` | LOW | intentClassifier.js, llmIntentRouter.js |
| `backend/llmIntentRouter.js` | `core/intent/llmIntentRouter.js` | LOW | intentEngine.js |
| `backend/actionIntentDetector.js` | `core/intent/actionIntentDetector.js` | LOW | server.js |

**Validation:** Issue a voice command; confirm intent is classified correctly.

---

## 5.4 Domain C � Core Memory ? core/memory/

| Current Path | New Path | Risk | Import Updates Required |
|-------------|----------|------|------------------------|
| `backend/memory.js` | `core/memory/semanticMemory.js` | HIGH | server.js, actions.js, memoryTool.js, cognitiveEngine.js, llmRouter.js � **renamed file** |
| `backend/episodicMemory.js` | `core/memory/episodicMemory.js` | HIGH | server.js, cognitiveEngine.js, reflectionGenerator.js, memoryTool.js |
| `backend/reflectionMemory.js` | `core/memory/reflectionMemory.js` | LOW | reflect.js |
| `backend/vectorStore.js` | `core/memory/vectorStore.js` | MEDIUM | memory.js (lazy), episodicMemory.js (lazy), cognitiveEngine.js |
| `backend/embeddingModel.js` | `core/memory/embeddingModel.js` | MEDIUM | memory.js (lazy), episodicMemory.js (lazy), cognitiveEngine.js |
| `backend/chatHistory.js` | `core/memory/chatHistory.js` | MEDIUM | server.js, llmRouter.js |
| `backend/memorySearch.js` | `core/memory/memorySearch.js` | LOW | actions.js, recallRouter.js, cognitiveEngine.js |
| `backend/memoryInspector.js` | `core/memory/memoryInspector.js` | LOW | actions.js |
| `backend/memoryUtils.js` | `core/memory/memoryUtils.js` | LOW | memoryInspector.js |
| `backend/memoryIntentClassifier.js` | `core/memory/memoryIntentClassifier.js` | LOW | server.js |
| `backend/recallRouter.js` | `core/memory/recallRouter.js` | LOW | actions.js |
| `backend/importanceScorer.js` | `core/memory/importanceScorer.js` | LOW | episodicMemory.js |
| `backend/keyNormalizer.js` | `core/memory/keyNormalizer.js` | LOW | memory.js |
| `backend/themeExtractor.js` | `core/memory/themeExtractor.js` | LOW | server.js |

> [!WARNING]
> `memory.js` is **renamed** to `semanticMemory.js`. Every `require("./memory")` must become `require("@core/memory/semanticMemory")`. Search for ALL occurrences before moving.

**Validation:** Memory load at startup; save a fact ("my name is X"), restart, recall it.

---

## 5.5 Domain D � Core Reasoning ? core/reasoning/

| Current Path | New Path | Risk | Import Updates Required |
|-------------|----------|------|------------------------|
| `backend/cognitiveEngine.js` | `core/reasoning/cognitiveEngine.js` | MEDIUM | server.js |
| `backend/plannerEngine.js` | `core/reasoning/plannerEngine.js` | MEDIUM | server.js, agentLoop.js, screenActionOrchestrator.js |
| `backend/confirmManager.js` | `core/reasoning/confirmManager.js` | LOW | server.js |

**Validation:** Issue a multi-step agent command; planner generates JSON plan.

---

## 5.6 Domain E � Core Personality ? core/personality/

| Current Path | New Path | Risk | Import Updates Required |
|-------------|----------|------|------------------------|
| `backend/personality.js` | `core/personality/personality.js` | LOW | server.js |
| `backend/personalityLLM.js` | `core/personality/personalityLLM.js` | LOW | personality.js |
| `backend/identity.js` | `core/personality/identity.js` | LOW | llmRouter.js, server.js |

**Validation:** LLM response has personality applied (not flat/robotic).

---

## 5.7 Domain F � LLM Providers ? providers/llm/

| Current Path | New Path | Risk | Import Updates Required |
|-------------|----------|------|------------------------|
| `backend/llmRunner.js` | `providers/llm/llmRunner.js` | HIGH | server.js, plannerEngine.js, llmRouter.js, reflectionGenerator.js, personalityLLM.js |
| `backend/llmRouter.js` | `providers/llm/llmRouter.js` | HIGH | server.js |
| `backend/llmGuard.js` | `providers/llm/llmGuard.js` | LOW | server.js |
| `backend/llmPrompt.js` | `providers/llm/llmPrompt.js` | LOW | llmRouter.js |
| `backend/codePrompt.js` | `providers/llm/codePrompt.js` | LOW | server.js |
| `backend/mathPrompt.js` | `providers/llm/mathPrompt.js` | LOW | server.js |
| `backend/ollamaWarmup.js` | `providers/llm/ollamaWarmup.js` | LOW | server.js |
| `backend/localLLM.js` | `providers/llm/localLLM.js` | LOW | visionRunner.js |
| `backend/aiSwitch.js` | `providers/llm/aiSwitch.js` | MEDIUM | server.js, llmRouter.js, plannerEngine.js |
| `backend/chatgptClient.js` | `providers/external/chatgptClient.js` | LOW | llmRouter.js |
| `backend/geminiClient.js` | `providers/external/geminiClient.js` | LOW | llmRouter.js, plannerEngine.js, visionRouter.js |
| `backend/groqClient.js` | `providers/external/groqClient.js` | LOW | llmRouter.js |

**Validation:** LLM generates response (local Ollama mode). Switch to Gemini; confirm response.

---

## 5.8 Domain G � Agent System ? agents/

| Current Path | New Path | Risk | Import Updates Required |
|-------------|----------|------|------------------------|
| `backend/agent/agentLoop.js` | `agents/agentLoop.js` | HIGH | server.js |
| `backend/agent/actionFeedback.js` | `agents/actionFeedback.js` | LOW | agentLoop.js |
| `backend/agent/actionValidator.js` | `agents/actionValidator.js` | LOW | agentLoop.js |
| `backend/agent/coordinateMapper.js` | `agents/coordinateMapper.js` | LOW | screenActionOrchestrator.js |
| `backend/agent/elementResolver.js` | `agents/elementResolver.js` | LOW | screenActionOrchestrator.js |
| `backend/agent/interactionModeManager.js` | `agents/interactionModeManager.js` | LOW | server.js |
| `backend/agent/pythonBridge.js` | `agents/pythonBridge.js` | LOW | screenActionOrchestrator.js |
| `backend/agent/screenScale.js` | `agents/screenScale.js` | LOW | coordinateMapper.js |
| `backend/agent/uiStateStore.js` | `agents/uiStateStore.js` | LOW | agentLoop.js |
| `backend/agent/worldModel.js` | `agents/worldModel.js` | LOW | agentLoop.js |
| `backend/agent/screenSkills/skillRegistry.js` | `agents/skills/skillRegistry.js` | LOW | agentLoop.js |
| `backend/agent/screenSkills/fillFormSkill.js` | `agents/skills/fillFormSkill.js` | LOW | skillRegistry.js |
| `backend/agent/screenSkills/navigationSkill.js` | `agents/skills/navigationSkill.js` | LOW | skillRegistry.js |
| `backend/agent/screenSkills/scrollSkill.js` | `agents/skills/scrollSkill.js` | LOW | skillRegistry.js |
| `backend/agent/screenSkills/sendMessageSkill.js` | `agents/skills/sendMessageSkill.js` | LOW | skillRegistry.js |
| `backend/agent/screenSkills/suggestionSkill.js` | `agents/skills/suggestionSkill.js` | LOW | skillRegistry.js |
| `backend/python_worker/` | `agents/vision_worker/` | MEDIUM | pythonBridge.js script path |

**Validation:** Issue "click the start button" command; agent loop executes.

---

## 5.9 Domain H � Feature Modules ? modules/

| Current Path | New Path | Risk | Import Updates Required |
|-------------|----------|------|------------------------|
| `backend/whisperManager.js` | `modules/stt/whisperManager.js` | HIGH | server.js |
| `backend/wakeWord.js` | `modules/wake/wakeWord.js` | HIGH | electron/main.js |
| `backend/screenCapture.js` | `modules/vision/screenCapture.js` | MEDIUM | server.js, agentLoop.js |
| `backend/ocrRunner.js` | `modules/vision/ocrRunner.js` | LOW | server.js, agentLoop.js |
| `backend/visionRouter.js` | `modules/vision/visionRouter.js` | LOW | server.js |
| `backend/visionRunner.js` | `modules/vision/visionRunner.js` | LOW | visionRouter.js |
| `backend/visionAnalyzer.js` | `modules/vision/visionAnalyzer.js` | LOW | server.js |
| `backend/screenClassifier.js` | `modules/vision/screenClassifier.js` | LOW | server.js, agentLoop.js |
| `backend/screenActionOrchestrator.js` | `modules/vision/screenActionOrchestrator.js` | HIGH | server.js, agentLoop.js |
| `backend/visualService.js` | `modules/aeye/visualService.js` | LOW | server.js |
| `backend/reflectionRunner.js` | `modules/reflection/reflectionRunner.js` | LOW | server.js |
| `backend/reflectionGenerator.js` | `modules/reflection/reflectionGenerator.js` | LOW | reflectionRunner.js |
| `backend/reflectionTrigger.js` | `modules/reflection/reflectionTrigger.js` | LOW | reflectionRunner.js |

**Validation:** Speak a command ? Whisper transcribes ? wake word still activates.

---

## 5.10 Domain I � Integrations ? integrations/

| Current Path | New Path | Risk | Import Updates Required |
|-------------|----------|------|------------------------|
| `backend/telegramService.js` | `integrations/telegram/telegramService.js` | MEDIUM | server.js, visualService.js, conversionEngine.js |
| `backend/whatsappBridge.js` | `integrations/whatsapp/whatsappBridge.js` | MEDIUM | server.js |
| `backend/email/emailFetcher.js` | `integrations/email/emailFetcher.js` | LOW | emailHandler.js |
| `backend/email/emailHandler.js` | `integrations/email/emailHandler.js` | LOW | server.js |
| `backend/email/saveSession.js` | `integrations/email/saveSession.js` | LOW | emailFetcher.js execSync path |
| `backend/conversionEngine.js` | `integrations/telegram/conversionEngine.js` | LOW | server.js |

> [!WARNING]
> `emailFetcher.js` calls `execSync("node backend/email/saveSession.js")` � a hardcoded shell path. After the move this must become `execSync("node integrations/email/saveSession.js")` or use `__dirname` relative path.

**Validation:** Telegram bot responds to a message. WhatsApp reconnects. Email fetch returns results.

---

## 5.11 Domain J � Tools & Safety ? tools/ + safety/

| Current Path | New Path | Risk | Import Updates Required |
|-------------|----------|------|------------------------|
| `backend/tools/toolRegistry.js` | `tools/toolRegistry.js` | MEDIUM | server.js |
| `backend/tools/desktopTool.js` | `tools/desktopTool.js` | LOW | toolRegistry.js |
| `backend/tools/systemTool.js` | `tools/systemTool.js` | LOW | toolRegistry.js |
| `backend/tools/memoryTool.js` | `tools/memoryTool.js` | LOW | toolRegistry.js � imports memory.js (now semanticMemory.js) |
| `backend/tools/n8nTool.js` | `tools/n8nTool.js` | LOW | toolRegistry.js |
| `backend/safety/riskEngine.js` | `safety/riskEngine.js` | LOW | server.js |
| `backend/safety/confirmationEngine.js` | `safety/confirmationEngine.js` | LOW | server.js |

**Validation:** Issue a risky command (e.g., "open calculator"); confirm confirmation prompt appears.

---

## 5.12 Domain K � Utilities ? utils/

| Current Path | New Path | Risk | Import Updates Required |
|-------------|----------|------|------------------------|
| `backend/utils/safeTempManager.js` | `utils/safeTempManager.js` | MEDIUM | server.js, screenCapture.js |
| `backend/utils/powerMonitor.js` | `utils/powerMonitor.js` | LOW | whisperManager.js |
| `backend/normalizer.js` | `utils/normalizer.js` | LOW | server.js |
| `backend/dateResolver.js` | `utils/dateResolver.js` | LOW | intentClassifier.js, actions.js |
| `backend/dateParser.js` | `utils/dateParser.js` | LOW | dateResolver.js |
| `backend/fileSearch.js` | `utils/fileSearch.js` | LOW | server.js |
| `backend/fileCleanup.js` | `utils/fileCleanup.js` | LOW | server.js |
| `backend/remoteControl.js` | `utils/remoteControl.js` | LOW | server.js |
| `backend/totpManager.js` | `utils/totpManager.js` | LOW | server.js |
| `backend/busyMode.js` | `utils/busyMode.js` | LOW | server.js |
| `backend/vipList.js` | `utils/vipList.js` | LOW | server.js |
| `backend/missedTracker.js` | `utils/missedTracker.js` | LOW | server.js |
| `backend/autoReplyGuard.js` | `utils/autoReplyGuard.js` | LOW | server.js |
| `backend/contactBook.js` | `utils/contactBook.js` | LOW | server.js |

**NEW FILE to create:** `utils/pathConfig.js` � centralizes all runtime path resolution (see Section 8).

**Validation:** Start backend; confirm no module-not-found errors.

---

## 5.13 Domain L � Actions ? actions/

| Current Path | New Path | Risk | Import Updates Required |
|-------------|----------|------|------------------------|
| `backend/actions.js` | `actions/actions.js` | HIGH | server.js � main intent handler |
| `backend/systemActions.js` | `actions/systemActions.js` | LOW | server.js |
| `backend/localSkills.js` | `actions/localSkills.js` | LOW | server.js |
| `backend/contentSuggester.js` | `actions/contentSuggester.js` | LOW | server.js |

**Validation:** Issue a memory command ("remember that..."); confirm it saves.

---

## 5.14 Runtime Data ? data/

| Current Path | New Path | Reason |
|-------------|----------|--------|
| `backend/memory.json` | `data/memory/memory.json` | Runtime data next to source |
| `backend/episodic_memory.json` | `data/memory/episodic_memory.json` | 1.2 MB runtime file |
| `backend/vector_store.json` | `data/memory/vector_store.json` | 620 KB runtime file |
| `backend/reflection_memory.json` | `data/memory/reflection_memory.json` | Runtime data |
| `backend/chat_history.json` | `data/memory/chat_history.json` | Runtime data |
| `backend/totp_secret.json` | `data/security/totp_secret.json` | Sensitive credential |
| `cookies.json` (root) | `data/sessions/email/cookies.json` | Session data at wrong level |
| `.wwebjs_auth/` (root) | `data/sessions/whatsapp/.wwebjs_auth/` | Session at wrong level |
| `.wwebjs_cache/` (root) | `data/cache/whatsapp/.wwebjs_cache/` | Cache at wrong level |
| `backend/logs/` | `runtime/logs/` | Logs are runtime artifacts |
| `backend/toolExecution.log` | `runtime/logs/toolExecution.log` | Runtime log |

**Validation:** Restart ARVSAL; confirm memory loads from new paths; check logs appear in `runtime/logs/`.

---

## 5.15 Configuration ? config/

| Current Path | New Path | Reason |
|-------------|----------|--------|
| `backend/profiles/arvsal.json` | `config/profiles/arvsal.json` | Static config not runtime data |
| `backend/profiles/base.json` | `config/profiles/base.json` | Static config |
| `backend/profiles/custom.json` | `config/profiles/custom.json` | Static config |
| `backend/profiles/jarvis.json` | `config/profiles/jarvis.json` | Static config |
| `backend/profiles/debug.json` | `config/profiles/debug.json` | Static config |

> After moving, update `backend/wakeWord.js` lines 21-22 to point to `config/profiles/arvsal.json`.

---

## 5.16 Documentation ? docs/

| Current Path | New Path | Reason |
|-------------|----------|--------|
| `arvsal_analysis.md` | `docs/archive/arvsal_analysis.md` | Historical doc |
| `gitignore_analysis.md` | `docs/archive/gitignore_analysis.md` | Historical doc |
| `ui_modernization_plan.md` | `docs/archive/ui_modernization_plan.md` | Historical doc |
| `README.pdf` | **DELETE** | Generated artifact |

---

## 5.17 Python Submodule Reorganization

| Current Path | New Path | Reason |
|-------------|----------|--------|
| `backend/arvsal-vision/` | `vision/` | Promoted to top-level (it is a full submodule) |
| `whisper.cpp/` | `stt/whisper.cpp/` | Organized under stt/ domain |

> [!WARNING]
> Moving a Git submodule requires editing `.gitmodules`. Use `git mv` not regular `mv` for submodule directories.
```bash
git mv backend/arvsal-vision vision
git mv whisper.cpp stt/whisper.cpp
# Edit .gitmodules to update the path entries
git add .gitmodules
git commit -m "chore: relocate submodules to domain directories"
```


---

# SECTION 6 � IMPORT REFACTOR GUIDE

> [!NOTE]
> All imports use the `module-alias` `@namespace` system. Install it first: `npm install module-alias`. Add aliases to `package.json`. Register at the top of every entry point.

## 6.0 Why module-alias was chosen (and its risks)

While modern Node.js supports subpath imports (e.g., `#core/`), `module-alias` was selected to maintain compatibility with the existing CommonJS structure without requiring a full `"type": "module"` migration or breaking the current Electron build pipeline.

### Import Architecture Comparison

| Option | Advantages | Disadvantages |
|--------|------------|---------------|
| Relative Imports | No runtime dependency | Deep `../../` paths are extremely fragile during refactors |
| **`module-alias` (Selected)** | CommonJS compatible | Requires `require('module-alias/register')` at every entry point |
| Node Subpath Imports (`#core/`) | Native, zero-dependency solution | Requires full ESM `"type": "module"` migration (breaks Electron) |
| Build-Time Aliases (Webpack/Vite) | Clean imports, no runtime cost | High build complexity; breaks `node server.js` direct execution |



### 6.0.1 Justification for Migration Order

A safer theoretical order is to bootstrap `module-alias` before moving any files. However, ARVSAL's migration follows a **simultaneous domain-move and alias-adoption** strategy.

**Why the current order is safer:**
1. Defining aliases in `package.json` that point to empty `core/` directories before moving files is safe.
2. However, injecting those aliases into `backend/server.js` *before* the target files physically exist will crash the application during testing.
3. Therefore, we define the alias schema immediately, but we apply the import updates domain-by-domain alongside the physical file moves (Phase D). This allows incremental smoke testing after every domain commit.


### Long-Term Direction (ESM Migration)
When ARVSAL eventually migrates to ESM, replace:
```js
require("module-alias/register")
```
with native Node subpath imports:
```json
"imports": {
  "#core/*": "./core/*"
}
```
*This is future guidance only and NOT part of the current migration.*

**Why `module-alias` was chosen:** 
ARVSAL is currently a CommonJS project heavily reliant on dynamic `require()` calls and an Electron shell. Moving to modern native `#core/` imports would require converting all 100+ files to ESM (`import`/`export`), which significantly increases the migration risk. `module-alias` allows clean imports without rewriting the module system, at the cost of needing explicit bootstrap registration.


> [!WARNING]
> **Child Process Inheritance Risk:** Child processes (`spawn`, `exec`) do NOT inherit the alias registry. Any spawned Node script MUST explicitly include `require('module-alias/register')` as its first line, or use relative paths.

## 6.1 Setup: package.json Aliases

Add to `package.json` (at root level):
```json
"_moduleAliases": {
  "@root"         : ".",
  "@core"         : "./core",
  "@providers"    : "./providers",
  "@agents"       : "./agents",
  "@modules"      : "./modules",
  "@integrations" : "./integrations",
  "@tools"        : "./tools",
  "@safety"       : "./safety",
  "@utils"        : "./utils",
  "@actions"      : "./actions",
  "@config"       : "./config",
  "@data"         : "./data"
}
```

Add as FIRST line in `backend/server.js` and `apps/electron/main.js`:
```js
require('module-alias/register');
```

---

## 6.2 Import Changes: apps/electron/main.js

| OLD | NEW | Reason |
|-----|-----|--------|
| `require("../backend/wakeWord")` | `require("@modules/wake/wakeWord")` | wakeWord moved to modules/wake/ |

---

## 6.3 Import Changes: backend/server.js

| OLD Import | NEW Import | Reason |
|-----------|-----------|--------|
| `require("./chatHistory")` | `require("@core/memory/chatHistory")` | Memory domain |
| `require("./episodicMemory")` | `require("@core/memory/episodicMemory")` | Memory domain |
| `require("./memory")` | `require("@core/memory/semanticMemory")` | Renamed + memory domain |
| `require("./themeExtractor")` | `require("@core/memory/themeExtractor")` | Memory domain |
| `require("./normalizer")` | `require("@utils/normalizer")` | Utils domain |
| `require("./intentClassifier")` | `require("@core/intent/intentClassifier")` | Intent domain |
| `require("./actions")` | `require("@actions/actions")` | Actions domain |
| `require("./personality")` | `require("@core/personality/personality")` | Personality domain |
| `require("./llmRouter")` | `require("@providers/llm/llmRouter")` | LLM providers |
| `require("./localSkills")` | `require("@actions/localSkills")` | Actions domain |
| `require("./cognitiveEngine")` | `require("@core/reasoning/cognitiveEngine")` | Reasoning domain |
| `require("./plannerEngine")` | `require("@core/reasoning/plannerEngine")` | Reasoning domain |
| `require("./llmRunner")` | `require("@providers/llm/llmRunner")` | LLM providers |
| `require("./actionIntentDetector")` | `require("@core/intent/actionIntentDetector")` | Intent domain |
| `require("./telegramService")` | `require("@integrations/telegram/telegramService")` | Integrations |
| `require("./remoteControl")` | `require("@utils/remoteControl")` | Utils |
| `require("./totpManager")` | `require("@utils/totpManager")` | Utils |
| `require("./fileSearch")` | `require("@utils/fileSearch")` | Utils |
| `require("./whatsappBridge")` | `require("@integrations/whatsapp/whatsappBridge")` | Integrations |
| `require("./busyMode")` | `require("@utils/busyMode")` | Utils |
| `require("./vipList")` | `require("@utils/vipList")` | Utils |
| `require("./missedTracker")` | `require("@utils/missedTracker")` | Utils |
| `require("./autoReplyGuard")` | `require("@utils/autoReplyGuard")` | Utils |
| `require("./contactBook")` | `require("@utils/contactBook")` | Utils |
| `require("./visualService")` | `require("@modules/aeye/visualService")` | Modules/aeye |
| `require("./visionRouter")` | `require("@modules/vision/visionRouter")` | Modules/vision |
| `require("./ocrRunner")` | `require("@modules/vision/ocrRunner")` | Modules/vision |
| `require("./visionAnalyzer")` | `require("@modules/vision/visionAnalyzer")` | Modules/vision |
| `require("./utils/safeTempManager")` | `require("@utils/safeTempManager")` | Utils |
| `require("./agent/interactionModeManager")` | `require("@agents/interactionModeManager")` | Agents |
| `require("./conversionEngine")` | `require("@integrations/telegram/conversionEngine")` | Integrations |
| `require("./screenClassifier")` | `require("@modules/vision/screenClassifier")` | Modules/vision |
| `require("./whisperManager")` | `require("@modules/stt/whisperManager")` | Modules/stt |
| `require("./screenActionOrchestrator")` | `require("@modules/vision/screenActionOrchestrator")` | Modules/vision |
| `require("./agent/agentLoop")` | `require("@agents/agentLoop")` | Agents |
| `require("./contentSuggester")` | `require("@actions/contentSuggester")` | Actions |
| `require("./reflectionRunner")` | `require("@modules/reflection/reflectionRunner")` | Modules/reflection |
| `require("./systemActions")` | `require("@actions/systemActions")` | Actions |
| `require("./aiSwitch")` | `require("@providers/llm/aiSwitch")` | LLM providers |
| `require("./confirmManager")` | `require("@core/reasoning/confirmManager")` | Reasoning |

**Validation:** `node backend/server.js` starts without `Cannot find module` errors.

---

## 6.4 Import Changes: core/memory/episodicMemory.js

| OLD | NEW |
|-----|-----|
| `require("./importanceScorer")` | `require("@core/memory/importanceScorer")` |
| `require("./embeddingModel")` | `require("@core/memory/embeddingModel")` |
| `require("./vectorStore")` | `require("@core/memory/vectorStore")` |

---

## 6.5 Import Changes: core/memory/semanticMemory.js (was memory.js)

| OLD | NEW |
|-----|-----|
| `require("./keyNormalizer")` | `require("@core/memory/keyNormalizer")` |
| `require("./embeddingModel")` | `require("@core/memory/embeddingModel")` |
| `require("./vectorStore")` | `require("@core/memory/vectorStore")` |

---

## 6.6 Import Changes: core/reasoning/plannerEngine.js

| OLD | NEW |
|-----|-----|
| `require("./llmRunner")` | `require("@providers/llm/llmRunner")` |
| `require("./geminiClient")` | `require("@providers/external/geminiClient")` |
| `require("./aiSwitch")` | `require("@providers/llm/aiSwitch")` |

---

## 6.7 Import Changes: providers/llm/llmRouter.js

| OLD | NEW |
|-----|-----|
| `require("./llmRunner")` | `require("@providers/llm/llmRunner")` |
| `require("./chatHistory")` | `require("@core/memory/chatHistory")` |
| `require("./memory")` | `require("@core/memory/semanticMemory")` |
| `require("./episodicMemory")` | `require("@core/memory/episodicMemory")` |
| `require("./llmPrompt")` | `require("@providers/llm/llmPrompt")` |
| `require("./identity")` | `require("@core/personality/identity")` |
| `require("./aiSwitch")` | `require("@providers/llm/aiSwitch")` |
| `require("./chatgptClient")` | `require("@providers/external/chatgptClient")` |
| `require("./geminiClient")` | `require("@providers/external/geminiClient")` |
| `require("./groqClient")` | `require("@providers/external/groqClient")` |

---

## 6.8 Import Changes: modules/stt/whisperManager.js

| OLD | NEW |
|-----|-----|
| `require("./utils/powerMonitor")` | `require("@utils/powerMonitor")` |
| `path.resolve(__dirname, "../whisper.cpp/build/bin/whisper-cli.exe")` | `require("@utils/pathConfig").WHISPER_EXE` |
| `path.resolve(__dirname, "../whisper.cpp/models/ggml-small.en.bin")` | `require("@utils/pathConfig").SMALL_MODEL_PATH` |

---

## 6.9 Import Changes: agents/agentLoop.js

| OLD | NEW |
|-----|-----|
| `require("../screenCapture")` | `require("@modules/vision/screenCapture")` |
| `require("../ocrRunner")` | `require("@modules/vision/ocrRunner")` |
| `require("../screenClassifier")` | `require("@modules/vision/screenClassifier")` |
| `require("./uiStateStore")` | `require("@agents/uiStateStore")` |
| `require("./worldModel")` | `require("@agents/worldModel")` |
| `require("../plannerEngine")` | `require("@core/reasoning/plannerEngine")` |
| `require("./actionValidator")` | `require("@agents/actionValidator")` |
| `require("../screenActionOrchestrator")` | `require("@modules/vision/screenActionOrchestrator")` |
| `require("./actionFeedback")` | `require("@agents/actionFeedback")` |
| `require("./screenSkills/skillRegistry")` | `require("@agents/skills/skillRegistry")` |

---

## 6.10 Import Changes: tools/toolRegistry.js

| OLD | NEW |
|-----|-----|
| `require("./memoryTool")` | `require("@tools/memoryTool")` |
| `require("./systemTool")` | `require("@tools/systemTool")` |
| `require("./desktopTool")` | `require("@tools/desktopTool")` |
| `require("./n8nTool")` | `require("@tools/n8nTool")` |
| `path.join(__dirname, "../toolExecution.log")` | `path.join(process.env.ARVSAL_LOG_DIR\|\|"./runtime/logs", "toolExecution.log")` |

---

## 6.11 Import Changes: tools/memoryTool.js

| OLD | NEW |
|-----|-----|
| `require("../memory")` | `require("@core/memory/semanticMemory")` |
| `require("../episodicMemory")` | `require("@core/memory/episodicMemory")` |

---

## 6.12 Import Changes: modules/wake/wakeWord.js

| OLD | NEW |
|-----|-----|
| `path.resolve(__dirname, '../node_modules/ava-listener/profiles/arvsal.json')` | `path.resolve(__dirname, '../../node_modules/ava-listener/profiles/arvsal.json')` |
| `path.resolve(__dirname, 'profiles/arvsal.json')` | `path.resolve(__dirname, '../../config/profiles/arvsal.json')` |

---

## 6.13 Import Changes: integrations/email/emailFetcher.js

> [!WARNING]
> **Critical Fix 2:** Child process alias warning. Any file launched via `spawn`, `exec`, `execFile`, or `execSync` must either (A) avoid aliases, OR (B) load `module-alias/register` explicitly. This is because child processes do not inherit the alias registry from the main process.

| OLD | NEW |
|-----|-----|
| `fs.readFileSync("cookies.json")` | `fs.readFileSync(require("@utils/pathConfig").EMAIL_COOKIES_PATH)` |
| `execSync("node backend/email/saveSession.js")` | `execSync(\`node \${path.resolve(__dirname, "./saveSession.js")}\`)` |

---

## 6.14 Import Changes: integrations/telegram/telegramService.js

| OLD | NEW |
|-----|-----|
| `const saveFolder = "C:\\Users\\athar\\Downloads"` | `const saveFolder = process.env.ARVSAL_DOWNLOAD_DIR \|\| path.resolve(__dirname, "../../runtime/downloads")` |

---

## 6.15 Import Changes: modules/aeye/visualService.js

| OLD | NEW |
|-----|-----|
| `` `ffmpeg -f dshow ...` `` (PATH-dependent) | `` `"${require("@utils/pathConfig").FFMPEG_EXE}" -f dshow ...` `` |

---

## 6.16 New File: utils/pathConfig.js

Create this file to centralize ALL path resolution:

```js
// utils/pathConfig.js � Single source of truth for all runtime paths
require('dotenv').config();
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

function resolve(envVar, fallback) {
  const v = process.env[envVar];
  if (v) return path.isAbsolute(v) ? v : path.resolve(ROOT, v);
  return path.resolve(ROOT, fallback);
}

module.exports = {
  FFMPEG_EXE:         resolve("ARVSAL_FFMPEG_PATH",         "runtime/ffmpeg/bin/ffmpeg.exe"),
  PIPER_EXE:          resolve("ARVSAL_PIPER_PATH",           "runtime/piper/piper.exe"),
  PIPER_MODEL:        resolve("ARVSAL_PIPER_MODEL",          "runtime/piper/models/en_US-ryan-high.onnx"),
  TTS_WAV:            resolve("ARVSAL_TTS_WAV",              "runtime/temp/tts/arvsal.wav"),
  WHISPER_EXE:        resolve("ARVSAL_WHISPER_EXE",          "runtime/whisper/bin/whisper-cli.exe"),
  SMALL_MODEL_PATH:   resolve("ARVSAL_WHISPER_SMALL_MODEL",  "runtime/whisper/models/ggml-small.en.bin"),
  MEDIUM_MODEL_PATH:  resolve("ARVSAL_WHISPER_MEDIUM_MODEL", "runtime/whisper/models/ggml-medium.bin"),
  DOWNLOAD_DIR:       resolve("ARVSAL_DOWNLOAD_DIR",         "runtime/downloads"),
  TEMP_DIR:           resolve("ARVSAL_TEMP_DIR",             "runtime/temp"),
  LOG_DIR:            resolve("ARVSAL_LOG_DIR",              "runtime/logs"),
  EMAIL_COOKIES_PATH: resolve("ARVSAL_EMAIL_COOKIES",        "data/sessions/email/cookies.json"),
  MEMORY_DIR:         resolve("ARVSAL_MEMORY_DIR",           "data/memory"),
  NIRCMD_EXE:         resolve("ARVSAL_NIRCMD_PATH",          "runtime/nircmd/nircmd.exe"),
};
```

**Validation after all import changes:*```bash
node -e "const p = require('./utils/pathConfig'); console.log(p);"
# Verify all paths resolve to correct locations
```

---

## 6.17 Summary of Import Changes

| Layer | Files Changed | Import Lines Changed |
|-------|--------------|---------------------|
| core/ | ~20 files | ~45 |
| providers/ | ~10 files | ~25 |
| agents/ | ~17 files | ~35 |
| modules/ | ~12 files | ~20 |
| integrations/ | ~6 files | ~15 |
| tools/ | 5 files | ~12 |
| safety/ | 2 files | ~4 |
| utils/ | ~10 files | ~8 |
| actions/ | ~4 files | ~10 |
| **TOTAL** | **~90 files** | **~214 lines** |


---

# SECTION 7 � DEAD CODE CLEANUP GUIDE

> [!CAUTION]
> Do NOT delete any file without first confirming it is unreferenced. The grep commands below verify this. Delete only after the confirmation step passes.

---

## 7.1 backend/ttsEngine.js

**Reason for Removal:** `server.js` calls Piper TTS directly inline (lines 201, 698). `ttsEngine.js` is never imported or called from any active file.

**Risk Level:** ?? LOW � Confirmed unreferenced.

**Dependency Verification:*```bash
grep -r "ttsEngine" . --include="*.js" --exclude-dir=node_modules
# Expected: zero results (except in this guide and dead file itself)
```

**Validation Step:** Run backend; confirm TTS still works (Piper is called inline in server.js).

**Deletion Command:*```bash
git rm backend/ttsEngine.js
git commit -m "chore: remove dead ttsEngine.js (Piper called inline)"
```

**Rollback:** `git revert <commit-hash>` to restore.

---

## 7.2 backend/tts.js

**Reason for Removal:** 707-byte stub. Contains a hardcoded `espeak.exe` path. eSpeak is not used anywhere in the active system.

**Risk Level:** ?? LOW � Dead stub.

**Dependency Verification:*```bash
grep -r "require.*tts" . --include="*.js" --exclude-dir=node_modules
# Expected: no reference to "./tts" (distinct from ttsEngine)
```

**Validation Step:** Start backend; no import errors.

**Deletion Command:*```bash
git rm backend/tts.js
git commit -m "chore: remove dead tts.js stub (espeak not used)"
```

---

## 7.3 backend/espeak.js

**Reason for Removal:** 270-byte dead stub. eSpeak is not integrated into any active pipeline.

**Risk Level:** ?? LOW

**Dependency Verification:*```bash
grep -r "espeak" . --include="*.js" --exclude-dir=node_modules
# Expected: zero active references
```

**Deletion Command:*```bash
git rm backend/espeak.js
git commit -m "chore: remove espeak.js dead stub"
```

---

## 7.4 backend/llmDebug.js

**Reason for Removal:** 175-byte file containing a single debug flag variable. No actual logic.

**Risk Level:** ?? LOW

**Dependency Verification:*```bash
grep -r "llmDebug" . --include="*.js" --exclude-dir=node_modules
# LLM_DEBUG env var is used directly in llmRouter.js and llmRunner.js � not via this file
```

**Deletion Command:*```bash
git rm backend/llmDebug.js
git commit -m "chore: remove llmDebug.js dead stub"
```

---

## 7.5 backend/reflect.js

**Reason for Removal:** Possible duplicate of `reflectionRunner.js`. Both appear to orchestrate reflection. Must audit before deleting.

**Risk Level:** ?? MEDIUM � Audit required first.

**Dependency Verification:*```bash
grep -r "require.*reflect" . --include="*.js" --exclude-dir=node_modules
# If only reflectionRunner.js, reflectionGenerator.js, reflectionTrigger.js appear ? safe to delete
# If reflect.js is imported anywhere ? must merge logic before deleting
```

**If safe to delete:*```bash
git rm backend/reflect.js
git commit -m "chore: remove reflect.js (duplicate of reflectionRunner.js)"
```

**If logic is unique:** Merge unique logic into `reflectionRunner.js` before deletion.

---

## 7.6 electron/arv-sal_en_windows_v4_0_0.ppn

**Status:** DO NOT DELETE UNTIL VERIFIED.

**Reason:** Require validation of all wake-word references before removal. The `config/profiles/arvsal.json` may internally reference this `.ppn` model.

**Risk Level:** 🔴 HIGH

**Validation:** Audit `arvsal.json` to confirm no internal references exist before proceeding with removal.

## 7.7 whisper.cpp/ggml-small.en.bin (487 MB DUPLICATE)

**Reason for Removal:** Exact duplicate of `whisper.cpp/models/ggml-small.en.bin`. The root-level copy is not referenced by any code. Removing it frees 487 MB.

**Risk Level:** ?? LOW � The referenced model is in `models/` subdirectory.

**Dependency Verification:*```bash
grep -r "whisper\.cpp/ggml-small" . --include="*.js" --exclude-dir=node_modules
# Expected: zero results (whisperManager.js references whisper.cpp/models/ggml-small.en.bin)
```

**Deletion Command:*```bash
# WARNING: This is 487 MB � deletion is permanent without git history
git rm "whisper.cpp/ggml-small.en.bin"
git commit -m "chore: remove 487MB duplicate whisper small model from submodule root"
```

---

## 7.8 backend/logs/screenshot.png (5.9 MB)

**Reason for Removal:** A 5.9 MB screenshot committed into the `logs/` folder. Runtime artifacts must never be in git history.

**Risk Level:** ?? LOW � Runtime artifact, not source.

**Deletion Command:*```bash
git rm backend/logs/screenshot.png
# Add to .gitignore: backend/logs/*.png
git commit -m "chore: remove committed screenshot artifact from logs/"
```

---

## 7.9 fix_log.py (Root Level)

**Reason for Removal:** Developer debug script left at repository root. Not part of the application.

**Risk Level:** ?? LOW

**Deletion Command:*```bash
git rm fix_log.py
git commit -m "chore: remove debug script fix_log.py from root"
```

---

## 7.10 utils_vad.py (Root Level)

**Reason for Removal:** Experimental VAD (Voice Activity Detection) script at root. Not integrated into any pipeline.

**Risk Level:** ?? LOW (archive if VAD integration is planned)

**Options:*- Delete if VAD is not planned: `git rm utils_vad.py`
- Archive if potentially useful: `git mv utils_vad.py docs/archive/utils_vad.py`

---

## 7.11 planner.mf (Root Level)

**Reason for Removal:** 491-byte file of unknown purpose and format. Not referenced by any JS or Python file.

**Risk Level:** ?? MEDIUM � Unknown content. **Investigate before deleting.***Investigation Steps:*```bash
# View contents
cat planner.mf

# Check if referenced anywhere
grep -r "planner.mf" . --exclude-dir=node_modules
```

**If unreferenced:** `git rm planner.mf`

---

## 7.12 README.pdf

**Reason for Removal:** Generated PDF export of README.md. Should not be in version control.

**Deletion Command:*```bash
git rm README.pdf
echo "README.pdf" >> .gitignore
git commit -m "chore: remove generated README.pdf; add to .gitignore"
```

---

## 7.13 Dead Code Blocks (Do Not Delete Files � Clean Inline)

These are large commented-out code blocks inside active files:

| File | Lines | Content | Action |
|------|-------|---------|--------|
| `backend/llmRunner.js` | 316�477 | Old spawn-based Ollama runner (~170 lines) | Delete commented block |
| `backend/episodicMemory.js` | 227�440 | Old TTL-based memory version (~220 lines) | Delete commented block |
| `backend/plannerEngine.js` | 213�383 | Old planner version (~170 lines) | Delete commented block |
| `backend/systemActions.js` | 237 | Commented duplicate nircmd line | Delete single line |

**Procedure for each:*1. Open file in editor
2. Select the commented block
3. Delete it
4. Verify file still runs: `node -e "require('./backend/llmRunner.js')"`

---

## 7.14 frontend/ Directory

**Status:** Legacy browser UI, replaced by Electron renderer. Entire directory is obsolete.

**Risk Level:** ?? MEDIUM � Verify no active code imports from `frontend/`.

**Dependency Verification:*```bash
grep -r "frontend" . --include="*.js" --exclude-dir=node_modules --exclude-dir=frontend
# Expected: zero results
```

**If safe:** `git rm -r frontend/` or move to `docs/archive/frontend-legacy/`

---

## 7.15 Runtime Data Files to Gitignore

These files should NOT be deleted � they contain live data. Add to `.gitignore`:

```gitignore
# Runtime data � do not commit
backend/memory.json
backend/episodic_memory.json
backend/vector_store.json
backend/reflection_memory.json
backend/chat_history.json
backend/totp_secret.json
backend/toolExecution.log
backend/logs/
book/__pycache__/
book/audio_tmp/
book/manuscript.docx
book/manuscript.pdf
book/context_buffer.json
backend/python_worker/__pycache__/
.wwebjs_auth/
.wwebjs_cache/
cookies.json
```


---

# SECTION 8 � CONFIGURATION MIGRATION GUIDE

## 8.1 Current .env State

The existing `.env` contains API keys and model names but NO path variables:

```env
# Current .env (partial � keys redacted)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
OPENAI_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
GNEWS_API_KEY=...
N8N_WEBHOOK_URL=...
LLM_DEBUG=false
ARVSAL_WAKE_DEBUG=false
GHOST_MODE=false
```

## 8.2 Target .env State

After migration, `.env` must include all path variables:

```env
# === API Keys (unchanged) ===
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
OPENAI_API_KEY=your_key
GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
GNEWS_API_KEY=your_key
N8N_WEBHOOK_URL=your_url

# === Debug Flags (unchanged) ===
LLM_DEBUG=false
ARVSAL_WAKE_DEBUG=false
GHOST_MODE=false

# === Runtime Binary Paths (NEW) ===
ARVSAL_FFMPEG_PATH=./runtime/ffmpeg/bin/ffmpeg.exe
ARVSAL_PIPER_PATH=./runtime/piper/piper.exe
ARVSAL_PIPER_MODEL=./runtime/piper/models/en_US-ryan-high.onnx
ARVSAL_TTS_WAV=./runtime/temp/tts/arvsal.wav
ARVSAL_WHISPER_EXE=./runtime/whisper/bin/whisper-cli.exe
ARVSAL_WHISPER_SMALL_MODEL=./runtime/whisper/models/ggml-small.en.bin
ARVSAL_WHISPER_MEDIUM_MODEL=./runtime/whisper/models/ggml-medium.bin
ARVSAL_NIRCMD_PATH=./runtime/nircmd/nircmd.exe

# === Runtime Data Paths (NEW) ===
ARVSAL_DOWNLOAD_DIR=./runtime/downloads
ARVSAL_TEMP_DIR=./runtime/temp
ARVSAL_LOG_DIR=./runtime/logs
ARVSAL_EMAIL_COOKIES=./data/sessions/email/cookies.json
ARVSAL_MEMORY_DIR=./data/memory
ARVSAL_WHATSAPP_SESSION_DIR=./runtime/sessions/whatsapp

# === External Tool Paths (NEW � use system PATH) ===
ARVSAL_OLLAMA_PATH=ollama
ARVSAL_PYTHON_PATH=python
ARVSAL_SOFFICE_PATH=soffice
```

## 8.3 Migration Procedure

```powershell
# Step 1: Back up current .env
Copy-Item ".env" ".env.backup.$(Get-Date -Format 'yyyyMMdd')"

# Step 2: Append all new path variables
$newVars = @"

# === Runtime Binary Paths (added during restructure) ===
ARVSAL_FFMPEG_PATH=./runtime/ffmpeg/bin/ffmpeg.exe
ARVSAL_PIPER_PATH=./runtime/piper/piper.exe
ARVSAL_PIPER_MODEL=./runtime/piper/models/en_US-ryan-high.onnx
ARVSAL_TTS_WAV=./runtime/temp/tts/arvsal.wav
ARVSAL_WHISPER_EXE=./runtime/whisper/bin/whisper-cli.exe
ARVSAL_WHISPER_SMALL_MODEL=./runtime/whisper/models/ggml-small.en.bin
ARVSAL_WHISPER_MEDIUM_MODEL=./runtime/whisper/models/ggml-medium.bin
ARVSAL_NIRCMD_PATH=./runtime/nircmd/nircmd.exe
ARVSAL_DOWNLOAD_DIR=./runtime/downloads
ARVSAL_TEMP_DIR=./runtime/temp
ARVSAL_LOG_DIR=./runtime/logs
ARVSAL_EMAIL_COOKIES=./data/sessions/email/cookies.json
ARVSAL_MEMORY_DIR=./data/memory
ARVSAL_WHATSAPP_SESSION_DIR=./runtime/sessions/whatsapp
ARVSAL_OLLAMA_PATH=ollama
ARVSAL_PYTHON_PATH=python
ARVSAL_SOFFICE_PATH=soffice
"@
Add-Content ".env" $newVars

# Step 3: Create .env.example (no secrets � safe to commit)
# Copy .env, then replace all values with empty or placeholder
```

## 8.4 Validation Procedure

```bash
# Verify all env vars are loaded
node -e "
  require('dotenv').config();
  const vars = ['ARVSAL_FFMPEG_PATH','ARVSAL_PIPER_PATH','ARVSAL_WHISPER_EXE',
                 'ARVSAL_WHISPER_SMALL_MODEL','ARVSAL_WHISPER_MEDIUM_MODEL',
                 'ARVSAL_DOWNLOAD_DIR','ARVSAL_LOG_DIR'];
  vars.forEach(v => console.log(v, '=', process.env[v] || 'MISSING'));
"
```

## 8.5 Rollback Procedure

```powershell
# Restore original .env from backup
Copy-Item ".env.backup.YYYYMMDD" ".env" -Force
```

---

## 8.6 Runtime Config Changes

### 8.6.1 pathConfig.js (NEW � create during Phase E)

Create `utils/pathConfig.js` as documented in Section 6.16.

This file is the **single centralized resolver** for all runtime paths. Every file that previously had a hardcoded path must import from here instead.

### 8.6.2 .gitignore Updates

Add these rules to `.gitignore`:

```gitignore
# Runtime directory � not in git
/runtime/ffmpeg/
/runtime/piper/
/runtime/whisper/
/runtime/models/
/runtime/sessions/
/runtime/cache/
/runtime/temp/
/runtime/downloads/
/runtime/logs/
!/runtime/**/.gitkeep

# Data directory � runtime state
/data/memory/
/data/sessions/
/data/security/
/data/cache/
!/data/**/.gitkeep

# Python
__pycache__/
*.pyc
/book/audio_tmp/
/book/manuscript.docx
/book/manuscript.pdf
/book/context_buffer.json
/book/.last_update_id

# Logs and runtime artifacts
*.log
backend/logs/screenshot.png
backend/memory.json
backend/episodic_memory.json
backend/vector_store.json
backend/chat_history.json
backend/totp_secret.json
backend/reflection_memory.json
.wwebjs_auth/
.wwebjs_cache/
cookies.json
README.pdf
```

### 8.6.3 Startup Config Changes

The current startup sequence in `electron/main.js` spawns the backend:
```js
spawn("node", [path.resolve(__dirname, "../../backend/server.js")])
```

After restructuring, this becomes:
```js
spawn("node", [path.resolve(__dirname, "../../backend/server.js")])
```

Additionally, add a health check at startup:
```js
// In electron/main.js � before spawning backend
const { execSync } = require("child_process");
try {
  execSync("node scripts/health-check.js", { stdio: "inherit" });
} catch (e) {
  dialog.showErrorBox("ARVSAL Startup Error",
    "Missing runtime files. Run: node scripts/setup-runtime.js");
  app.quit();
}
```

---

# SECTION 9 � STARTUP GRAPH IMPACT ANALYSIS

## 9.1 Current Startup Flow

```
npm start / electron .
    �
    +- electron/main.js loads
    �   +- Checks GHOST_MODE env
    �   +- spawn("node", [path.resolve(__dirname, "../../backend/server.js")])  ? Backend spawned as child process
    �   +- WakeWordEngine = require("../backend/wakeWord")
    �   �   +- ava-listener npm package initializes
    �   �       +- Copies profile from node_modules ? backend/profiles/
    �   +- BrowserWindow created ? loads electron/renderer/index.html
    �
    +- backend/server.js starts
        +- dotenv.config() ? reads .env
        +- ALL modules required synchronously at top:
        �   ollamaWarmup, chatHistory, episodicMemory, memory,
        �   themeExtractor, normalizer, intentClassifier, actions,
        �   personality, llmRouter, localSkills, cognitiveEngine,
        �   plannerEngine, llmRunner, actionIntentDetector,
        �   telegramService, remoteControl, totpManager, fileSearch,
        �   whatsappBridge, busyMode, vipList, missedTracker,
        �   autoReplyGuard, contactBook, visualService, visionRouter,
        �   ocrRunner, visionAnalyzer, conversionEngine, screenClassifier,
        �   whisperManager, screenActionOrchestrator, agentLoop,
        �   contentSuggester, reflectionRunner, systemActions,
        �   confirmManager, aiSwitch, utils/safeTempManager,
        �   agent/interactionModeManager
        +- LAZY requires (inside switch cases):
        �   email/emailHandler, tools/toolRegistry,
        �   safety/riskEngine, screenCapture
        +- express.listen(3000) ? Server ready
        +- ollamaWarmup() ? Warms Ollama models (async)
        +- startTelegramListener() ? Telegram polling starts
        +- startWhatsApp() ? WhatsApp Web.js session starts
```

## 9.2 Target Startup Flow (Post-Migration)

Startup flow remains largely the same because backend/server.js is NOT decomposed.

## 9.3 Components Affected by Migration

| Component | Current Entry Point | New Entry Point | Change Type |
|-----------|--------------------|--------------------|-------------|
| Electron Main | `electron/main.js` | `apps/electron/main.js` | Move + alias registration |
| Backend Server | `backend/server.js` | `backend/server.js` | Intact |
| Wake Word | `backend/wakeWord` | `@modules/wake/wakeWord` | Move + alias |
| Whisper STT | `backend/whisperManager` | `@modules/stt/whisperManager` | Move + pathConfig |
| Piper TTS | inline in server.js | inline in server.js | Intact |
| Agent Loop | `backend/agent/agentLoop` | `@agents/agentLoop` | Move + alias |
| Memory | `backend/memory` | `@core/memory/semanticMemory` | Move + rename + alias |

## 9.4 IPC Changes

**Current IPC channels** (in `electron/main.js`) � NO CHANGES REQUIRED to IPC channel names:

| Channel | Direction | Handler |
|---------|-----------|---------|
| `arvsal:command` | Renderer ? Main ? Backend | POSTs to `localhost:3000/command` |
| `arvsal:audio` | Renderer ? Main ? Backend | POSTs to `localhost:3000/audio` |
| `arvsal:finalAudio` | Renderer ? Main ? Backend | POSTs to `localhost:3000/audio/final` |
| `arvsal:speak` | Renderer ? Main ? Backend | POSTs to `localhost:3000/speak` |
| `arvsal:streamAudio` | Renderer ? Main ? Backend | POSTs to `localhost:3000/audio/stream` |
| `arvsal:resumeWake` | Main ? Wake Engine | Resumes wake detection |
| `arvsal:stopWake` | Main ? Wake Engine | Pauses wake detection |
| `arvsal:ttsStart` | Main ? Renderer | TTS started notification |
| `arvsal:ttsEnd` | Main ? Renderer | TTS ended notification |

> [!NOTE]
> IPC channel NAMES are unchanged. Only the import path for `WakeWordEngine` changes.

## 9.5 Subprocess Changes

| Subprocess | Before | After | Notes |
|-----------|--------|-------|-------|
| Backend server | `spawn("node", [path.resolve(__dirname, "../../backend/server.js")])` | `spawn("node", [path.resolve(__dirname, "../../backend/server.js")])` | Path update in main.js |
| FFmpeg | `spawn(hardcoded_path, ...)` | `spawn(pathConfig.FFMPEG_EXE, ...)` | Via pathConfig |
| Piper TTS | `spawn(hardcoded_path, ...)` | `spawn(pathConfig.PIPER_EXE, ...)` | Via pathConfig |
| Whisper CLI | `execFile(relative_path, ...)` | `execFile(pathConfig.WHISPER_EXE, ...)` | Via pathConfig; cwd auto-derives |
| Ollama | `spawn(hardcoded_path, ...)` | `spawn(process.env.ARVSAL_OLLAMA_PATH, ...)` | Via env |
| Python | `spawn(hardcoded_path, ...)` | `spawn(process.env.ARVSAL_PYTHON_PATH, ...)` | Via env |

## 9.6 Risk Analysis

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| `module-alias` not registered before first require() | HIGH if forgotten | All `@` imports fail | Make it line 1 of EVERY entry point |
| `backend/server.js` missing shared state during global state preservation | MEDIUM | Race conditions in audio pipeline | Carefully map state ownership BEFORE moving files |
| WhatsApp session not found at new path | MEDIUM | QR re-scan required | Copy (not move) session; validate BEFORE deleting original |
| Whisper DLL loading fails at new location | LOW | STT completely broken | Verify cwd = dirname(WHISPER_EXE) |
| Lazy requires in switch cases fail after file moves | HIGH | Plan execution broken | Convert ALL lazy requires to top-level during Phase D |

## 9.7 Validation Checklist for Startup

After Phase E (global state preservation) completes:

- [ ] `apps/electron/main.js` has `require('module-alias/register')` as line 1
- [ ] `backend/server.js` has `require('module-alias/register')` as line 1
- [ ] Backend spawned as `backend/server.js` in main.js
- [ ] `http://localhost:3000/health` returns `{"status":"ok"}`
- [ ] Wake word triggers Electron IPC correctly
- [ ] First voice command processed end-to-end


---

# SECTION 10 � VERIFICATION CHECKLIST

> Run this checklist after each phase. A phase is not complete until all relevant boxes can be checked.

---

## Phase A Checklist � Runtime Consolidation

### Functional Tests
- [ ] `runtime\ffmpeg\bin\ffmpeg.exe -version` outputs version info
- [ ] `runtime\piper\piper.exe --version` or help text appears
- [ ] `runtime\whisper\bin\whisper-cli.exe --version` runs without DLL errors
- [ ] `runtime\nircmd\nircmd.exe` runs without errors

### Startup Tests
- [ ] Backend starts: `node backend/server.js` (no errors)
- [ ] No `Cannot find module` errors in console

### STT Tests (Whisper)
- [ ] Short voice command ? transcript appears in UI
- [ ] Long voice command via `/audio/final` ? accurate transcript
- [ ] STT works when laptop is on battery (CPU mode)
- [ ] STT works when plugged in (GPU mode if applicable)

### TTS Tests (Piper)
- [ ] Issue any command ? ARVSAL speaks response with Ryan voice
- [ ] `/speak` route responds with audio
- [ ] `speakLocally()` helper plays audio in renderer

### Integration Tests
- [ ] Telegram: Send message to bot ? bot responds
- [ ] Telegram: Send file to bot ? file appears in `runtime/downloads/`

---

## Phase B Checklist � Data Isolation

- [ ] `data/memory/memory.json` loads correctly at startup
- [ ] `data/memory/episodic_memory.json` loads correctly
- [ ] `data/memory/vector_store.json` loads correctly
- [ ] Memory persists: save a fact, restart, fact is recalled
- [ ] WhatsApp connects without QR re-scan
- [ ] Email cookies load from `data/sessions/email/cookies.json`
- [ ] Log files write to `runtime/logs/`
- [ ] No JSON files remain alongside source in `backend/`

---

## Phase C Checklist � Dead Code Removal

- [ ] `node backend/server.js` starts cleanly (no missing module errors)
- [ ] TTS still works (Piper inline in server.js � not via ttsEngine.js)
- [ ] Wake word still activates (ava-listener, not Picovoice .ppn)
- [ ] `git status` shows no untracked runtime artifacts
- [ ] `whisper.cpp/ggml-small.en.bin` (root) is gone; `models/` copy intact
- [ ] 487 MB freed from `whisper.cpp/`

---

## Phase D Checklist � Directory Restructuring

### After Each Domain Move:
- [ ] `node -e "require('./core/intent/intentClassifier')"` � no error (after core/intent move)
- [ ] `node -e "require('./core/memory/semanticMemory')"` � no error (after core/memory move)
- [ ] `node -e "require('./providers/llm/llmRunner')"` � no error (after providers move)
- [ ] `node -e "require('./agents/agentLoop')"` � no error (after agents move)
- [ ] `node -e "require('./modules/stt/whisperManager')"` � no error (after modules move)

### LLM Tests
- [ ] Local Ollama: Issue conversational command ? LLM responds
- [ ] Memory recall: "what is my name?" ? correct recall

### Whisper Tests
- [ ] Voice ? transcript in UI

### Vision Tests
- [ ] OCR: Ask ARVSAL to read screen ? OCR output visible in logs
- [ ] Screen capture: `screenCapture.js` creates temp file in `runtime/temp/screen/`

### Agent Tests
- [ ] "Open Notepad" ? system tool opens Notepad
- [ ] Plan generation: complex command triggers planner JSON output in console

### WhatsApp Tests
- [ ] WhatsApp client status shows connected
- [ ] Send WhatsApp to self ? ARVSAL logs receipt

### Email Tests
- [ ] "Check email" ? email results returned (or auth error if session expired)

---

## 

**Objective:** Keep backend/server.js intact during this migration.

**NOT APPLICABLE:** Shared state extraction
*(These steps are NOT APPLICABLE because server.js will remain intact.)**Global State Preservation:*When moving files, ensure only one instance exists for:
* memory state
* chat history
> *See Section 3 for full details on Global State Preservation.*

**Required Validation:** Full E2E test.

## Phase E Checklist � Import Alias System

- [ ] `require('module-alias/register')` is line 1 in `backend/server.js`
- [ ] `require('module-alias/register')` is line 1 in `apps/electron/main.js`
- [ ] `package.json` has `_moduleAliases` block with all 13 aliases
- [ ] `node -e "require('module-alias/register'); require('@core/memory/semanticMemory')"` � no error
- [ ] `node -e "require('module-alias/register'); require('@providers/llm/llmRunner')"` � no error
- [ ] `node scripts/health-check.js` � all checks pass
- [ ] Full backend start: zero `Cannot find module` errors
- [ ] Piper TTS: confirm voice output
- [ ] Whisper STT: confirm transcription
- [ ] Agent: confirm plan execution

---

## Phase G Checklist � Book Engine + Final Config

- [ ] Book engine: `python book/engine.py` starts without path errors
- [ ] Book engine: Generate a 3-sentence test book ? PDF created
- [ ] `config/profiles/arvsal.json` is at new location
- [ ] `wakeWord.js` profile path updated ? wake word still activates
- [ ] `.env.example` created with all variable keys (no values)
- [ ] `.gitignore` updated with `runtime/`, `data/` rules
- [ ] `git status` shows no untracked runtime files

---

## Final End-to-End System Test

Run these in sequence after all phases complete:

### Voice Pipeline
- [ ] Say wake word ? ARVSAL responds with "Yes sir" audio
- [ ] Say "what time is it" ? ARVSAL speaks current time

### LLM Pipeline
- [ ] Say "tell me a joke" ? Ollama generates response ? Piper speaks it

### Memory Pipeline
- [ ] Say "remember that my favorite color is blue"
- [ ] Restart ARVSAL
- [ ] Say "what is my favorite color?" ? "blue" recalled

### Agent Pipeline
- [ ] Say "open calculator" ? Windows Calculator opens

### Vision Pipeline
- [ ] Say "what's on my screen?" ? OCR/vision response

### Integration Pipeline
- [ ] Telegram: send "hello" ? bot responds
- [ ] WhatsApp: ARVSAL shows as online

---

# SECTION 11 � ROLLBACK PLAYBOOK

## Phase A Rollback � Runtime Consolidation

**Trigger:** Binary path change breaks STT or TTS.

**Recovery Steps:*1. Open `.env`
2. Set original hardcoded paths:
   ```
   ARVSAL_FFMPEG_PATH=C:\Users\athar\Downloads\ffmpeg-8.0.1-essentials_build\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe
   ARVSAL_PIPER_PATH=C:\Users\athar\Downloads\piper_windows_amd64\piper\piper.exe
   ARVSAL_PIPER_MODEL=C:\Users\athar\Downloads\piper_windows_amd64\piper\en_US-ryan-high.onnx
   ARVSAL_WHISPER_EXE= (remove � let whisperManager.js use its default relative path)
   ```
3. Restart backend
4. Originals at `C:\Users\athar\Downloads\...` are untouched � system recovers instantly

**Files Affected:** `.env` only
**Expected Recovery Time:** 2 minutes

---

## Phase B Rollback � Data Isolation

**Trigger:** Memory fails to load; WhatsApp requires QR re-scan; email fetch fails.

**Recovery Steps:*```powershell
# Restore data files to backend/
Copy-Item "C:\arvsal-backup-YYYYMMDD\memory.json" "backend\memory.json" -Force
Copy-Item "C:\arvsal-backup-YYYYMMDD\episodic_memory.json" "backend\episodic_memory.json" -Force
Copy-Item "C:\arvsal-backup-YYYYMMDD\vector_store.json" "backend\vector_store.json" -Force
Copy-Item "C:\arvsal-backup-YYYYMMDD\cookies.json" "cookies.json" -Force
Copy-Item "C:\arvsal-backup-YYYYMMDD\.wwebjs_auth" ".wwebjs_auth" -Recurse -Force

# Revert path changes in source files
git checkout backend/memory.js backend/episodicMemory.js backend/email/emailFetcher.js
git checkout backend/whatsappBridge.js
```

**Files Affected:** memory files + emailFetcher.js + whatsappBridge.js
**Expected Recovery Time:** 5 minutes

---

## Phase C Rollback � Dead Code Removal

**Trigger:** Deleted file was actually imported somewhere unexpected.

**Recovery Steps:*```bash
git revert <phase-C-commit-hash>
# OR restore specific file
git checkout pre-restructure-v1 -- backend/ttsEngine.js
```

**Expected Recovery Time:** 2 minutes

---

## Phase D Rollback � Directory Restructuring

**Trigger:** Import breakage after domain move; module not found errors.

**Recovery Steps (per domain):*```bash
# Option 1: Revert the specific domain commit
git revert <domain-commit-hash>

# Option 2: Restore specific files
git checkout pre-restructure-v1 -- backend/intentClassifier.js
# Re-run from last working domain checkpoint

# Option 3: Full rollback to pre-migration
git checkout restructure-v2
git reset --hard phase-C-complete
```

**Files Affected:** All files in moved domain
**Expected Recovery Time:** 5�15 minutes per domain

---

## 

**Objective:** Keep backend/server.js intact during this migration.

**NOT APPLICABLE:** Shared state extraction
*(These steps are NOT APPLICABLE because server.js will remain intact.)**Global State Preservation:*When moving files, ensure only one instance exists for:
* memory state
* chat history
> *See Section 3 for full details on Global State Preservation.*

**Required Validation:** Full E2E test.

## Phase E Rollback � Import Alias System

**Trigger:** `@alias` not resolving; module-alias not bootstrapping.

**Recovery Steps:*```bash
# Remove module-alias registration from entry points
# Replace all @alias imports with relative paths
git checkout restructure-v2
git reset --hard phase-E-complete
```

**Emergency Fix (no rollback needed):*```bash
# If only bootstrap order is wrong:
# Ensure require('module-alias/register') is FIRST line
# Check package.json _moduleAliases is present and correct
node -e "require('module-alias/register'); console.log('aliases ok')"
```

**Expected Recovery Time:** 5 minutes

---

## Phase G Rollback � Book Engine + Config

**Trigger:** Book engine fails to start; Ollama or soffice path wrong.

**Recovery Steps:*```python
# In book/config.py � restore hardcoded fallback
OLLAMA_EXE = Path(r"C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe")
SOFFICE_EXE = Path(r"C:\Program Files\LibreOffice\program\soffice.exe")
```

**Files Affected:** `book/config.py`, `wakeWord.js` profile paths
**Expected Recovery Time:** 2 minutes

---

## Full Emergency Rollback

If the entire migration needs to be abandoned:

```bash
# Return to main branch at pre-migration state
git checkout main
git reset --hard pre-restructure-v1

# Clean up any newly created untracked files/directories
git clean -fd

# Verify
git log --oneline -3
node backend/server.js  # Should start normally
```

**Expected Recovery Time:** 2 minutes

---

# SECTION 12 � FINAL EXECUTION TIMELINE

## Realistic 5-Day Migration Roadmap

> Assumes 6�8 working hours per day. Solo developer. System stays live throughout (do not take it fully offline).

---

### Day 1 � Runtime & Data (Phases A + B)

**Morning (3 hours) � Phase A: Runtime Consolidation*| Time | Task |
|------|------|
| 9:00 | Create git tag `pre-restructure-v1`, branch `restructure-v2` |
| 9:15 | Create `runtime/` directory skeleton |
| 9:30 | Copy FFmpeg to `runtime/ffmpeg/bin/` |
| 9:45 | Copy Piper + models to `runtime/piper/` |
| 10:00 | Copy Whisper binary + DLLs to `runtime/whisper/bin/` |
| 10:15 | Copy Whisper models to `runtime/whisper/models/` (~1.5 GB � wait) |
| 10:45 | Add all ARVSAL_* path vars to `.env` |
| 11:00 | Update server.js FFmpeg refs (�3), Piper refs (�2), model refs (�2) |
| 11:20 | Update whisperManager.js to use pathConfig |
| 11:30 | Update telegramService.js download folder |
| 11:40 | Update embeddingModel.js + pythonBridge.js + systemActions.js |
| 12:00 | **SMOKE TEST** � Full backend start, STT test, TTS test |

**Afternoon (2 hours) � Phase B: Data Isolation*| Time | Task |
|------|------|
| 13:00 | Create `data/` directory skeleton |
| 13:15 | Copy all backend/*.json to `data/memory/` |
| 13:30 | Update all `path.join(__dirname, "memory.json")` refs in backend/ |
| 14:00 | Move cookies.json ? `data/sessions/email/` |
| 14:15 | Copy .wwebjs_auth ? `data/sessions/whatsapp/` |
| 14:30 | Update emailFetcher.js + whatsappBridge.js |
| 14:45 | **SMOKE TEST** � Memory loads, WhatsApp connects, email works |
| 15:00 | Git commit: `"phase-A-B: runtime + data isolation"` |
| 15:10 | Create tag `phase-B-complete` |

---

### Day 2 � Cleanup & Start Restructure (Phases C + D start)

**Morning (1.5 hours) � Phase C: Dead Code Removal*| Time | Task |
|------|------|
| 9:00 | grep verify each dead file (ttsEngine, tts, espeak, llmDebug) |
| 9:20 | `git rm` dead files |
| 9:30 | Investigate `planner.mf` and `reflect.js` |
| 9:45 | Delete 487 MB whisper duplicate |
| 10:00 | Delete screenshot.png, fix_log.py, README.pdf |
| 10:15 | Move dev docs to `docs/archive/` |
| 10:30 | **SMOKE TEST** � Full startup, zero import errors |
| 10:45 | Git commit: `"phase-C: dead code removed"`, tag `phase-C-complete` |

**Afternoon (4 hours) � Phase D start: Core + Providers domains*| Time | Task |
|------|------|
| 11:00 | Create all V2 target directories |
| 11:15 | Move core/intent/ files (5 files) + update their imports |
| 12:00 | **Smoke test** � intent classification works |
| 12:15 | Move core/memory/ files (14 files) + update imports |
| 13:30 | **Smoke test** � memory load/save works |
| 14:00 | Move core/reasoning/ files (3 files) + update imports |
| 14:30 | **Smoke test** � planner generates plans |
| 15:00 | Move core/personality/ files (3 files) + update imports |
| 15:30 | Move providers/llm/ files (10 files) + update imports |
| 16:00 | Move providers/external/ files (3 files) + update imports |
| 16:30 | **Smoke test** � LLM responds (local + Gemini mode) |
| 17:00 | Git commit: `"phase-D: core + providers moved"` |

---

### Day 3 � Restructure Continues (Phase D complete)

| Time | Task |
|------|------|
| 9:00 | Move agents/ files (10 files + 6 skills) + update imports |
| 10:30 | **Smoke test** � agent loop executes a screen action |
| 10:45 | Move modules/stt/, modules/wake/ + update imports |
| 11:30 | **Smoke test** � Whisper STT works, wake word triggers |
| 11:45 | Move modules/vision/ (8 files) + update imports |
| 13:00 | **Smoke test** � OCR, screen capture work |
| 13:15 | Move modules/reflection/, modules/aeye/ |
| 13:45 | Move integrations/ (6 files) + update imports |
| 14:30 | **Smoke test** � Telegram, WhatsApp, email work |
| 14:45 | Move tools/, safety/ (7 files) + update imports |
| 15:15 | Move utils/, actions/ (12 files) + update imports |
| 16:00 | Move apps/ (Electron shell � 12 files) + update imports |
| 16:30 | Move git submodules (arvsal-vision ? vision/, whisper.cpp ? stt/) |
| 17:00 | Move config/profiles/ + update wakeWord.js paths |
| 17:30 | **Full smoke test** � entire system E2E |
| 17:45 | Git commit: `"phase-D: complete restructure"`, tag `phase-D-complete` |

---

### Day 4 � Import Aliases + Final Config (Phases F + G)

**Morning (3 hours) � Phase E: Import Alias System*| Time | Task |
|------|------|
| 9:00 | `npm install module-alias` |
| 9:10 | Add `_moduleAliases` to `package.json` |
| 9:20 | Add `require('module-alias/register')` to `backend/server.js` line 1 |
| 9:25 | Add `require('module-alias/register')` to `apps/electron/main.js` line 1 |
| 9:30 | Create `utils/pathConfig.js` |
| 9:45 | Replace relative imports with @aliases � backend/server.js (~40 imports) |
| 10:30 | Replace relative imports � core/ files (~45 imports) |
| 11:00 | Replace relative imports � providers/ files (~25 imports) |
| 11:30 | Replace relative imports � agents/ files (~35 imports) |
| 12:00 | **Smoke test** � zero module errors, LLM responds |

**Afternoon (2 hours) � Phase G: Book Engine + Final Config*| Time | Task |
|------|------|
| 13:00 | Update `book/config.py` Ollama + soffice paths |
| 13:30 | Create `.env.example` with all variable keys |
| 13:45 | Update `.gitignore` with runtime/ + data/ rules |
| 14:00 | Run `node scripts/health-check.js` |
| 14:15 | Run book engine: generate test book |
| 14:30 | **Final system-wide E2E test** |
| 15:00 | `git commit -m "phase-F-G: aliases + final config"` |
| 15:10 | `git tag migration-complete` |
| 15:15 | Open PR: `restructure-v2 ? main` |

---

## Summary

| Day | Phases | Key Deliverable |
|-----|--------|----------------|
| 1 | A + B | All binaries in `runtime/`, all data in `data/`, env vars set |
| 2 | C + D (start) | Dead code gone, core/ + providers/ restructured |
| 3 | D (finish) | All 110 files in V2 structure, submodules relocated |
| 4 | E | Global state preserved, E2E tested |
| 5 | F + G | @aliases active, book engine fixed, migration complete |

**Total estimated time:** 3�5 days depending on issues encountered.

**Critical path:** Global State Preservation requires careful validation. Schedule it on a day with buffer time for debugging.

---

*ARVSAL Manual Restructure Execution Guide � End of Document*Generated from: ARVSAL_DEPENDENCY_GRAPH.md, ARVSAL_EXTERNAL_DEPENDENCIES.md, ARVSAL_EXTERNAL_DEPENDENCIES_V2.md, ARVSAL_ASSET_INVENTORY.md, ARVSAL_V2_FOLDER_STRUCTURE.md, ARVSAL_MIGRATION_PLAN.md, ARVSAL_IMPORT_REFACTOR_PLAN.md, ARVSAL_RUNTIME_DIRECTORY_PLAN.md, ARVSAL_RESTRUCTURE_READINESS.md---

# SECTION 13 — ASAR PACKAGING CONSIDERATIONS

**Critical Fix 3: Electron Production Packaging*When building the Electron app for production, all files are bundled into a read-only archive named `app.asar`.

**Why runtime binaries cannot live inside app.asar:*External executables (like `whisper-cli.exe`, `ffmpeg.exe`, `piper.exe`) cannot be spawned if they are packed inside an `.asar` archive. The OS (`child_process.spawn`) expects a real file system path, which an `.asar` file cannot provide directly for an executable inside it.

**Proper Handling:** Use `process.resourcesPath` to point to binaries placed outside the `app.asar`.
* Alternatively, explicitly configure your bundler (e.g., `electron-builder`) to use `asarUnpack` for the `runtime/` folder. This places the files in `app.asar.unpacked`, where they can be executed.
* Avoid relying on `__dirname` relative pathing if those paths resolve inside `app.asar` when targeting an external binary.


### `electron-builder` Configuration Example
To ensure the `runtime/` folder is available to the compiled application, it must be explicitly unpacked:

```json
{
  "build": {
    "appId": "com.arvsal.app",
    "asar": true,
    "asarUnpack": [
      "runtime/**"
    ]
  }
}
```

### Production Path Resolution Example
When packaged, the application runs from `app.asar`. The unpacked runtime binaries will reside in `app.asar.unpacked`. You must use `process.resourcesPath` to dynamically locate them.

Update `utils/pathConfig.js` to handle both development and production:

*See Section 13.2 for the authoritative `pathConfig.js` implementation.*

### Production Build Validation Checklist
Before releasing an `.exe`:
- [ ] `whisper-cli.exe` launches successfully from the unpacked directory.
- [ ] `piper.exe` launches successfully and produces audio.
- [ ] `ffmpeg.exe` successfully transcodes audio buffers.
- [ ] Wake word activates (ensure `ava-listener` profiles resolve outside ASAR if necessary).
- [ ] All data files (memory, sessions) are successfully written to a user-writable path (e.g., `%APPDATA%`), NOT the read-only installation directory.
