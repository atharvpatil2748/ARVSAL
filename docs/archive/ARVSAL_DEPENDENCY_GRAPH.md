# ARVSAL Dependency Graph
**Generated:** 2026-05-30 | **Phase:** 1 of 8

---

## Repository Root Overview

```
arvsal/
├── electron/           → Electron shell (main process + renderer)
├── backend/            → Node.js Express server (core brain)
│   ├── agent/          → Autonomous screen-action agent
│   ├── arvsal-vision/  → OmniTool vision submodule (Git submodule)
│   ├── email/          → Email integration via Puppeteer
│   ├── logs/           → Runtime log files
│   ├── profiles/       → AVA wake-word listener profiles
│   ├── python_worker/  → YOLO-based UI element detector
│   ├── safety/         → Risk/confirmation engine
│   ├── tools/          → Tool registry (system/desktop/n8n/memory)
│   └── utils/          → Safe temp manager + power monitor
├── book/               → Standalone Text-In/PDF-Out engine (Python)
├── frontend/           → Standalone browser-based UI (unused/legacy)
├── whisper.cpp/        → Git submodule — whisper.cpp compiled binary
└── [root files]        → package.json, .env, .gitignore, etc.
```

---

## 1. Electron Layer

### `electron/main.js`
**Imports:**
- `electron` (BrowserWindow, ipcMain, session, globalShortcut)
- `child_process` (spawn)
- `path`
- `node-fetch` (dynamic ESM import)
- `../backend/wakeWord` → `WakeWordEngine`

**Role:** App entry point. Spawns backend server, opens renderer window, starts wake engine.

**IPC Channels Exposed:**
- `arvsal:command` → POSTs to `http://localhost:3000/command`
- `arvsal:audio` → POSTs to `http://localhost:3000/audio`
- `arvsal:finalAudio` → POSTs to `http://localhost:3000/audio/final`
- `arvsal:speak` → POSTs to `http://localhost:3000/speak`
- `arvsal:streamAudio` → POSTs to `http://localhost:3000/audio/stream`
- `arvsal:resumeWake`, `arvsal:stopWake`, `arvsal:ttsStart`, `arvsal:ttsEnd` (one-way)

### `electron/preload.js`
**Role:** Context bridge between renderer and main process.

### `electron/renderer/index.html`
**Imports:** Inline JavaScript (single-file app)
**Role:** Main UI. Microphone, wake animation, chat display, TTS playback.

### `electron/renderer/ui.js`
**Role:** Thin stub (likely unused/empty bridge).

### `electron/renderer/*.css`
- `animations.css` — AI orb animations
- `components.css` — UI component styles
- `effects.css` — Visual effects
- `layout.css` — Layout grid
- `states.css` — State-specific CSS (listening, processing, etc.)
- `theme.css` — Design tokens

### `electron/arv-sal_en_windows_v4_0_0.ppn`
**Type:** Picovoice wake word model (PPN file).
**Status:** ⚠️ ORPHANED — `ava-listener` npm package is used instead; this file is never referenced.

---

## 2. Backend Layer — Core

### `backend/server.js` (1828 lines — MONOLITH)
**Primary file. Imports ALL modules.**

**Internal imports:**
```
./ollamaWarmup
./chatHistory
./episodicMemory
./memory
./themeExtractor
./normalizer
./intentClassifier
./actions
./personality
./llmRouter
./localSkills
./cognitiveEngine
./plannerEngine
./llmRunner
./actionIntentDetector
./telegramService
./remoteControl
./totpManager
./fileSearch
./whatsappBridge
./busyMode
./vipList
./missedTracker
./autoReplyGuard
./contactBook
./visualService
./visionRouter
./ocrRunner
./visionAnalyzer
./conversionEngine
./screenClassifier
./whisperManager
./screenActionOrchestrator
./agent/agentLoop
./contentSuggester
./reflectionRunner
./systemActions
./confirmManager
./aiSwitch
./email/emailHandler           (lazy-loaded in EMAIL_FETCH case)
./tools/toolRegistry           (lazy-loaded in CONFIRM/plan execution)
./safety/riskEngine            (lazy-loaded in plan execution)
./screenCapture                (lazy-loaded in SUGGEST_CONTENT)
./utils/safeTempManager
./agent/interactionModeManager
```

