# README Modernization Plan
**Based on live codebase audit — June 2026**
**Do NOT modify README.md until this plan is approved.**

---

## G. Estimated README Completion Percentage

> **Current accuracy: ~34%**

The README was written against the pre-V2 monolithic `backend/` architecture. V2 has decomposed nearly every component into a new domain directory (`core/`, `providers/`, `modules/`, `integrations/`, `agents/`, `tools/`, `safety/`, `actions/`). The wake system, VAD pipeline, intent engine, and all file paths are wrong. The system diagram reflects a completely different architecture. Approximately two-thirds of the document requires partial or complete rewriting.

---

## A. Sections That Remain Unchanged

These sections are conceptually correct and require at most cosmetic edits.

| Section | Status | Notes |
|---|---|---|
| Title / Tagline | ✅ Keep | Accurate and professional |
| Overview paragraph | ✅ Keep | High-level description remains valid |
| Core philosophy note (60/40 deterministic) | ✅ Keep | Validated by `intentClassifier.js` |
| n8n Email Intelligence Pipeline diagram | ✅ Keep | Pipeline shape is unchanged |
| Example Use Cases table | ✅ Minor edits | Most commands still valid; minor path refs wrong |
| Installation prerequisites (Node.js, Ollama, Piper, FFmpeg) | ✅ Keep | Correct |
| Future Improvements | ✅ Keep | Aspirational; not affected by migration |
| Why This Project Matters | ✅ Keep | Still accurate |
| License | ✅ Keep | Unchanged |

---

## B. Sections Needing Partial Updates

These sections are mostly correct but contain specific outdated references.

### 1. Key Features (line 19–38)
- **Keep:** All feature descriptions are still valid.
- **Update needed:**
  - "Custom Wake Word — On-device Picovoice Porcupine model" → must be changed to `ava-listener` npm package / Sherpa-ONNX
  - "Silero VAD integration" is not mentioned at all — it should be added as a distinct feature
  - "Topic Tracker" — `backend/topicTracker.js` is dead code per Phase B audit; verify if still active in server.js
  - Battery-aware GPU switching (Whisper uses `powerMonitor.js` to detect battery → `--no-gpu`) is a real feature not documented

### 2. Tech Stack → AI & Models (line 158–171)
- **Keep:** All LLMs, Piper, Whisper model names correct.
- **Update needed:**
  - "Wake Word — Picovoice Porcupine — custom-trained `.ppn` model" → Replace with `ava-listener` (npm package) using Sherpa-ONNX
  - Add: Silero VAD (Python `vad_worker.py`) for speech detection
  - Add: `phi3:mini` — used by `llmIntentRouter.js` for ambiguous intent resolution
  - Add: Battery-aware GPU switching via `powerMonitor.js`

### 3. Tech Stack → Key Libraries (line 173–188)
- **Keep:** All current libraries are valid.
- **Add:** `ava-listener` (npm) — wake word engine
- **Add:** Silero VAD (via embedded Python worker)
- **Remove or footnote:** `robotjs` — verify if still in use by `desktopTool.js`

### 4. How It Works (line 191–212)
- **Step 1 (Wake):** "Porcupine detects the custom wake word" → Replace with AVAListener / ava-listener
- **Step 2 (Transcribe):** "Audio streams in parallel: small Whisper model shows live text" → The streaming (`/audio/pcm`) path exists in server.js but VAD gating now filters audio **before** Whisper. This step needs updating to include VAD pre-screening.
- **All other steps:** Architecturally sound; update only if file paths are mentioned.

### 5. Installation → Steps (line 276–308)
- **Update needed:**
  - No `PICOVOICE_ACCESS_KEY` needed — replaced by `ava-listener`
  - Add: `ava-listener` is installed automatically via `npm install`
  - Add: Runtime binaries are set up via `pathConfig.js` / `.env` variable mapping
  - `.env` file example needs updating to remove `PICOVOICE_ACCESS_KEY`

---

## C. Sections Needing Complete Rewrites

### 1. System Architecture Diagram (lines 43–108)
**Status: Completely obsolete.**

