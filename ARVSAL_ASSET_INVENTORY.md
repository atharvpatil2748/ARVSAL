# ARVSAL Asset Inventory
**Generated:** 2026-05-30 | **Phase:** 3 of 8

---

## Classification Legend
- **CORE SOURCE** — Active, load-bearing source code
- **CONFIGURATION** — Config files and environment
- **MODEL** — AI/ML model weights
- **RUNTIME DATA** — Data files generated or modified at runtime
- **CACHE** — Temporary cached data
- **LOGS** — Log files
- **DOCUMENTATION** — Docs, READMEs, analysis
- **THIRD PARTY** — External submodules, vendored code
- **GENERATED FILE** — Auto-generated (pycache, lock files)
- **BUILD OUTPUT** — Compiled artifacts
- **DEAD CODE** — Commented-out or unreachable code

---

## Root Level Files

| File | Size | Classification | Purpose | Git Rec |
|------|------|---------------|---------|---------|
| `.env` | 946 B | CONFIGURATION | API keys, model names, port | ✅ Keep (gitignored) |
| `.gitignore` | 8.8 KB | CONFIGURATION | Git exclusion rules | ✅ Keep |
| `.clinerules` | 320 B | CONFIGURATION | AI assistant rules | ✅ Keep |
| `package.json` | 1.3 KB | CONFIGURATION | npm deps + scripts | ✅ Keep |
| `package-lock.json` | 212 KB | GENERATED FILE | Lock file | ✅ Keep |
| `README.md` | 19 KB | DOCUMENTATION | Main project README | ✅ Keep |
| `README.pdf` | 114 KB | DOCUMENTATION | PDF export of README | ❌ Remove (generated) |
| `cookies.json` | 959 B | RUNTIME DATA | Puppeteer email session | ❌ Gitignore, move to runtime/ |
| `planner.mf` | 491 B | UNKNOWN | Unknown purpose | 🔍 Investigate |
| `fix_log.py` | 1.2 KB | DEAD CODE | Dev debug script | ❌ Remove |
| `utils_vad.py` | 25.6 KB | EXPERIMENTAL | VAD experimentation script | ❌ Remove or archive |
| `arvsal_analysis.md` | 30 KB | DOCUMENTATION | Past audit doc | ❌ Move to docs/ |
| `gitignore_analysis.md` | 7.8 KB | DOCUMENTATION | Past analysis | ❌ Move to docs/ |
| `ui_modernization_plan.md` | 8.8 KB | DOCUMENTATION | UI planning doc | ❌ Move to docs/ |

---

## Electron Layer

| File | Size | Classification | Purpose | Git Rec |
|------|------|---------------|---------|---------|
| `electron/main.js` | 6.8 KB | CORE SOURCE | Electron entry point | ✅ Keep |
| `electron/preload.js` | 1.5 KB | CORE SOURCE | IPC bridge | ✅ Keep |
| `electron/arv-sal_en_windows_v4_0_0.ppn` | 2.8 KB | MODEL | Old Picovoice wake model | ❌ Remove (obsolete) |
| `electron/renderer/index.html` | 27 KB | CORE SOURCE | Main UI | ✅ Keep |
| `electron/renderer/ui.js` | 652 B | DEAD CODE | Stub/unused | 🔍 Investigate |
| `electron/renderer/animations.css` | 2.2 KB | CORE SOURCE | UI animations | ✅ Keep |
| `electron/renderer/components.css` | 1.9 KB | CORE SOURCE | UI components | ✅ Keep |
| `electron/renderer/effects.css` | 2.0 KB | CORE SOURCE | Visual effects | ✅ Keep |
| `electron/renderer/layout.css` | 1.1 KB | CORE SOURCE | Layout | ✅ Keep |
| `electron/renderer/states.css` | 1.1 KB | CORE SOURCE | State styles | ✅ Keep |
| `electron/renderer/theme.css` | 300 B | CORE SOURCE | Design tokens | ✅ Keep |
| `electron/renderer/yes_sir.wav` | 29.9 KB | RUNTIME DATA | Wake confirmation sound | ✅ Keep |