**External npm packages:**
```
express, cors, fs, os, child_process, axios, form-data,
screenshot-desktop, sharp, dotenv, path
```

**External binaries used (hardcoded paths):**
- `C:\Users\athar\Downloads\ffmpeg-8.0.1-essentials_build\...\ffmpeg.exe` (×3 — audio, final, stream)
- `C:\Users\athar\Downloads\piper_windows_amd64\piper\piper.exe` (×2 — speakLocally + /speak route)

---

## 3. Backend — LLM / AI Layer

### `backend/llmRunner.js`
**Imports:** `child_process`, `http`
**Role:** Serial queue for Ollama HTTP API (`localhost:11434`). Contains both active (HTTP) and commented-out (spawn-based) implementation.
**Dead code:** ~170 lines of commented-out spawn-based runner (lines 316–477).

### `backend/llmRouter.js`
**Imports:** `./llmRunner`, `./chatHistory`, `./memory`, `./episodicMemory`, `./llmPrompt`, `./identity`, `./aiSwitch`, `./chatgptClient`, `./geminiClient`, `./groqClient`
**Role:** Routes LLM calls based on active AI mode (local / ChatGPT / Gemini / Groq).

### `backend/plannerEngine.js`
**Imports:** `./llmRunner`, `./geminiClient`, `./aiSwitch`
**Role:** Generates JSON action plans from user input. Contains large commented-out previous version (lines 213–383).

### `backend/aiSwitch.js`
**Imports:** None (internal state only)
**Role:** Singleton state for active AI (local / chatgpt / gemini / groq).

### `backend/localLLM.js`
**Imports:** `./llmRunner`
**Role:** Wrapper for local Ollama model calls.

### `backend/llmGuard.js`
**Imports:** `./llmRunner`
**Role:** Content safety pre-filter for LLM inputs.

### `backend/llmIntentRouter.js`
**Imports:** `./llmRunner`, `./intentPrompt`
**Role:** LLM-based intent fallback classifier.

### `backend/ollamaWarmup.js`
**Imports:** `http`
**Role:** Warms all Ollama models at startup.

### `backend/llmDebug.js`
**Role:** Single-line debug flag. Likely dead code.

---

## 4. Backend — Intent Layer

### `backend/intentClassifier.js` (12,207 bytes)
**Imports:** `./intentPrompt`, `./dateResolver`
**Role:** Rule-first deterministic intent classifier. Matches ~40+ intents.

### `backend/actionIntentDetector.js`
**Imports:** None
**Role:** Heuristic classifier for screen-action intents.

### `backend/intentEngine.js`
**Imports:** `./llmIntentRouter`, `./intentClassifier`
**Role:** Orchestrator that tries rule-based first, then falls back to LLM classification.

### `backend/intentPrompt.js`
**Imports:** None
**Role:** Static prompt template for LLM intent classification.

### `backend/actions.js` (11,558 bytes)
**Imports:** `./memory`, `./episodicMemory`, `./dateResolver`, `./memorySearch`, `./memoryInspector`, `./recallRouter`
**Role:** Handles memory-related intents (REMEMBER, RECALL, FORGET, etc.).

---

## 5. Backend — Memory Layer

### `backend/memory.js` (Semantic Memory)
**Imports:** `./keyNormalizer`, `./embeddingModel` (lazy), `./vectorStore` (lazy)
**Persists to:** `backend/memory.json`
**Role:** Key/value fact store with confidence decay.

