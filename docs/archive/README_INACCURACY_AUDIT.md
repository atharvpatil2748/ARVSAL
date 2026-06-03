# README Inaccuracy Audit
**Source: Live V2 codebase — June 2026**
**No README changes are made by this document. Audit only.**

Every table entry is grounded in actual file inspection. Section and line numbers refer to the current README.md.

---

## WAKE SYSTEM

---

### Inaccuracy #1 — Wake word engine is Porcupine

| Field | Content |
|---|---|
| **README line** | Line 21 (Key Features): `"Custom Wake Word — On-device Picovoice Porcupine model trained specifically on the word 'Arvsal'"` |
| **README line** | Line 47 (Architecture): `[WAKE WORD — Picovoice Porcupine (.ppn)]` |
| **README line** | Line 116 (Core Components): `"Wake Word | electron/main.js + .ppn | Custom Porcupine model"` |
| **README line** | Line 161 (Tech Stack): `"Wake Word | Picovoice Porcupine — custom-trained .ppn model"` |
| **README line** | Line 193 (How It Works): `"Porcupine detects the custom wake word 'Arvsal' on-device"` |
| **README line** | Line 299 (Installation): `PICOVOICE_ACCESS_KEY=your_picovoice_key` |
| **Reason incorrect** | `modules/wake/wakeWord.js` (line 19) shows `const { AVAListener } = require('ava-listener')`. Porcupine is completely replaced. The engine is `ava-listener`, an npm package wrapping Sherpa-ONNX for on-device wake word detection. No `.ppn` file is referenced anywhere. Profile management uses `profiles/arvsal.json`. |
| **Replacement** | `"Custom Wake Word — On-device AVAListener (ava-listener npm package, Sherpa-ONNX backend) — no cloud, no API key required, JSON-profile configured"` |

---

### Inaccuracy #2 — `.ppn` file referenced

| Field | Content |
|---|---|
| **README line** | Lines 47, 116 |
| **Reason incorrect** | No `.ppn` file exists anywhere in the codebase. The `ava-listener` package uses a JSON profile (`profiles/arvsal.json`) with `wakePhrases` and `threshold` configuration, not a proprietary Porcupine binary model. |
| **Replacement** | Remove all `.ppn` references. Reference `modules/wake/profiles/arvsal.json`. |

---

### Inaccuracy #3 — `PvRecorder` referenced for audio capture

| Field | Content |
|---|---|
| **README line** | Line 51 (Architecture): `[AUDIO CAPTURE — MediaRecorder / PvRecorder]` |
| **Reason incorrect** | `PvRecorder` is a Picovoice library and is not present anywhere in the codebase. Audio capture uses the browser `MediaRecorder` API in `apps/renderer/index.html`. The renderer sends WebM blobs to the backend via Electron IPC. |
| **Replacement** | `[AUDIO CAPTURE — MediaRecorder (Web API) in renderer → IPC → backend]` |

---

### Inaccuracy #4 — Silero VAD is missing entirely

| Field | Content |
|---|---|
| **README lines** | Architecture diagram (lines 43–108), How It Works step 2 (line 195), STT streaming description |
| **Reason incorrect** | A full Silero VAD pipeline is implemented in `modules/stt/vadManager.js` and `backend/python_worker/vad_worker.py`. Every audio endpoint (`/audio`, `/audio/final`, `/audio/stream`) passes audio through VAD before invoking Whisper. VAD operates in two modes: persistent worker (for stream endpoint) and spawn-per-request (for final endpoint). It is fail-open: if VAD cannot classify, audio passes through to Whisper. This is a critical feature entirely absent from the README. |
| **Replacement** | Add as a distinct Key Feature. Add a VAD stage in the architecture diagram between audio capture and Whisper. Add to the STT Streaming row in Core Components. |

---

### Inaccuracy #5 — `PICOVOICE_ACCESS_KEY` in `.env` example

| Field | Content |
|---|---|
| **README line** | Line 299: `PICOVOICE_ACCESS_KEY=your_picovoice_key` |
| **Reason incorrect** | `ava-listener` does not require a Picovoice API key. No Picovoice dependency exists in `package.json`. This key is never read by any module. |
| **Replacement** | Remove from `.env` example. |

---

## SPEECH / STT STACK

---

### Inaccuracy #6 — whisperManager file location