---

## Backend — Core Source Files

| File | Size | Classification | Purpose | Git Rec |
|------|------|---------------|---------|---------|
| `backend/server.js` | 53 KB | CORE SOURCE | Main HTTP server (monolith) | ✅ Keep → split |
| `backend/llmRunner.js` | 14 KB | CORE SOURCE + DEAD CODE | Ollama runner (contains ~170 lines dead) | ✅ Keep → clean dead code |
| `backend/llmRouter.js` | 11 KB | CORE SOURCE | Routes LLM calls | ✅ Keep |
| `backend/plannerEngine.js` | 11 KB | CORE SOURCE + DEAD CODE | JSON plan generator (large dead block) | ✅ Keep → clean |
| `backend/intentClassifier.js` | 12 KB | CORE SOURCE | Rule-based intent classifier | ✅ Keep |
| `backend/screenActionOrchestrator.js` | 25 KB | CORE SOURCE | Vision action orchestrator | ✅ Keep |
| `backend/episodicMemory.js` | 9.8 KB | CORE SOURCE + DEAD CODE | Temporal memory (large dead block) | ✅ Keep → clean |
| `backend/cognitiveEngine.js` | 12 KB | CORE SOURCE | Memory retrieval + scoring | ✅ Keep |
| `backend/intentEngine.js` | 6.3 KB | CORE SOURCE | Intent orchestrator | ✅ Keep |
| `backend/llmIntentRouter.js` | 6.6 KB | CORE SOURCE | LLM intent fallback | ✅ Keep |
| `backend/actions.js` | 11.6 KB | CORE SOURCE | Memory intent handlers | ✅ Keep |
| `backend/personality.js` | 7.6 KB | CORE SOURCE | Personality post-processor | ✅ Keep |
| `backend/personalityLLM.js` | 4.5 KB | CORE SOURCE | LLM personality wrapper | ✅ Keep |
| `backend/memory.js` | 5.9 KB | CORE SOURCE | Semantic fact store | ✅ Keep |
| `backend/vectorStore.js` | 7.8 KB | CORE SOURCE | Flat JSON vector store | ✅ Keep |
| `backend/embeddingModel.js` | 2.1 KB | CORE SOURCE | HuggingFace embeddings | ✅ Keep |
| `backend/whisperManager.js` | 4.6 KB | CORE SOURCE | Whisper STT runner | ✅ Keep |
| `backend/wakeWord.js` | 7.3 KB | CORE SOURCE | AVA wake word bridge | ✅ Keep |
| `backend/normalizer.js` | 3.2 KB | CORE SOURCE | Text normalizer | ✅ Keep |
| `backend/systemActions.js` | 8.4 KB | CORE SOURCE | OS-level actions | ✅ Keep |
| `backend/conversionEngine.js` | 4.1 KB | CORE SOURCE | PDF conversion | ✅ Keep |
| `backend/telegramService.js` | 4.2 KB | CORE SOURCE | Telegram bot | ✅ Keep |
| `backend/whatsappBridge.js` | 818 B | CORE SOURCE | WhatsApp bridge | ✅ Keep |
| `backend/screenCapture.js` | 2.9 KB | CORE SOURCE | Screenshot capture | ✅ Keep |
| `backend/ocrRunner.js` | 524 B | CORE SOURCE | Tesseract OCR | ✅ Keep |
| `backend/visionRouter.js` | 595 B | CORE SOURCE | Vision routing | ✅ Keep |
| `backend/visionRunner.js` | 1.1 KB | CORE SOURCE | Local vision model | ✅ Keep |
| `backend/visionAnalyzer.js` | 452 B | CORE SOURCE | Text-heavy classifier | ✅ Keep |
| `backend/visualService.js` | 2.5 KB | CORE SOURCE | A-Eye webcam + Telegram | ✅ Keep |
| `backend/reflectionRunner.js` | 5.2 KB | CORE SOURCE | Reflection orchestrator | ✅ Keep |
| `backend/reflectionGenerator.js` | 3.2 KB | CORE SOURCE | Reflection LLM caller | ✅ Keep |
| `backend/reflectionTrigger.js` | 2.9 KB | CORE SOURCE | Reflection trigger logic | ✅ Keep |
| `backend/reflect.js` | 6.6 KB | CORE SOURCE | Standalone reflection (possible dup) | 🔍 Audit vs reflectionRunner |
| `backend/aiSwitch.js` | 2.1 KB | CORE SOURCE | AI mode state | ✅ Keep |
| `backend/chatHistory.js` | 4.9 KB | CORE SOURCE | Conversation history | ✅ Keep |
| `backend/identity.js` | 5.3 KB | CORE SOURCE | Identity context | ✅ Keep |
| `backend/contentSuggester.js` | 4.5 KB | CORE SOURCE | Content suggestions | ✅ Keep |
| `backend/importanceScorer.js` | 2.2 KB | CORE SOURCE | Memory importance | ✅ Keep |
| `backend/memorySearch.js` | 1.8 KB | CORE SOURCE | Memory search | ✅ Keep |
| `backend/memoryInspector.js` | 5.7 KB | CORE SOURCE | Memory inspection | ✅ Keep |
| `backend/memoryUtils.js` | 2.6 KB | CORE SOURCE | Memory utilities | ✅ Keep |
| `backend/memoryIntentClassifier.js` | 2.4 KB | CORE SOURCE | Memory intent detection | ✅ Keep |
| `backend/recallRouter.js` | 1.4 KB | CORE SOURCE | Recall routing | ✅ Keep |
| `backend/localLLM.js` | 4.1 KB | CORE SOURCE | Local LLM wrapper | ✅ Keep |
| `backend/llmGuard.js` | 4.3 KB | CORE SOURCE | LLM content guard | ✅ Keep |
| `backend/llmPrompt.js` | 7.3 KB | CORE SOURCE | LLM prompt templates | ✅ Keep |
| `backend/intentPrompt.js` | 5.2 KB | CORE SOURCE | Intent prompt template | ✅ Keep |
| `backend/actionIntentDetector.js` | 5.4 KB | CORE SOURCE | Screen action detector | ✅ Keep |
| `backend/codePrompt.js` | 1.2 KB | CORE SOURCE | Code prompt template | ✅ Keep |
| `backend/mathPrompt.js` | 1.2 KB | CORE SOURCE | Math prompt template | ✅ Keep |
| `backend/dateResolver.js` | 3.4 KB | CORE SOURCE | Date parsing | ✅ Keep |
| `backend/dateParser.js` | 511 B | CORE SOURCE | Date parsing helper | ✅ Keep |
| `backend/keyNormalizer.js` | 1.3 KB | CORE SOURCE | Key normalizer | ✅ Keep |
| `backend/themeExtractor.js` | 2.6 KB | CORE SOURCE | Topic extractor | ✅ Keep |
| `backend/fileSearch.js` | 1.1 KB | CORE SOURCE | File search | ✅ Keep |
| `backend/fileCleanup.js` | 450 B | CORE SOURCE | Temp cleanup | ✅ Keep |
| `backend/screenClassifier.js` | 1.6 KB | CORE SOURCE | Screen type classifier | ✅ Keep |
| `backend/ollamaWarmup.js` | 683 B | CORE SOURCE | Model pre-warming | ✅ Keep |
| `backend/confirmManager.js` | 2.6 KB | CORE SOURCE | Confirmation state | ✅ Keep |
| `backend/contactBook.js` | 4.3 KB | CORE SOURCE | WhatsApp contacts | ✅ Keep |
| `backend/busyMode.js` | 857 B | CORE SOURCE | Busy mode state | ✅ Keep |
| `backend/autoReplyGuard.js` | 503 B | CORE SOURCE | Auto-reply throttle | ✅ Keep |
| `backend/missedTracker.js` | 889 B | CORE SOURCE | Missed messages | ✅ Keep |
| `backend/vipList.js` | 316 B | CORE SOURCE | VIP contact list | ✅ Keep |
| `backend/remoteControl.js` | 282 B | CORE SOURCE | Remote control toggle | ✅ Keep |
| `backend/totpManager.js` | 882 B | CORE SOURCE | TOTP verification | ✅ Keep |
| `backend/chatgptClient.js` | 2.5 KB | CORE SOURCE | OpenAI client | ✅ Keep |
| `backend/geminiClient.js` | 4.4 KB | CORE SOURCE | Gemini client | ✅ Keep |
| `backend/groqClient.js` | 2.7 KB | CORE SOURCE | Groq client | ✅ Keep |