### `backend/episodicMemory.js` (Episodic Memory)
**Imports:** `./importanceScorer`, `./embeddingModel` (lazy), `./vectorStore` (lazy)
**Persists to:** `backend/episodic_memory.json` (1.2 MB — VERY LARGE)
**Role:** Temporal event memory. Contains dead code (~220 lines commented out).

### `backend/chatHistory.js`
**Imports:** None
**Role:** In-memory conversation history (last N turns). Not persisted.

### `backend/vectorStore.js`
**Imports:** `fs`, `path`
**Persists to:** `backend/vector_store.json` (620 KB)
**Role:** Flat JSON vector store for RAG retrieval.

### `backend/embeddingModel.js`
**Imports:** `@huggingface/transformers`
**Role:** Generates text embeddings via local HuggingFace model.

### `backend/cognitiveEngine.js`
**Imports:** `./memory`, `./episodicMemory`, `./vectorStore`, `./embeddingModel`, `./memorySearch`
**Role:** Retrieves and scores relevant memories for context injection.

### `backend/reflectionMemory.js`
**Imports:** `fs`, `path`
**Persists to:** `backend/reflection_memory.json`
**Role:** Stores AI self-reflection results.

### `backend/memoryInspector.js`, `backend/memorySearch.js`, `backend/memoryUtils.js`
**Imports:** `./memory`, `./episodicMemory`, etc.
**Role:** Memory query utilities.

### `backend/recallRouter.js`
**Imports:** `./memorySearch`, `./cognitiveEngine`
**Role:** Routes memory recall by type.

### `backend/memoryIntentClassifier.js`
**Imports:** None
**Role:** Classifies if input is a memory operation.

### `backend/importanceScorer.js`
**Imports:** None
**Role:** Scores memory item importance (0.0–1.0).

---

## 6. Backend — Reflection Layer

### `backend/reflectionRunner.js`
**Imports:** `./reflectionTrigger`, `./reflectionGenerator`
**Role:** Decides when and whether to run reflection.

### `backend/reflectionGenerator.js`
**Imports:** `./llmRunner`, `./episodicMemory`
**Role:** Generates reflection content via LLM.

### `backend/reflectionTrigger.js`
**Imports:** None
**Role:** Determines reflection triggers (time-based, event-based).

### `backend/reflect.js`
**Imports:** `./reflectionMemory`, `./episodicMemory`, `./llmRunner`
**Role:** Standalone reflection runner (possibly duplicate of reflectionRunner.js).
⚠️ **Possible duplicate functionality.**

---

## 7. Backend — Vision / Screen Layer

### `backend/whisperManager.js`
**Imports:** `child_process`, `path`, `./utils/powerMonitor`
**References:** `../whisper.cpp/build/bin/whisper-cli.exe` (relative), `../whisper.cpp/models/ggml-small.en.bin` (relative)
**Role:** Runs whisper-cli.exe for STT. GPU vs CPU auto-detection.

### `backend/screenCapture.js`
**Imports:** `screenshot-desktop`, `path`, `os`, `./utils/safeTempManager`
**Role:** Captures screen to temp file.

### `backend/screenClassifier.js`
**Imports:** None
**Role:** Classifies screen type from OCR text (CODE/BROWSER/EMAIL/TERMINAL etc.).

### `backend/ocrRunner.js`
**Imports:** `node-tesseract-ocr`
**Role:** Runs Tesseract OCR on image files.

### `backend/visionRouter.js`
**Imports:** `./geminiClient`, `./visionRunner`
**Role:** Routes vision tasks to Gemini or local model.

### `backend/visionRunner.js`
**Imports:** `./localLLM`
**Role:** Runs local vision model.

### `backend/visionAnalyzer.js`
**Imports:** None
**Role:** Classifies whether image is text-heavy or visual.

### `backend/visualService.js` (A-Eye)
**Imports:** `child_process`, `path`, `fs`, `os`, `./telegramService`
**External:** Calls `ffmpeg` (from PATH) for webcam capture. Uses `os.tmpdir()`.
**Role:** Webcam capture + Telegram transmission.

