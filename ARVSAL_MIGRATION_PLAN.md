# ARVSAL Migration Plan
**Generated:** 2026-05-30 | **Phase:** 5 of 8

> **Rule:** Every file listed has a deterministic destination. Files marked ❌ DELETE should be removed entirely. Files marked ✅ KEEP IN PLACE require only import path updates, not physical movement.

---

## Electron Layer

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `electron/main.js` | `apps/electron/main.js` | Electron app belongs in apps/ |
| `electron/preload.js` | `apps/electron/preload.js` | Part of electron shell |
| `electron/renderer/index.html` | `apps/renderer/index.html` | Renderer is part of app shell |
| `electron/renderer/ui.js` | `apps/renderer/ui.js` | Stub — keep, investigate |
| `electron/renderer/animations.css` | `apps/renderer/styles/animations.css` | Organized under styles/ |
| `electron/renderer/components.css` | `apps/renderer/styles/components.css` | Organized under styles/ |
| `electron/renderer/effects.css` | `apps/renderer/styles/effects.css` | Organized under styles/ |
| `electron/renderer/layout.css` | `apps/renderer/styles/layout.css` | Organized under styles/ |
| `electron/renderer/states.css` | `apps/renderer/styles/states.css` | Organized under styles/ |
| `electron/renderer/theme.css` | `apps/renderer/styles/theme.css` | Organized under styles/ |
| `electron/renderer/yes_sir.wav` | `apps/renderer/assets/yes_sir.wav` | Static asset into assets/ |
| `electron/arv-sal_en_windows_v4_0_0.ppn` | ❌ DELETE | Orphaned Picovoice model — ava-listener used instead |

---

## Backend → Services (Routes Only)

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `backend/server.js` (route registration) | `services/server.js` | Core Express app setup |
| `backend/server.js` (/audio route) | `services/audio/audioRoutes.js` | Audio pipeline split out |
| `backend/server.js` (/command route) | `services/command/commandRoute.js` | Command route split out |
| `backend/server.js` (/speak route) | `services/tts/ttsRoute.js` | TTS route split out |
| `backend/server.js` (/health route) | `services/health/healthRoute.js` | Health route split out |
| `backend/server.js` (validateWhisperOutput) | `services/audio/audioValidator.js` | Validator belongs with audio service |
| `backend/server.js` (startTelegramListener) | `integrations/telegram/telegramListener.js` | Telegram polling is an integration |
| `backend/server.js` (startWhatsApp callback) | `integrations/whatsapp/whatsappListener.js` | WhatsApp is an integration |

---

## Backend → Core

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `backend/intentClassifier.js` | `core/intent/intentClassifier.js` | Intent is core logic |
| `backend/intentEngine.js` | `core/intent/intentEngine.js` | Intent orchestration |
| `backend/intentPrompt.js` | `core/intent/intentPrompt.js` | Intent LLM prompt |
| `backend/llmIntentRouter.js` | `core/intent/llmIntentRouter.js` | LLM intent fallback |
| `backend/actionIntentDetector.js` | `core/intent/actionIntentDetector.js` | Intent detection |
| `backend/memory.js` | `core/memory/semanticMemory.js` | Renamed for clarity |
| `backend/episodicMemory.js` | `core/memory/episodicMemory.js` | Memory subsystem |
| `backend/reflectionMemory.js` | `core/memory/reflectionMemory.js` | Memory subsystem |
| `backend/memorySearch.js` | `core/memory/memorySearch.js` | Memory utilities |
| `backend/memoryInspector.js` | `core/memory/memoryInspector.js` | Memory utilities |
| `backend/memoryUtils.js` | `core/memory/memoryUtils.js` | Memory utilities |
| `backend/memoryIntentClassifier.js` | `core/memory/memoryIntentClassifier.js` | Memory utilities |
| `backend/recallRouter.js` | `core/memory/recallRouter.js` | Memory utilities |
| `backend/importanceScorer.js` | `core/memory/importanceScorer.js` | Memory utilities |
| `backend/keyNormalizer.js` | `core/memory/keyNormalizer.js` | Memory utilities |
| `backend/themeExtractor.js` | `core/memory/themeExtractor.js` | Memory utilities |
| `backend/cognitiveEngine.js` | `core/reasoning/cognitiveEngine.js` | Reasoning layer |
| `backend/plannerEngine.js` | `core/reasoning/plannerEngine.js` | Reasoning layer |
| `backend/confirmManager.js` | `core/reasoning/confirmManager.js` | Reasoning/state |
| `backend/chatHistory.js` | `core/memory/chatHistory.js` | Memory subsystem |
| `backend/personality.js` | `core/personality/personality.js` | Personality layer |
| `backend/personalityLLM.js` | `core/personality/personalityLLM.js` | Personality layer |
| `backend/identity.js` | `core/personality/identity.js` | Personality layer |