The diagram shows:
- `[WAKE WORD — Picovoice Porcupine (.ppn)]` — **WRONG.** Wake is now handled by `ava-listener` package wrapping Sherpa-ONNX.
- `WebM → PCM dual-stream` with both streaming and final paths described as always-on — **WRONG.** VAD pre-screening now gates both paths. Audio is only passed to Whisper if Silero VAD confirms speech presence.
- `[AUDIO CAPTURE — MediaRecorder / PvRecorder]` — **WRONG.** PvRecorder is not used; audio capture is `MediaRecorder` in the renderer.
- `whisper.cpp small model → live transcription display` streaming — this path exists in server.js but may not be actively used.
- `[DETERMINISTIC INTENT CLASSIFIER — intentClassifier.js]` — path is now `core/intent/intentClassifier.js`, not `backend/intentClassifier.js`.
- `[ROUTING SWITCH (server.js)]` — still accurate that server.js orchestrates, but the routing now involves a two-layer intent system: deterministic `intentClassifier.js` first, then optional `llmIntentRouter.js` (phi3:mini) for GENERAL_QUESTION fallback disambiguation.
- `topicTracker.setActiveTopic()` in response path — verify if dead.

### 2. Core Components Table (lines 112–144)
**Status: All file paths are wrong. Every component has moved.**

| README path | Actual V2 path |
|---|---|
| `electron/main.js` | `apps/electron/main.js` |
| `backend/server.js /audio/pcm` | `backend/server.js` (unchanged but STT path changed) |
| `backend/whisperManager.js` | `modules/stt/whisperManager.js` |
| `backend/intentClassifier.js` | `core/intent/intentClassifier.js` |
| `backend/memory.js` | `core/memory/semanticMemory.js` |
| `backend/episodicMemory.js` | `core/memory/episodicMemory.js` |
| `backend/reflectionMemory.js` + `reflectionRunner.js` | `core/memory/reflectionMemory.js` + `modules/reflection/reflectionRunner.js` |
| `backend/vectorStore.js` | `core/memory/vectorStore.js` |
| `backend/cognitiveEngine.js` | `core/reasoning/cognitiveEngine.js` |
| `backend/topicTracker.js` | Verify (may be dead code) |
| `backend/llmRouter.js` | `providers/llm/llmRouter.js` |
| `backend/plannerEngine.js` | `core/reasoning/plannerEngine.js` |
| `backend/tools/toolRegistry.js` | `tools/toolRegistry.js` |
| `backend/tools/n8nTool.js` | `tools/n8nTool.js` |
| `backend/tools/desktopTool.js` | `tools/desktopTool.js` |
| `backend/email/emailFetcher.js` | `integrations/email/emailFetcher.js` |
| `backend/email/emailHandler.js` | `integrations/email/emailHandler.js` |
| `backend/screenActionOrchestrator.js` | `modules/vision/screenActionOrchestrator.js` |
| `backend/agent/agentLoop.js` | `agents/agentLoop.js` |
| `backend/agent/screenSkills/` | `agents/skills/` |
| `backend/contentSuggester.js` | `actions/contentSuggester.js` |
| `backend/contactBook.js` | `utils/contactBook.js` |
| `backend/conversionEngine.js` | `integrations/telegram/conversionEngine.js` |
| `backend/telegramService.js` | `integrations/telegram/telegramService.js` |
| `backend/whatsappBridge.js` | `integrations/whatsapp/whatsappBridge.js` |
| `backend/visionRouter.js` + `ocrRunner.js` | `modules/vision/visionRouter.js` + `modules/vision/ocrRunner.js` |
| `backend/confirmManager.js` | `core/reasoning/confirmManager.js` |
| `backend/totpManager.js` | `utils/totpManager.js` |
| Missing: `safety/riskEngine.js` | New — not documented at all |
| Missing: `safety/confirmationEngine.js` | New — not documented at all |
| Missing: `modules/stt/vadManager.js` | New — not documented at all |
| Missing: `modules/aeye/visualService.js` | New — not documented at all |
| Missing: `core/intent/llmIntentRouter.js` | New — not documented at all |
| Missing: `core/intent/actionIntentDetector.js` | New — not documented at all |
| Missing: `utils/pathConfig.js` | New — not documented at all |

### 3. Folder Structure (implied by all file paths throughout README)
**Status: Completely obsolete.** No explicit folder tree is shown in the README but every referenced path uses `backend/`. A V2 folder structure section must be added from scratch.

---

## D. New Sections Recommended

