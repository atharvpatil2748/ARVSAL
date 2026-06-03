# ARVSAL V2 Folder Structure
**Generated:** 2026-05-30 | **Phase:** 4 of 8

---

## Design Principles

1. **Clean Separation of Concerns** — Every directory has a single responsibility
2. **Monolith Elimination** — `server.js` (1828 lines) split into domain-specific services
3. **Runtime Isolation** — All external binaries, models, and generated data in `/runtime`
4. **Future Scalability** — Structure supports multi-agent, mobile sync, cloud LLM
5. **Developer Experience** — New contributors can navigate confidently
6. **No Hardcoded Paths** — All paths via config or env variables

---

## Proposed V2 Structure

```
arvsal/
│
├── apps/                           # Electron application shell
│   ├── electron/
│   │   ├── main.js                 # App entry — spawns backend, manages window
│   │   ├── preload.js              # Context bridge (IPC)
│   │   └── ipc/
│   │       └── handlers.js         # IPC handler registrations (split from main.js)
│   └── renderer/
│       ├── index.html              # Main UI
│       ├── ui.js                   # UI bootstrap
│       └── styles/
│           ├── theme.css
│           ├── animations.css
│           ├── components.css
│           ├── effects.css
│           ├── layout.css
│           └── states.css
│
├── services/                       # Backend HTTP services
│   ├── server.js                   # App entry — Express setup, route mounting
│   ├── audio/
│   │   ├── audioRoutes.js          # /audio, /audio/final, /audio/stream routes
│   │   └── audioValidator.js       # Whisper output validation
│   ├── command/
│   │   └── commandRoute.js         # /command route handler
│   ├── tts/
│   │   └── ttsRoute.js             # /speak route
│   └── health/
│       └── healthRoute.js          # /health route
│
├── core/                           # Core AI brain — no I/O, pure logic
│   ├── intent/
│   │   ├── intentClassifier.js     # Rule-based intent classification
│   │   ├── intentEngine.js         # Classifier orchestrator
│   │   ├── actionIntentDetector.js # Screen action heuristics
│   │   ├── intentPrompt.js         # Intent LLM prompt
│   │   └── llmIntentRouter.js      # LLM fallback classifier
│   ├── memory/
│   │   ├── semanticMemory.js       # (was memory.js) — key/value facts
│   │   ├── episodicMemory.js       # Temporal event memory
│   │   ├── reflectionMemory.js     # Self-reflection storage
│   │   ├── memorySearch.js         # Memory search utilities
│   │   ├── memoryInspector.js      # Memory inspection
│   │   ├── memoryUtils.js          # Memory helpers
│   │   ├── memoryIntentClassifier.js
│   │   ├── recallRouter.js
│   │   ├── importanceScorer.js
│   │   ├── keyNormalizer.js
│   │   └── themeExtractor.js
│   ├── reasoning/
│   │   ├── cognitiveEngine.js      # Memory retrieval + context scoring
│   │   ├── plannerEngine.js        # JSON plan generator
│   │   ├── actionIntentDetector.js # (moved from intent/)
│   │   └── confirmManager.js       # Confirmation state machine
│   └── personality/
│       ├── personality.js          # Post-processor
│       ├── personalityLLM.js       # LLM personality wrapper
│       └── identity.js             # Identity context provider
│
├── providers/                      # LLM + AI provider clients
│   ├── llm/
│   │   ├── llmRunner.js            # Ollama HTTP client (serial queue)
│   │   ├── llmRouter.js            # Routes by active AI mode
│   │   ├── llmGuard.js             # Content safety filter
│   │   ├── llmPrompt.js            # Chat prompt builder
│   │   ├── codePrompt.js           # Code prompt template
│   │   ├── mathPrompt.js           # Math prompt template
│   │   ├── ollamaWarmup.js         # Model pre-warming
│   │   ├── localLLM.js             # Local model wrapper
│   │   └── aiSwitch.js             # Active AI state
│   └── external/
│       ├── chatgptClient.js        # OpenAI GPT client
│       ├── geminiClient.js         # Google Gemini client
│       └── groqClient.js           # Groq cloud client
│
├── agents/                         # Autonomous agent system
│   ├── agentLoop.js                # Perceive → Plan → Validate → Execute
│   ├── planExecution.js            # Tool execution from plan steps
│   ├── actionFeedback.js           # Post-action feedback evaluator
│   ├── actionValidator.js          # Pre-action risk validator
│   ├── worldModel.js               # World context builder
│   ├── uiStateStore.js             # UI state tracking
│   ├── interactionModeManager.js   # Interaction mode (chat/action/mixed)
│   ├── coordinateMapper.js         # Screen coordinate mapping
│   ├── elementResolver.js          # UI element resolution
│   ├── screenScale.js              # DPI scaling
│   └── skills/
│       ├── skillRegistry.js        # Skill dispatcher
│       ├── fillFormSkill.js
│       ├── navigationSkill.js
│       ├── scrollSkill.js
│       ├── sendMessageSkill.js
│       └── suggestionSkill.js
│
├── modules/                        # Feature modules (pluggable)
│   ├── stt/
│   │   └── whisperManager.js       # Whisper STT runner
│   ├── tts/
│   │   └── piperTTS.js             # Piper TTS (was ttsEngine.js + inline)
│   ├── vision/
│   │   ├── screenCapture.js        # Screenshot
│   │   ├── ocrRunner.js            # Tesseract OCR
│   │   ├── visionRouter.js         # Route to Gemini or local
│   │   ├── visionRunner.js         # Local vision model
│   │   ├── visionAnalyzer.js       # Text-heavy classifier
│   │   ├── screenClassifier.js     # Screen type classifier
│   │   └── screenActionOrchestrator.js
│   ├── wake/
│   │   └── wakeWord.js             # AVA wake word bridge
│   ├── reflection/
│   │   ├── reflectionRunner.js
│   │   ├── reflectionGenerator.js
│   │   └── reflectionTrigger.js
│   └── aeye/
│       └── visualService.js        # A-Eye webcam + Telegram
│
├── integrations/                   # External service integrations
│   ├── telegram/
│   │   └── telegramService.js
│   ├── whatsapp/
│   │   └── whatsappBridge.js
│   ├── email/
│   │   ├── emailFetcher.js
│   │   ├── emailHandler.js
│   │   └── saveSession.js
│   └── n8n/
│       └── (n8n webhook handler)
│
├── tools/                          # Agentic tool system
│   ├── toolRegistry.js             # Central tool executor
│   ├── desktopTool.js              # Mouse/keyboard via robotjs
│   ├── systemTool.js               # App/URL/lock via OS
│   ├── memoryTool.js               # Memory R/W via tool interface
│   └── n8nTool.js                  # n8n workflow trigger
│
├── safety/                         # Safety and risk management
│   ├── riskEngine.js               # Plan risk evaluator
│   └── confirmationEngine.js       # Confirmation state
│
├── utils/                          # Shared utilities
│   ├── safeTempManager.js          # Temp file lifecycle
│   ├── powerMonitor.js             # Battery/power detection
│   ├── normalizer.js               # Text normalization
│   ├── dateResolver.js             # Date parsing
│   ├── dateParser.js               # Date parsing helper
│   ├── fileSearch.js               # File finder
│   ├── fileCleanup.js              # Cleanup utilities
│   └── pathConfig.js              # NEW: Centralizes all path resolution
│
├── actions/                        # Intent action handlers
│   ├── actions.js                  # Memory intents (remember/recall/forget)
│   ├── systemActions.js            # OS actions (shutdown/volume/etc.)
│   ├── localSkills.js              # Weather, news
│   ├── contentSuggester.js         # Content suggestions
│   └── conversionEngine.js        # Telegram PDF conversion
│
├── data/                           # Runtime persistent data (gitignored)
│   ├── memory/
│   │   ├── memory.json             # Semantic facts
│   │   ├── episodic_memory.json    # Episodic events
│   │   ├── reflection_memory.json  # Reflections
│   │   ├── vector_store.json       # Embedding vectors
│   │   └── chat_history.json       # Recent conversation
│   ├── sessions/
│   │   ├── email/
│   │   │   └── cookies.json        # Puppeteer email cookies
│   │   └── whatsapp/
│   │       ├── .wwebjs_auth/       # WhatsApp session
│   │       └── .wwebjs_cache/      # WhatsApp cache
│   └── security/
│       └── totp_secret.json        # TOTP secret (highly sensitive)
│
├── runtime/                        # External binaries + models (gitignored)
│   ├── ffmpeg/
│   │   └── bin/
│   │       └── ffmpeg.exe          # FFmpeg binary
│   ├── piper/
│   │   ├── piper.exe               # Piper TTS binary
│   │   └── models/
│   │       ├── en_US-ryan-high.onnx
│   │       └── en_US-ryan-high.onnx.json
│   ├── whisper/
│   │   ├── bin/
│   │   │   └── whisper-cli.exe     # Compiled Whisper binary
│   │   └── models/
│   │       ├── ggml-small.en.bin   # ~487 MB
│   │       └── ggml-medium.bin     # ~1.5 GB
│   ├── models/
│   │   └── vision/
│   │       ├── yolov8n.pt          # YOLO UI detection
│   │       └── omnitool/           # arvsal-vision weights
│   ├── downloads/                  # Telegram file downloads
│   ├── temp/                       # Temp audio/screenshot files
│   │   ├── audio/                  # WAV/WebM temp files
│   │   ├── tts/                    # Piper output WAV
│   │   └── screen/                 # Screenshot temp files
│   └── logs/                       # Runtime logs
│       ├── risk.log
│       └── toolExecution.log
│
├── vision/                         # arvsal-vision Python subsystem
│   ├── gradio_demo.py              # Gradio demo interface
│   ├── omnitool/                   # OmniTool core Python modules
│   └── util/                       # Vision utilities
│
├── book/                           # Book Engine (standalone Python)
│   ├── engine.py
│   ├── llm_processor.py
│   ├── config.py                   # (hardcoded paths → env vars)
│   ├── state_machine.py
│   ├── doc_builder.py
│   ├── converter.py
│   └── requirements.txt
│
├── stt/                            # whisper.cpp submodule
│   └── whisper.cpp/                # (git submodule — built binary referenced)
│
├── config/                         # Application configuration
│   ├── .env.example                # Template (no secrets)
│   ├── profiles/                   # Wake word profiles
│   │   ├── arvsal.json
│   │   ├── base.json
│   │   ├── custom.json
│   │   └── jarvis.json
│   └── runtime.config.js           # NEW: Resolves all runtime paths from .env
│
├── docs/                           # Documentation
│   ├── README.md                   # Main docs (move from root)
│   ├── architecture.md             # Architecture overview
│   ├── setup.md                    # Setup guide
│   ├── external-deps.md            # How to install runtime deps
│   └── api.md                      # Internal API reference
│
├── tests/                          # Test suite
│   └── (future)
│
├── scripts/                        # Dev/ops scripts
│   ├── setup-runtime.js            # Downloads/installs runtime binaries
│   └── health-check.js             # Verifies all paths exist at startup
│
├── .env                            # Active environment (gitignored)
├── .gitignore                      # Updated exclusions
├── package.json                    # npm configuration
└── .clinerules                     # AI assistant rules
```