| Field | Content |
|---|---|
| **README line** | Line 118: `"STT Final | backend/whisperManager.js"` |
| **Reason incorrect** | The file is at `modules/stt/whisperManager.js`, confirmed by direct inspection. |
| **Replacement** | `modules/stt/whisperManager.js` |

---

### Inaccuracy #7 — Streaming STT described as always-on live display

| Field | Content |
|---|---|
| **README lines** | Lines 55–57 (Architecture), Line 195 (How It Works): `"small Whisper model shows live text"` |
| **Reason incorrect** | VAD now pre-screens all audio before it reaches Whisper. The streaming path (`/audio/stream`) uses persistent VAD worker mode. Audio is only transcribed if VAD confirms speech. The "live transcription display" implication of a continuous stream is no longer accurate without mentioning VAD gating. |
| **Replacement** | Update to describe: audio → FFmpeg → VAD check → if speech → Whisper small model → partial display. |

---

### Inaccuracy #8 — Whisper run from build path not documented

| Field | Content |
|---|---|
| **README line** | Line 270 (Installation Prerequisites): `"whisper.cpp binary with ggml-medium.bin model"` |
| **Reason incorrect** | `modules/stt/whisperManager.js` (lines 7–8) shows `WHISPER_EXE = pathConfig.WHISPER_EXE` resolving to `runtime/whisper/build/bin/whisper-cli.exe`. The executable must be compiled from the `runtime/whisper` submodule (whisper.cpp). CWD is set to `runtime/whisper/bin/` so DLLs load correctly. Whisper runs with GPU unless battery-powered (`powerMonitor.js`). None of this is documented. |
| **Replacement** | Add: "whisper.cpp source is included as a Git submodule at `runtime/whisper`. Must be compiled: `cmake -B build -DWHISPER_CUBLAS=1 && cmake --build build --config Release`. Executable at `runtime/whisper/build/bin/whisper-cli.exe`. GPU-accelerated by default; falls back to CPU on battery." |

---

### Inaccuracy #9 — Battery-aware GPU switching not documented

| Field | Content |
|---|---|
| **README lines** | Not mentioned anywhere |
| **Reason incorrect** | `whisperManager.js` (lines 28, 48–52) calls `isOnBattery()` from `utils/powerMonitor.js` and adds `--no-gpu` to Whisper args when on battery. This is a production feature that determines GPU usage dynamically. |
| **Replacement** | Add to Key Features and to the STT section: "Battery-aware GPU switching — Whisper uses CUDA GPU acceleration when plugged in and falls back to CPU-only when on battery (`utils/powerMonitor.js`)." |

---

## INTENT SYSTEM

---

### Inaccuracy #10 — intentClassifier.js file path

| Field | Content |
|---|---|
| **README line** | Line 119: `"Intent Engine | backend/intentClassifier.js"` |
| **Reason incorrect** | File is at `core/intent/intentClassifier.js`. |
| **Replacement** | `core/intent/intentClassifier.js` |

---

### Inaccuracy #11 — "40+ intents" count is stale

| Field | Content |
|---|---|
| **README lines** | Lines 23, 71, 197: `"40+ priority-ordered regex rules"` |
| **Reason incorrect** | `core/intent/intentClassifier.js` now contains: CODING_QUERY, MATH_QUERY, CONFIRM_YES/NO, INTRODUCE_SELF, LOCAL_SKILL (TIME/DATE/WEATHER/NEWS), EPISODIC_BY_DATE, EPISODIC_RECALL, MEMORY_SUMMARY, FORGET, RECALL, REMEMBER, SCREEN_ACTION, SCREEN_ACTION_MIXED, SUGGEST_CONTENT, MUTE, VOLUME_UP, VOLUME_DOWN, SEARCH, YOUTUBE, OPEN_APP (chrome/edge/notepad/calculator/calendar/whatsapp), OPEN_FOLDER, OPEN_CALENDAR, SHUTDOWN, RESTART, LOCK, SLEEP, WEBCAM_SNAP, SMALLTALK, EMAIL_FETCH, GENERAL_QUESTION — over 50 distinct intents. Additionally, `llmIntentRouter.js` adds phi3:mini as a second-pass intent layer. |
| **Replacement** | "50+ priority-ordered intents across two layers: deterministic regex classifier (primary) + phi3:mini LLM router (secondary, sandboxed, 1.2s timeout)" |

---

### Inaccuracy #12 — LLM Intent Router not documented at all