### 1. V2 Project Structure (NEW — Critical)
A documented tree of the new `apps/`, `core/`, `providers/`, `modules/`, `integrations/`, `agents/`, `tools/`, `safety/`, `utils/`, `data/`, `runtime/` layout.

### 2. Wake System: AVAListener + Silero VAD (NEW — Critical)
The current README implies Porcupine is used. AVAListener (`ava-listener` npm package, Sherpa-ONNX backend) is the actual wake engine. Silero VAD (Python worker) gates STT processing. Neither appears correctly anywhere in the README.

### 3. Runtime Setup (NEW — Recommended)
Document the `runtime/` portable dependency store and `pathConfig.js` environment variable system. Explain that `runtime/whisper/` is a submodule (`whisper.cpp`) and that `runtime/whisper/build/bin/whisper-cli.exe` must be compiled locally.

### 4. Data Isolation Model (NEW — Recommended)
Document `data/memory/` as the isolated, gitignored persistent store for all memory databases, distinguishing it from source code in `core/memory/`.

### 5. Safety Layer (NEW — Recommended)
Document `safety/riskEngine.js` (risk evaluation, confirmation thresholds, action whitelisting) and `safety/confirmationEngine.js`.

---

## E. Proposed Updated Architecture Diagram

```
[Microphone]
      │
      ▼
[AVAListener — ava-listener npm + Sherpa-ONNX]
   Always-on wake phrase detection (on-device, no cloud)
   Pause/Resume/Suppress lifecycle managed by Electron IPC
      │
      ▼ wake event
[apps/electron/main.js — IPC Bridge]
   Forwards arvsal:wake to renderer
      │
      ▼
[apps/renderer — MediaRecorder]
   Captures WebM audio, sends to backend via IPC
      │
   ┌──────────────────────────┐
   │  /audio/final  (primary) │  → FFmpeg → WAV 16kHz mono
   │  /audio/stream (live)    │  → FFmpeg → WAV 16kHz mono
   └──────────────────────────┘
      │
      ▼
[Silero VAD — modules/stt/vadManager.js → backend/python_worker/vad_worker.py]
   Speech presence check (threshold, min speech duration)
   FAIL-OPEN: passes through on error or timeout
   Persistent worker mode (stream) / spawn-per-request mode (final)
      │
      ├── REJECT (silence / noise) → discard
      │
      └── PASS → Whisper STT
            │
            ├── Small model (SMALL_MODEL_PATH)     — fallback / streaming
            └── Medium model (MEDIUM_MODEL_PATH)   — GPU-accelerated, primary
                Battery-aware: --no-gpu when on battery (utils/powerMonitor.js)
      │
      ▼
[Transcription] → stripWakeWord() → normalize() → cleanNormalizedText
      │
      ▼
[Deterministic Intent Classifier — core/intent/intentClassifier.js]
   Priority-ordered regex rule engine (50+ intents)
   CONFIRM → AI_MODE → MEMORY_OPS → LOCAL_SKILL → SCREEN_ACTION →
   SYSTEM → SEARCH → EMAIL → SMALLTALK → GENERAL_QUESTION
      │
      ├── If GENERAL_QUESTION: optional LLM assist
      │   [LLM Intent Router — core/intent/llmIntentRouter.js]
      │   phi3:mini, 1.2s timeout, sandboxed, fail-safe
      │
      ▼
   ┌───────────────────────────────────────────────────────┐
   │              ROUTING SWITCH (backend/server.js)       │
   ├──────────────────────────┬────────────────────────────┤
   │  NON-LLM INTENTS         │  LLM INTENTS               │
   │  (deterministic)         │  (cognitive pipeline)      │
   │                          │                            │
   │  OPEN_APP   → spawn      │  1. cognitiveEngine        │
   │  VOLUME     → nircmd     │     (4-layer memory fusion)│
   │  SHUTDOWN   → riskEngine │  2. llmRouter              │
   │             → confirm    │     (model select)         │
   │  SEARCH     → browser    │  3. Prompt assembly        │
   │  WHATSAPP   → contactBook│  4. LLM inference          │
   │  EMAIL      → emailFetch │  5. Output validation      │
   │             → n8n        │  6. applyPersonality()     │
   │  SCREEN_ACTION →         │                            │
   │    agents/agentLoop.js → │                            │
   │    core/reasoning/       │                            │
   │      plannerEngine.js →  │                            │
   │    safety/riskEngine.js→ │                            │
   │    tools/toolRegistry → │                            │
   │    agents/skills/        │                            │
   └──────────────────────────┴────────────────────────────┘
      │
      ▼
[PERSONALITY LAYER — core/personality/personality.js]
      │
      ▼
[RESPONSE] → core/memory/chatHistory.js
           + core/memory/episodicMemory.js
           + modules/reflection/reflectionTrigger.js (background)
      │
      ▼
[TTS — Piper (en_US-ryan-high.onnx)] → runtime/temp/tts/arvsal.wav → playback
      │
      ▼
[ELECTRON UI — apps/renderer/index.html]
```