---

## Directory Purpose Reference

| Directory | Purpose | Key Contents |
|-----------|---------|--------------|
| `apps/` | Electron shell only — no business logic | main.js, preload.js, renderer UI |
| `services/` | HTTP API layer — thin route handlers only | Express routes, no logic |
| `core/` | Pure AI logic — intent, memory, reasoning | Intent classifier, memory engines |
| `providers/` | AI/LLM provider abstraction | Ollama, OpenAI, Gemini, Groq clients |
| `agents/` | Autonomous agent execution | Agent loop, skills, world model |
| `modules/` | Feature subsystems | STT, TTS, Vision, Wake, Reflection |
| `integrations/` | Third-party service bridges | Telegram, WhatsApp, Email |
| `tools/` | Agentic tool system | Desktop, system, memory, n8n tools |
| `safety/` | Risk and safety management | Risk engine, confirmation engine |
| `utils/` | Pure utility functions | Normalizer, temp manager, date parser |
| `actions/` | Intent action implementations | Memory, system, skill handlers |
| `data/` | Runtime data files (gitignored) | All .json data, sessions, cache |
| `runtime/` | External binaries and models (gitignored) | FFmpeg, Piper, Whisper, YOLO |
| `vision/` | arvsal-vision Python submodule | OmniParser, Gradio demo |
| `book/` | Standalone book engine | Text-In/PDF-Out Telegram bot |
| `stt/` | whisper.cpp C++ submodule | Compiled STT binary source |
| `config/` | Static configuration | Profiles, env template |
| `docs/` | All documentation | README, setup, API reference |
| `tests/` | Test suite | Future: unit + integration tests |
| `scripts/` | Dev tooling | Setup, health check |

---

## Key Architectural Improvements

### 1. `server.js` Decomposed
**Before:** 1828-line monolith with all routes, business logic, helpers, constants
**After:** Thin `services/server.js` (mount routes) + separate route files per domain

### 2. Path Configuration Centralized
**Before:** Hardcoded `C:\Users\athar\Downloads\...` in 6+ files
**After:** `utils/pathConfig.js` + `.env` → single source of truth for all paths

### 3. Memory Data Separated from Source
**Before:** `backend/memory.json`, `episodic_memory.json`, `vector_store.json` alongside source files
**After:** All runtime data in `data/memory/` (gitignored separately)

### 4. Runtime Dependencies Contained
**Before:** FFmpeg in Downloads, Piper in Downloads, models scattered
**After:** Everything in `runtime/` with `.gitignore` and a `setup-runtime.js` installer script

### 5. Dead Code Eliminated
Removes: `ttsEngine.js`, `tts.js`, `espeak.js`, `llmDebug.js`, `reflect.js` (audit vs reflectionRunner), all commented-out blocks