### `backend/screenActionOrchestrator.js` (25 KB — LARGE)
**Imports:** `./plannerEngine`, `./tools/toolRegistry`, `./agent/pythonBridge`, `./agent/elementResolver`, `./agent/coordinateMapper`, `./screenCapture`, `./ocrRunner`
**Role:** Orchestrates multi-step screen interactions.

### `backend/agent/agentLoop.js`
**Imports:** `../screenCapture`, `../ocrRunner`, `../screenClassifier`, `./uiStateStore`, `./worldModel`, `../plannerEngine`, `./actionValidator`, `../screenActionOrchestrator`, `./actionFeedback`, `./screenSkills/skillRegistry`
**Role:** Perception → Plan → Validate → Execute loop.

### `backend/agent/pythonBridge.js`
**Imports:** `child_process`, `path`
**Role:** Calls `backend/python_worker/main.py` for YOLO UI element detection.

### `backend/python_worker/main.py`
**Imports (Python):** `ultralytics` (YOLO), `cv2`, `PIL`, `numpy`
**Models used:** `backend/python_worker/models/yolov8n.pt` (6.5 MB)
**Role:** YOLO-based UI element detector. Called by pythonBridge.js.

---

## 8. Backend — Tools Layer

### `backend/tools/toolRegistry.js`
**Imports:** `./memoryTool`, `./systemTool`, `./desktopTool`, `./n8nTool`
**Persists logs to:** `backend/toolExecution.log`
**Role:** Central tool execution router.

### `backend/tools/systemTool.js`
**Imports:** `child_process`
**Role:** Opens apps, URLs, locks PC. Windows-first with macOS fallback.

### `backend/tools/desktopTool.js`
**Imports:** `robotjs`, `screenshot-desktop`, `child_process`
**Role:** Mouse/keyboard automation via robotjs.

### `backend/tools/memoryTool.js`
**Imports:** `../memory`, `../episodicMemory`
**Role:** Memory read/write via tool interface.

### `backend/tools/n8nTool.js`
**Imports:** `axios`
**Role:** Triggers n8n automation workflows via HTTP.

### `backend/agent/screenSkills/skillRegistry.js`
**Imports:** `./fillFormSkill`, `./navigationSkill`, `./scrollSkill`, `./sendMessageSkill`, `./suggestionSkill`
**Role:** Registry for high-level screen interaction skills.

---

## 9. Backend — Safety Layer

### `backend/safety/riskEngine.js`
**Imports:** None
**Role:** Evaluates plan risk level. Blocks destructive operations.

### `backend/safety/confirmationEngine.js`
**Imports:** None
**Role:** Manages confirmation state for risky operations.

---

## 10. Backend — Integrations

### `backend/telegramService.js`
**Imports:** `axios`, `fs`, `path`, `form-data`
**External path:** `C:\Users\athar\Downloads` (hardcoded save folder, line 93)
**Role:** Telegram bot polling, send messages/documents/files.

### `backend/whatsappBridge.js`
**Imports:** `whatsapp-web.js`
**Runtime data:** `.wwebjs_auth/`, `.wwebjs_cache/` (root level)
**Role:** WhatsApp Web.js bridge. Starts WhatsApp session.

### `backend/email/emailFetcher.js`
**Imports:** `puppeteer`, `fs`, `child_process`
**External:** Reads `cookies.json` (root level). Hardcoded IITK webmail URL.
**Role:** Puppeteer-based email scraper.

### `backend/email/emailHandler.js`
**Imports:** `./emailFetcher`
**Role:** Processes fetched emails.

### `backend/email/saveSession.js`
**Imports:** `puppeteer`, `fs`
**Role:** Saves Puppeteer browser cookies.

### `backend/conversionEngine.js`
**Imports:** `fs`, `path`, `pdf-lib`, `pdf-merger-js`, `libreoffice-convert`
**Role:** Converts received Telegram files to PDF, merges them.

---

## 11. Backend — Personality / Identity