| Field | Content |
|---|---|
| **README lines** | Not mentioned anywhere |
| **Reason incorrect** | `core/intent/llmIntentRouter.js` exists and is active. It uses `phi3:mini` with a 1.2-second timeout to optionally refine `GENERAL_QUESTION` intents. It is sandboxed (forbidden intents list), fail-safe (returns `null` on any error), and never executes actions or generates replies. This is an architecturally significant component absent from the README. |
| **Replacement** | Add to Core Components table: `"LLM Intent Router | core/intent/llmIntentRouter.js | phi3:mini — secondary intent disambiguation, 1.2s sandboxed, fail-safe"` |

---

### Inaccuracy #13 — actionIntentDetector.js not documented

| Field | Content |
|---|---|
| **README lines** | Not mentioned |
| **Reason incorrect** | `core/intent/actionIntentDetector.js` exists and is called from `intentClassifier.js` (line 13) for screen-action detection, producing `SCREEN_ACTION` and `SCREEN_ACTION_MIXED` intent types. |
| **Replacement** | Add to Core Components as a supporting component of the Intent Engine. |

---

## MEMORY SYSTEM

---

### Inaccuracy #14 — All memory module paths wrong

| Field | Content |
|---|---|
| **README line** | Lines 120–124 (Core Components) |
| **Reason incorrect** | Every memory module has moved from `backend/` to `core/memory/`. Confirmed by direct file listing and code inspection. |
| **Replacement** | See Core Components rewrite in the Modernization Plan. |

---

### Inaccuracy #15 — Memory ranking formula is slightly outdated

| Field | Content |
|---|---|
| **README line** | Line 201: `"ranked by importance × 0.4 + confidence × 0.4 + recency × 0.2"` |
| **Reason incorrect** | `core/reasoning/cognitiveEngine.js` (line 56) confirms: `importance * 0.4 + confidence * 0.4 + recency * 0.2`. Formula is **correct** — this is NOT an inaccuracy. ✅ |
| **Replacement** | No change needed. |

---

### Inaccuracy #16 — cognitiveEngine.js path wrong

| Field | Content |
|---|---|
| **README line** | Line 124: `"Cognitive Engine | backend/cognitiveEngine.js"` |
| **Reason incorrect** | File is at `core/reasoning/cognitiveEngine.js`. The cognitive engine also now has a second exported function, `processActionMemory()`, for screen-action-scoped memory queries. |
| **Replacement** | `core/reasoning/cognitiveEngine.js` |

---

### Inaccuracy #17 — data/memory/ directory not documented

| Field | Content |
|---|---|
| **README lines** | Not mentioned anywhere |
| **Reason incorrect** | All memory JSON databases live in `data/memory/` (gitignored, runtime-generated). The README implies memory files live alongside source code in `backend/`. The Phase B data isolation moved all persistent JSON to `data/memory/`. |
| **Replacement** | Add a "Data Isolation" section or note to the memory documentation. |

---

## REASONING / PLANNING

---

### Inaccuracy #18 — plannerEngine.js path wrong

| Field | Content |
|---|---|
| **README line** | Line 127: `"Planner Engine | backend/plannerEngine.js"` |
| **Reason incorrect** | File is at `core/reasoning/plannerEngine.js`. |
| **Replacement** | `core/reasoning/plannerEngine.js` |

---

### Inaccuracy #19 — confirmManager.js path wrong

| Field | Content |
|---|---|
| **README line** | Line 143: `"Confirm Guard | backend/confirmManager.js"` |
| **Reason incorrect** | File is at `core/reasoning/confirmManager.js`. |
| **Replacement** | `core/reasoning/confirmManager.js` |

---

### Inaccuracy #20 — Safety layer not documented at all

| Field | Content |
|---|---|
| **README lines** | Not mentioned |
| **Reason incorrect** | `safety/riskEngine.js` and `safety/confirmationEngine.js` exist. `riskEngine.js` provides a deterministic, tool-aware, action-aware risk evaluation system with LOW/MEDIUM/HIGH/CRITICAL levels, per-action overrides (e.g. `shutdown` → CRITICAL), and full execution logging to `logs/risk.log`. This is a production-grade safety component not mentioned anywhere in the README. |
| **Replacement** | Add "Risk Engine" row to Core Components and a brief Safety Layer section. |

---

## LLM ROUTER

---

### Inaccuracy #21 — llmRouter.js path wrong