---

## Backend — Dead/Stub Files

| File | Size | Classification | Notes |
|------|------|---------------|-------|
| `backend/ttsEngine.js` | 967 B | DEAD CODE | Piper TTS — server.js calls Piper directly |
| `backend/tts.js` | 707 B | DEAD CODE | Unclear purpose, tiny file |
| `backend/espeak.js` | 270 B | DEAD CODE | eSpeak not used |
| `backend/llmDebug.js` | 175 B | DEAD CODE | Single debug flag |

---

## Backend — Runtime Data (Should Be Gitignored)

| File | Size | Classification | Notes |
|------|------|---------------|-------|
| `backend/memory.json` | 8.4 KB | RUNTIME DATA | Semantic memory store |
| `backend/episodic_memory.json` | 1.26 MB | RUNTIME DATA | ⚠️ Very large — growing indefinitely |
| `backend/vector_store.json` | 620 KB | RUNTIME DATA | Vector index |
| `backend/reflection_memory.json` | 2 B | RUNTIME DATA | Empty, initialized file |
| `backend/chat_history.json` | 3.2 KB | RUNTIME DATA | Recent chat |
| `backend/totp_secret.json` | 45 B | RUNTIME DATA | TOTP secret — ⚠️ SENSITIVE |
| `backend/toolExecution.log` | 41 KB | LOGS | Tool execution log |