### `backend/personality.js`
**Imports:** `./personalityLLM`, `./identity`, `./llmRunner`
**Role:** Post-processes LLM replies to inject personality traits.

### `backend/personalityLLM.js`
**Imports:** `./llmRunner`
**Role:** Generates personality-adjusted responses via LLM.

### `backend/identity.js`
**Imports:** `./profiles/arvsal.json`
**Role:** Provides identity context (name, traits) to LLM.

---

## 12. Backend — AI Clients (External)

### `backend/chatgptClient.js`
**Imports:** `openai`

### `backend/geminiClient.js`
**Imports:** `@google/generative-ai`

### `backend/groqClient.js`
**Imports:** `axios`

---

## 13. Backend — Misc Utilities

### `backend/normalizer.js`
**Role:** Text normalization (spoken → typed equivalents).

### `backend/dateResolver.js`, `backend/dateParser.js`
**Role:** Parse relative date expressions ("tomorrow", "next week").

### `backend/keyNormalizer.js`
**Role:** Normalizes memory keys.

### `backend/themeExtractor.js`
**Role:** Extracts topic key from user input for memory tagging.

### `backend/fileSearch.js`
**Role:** Finds file by name on local disk.

### `backend/fileCleanup.js`
**Role:** Cleans old temp files.

### `backend/systemActions.js`
**Imports:** `child_process`
**Role:** System-level commands (shutdown, restart, sleep, volume, search).

### `backend/wakeWord.js`
**Imports:** `ava-listener`, `fs`, `path`, `child_process`, `events`
**Role:** Wake word engine wrapper. Bridges `ava-listener` npm package to ARVSAL API.