| Field | Content |
|---|---|
| **README line** | Line 126: `"LLM Router | backend/llmRouter.js"` |
| **Reason incorrect** | File is at `providers/llm/llmRouter.js`. |
| **Replacement** | `providers/llm/llmRouter.js` |

---

### Inaccuracy #22 — Memory injection scope understated

| Field | Content |
|---|---|
| **README line** | Line 203: `"The LLM router selects the appropriate model based on intent type"` |
| **Reason incorrect** | `providers/llm/llmRouter.js` (lines 100–163) shows memory injection is limited to `model === "llama3" && intent === "GENERAL_QUESTION"`. Cloud models (ChatGPT, Gemini, Groq) do NOT receive memory injection. The README implies memory is always injected for LLM calls. |
| **Replacement** | Clarify: "Memory context blocks ([KNOWN FACTS], [PAST CONVERSATIONS], [PATTERNS ABOUT USER], [RELATED MEMORIES]) are injected only for local llama3 on GENERAL_QUESTION intents. Cloud model calls use prompt + context window only." |

---

## VISION / AGENT

---

### Inaccuracy #23 — Agent paths wrong

| Field | Content |
|---|---|
| **README line** | Line 134–135: `"backend/agent/agentLoop.js"`, `"backend/agent/screenSkills/"` |
| **Reason incorrect** | Files are at `agents/agentLoop.js` and `agents/skills/`. |
| **Replacement** | `agents/agentLoop.js`, `agents/skills/` |

---

### Inaccuracy #24 — screenActionOrchestrator.js path wrong

| Field | Content |
|---|---|
| **README line** | Line 133: `"Screen Orchestrator | backend/screenActionOrchestrator.js"` |
| **Reason incorrect** | File is at `modules/vision/screenActionOrchestrator.js`. |
| **Replacement** | `modules/vision/screenActionOrchestrator.js` |

---

### Inaccuracy #25 — Vision / OCR paths wrong

| Field | Content |
|---|---|
| **README line** | Line 142: `"Vision / OCR | backend/visionRouter.js + ocrRunner.js"` |
| **Reason incorrect** | Files are at `modules/vision/visionRouter.js` and `modules/vision/ocrRunner.js`. |
| **Replacement** | `modules/vision/visionRouter.js` + `modules/vision/ocrRunner.js` |

---

### Inaccuracy #26 — arvsal-vision submodule location and state

| Field | Content |
|---|---|
| **README lines** | Not explicitly documented; implied by `backend/arvsal-vision/` in older migration docs |
| **Reason incorrect** | `arvsal-vision` is a Git submodule at `agents/arvsal-vision/` (git index shows `backend/arvsal-vision` but `.gitmodules` points to `agents/arvsal-vision`). It is the OmniParser submodule (microsoft/OmniParser). Its active integration status should be noted accurately. |
| **Replacement** | Document as: `agents/arvsal-vision/` — OmniParser Git submodule (microsoft/OmniParser), used for UI element detection in the vision pipeline. State: integrated as submodule, vision_worker directory is empty. |

---

## MESSAGING INTEGRATIONS

---

### Inaccuracy #27 — Telegram integration path wrong

| Field | Content |
|---|---|
| **README line** | Line 140: `"Telegram | backend/telegramService.js"` |
| **Reason incorrect** | File is at `integrations/telegram/telegramService.js`. `conversionEngine.js` is also now at `integrations/telegram/conversionEngine.js`. |
| **Replacement** | `integrations/telegram/telegramService.js` |

---

### Inaccuracy #28 — WhatsApp bridge path wrong

| Field | Content |
|---|---|
| **README line** | Line 141: `"WhatsApp | backend/whatsappBridge.js"` |
| **Reason incorrect** | File is at `integrations/whatsapp/whatsappBridge.js`. |
| **Replacement** | `integrations/whatsapp/whatsappBridge.js` |

---

### Inaccuracy #29 — Email fetcher path wrong

| Field | Content |
|---|---|
| **README line** | Lines 131–132: `"backend/email/emailFetcher.js"`, `"backend/email/emailHandler.js"` |
| **Reason incorrect** | Files are at `integrations/email/emailFetcher.js` and `integrations/email/emailHandler.js`. |
| **Replacement** | `integrations/email/emailFetcher.js`, `integrations/email/emailHandler.js` |

---

## TOOLS

---

### Inaccuracy #30 — Tool registry and tool paths wrong