---

## Backend — Subdirectory Assets

| File | Size | Classification | Notes |
|------|------|---------------|-------|
| `backend/profiles/arvsal.json` | 2.2 KB | CONFIGURATION | Wake word profile |
| `backend/profiles/base.json` | 447 B | CONFIGURATION | Base wake profile |
| `backend/profiles/custom.json` | 407 B | CONFIGURATION | Custom wake profile |
| `backend/profiles/jarvis.json` | 983 B | CONFIGURATION | Jarvis wake profile |
| `backend/profiles/debug.json` | 0 B | CONFIGURATION | Empty debug profile |
| `backend/logs/risk.log` | 64.8 KB | LOGS | Risk engine log |
| `backend/logs/toolExecution.log` | 25.4 KB | LOGS | Duplicate? Tool log in logs/ |
| `backend/logs/screenshot.png` | 5.9 MB | RUNTIME DATA | ⚠️ Large screenshot in logs folder |
| `backend/logs/regression_test_report.json` | 557 B | LOGS | Test report |
| `backend/python_worker/models/yolov8n.pt` | 6.5 MB | MODEL | YOLO UI detector model |

---

## Agent Subdirectory

| File | Size | Classification | Notes |
|------|------|---------------|-------|
| `backend/agent/agentLoop.js` | 4.7 KB | CORE SOURCE | Main agent loop |
| `backend/agent/actionFeedback.js` | 2.1 KB | CORE SOURCE | Feedback evaluator |
| `backend/agent/actionValidator.js` | 3.2 KB | CORE SOURCE | Step validator |
| `backend/agent/coordinateMapper.js` | 925 B | CORE SOURCE | Coordinate mapping |
| `backend/agent/elementResolver.js` | 2.7 KB | CORE SOURCE | UI element resolver |
| `backend/agent/interactionModeManager.js` | 406 B | CORE SOURCE | Mode state |
| `backend/agent/pythonBridge.js` | 2.1 KB | CORE SOURCE | Python worker bridge |
| `backend/agent/screenScale.js` | 572 B | CORE SOURCE | Screen DPI scaling |
| `backend/agent/uiStateStore.js` | 3.0 KB | CORE SOURCE | UI state tracking |
| `backend/agent/worldModel.js` | 1.3 KB | CORE SOURCE | World context builder |
| `backend/agent/screenSkills/*.js` | various | CORE SOURCE | 6 skill files |