---

## Backend → Providers

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `backend/llmRunner.js` | `providers/llm/llmRunner.js` | LLM is a provider |
| `backend/llmRouter.js` | `providers/llm/llmRouter.js` | LLM routing |
| `backend/llmGuard.js` | `providers/llm/llmGuard.js` | LLM safety |
| `backend/llmPrompt.js` | `providers/llm/llmPrompt.js` | LLM prompt |
| `backend/codePrompt.js` | `providers/llm/codePrompt.js` | Code prompt |
| `backend/mathPrompt.js` | `providers/llm/mathPrompt.js` | Math prompt |
| `backend/ollamaWarmup.js` | `providers/llm/ollamaWarmup.js` | Ollama management |
| `backend/localLLM.js` | `providers/llm/localLLM.js` | Local LLM wrapper |
| `backend/aiSwitch.js` | `providers/llm/aiSwitch.js` | AI mode state |
| `backend/chatgptClient.js` | `providers/external/chatgptClient.js` | External AI |
| `backend/geminiClient.js` | `providers/external/geminiClient.js` | External AI |
| `backend/groqClient.js` | `providers/external/groqClient.js` | External AI |

---

## Backend → Agents

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `backend/agent/agentLoop.js` | `agents/agentLoop.js` | Agent system promoted |
| `backend/agent/actionFeedback.js` | `agents/actionFeedback.js` | Agent utilities |
| `backend/agent/actionValidator.js` | `agents/actionValidator.js` | Agent utilities |
| `backend/agent/coordinateMapper.js` | `agents/coordinateMapper.js` | Agent utilities |
| `backend/agent/elementResolver.js` | `agents/elementResolver.js` | Agent utilities |
| `backend/agent/interactionModeManager.js` | `agents/interactionModeManager.js` | Agent state |
| `backend/agent/pythonBridge.js` | `agents/pythonBridge.js` | Agent-Python bridge |
| `backend/agent/screenScale.js` | `agents/screenScale.js` | Agent utilities |
| `backend/agent/uiStateStore.js` | `agents/uiStateStore.js` | Agent state |
| `backend/agent/worldModel.js` | `agents/worldModel.js` | Agent context |
| `backend/agent/screenSkills/skillRegistry.js` | `agents/skills/skillRegistry.js` | Skills |
| `backend/agent/screenSkills/fillFormSkill.js` | `agents/skills/fillFormSkill.js` | Skills |
| `backend/agent/screenSkills/navigationSkill.js` | `agents/skills/navigationSkill.js` | Skills |
| `backend/agent/screenSkills/scrollSkill.js` | `agents/skills/scrollSkill.js` | Skills |
| `backend/agent/screenSkills/sendMessageSkill.js` | `agents/skills/sendMessageSkill.js` | Skills |
| `backend/agent/screenSkills/suggestionSkill.js` | `agents/skills/suggestionSkill.js` | Skills |

---