| Field | Content |
|---|---|
| **README lines** | Lines 128–130: `"backend/tools/toolRegistry.js"`, `"backend/tools/n8nTool.js"`, `"backend/tools/desktopTool.js"` |
| **Reason incorrect** | All tools have moved to `tools/`. Files are at `tools/toolRegistry.js`, `tools/n8nTool.js`, `tools/desktopTool.js`, plus new `tools/systemTool.js` and `tools/memoryTool.js`. |
| **Replacement** | All `backend/tools/` references → `tools/`. Add `systemTool.js` and `memoryTool.js` as new entries. |

---

## UTILITIES

---

### Inaccuracy #31 — contactBook.js path wrong

| Field | Content |
|---|---|
| **README line** | Line 137: `"Contact Book | backend/contactBook.js"` |
| **Reason incorrect** | File is at `utils/contactBook.js`. |
| **Replacement** | `utils/contactBook.js` |

---

### Inaccuracy #32 — conversionEngine.js path wrong

| Field | Content |
|---|---|
| **README line** | Line 138: `"Conversion Engine | backend/conversionEngine.js"` |
| **Reason incorrect** | File is at `integrations/telegram/conversionEngine.js`. |
| **Replacement** | `integrations/telegram/conversionEngine.js` |

---

### Inaccuracy #33 — totpManager.js path wrong

| Field | Content |
|---|---|
| **README line** | Line 144: `"Secure Auth | backend/totpManager.js"` |
| **Reason incorrect** | File is at `utils/totpManager.js`. |
| **Replacement** | `utils/totpManager.js` |

---

### Inaccuracy #34 — contentSuggester.js path wrong

| Field | Content |
|---|---|
| **README line** | Line 136: `"Content Suggester | backend/contentSuggester.js"` |
| **Reason incorrect** | File is at `actions/contentSuggester.js`. |
| **Replacement** | `actions/contentSuggester.js` |

---

### Inaccuracy #35 — pathConfig.js not documented

| Field | Content |
|---|---|
| **README lines** | Not mentioned |
| **Reason incorrect** | `utils/pathConfig.js` is the single source of truth for all runtime paths (Whisper, Piper, FFmpeg, NirCmd, temp dirs, memory dir, sessions). It reads from `.env` overrides, falls back to hardcoded `runtime/` paths. It is a critical architectural component. |
| **Replacement** | Add to Core Components or utilities section. |

---

## ELECTRON / MAIN PROCESS

---

### Inaccuracy #36 — main.js path wrong

| Field | Content |
|---|---|
| **README line** | Line 116: `"Wake Word | electron/main.js + .ppn"` |
| **Reason incorrect** | File is at `apps/electron/main.js`. |
| **Replacement** | `apps/electron/main.js` |

---

### Inaccuracy #37 — Ghost Mode not documented

| Field | Content |
|---|---|
| **README lines** | Not mentioned |
| **Reason incorrect** | `apps/electron/main.js` (lines 7, 36–39) implements a `GHOST_MODE` environment switch (`GHOST_MODE=true`). In ghost mode, the backend and wake engine start normally but the Electron UI window is suppressed. This is a headless/server mode feature not documented anywhere. |
| **Replacement** | Add to Installation or Feature section: "Ghost Mode (`GHOST_MODE=true`) — runs backend and wake detection with no Electron UI window." |

---

### Inaccuracy #38 — Global hotkey Ctrl+Shift+A not documented

| Field | Content |
|---|---|
| **README lines** | Not mentioned |
| **Reason incorrect** | `apps/electron/main.js` (lines 197–204) registers `Ctrl+Shift+A` as a global hotkey to focus/show the main window and trigger a voice capture event. |
| **Replacement** | Add to Key Features or Usage section. |

---

## SUBMODULES

---

### Inaccuracy #39 — runtime/whisper not documented as a Git submodule

| Field | Content |
|---|---|
| **README line** | Line 270 (Installation): `"whisper.cpp binary"` |
| **Reason incorrect** | `runtime/whisper` is a Git submodule tracking `ggerganov/whisper.cpp` at a specific commit SHA. It contains full C++ source code, CMakeLists, examples, and bindings. The binary (`whisper-cli.exe`) must be compiled from this source. The README implies a pre-built binary download — it does not mention the submodule or compilation requirement. |
| **Replacement** | Add: `runtime/whisper` is a `git submodule` (ggerganov/whisper.cpp). After cloning, run `git submodule update --init --recursive`. Then compile following whisper.cpp build instructions. |

---