---

## Book Engine (Python)

| File | Size | Classification | Notes |
|------|------|---------------|-------|
| `book/engine.py` | 10.4 KB | CORE SOURCE | Main engine |
| `book/llm_processor.py` | 13.2 KB | CORE SOURCE | LLM interface |
| `book/config.py` | 4.9 KB | CONFIGURATION | Has hardcoded paths |
| `book/state_machine.py` | 11.4 KB | CORE SOURCE | Writing state machine |
| `book/doc_builder.py` | 10.1 KB | CORE SOURCE | DOCX builder |
| `book/converter.py` | 3.9 KB | CORE SOURCE | DOCX→PDF |
| `book/transcriber.py` | 828 B | DEAD CODE | Legacy audio transcriber stub |
| `book/requirements.txt` | 219 B | CONFIGURATION | Python deps |
| `book/manuscript.docx` | 40.6 KB | RUNTIME DATA | Generated document |
| `book/manuscript.pdf` | 121.7 KB | RUNTIME DATA | Generated PDF |
| `book/context_buffer.json` | 134 B | RUNTIME DATA | Book context state |
| `book/test_context_buffer.json` | 134 B | RUNTIME DATA | Test state file |
| `book/test_manuscript.docx` | 36.8 KB | RUNTIME DATA | Test output |
| `book/.last_update_id` | 9 B | RUNTIME DATA | Telegram offset |
| `book/__pycache__/` | — | GENERATED FILE | ❌ Gitignore |
| `book/audio_tmp/` | — | CACHE | ❌ Gitignore, delete |

---

## WhisperCpp Submodule

| File | Size | Classification | Notes |
|------|------|---------------|-------|
| `whisper.cpp/` (entire) | ~500+ MB | THIRD PARTY | Git submodule |
| `whisper.cpp/ggml-small.en.bin` | 487 MB | MODEL | ⚠️ DUPLICATE — delete |
| `whisper.cpp/models/ggml-small.en.bin` | 487 MB | MODEL | Primary location |
| `whisper.cpp/models/ggml-medium.bin` | ~1.5 GB | MODEL | Medium model |
| `whisper.cpp/build/` | — | BUILD OUTPUT | Compiled binary |
| `whisper.cpp/test.waw` | 147 KB | RUNTIME DATA | Test audio file |

---

## Root Level Runtime Data

| File/Dir | Size | Classification | Notes |
|----------|------|---------------|-------|
| `.wwebjs_auth/` | — | RUNTIME DATA | WhatsApp session — gitignore |
| `.wwebjs_cache/` | — | CACHE | WhatsApp Chromium cache — gitignore |
| `cookies.json` | 959 B | RUNTIME DATA | Email session — gitignore |
| `node_modules/` | ~200+ MB | THIRD PARTY | npm packages — gitignore |

---

## Summary Counts

| Classification | Count | Action |
|---------------|-------|--------|
| CORE SOURCE | ~110 files | Keep, refactor paths |
| CONFIGURATION | ~15 files | Keep, externalize hardcoded paths |
| MODEL | 4+ files | Move to `runtime/models/` |
| RUNTIME DATA | ~20 files | Gitignore, move to `runtime/data/` |
| CACHE | 3 dirs | Gitignore |
| LOGS | 5 files | Gitignore |
| DOCUMENTATION | 7 files | Move to `docs/` |
| THIRD PARTY | 2 submodules | Keep as submodules |
| GENERATED FILE | 3 dirs | Gitignore |
| BUILD OUTPUT | 1 dir | Gitignore |
| DEAD CODE | ~8 files | Delete or clean |