### `backend/ttsEngine.js`
**Imports:** `child_process`, `path`, `fs`
**External:** Hardcoded `C:\Users\athar\Downloads\piper_windows_amd64\piper\` (PIPER_DIR)
**Role:** Standalone Piper TTS. ⚠️ Appears unused — server.js calls Piper directly.

### `backend/tts.js`
**Role:** Likely dead/stub file (270 bytes).

### `backend/espeak.js`
**Role:** Likely dead/stub file (270 bytes).

### `backend/codePrompt.js`, `backend/mathPrompt.js`
**Role:** Prompt templates for coding/math LLM calls.

---

## 14. Book Engine (Python — Standalone)

### `book/engine.py`
**Imports (Python):** `config`, `state_machine`, `llm_processor`, `telebot`, `threading`
**Role:** Main Telegram polling loop for book engine.

### `book/llm_processor.py`
**Imports (Python):** `subprocess`, `json`, `re` + `config`
**External:** Calls `config.OLLAMA_EXE` (hardcoded `C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe`)
**Role:** LLM interface for book generation.

### `book/config.py`
**External paths (hardcoded):**
- `C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe`
- `C:\Program Files\LibreOffice\program\soffice.exe`
**Role:** Configuration loader. Reads from `../.env`.

### `book/state_machine.py`
**Imports (Python):** `config`, `llm_processor`, `doc_builder`
**Role:** State machine for book writing workflow.

### `book/doc_builder.py`
**Imports (Python):** `python-docx`, `config`
**Role:** Builds DOCX manuscript.

### `book/converter.py`
**Imports (Python):** `subprocess`, `config`
**Role:** Converts DOCX to PDF via LibreOffice.

### `book/transcriber.py`
**Role:** (Likely legacy) Audio transcription stub.

---

## 15. WhisperCpp Submodule

`whisper.cpp/` — Full whisper.cpp repository (Git submodule)
- `whisper.cpp/build/bin/whisper-cli.exe` — Compiled binary (referenced by `whisperManager.js`)
- `whisper.cpp/models/ggml-small.en.bin` — Small English model (referenced by `whisperManager.js`)
- `whisper.cpp/ggml-small.en.bin` — **Duplicate copy** of small model at root (487 MB — SHOULD NOT BE HERE)
- `whisper.cpp/models/ggml-medium.bin` — Medium model (referenced by `server.js` line 537)

---

## 16. Circular Dependencies

| Cycle | Files Involved |
|-------|----------------|
| Memory ↔ VectorStore | `memory.js` lazy-requires `vectorStore.js`; `vectorStore.js` is standalone |
| EpisodicMemory ↔ VectorStore | `episodicMemory.js` lazy-requires `vectorStore.js` |
| Server ↔ Tools (lazy) | `server.js` requires `tools/toolRegistry.js` inside case blocks |
| Server ↔ Safety (lazy) | `server.js` requires `safety/riskEngine.js` inside case blocks |

> No true circular import cycles detected (lazy loading breaks potential cycles).

---

## 17. Dead Code / Obsolete Files

| File | Status | Reason |
|------|--------|--------|
| `backend/llmRunner.js` lines 316–477 | Dead code | Old spawn-based runner, commented out |
| `backend/episodicMemory.js` lines 227–440 | Dead code | Old TTL-based version, commented out |
| `backend/plannerEngine.js` lines 213–383 | Dead code | Old planner version, commented out |
| `backend/ttsEngine.js` | Likely unused | `server.js` calls Piper directly |
| `backend/tts.js` | Likely dead stub | 270 bytes, unclear purpose |
| `backend/espeak.js` | Dead | 270 bytes, eSpeak is not used |
| `backend/llmDebug.js` | Dead stub | 175 bytes, single debug variable |
| `electron/arv-sal_en_windows_v4_0_0.ppn` | Orphaned | Picovoice model, `ava-listener` used instead |
| `frontend/` | Legacy UI | Standalone browser UI, replaced by Electron |
| `fix_log.py` | Dev tool | Root-level Python debug script |
| `utils_vad.py` | Dev tool/experimental | Root-level Python VAD script |
| `planner.mf` | Unknown | 491-byte file of unknown purpose |
| `arvsal_analysis.md` | Dev doc | Past analysis document in root |
| `gitignore_analysis.md` | Dev doc | Past analysis in root |
| `ui_modernization_plan.md` | Dev doc | Past planning doc in root |
| `book/audio_tmp/` | Runtime cache | Audio temp files in book engine |
| `book/__pycache__/` | Generated | Python bytecode |
| `backend/python_worker/__pycache__/` | Generated | Python bytecode |
| `backend/logs/screenshot.png` (5.9 MB) | Runtime artifact | Should not be in repo |
| `backend/episodic_memory.json` (1.2 MB) | Runtime data | Should not be in repo |
| `backend/vector_store.json` (620 KB) | Runtime data | Should not be in repo |
| `whisper.cpp/ggml-small.en.bin` (487 MB) | Duplicate | Same model already in `models/` |

---

## 18. Dependency Graph Summary

```
Electron Main
    └── WakeWord (ava-listener npm)
    └── Backend Server (spawned child process)
            └── Intent Pipeline
            │       intentClassifier → actions → memory/episodic
            └── LLM Pipeline
            │       llmRouter → llmRunner (Ollama HTTP)
            │               → chatgptClient / geminiClient / groqClient
            └── STT Pipeline
            │       whisperManager → whisper.cpp/build/bin/whisper-cli.exe
            │       [FFmpeg @ Downloads/] → WAV conversion
            └── TTS Pipeline
            │       [Piper @ Downloads/] → WAV generation → HTTP response
            └── Memory Pipeline
            │       memory.json + episodic_memory.json + vector_store.json
            │       embeddingModel (HuggingFace transformers)
            └── Agent Pipeline
            │       agentLoop → plannerEngine → toolRegistry
            │       screenCapture → ocrRunner (tesseract)
            │       python_worker (YOLO) ← pythonBridge
            └── Integrations
                    telegramService (Telegram Bot API)
                    whatsappBridge (whatsapp-web.js → .wwebjs_auth/)
                    email/emailFetcher (Puppeteer → cookies.json)
```