## SUMMARY TABLE

| # | Category | README says | Truth (from code) | Priority |
|---|---|---|---|---|
| 1 | Wake | Porcupine / `.ppn` | `ava-listener` npm / Sherpa-ONNX / JSON profile | 🔴 Critical |
| 2 | Wake | `.ppn` file | No `.ppn` — uses `arvsal.json` profile | 🔴 Critical |
| 3 | Wake | PvRecorder capture | MediaRecorder (Web API) | 🟠 High |
| 4 | STT | No VAD mentioned | Silero VAD gates all Whisper calls | 🔴 Critical |
| 5 | Install | `PICOVOICE_ACCESS_KEY` | Not needed; remove | 🔴 Critical |
| 6 | STT | `backend/whisperManager.js` | `modules/stt/whisperManager.js` | 🟠 High |
| 7 | STT | Always-on streaming live display | VAD-gated, conditional | 🟠 High |
| 8 | STT | "whisper.cpp binary" (pre-built) | Submodule — must compile | 🟠 High |
| 9 | STT | No GPU docs | Battery-aware GPU switching | 🟡 Medium |
| 10 | Intent | `backend/intentClassifier.js` | `core/intent/intentClassifier.js` | 🟠 High |
| 11 | Intent | "40+ intents" | 50+ intents, two-layer system | 🟡 Medium |
| 12 | Intent | No LLM router mentioned | `llmIntentRouter.js` (phi3:mini) | 🟠 High |
| 13 | Intent | No actionIntentDetector | `actionIntentDetector.js` active | 🟡 Medium |
| 14 | Memory | All `backend/` paths | All in `core/memory/` | 🔴 Critical |
| 15 | Memory | Ranking formula | Confirmed correct ✅ | — |
| 16 | Memory | `backend/cognitiveEngine.js` | `core/reasoning/cognitiveEngine.js` | 🟠 High |
| 17 | Memory | Files in backend | Isolated to `data/memory/` | 🟠 High |
| 18 | Reasoning | `backend/plannerEngine.js` | `core/reasoning/plannerEngine.js` | 🟠 High |
| 19 | Reasoning | `backend/confirmManager.js` | `core/reasoning/confirmManager.js` | 🟠 High |
| 20 | Safety | Not mentioned | `safety/riskEngine.js` active | 🟠 High |
| 21 | LLM | `backend/llmRouter.js` | `providers/llm/llmRouter.js` | 🟠 High |
| 22 | LLM | Memory always injected | Only llama3 + GENERAL_QUESTION | 🟡 Medium |
| 23 | Agents | `backend/agent/agentLoop.js` | `agents/agentLoop.js` | 🟠 High |
| 24 | Vision | `backend/screenActionOrchestrator` | `modules/vision/screenActionOrchestrator.js` | 🟠 High |
| 25 | Vision | `backend/visionRouter.js` | `modules/vision/visionRouter.js` | 🟠 High |
| 26 | Vision | arvsal-vision not documented | `agents/arvsal-vision/` submodule | 🟡 Medium |
| 27 | Messaging | `backend/telegramService.js` | `integrations/telegram/telegramService.js` | 🟠 High |
| 28 | Messaging | `backend/whatsappBridge.js` | `integrations/whatsapp/whatsappBridge.js` | 🟠 High |
| 29 | Messaging | `backend/email/` | `integrations/email/` | 🟠 High |
| 30 | Tools | `backend/tools/` | `tools/` | 🟠 High |
| 31 | Utils | `backend/contactBook.js` | `utils/contactBook.js` | 🟠 High |
| 32 | Utils | `backend/conversionEngine.js` | `integrations/telegram/conversionEngine.js` | 🟠 High |
| 33 | Utils | `backend/totpManager.js` | `utils/totpManager.js` | 🟠 High |
| 34 | Utils | `backend/contentSuggester.js` | `actions/contentSuggester.js` | 🟠 High |
| 35 | Utils | Not mentioned | `utils/pathConfig.js` — critical | 🟡 Medium |
| 36 | Electron | `electron/main.js` | `apps/electron/main.js` | 🟠 High |
| 37 | Electron | No Ghost Mode | `GHOST_MODE=true` supported | 🟡 Medium |
| 38 | Electron | No hotkey docs | `Ctrl+Shift+A` global hotkey | 🟡 Medium |
| 39 | Submodule | "whisper.cpp binary" | Git submodule, must compile | 🔴 Critical |