---

## F. Proposed Updated Folder Structure Section

```
arvsal/
│
├── apps/                          # Electron desktop application
│   ├── electron/
│   │   ├── main.js                # Electron entry point, wake engine lifecycle, IPC bridge
│   │   └── preload.js             # Context-isolated preload bridge
│   └── renderer/
│       ├── index.html             # UI — voice capture, text display, status
│       └── ui.js                  # Renderer-side logic
│
├── backend/
│   ├── server.js                  # Express server — all HTTP endpoints, routing orchestration
│   └── python_worker/             # Python subprocess workers
│       └── vad_worker.py          # Silero VAD persistent/one-shot worker
│
├── core/                          # Core AI / cognitive systems
│   ├── intent/
│   │   ├── intentClassifier.js    # Primary deterministic intent engine (50+ rules)
│   │   ├── intentEngine.js        # Safe fallback classifier (conservative)
│   │   ├── actionIntentDetector.js# Screen-action intent detector
│   │   ├── llmIntentRouter.js     # Optional phi3:mini intent disambiguation
│   │   └── intentPrompt.js        # Prompt builder for LLM intent routing
│   ├── memory/
│   │   ├── semanticMemory.js      # Key-value facts with confidence decay
│   │   ├── episodicMemory.js      # Timestamped conversation events
│   │   ├── reflectionMemory.js    # LLM-derived behavioral insights
│   │   ├── vectorStore.js         # Float32 embeddings, cosine-similarity search
│   │   ├── chatHistory.js         # Conversation context (LLM context window)
│   │   ├── embeddingModel.js      # Ollama embedding interface
│   │   └── [supporting modules]   # keyNormalizer, memorySearch, recallRouter, etc.
│   ├── personality/
│   │   ├── personality.js         # Personality / tone application
│   │   ├── personalityLLM.js      # LLM-driven personality extension
│   │   └── identity.js            # Identity facts and self-description
│   └── reasoning/
│       ├── cognitiveEngine.js     # 4-layer memory fusion + ranked retrieval
│       ├── plannerEngine.js       # NL → JSON action plan (LLM)
│       └── confirmManager.js      # Callback-based confirmation state
│
├── providers/                     # LLM and external API clients
│   ├── llm/
│   │   ├── llmRouter.js           # Multi-provider routing + memory injection
│   │   ├── llmRunner.js           # Ollama HTTP API client
│   │   ├── localLLM.js            # Local model wrapper
│   │   ├── llmGuard.js            # Output validation and cleaning
│   │   ├── llmPrompt.js           # System prompt builder
│   │   ├── aiSwitch.js            # Runtime AI provider hot-swap state
│   │   └── ollamaWarmup.js        # Model pre-warming on startup
│   └── external/
│       ├── chatgptClient.js       # OpenAI GPT-4 client
│       ├── geminiClient.js        # Google Gemini client
│       └── groqClient.js          # Groq (LLaMA 3.1) client
│
├── modules/                       # Hardware-interfacing runtime modules
│   ├── wake/
│   │   └── wakeWord.js            # AVAWakeAdapter — wraps ava-listener npm package
│   ├── stt/
│   │   ├── whisperManager.js      # Whisper.cpp runner (final + small model)
│   │   └── vadManager.js          # Silero VAD bridge (persistent + spawn-per-request)
│   ├── tts/                       # (TTS handled directly in backend/server.js → Piper)
│   ├── vision/
│   │   ├── screenActionOrchestrator.js  # Step executor, vision-guided click
│   │   ├── ocrRunner.js           # Tesseract OCR
│   │   ├── screenCapture.js       # Screenshot capture
│   │   ├── visionRouter.js        # Vision routing
│   │   └── [supporting modules]
│   ├── aeye/
│   │   └── visualService.js       # A-Eye webcam snap via FFmpeg DirectShow
│   └── reflection/
│       ├── reflectionRunner.js    # Trigger + run LLM reflection generation
│       ├── reflectionGenerator.js # Prompt + call LLM for behavioral insights
│       └── reflectionTrigger.js   # Every-N-turns background trigger logic
│
├── agents/                        # Screen automation agents
│   ├── agentLoop.js               # Screenshot → OCR → plan → execute loop
│   ├── skills/                    # Reusable screen automation skills
│   │   ├── sendMessageSkill.js
│   │   ├── fillFormSkill.js
│   │   ├── navigationSkill.js
│   │   ├── scrollSkill.js
│   │   ├── suggestionSkill.js
│   │   └── skillRegistry.js
│   ├── arvsal-vision/             # Git submodule: microsoft/OmniParser (vision AI)
│   └── [agent support files]      # elementResolver, coordinateMapper, worldModel, etc.
│
├── integrations/                  # Third-party messaging integrations
│   ├── email/
│   │   ├── emailFetcher.js        # Puppeteer-based IITK webmail scraper
│   │   ├── emailHandler.js        # n8n webhook dispatcher
│   │   └── saveSession.js         # Cookie/session persistence
│   ├── telegram/
│   │   ├── telegramService.js     # Secure remote control + TOTP 2FA
│   │   └── conversionEngine.js    # PDF batch merger (image/Office/PDF)
│   └── whatsapp/
│       └── whatsappBridge.js      # VIP auto-reply via whatsapp-web.js
│
├── tools/                         # Sandboxed tool execution layer
│   ├── toolRegistry.js            # Multi-tool dispatcher with action whitelisting
│   ├── desktopTool.js             # robotjs OS automation (click/type/scroll)
│   ├── memoryTool.js              # Memory read/write tool interface
│   ├── n8nTool.js                 # n8n webhook bridge
│   └── systemTool.js              # System-level actions (app open, volume, shutdown)
│
├── safety/                        # Risk and confirmation gating
│   ├── riskEngine.js              # Deterministic plan risk evaluation
│   └── confirmationEngine.js      # Confirmation request/response state
│
├── actions/                       # High-level action handlers
│   ├── actions.js                 # Core action dispatcher
│   ├── systemActions.js           # System action implementations
│   ├── contentSuggester.js        # Screen-aware typing suggestion engine
│   └── localSkills.js             # Local skill handlers (time, date, weather)
│
├── utils/                         # Shared utilities
│   ├── pathConfig.js              # Single source of truth for all runtime paths
│   ├── contactBook.js             # Name → WhatsApp ID resolver
│   ├── normalizer.js              # Text normalization pipeline
│   ├── dateResolver.js            # Date range parsing (episodic memory queries)
│   ├── safeTempManager.js         # Temp file lifecycle management
│   ├── powerMonitor.js            # Battery state detection (Whisper GPU switching)
│   ├── totpManager.js             # TOTP 2FA verification
│   └── [supporting utilities]
│
├── data/                          # Runtime-generated data (gitignored)
│   └── memory/                    # Persistent memory databases
│       ├── memory.json            # Semantic facts store
│       ├── episodic_memory.json   # Episodic event log
│       ├── vector_store.json      # Embedding vector index
│       ├── chat_history.json      # Conversation context
│       └── reflection_memory.json # Behavioral insight store
│
└── runtime/                       # Portable binary dependency store (gitignored)
    ├── whisper/                   # Git submodule: ggerganov/whisper.cpp (source)
    │   ├── build/bin/whisper-cli.exe   # Compiled executable (build locally)
    │   └── models/                     # ggml-small.bin, ggml-medium.bin (download)
    ├── piper/                     # Piper TTS binary + voice models
    ├── ffmpeg/                    # FFmpeg binary
    ├── nircmd/                    # NirCmd Windows audio control
    ├── temp/                      # Transient audio/screenshot files (auto-cleaned)
    ├── logs/                      # Runtime logs
    └── sessions/                  # Auth sessions (WhatsApp, email)
```