## Backend → Modules

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `backend/whisperManager.js` | `modules/stt/whisperManager.js` | STT module |
| `backend/ttsEngine.js` | ❌ DELETE | Dead code — Piper called inline in server.js |
| `backend/tts.js` | ❌ DELETE | Dead stub |
| `backend/espeak.js` | ❌ DELETE | Not used |
| `backend/wakeWord.js` | `modules/wake/wakeWord.js` | Wake module |
| `backend/screenCapture.js` | `modules/vision/screenCapture.js` | Vision module |
| `backend/ocrRunner.js` | `modules/vision/ocrRunner.js` | Vision module |
| `backend/visionRouter.js` | `modules/vision/visionRouter.js` | Vision module |
| `backend/visionRunner.js` | `modules/vision/visionRunner.js` | Vision module |
| `backend/visionAnalyzer.js` | `modules/vision/visionAnalyzer.js` | Vision module |
| `backend/screenClassifier.js` | `modules/vision/screenClassifier.js` | Vision module |
| `backend/screenActionOrchestrator.js` | `modules/vision/screenActionOrchestrator.js` | Vision module |
| `backend/visualService.js` | `modules/aeye/visualService.js` | A-Eye module |
| `backend/reflectionRunner.js` | `modules/reflection/reflectionRunner.js` | Reflection module |
| `backend/reflectionGenerator.js` | `modules/reflection/reflectionGenerator.js` | Reflection module |
| `backend/reflectionTrigger.js` | `modules/reflection/reflectionTrigger.js` | Reflection module |
| `backend/reflect.js` | 🔍 Audit vs reflectionRunner → DELETE or merge | Possible duplicate |

---

## Backend → Integrations

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `backend/telegramService.js` | `integrations/telegram/telegramService.js` | Integration layer |
| `backend/whatsappBridge.js` | `integrations/whatsapp/whatsappBridge.js` | Integration layer |
| `backend/email/emailFetcher.js` | `integrations/email/emailFetcher.js` | Integration layer |
| `backend/email/emailHandler.js` | `integrations/email/emailHandler.js` | Integration layer |
| `backend/email/saveSession.js` | `integrations/email/saveSession.js` | Integration layer |
| `backend/conversionEngine.js` | `integrations/telegram/conversionEngine.js` | Used by Telegram pipeline |

---

## Backend → Tools

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `backend/tools/toolRegistry.js` | `tools/toolRegistry.js` | Tool registry promoted |
| `backend/tools/desktopTool.js` | `tools/desktopTool.js` | Tool promoted |
| `backend/tools/systemTool.js` | `tools/systemTool.js` | Tool promoted |
| `backend/tools/memoryTool.js` | `tools/memoryTool.js` | Tool promoted |
| `backend/tools/n8nTool.js` | `tools/n8nTool.js` | Tool promoted |

---

## Backend → Safety

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `backend/safety/riskEngine.js` | `safety/riskEngine.js` | Safety promoted |
| `backend/safety/confirmationEngine.js` | `safety/confirmationEngine.js` | Safety promoted |

---

## Backend → Utils

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `backend/utils/safeTempManager.js` | `utils/safeTempManager.js` | Shared utility |
| `backend/utils/powerMonitor.js` | `utils/powerMonitor.js` | Shared utility |
| `backend/normalizer.js` | `utils/normalizer.js` | Shared utility |
| `backend/dateResolver.js` | `utils/dateResolver.js` | Shared utility |
| `backend/dateParser.js` | `utils/dateParser.js` | Shared utility |
| `backend/fileSearch.js` | `utils/fileSearch.js` | Shared utility |
| `backend/fileCleanup.js` | `utils/fileCleanup.js` | Shared utility |
| `backend/llmDebug.js` | ❌ DELETE | Dead stub |

---

## Backend → Actions

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `backend/actions.js` | `actions/actions.js` | Action handlers promoted |
| `backend/systemActions.js` | `actions/systemActions.js` | Action handlers |
| `backend/localSkills.js` | `actions/localSkills.js` | Skill actions |
| `backend/contentSuggester.js` | `actions/contentSuggester.js` | Content action |

---

## Runtime Data → data/

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `backend/memory.json` | `data/memory/memory.json` | Runtime data isolated |
| `backend/episodic_memory.json` | `data/memory/episodic_memory.json` | Runtime data isolated |
| `backend/vector_store.json` | `data/memory/vector_store.json` | Runtime data isolated |
| `backend/reflection_memory.json` | `data/memory/reflection_memory.json` | Runtime data |
| `backend/chat_history.json` | `data/memory/chat_history.json` | Runtime data |
| `backend/totp_secret.json` | `data/security/totp_secret.json` | Sensitive credential |
| `cookies.json` (root) | `data/sessions/email/cookies.json` | Session data |
| `.wwebjs_auth/` (root) | `data/sessions/whatsapp/.wwebjs_auth/` | Session data |
| `.wwebjs_cache/` (root) | `data/cache/whatsapp/.wwebjs_cache/` | Cache |
| `backend/logs/` | `runtime/logs/` | Runtime logs |
| `backend/toolExecution.log` | `runtime/logs/toolExecution.log` | Runtime log |

---

## Runtime Binaries → runtime/

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `C:\Users\athar\Downloads\ffmpeg-8.0.1-...\ffmpeg.exe` | `runtime/ffmpeg/bin/ffmpeg.exe` | Bundled runtime |
| `C:\Users\athar\Downloads\piper_windows_amd64\piper\piper.exe` | `runtime/piper/piper.exe` | Bundled runtime |
| `C:\Users\athar\Downloads\piper_windows_amd64\piper\en_US-ryan-high.onnx` | `runtime/piper/models/en_US-ryan-high.onnx` | Model file |
| `whisper.cpp/build/bin/whisper-cli.exe` | `runtime/whisper/bin/whisper-cli.exe` | Compiled binary |
| `whisper.cpp/models/ggml-small.en.bin` | `runtime/whisper/models/ggml-small.en.bin` | STT model |
| `whisper.cpp/models/ggml-medium.bin` | `runtime/whisper/models/ggml-medium.bin` | STT model |
| `whisper.cpp/ggml-small.en.bin` | ❌ DELETE (487 MB duplicate) | Duplicate model |
| `backend/python_worker/models/yolov8n.pt` | `runtime/models/vision/yolov8n.pt` | Vision model |
| `backend/arvsal-vision/weights/` | `runtime/models/vision/omnitool/` | Vision weights |

---

## Configuration → config/

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `backend/profiles/arvsal.json` | `config/profiles/arvsal.json` | Static config |
| `backend/profiles/base.json` | `config/profiles/base.json` | Static config |
| `backend/profiles/custom.json` | `config/profiles/custom.json` | Static config |
| `backend/profiles/jarvis.json` | `config/profiles/jarvis.json` | Static config |
| `backend/profiles/debug.json` | `config/profiles/debug.json` | Static config |
| `.env` | `.env` (keep at root) | Root convention |

---

## Python Subsystems

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `backend/python_worker/` | `agents/vision_worker/` | Part of agent system |
| `backend/arvsal-vision/` | `vision/` | Promoted to top-level |
| `book/` | `book/` | Keep as standalone |
| `whisper.cpp/` | `stt/whisper.cpp/` | Organized under stt/ |

---

## Documentation → docs/

| Current Location | New Location | Reason |
|-----------------|-------------|--------|
| `README.md` (root) | `docs/README.md` (symlink or keep root) | Keep root README |
| `arvsal_analysis.md` | `docs/archive/arvsal_analysis.md` | Historical doc |
| `gitignore_analysis.md` | `docs/archive/gitignore_analysis.md` | Historical doc |
| `ui_modernization_plan.md` | `docs/archive/ui_modernization_plan.md` | Historical doc |
| `README.pdf` | ❌ DELETE | Generated artifact |

---

## Files to Delete

| File | Reason |
|------|--------|
| `electron/arv-sal_en_windows_v4_0_0.ppn` | Orphaned Picovoice model |
| `backend/ttsEngine.js` | Dead code — server.js calls Piper directly |
| `backend/tts.js` | Dead stub |
| `backend/espeak.js` | Dead stub |
| `backend/llmDebug.js` | Dead stub |
| `backend/reflect.js` | Duplicate of reflectionRunner (verify before deleting) |
| `whisper.cpp/ggml-small.en.bin` | 487 MB duplicate |
| `backend/logs/screenshot.png` | 5.9 MB runtime artifact |
| `fix_log.py` | Dev debug script |
| `README.pdf` | Generated artifact |
| `planner.mf` | Unknown — investigate first |
