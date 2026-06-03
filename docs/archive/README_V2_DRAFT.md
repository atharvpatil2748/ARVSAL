# ARVSAL

### Autonomous Response & Virtual System Analysis Layer

> A deterministic, memory-aware personal AI operating system — built for deep OS control, persistent cognition, hallucination-free automation, and n8n-powered workflow intelligence.

---

## Overview

Most AI assistants are stateless, cloud-locked, or incapable of controlling your local machine. **Arvsal** is built to eliminate all three limitations simultaneously.

It runs natively on Windows as an Electron desktop application, backed by a Node.js/Express server. Arvsal sits at the intersection of conversational AI and hard system control — capable of managing your OS, remembering you across sessions, automating on-screen tasks through vision, sending WhatsApp messages to named contacts, processing emails via an n8n intelligence pipeline, and switching between local and cloud AI models at runtime.

**Core philosophy:** Deterministic-first. ~60% of commands never reach an LLM — they are handled instantly by a pure rule-based intent engine. The AI layer is reserved for reasoning, memory synthesis, and tasks that genuinely require it.

---

## Key Features

- **Custom Wake Word** — On-device AVAListener (`ava-listener` npm package, Sherpa-ONNX backend) with JSON-profile configuration. No cloud, no API keys required.
- **Silero VAD Speech Detection** — Advanced Voice Activity Detection via persistent Python worker. Fails-open and gates all STT processing to prevent hallucinated transcriptions from background noise.
- **Hybrid Whisper STT** — Dual-pipeline: small model for fallback/streaming + GPU-accelerated medium model for high-accuracy final transcription.
- **Battery-Aware GPU Switching** — Whisper automatically uses CUDA GPU acceleration when plugged in, and dynamically falls back to CPU-only inference when on battery.
- **Two-Layer Intent System** — 50+ deterministic priority-ordered regex rules (zero LLM latency) backed by a sandboxed, fail-safe LLM intent router (`phi3:mini` with 1.2s timeout) for ambiguous queries.
- **Multi-LLM Routing** — Runtime hot-swapping across Ollama (llama3, deepseek-r1, deepseek-coder, phi3), OpenAI GPT-4, Google Gemini, and Groq — no restart required.
- **4-Layer Persistent Memory** — Semantic facts, episodic events, LLM-derived reflections, and vector embedding store — fused by a cognitive engine.
- **Vision-Driven Screen Automation** — Screenshot → OCR → LLM action plan → execution layer with DPI scaling correction.
- **Screen Skills Sub-System** — Reusable skills for: sending messages, filling forms, navigating, scrolling, and content suggestions.
- **n8n Email Intelligence Pipeline** — Puppeteer-based email fetcher sends inbox data to an n8n webhook for LLM-structured extraction of events, deadlines, and summaries.
- **Content Suggester** — Context-aware typing suggestions generated from screen content, selectable by voice.
- **Named Contact Book** — WhatsApp messages sent by name resolution (`send message to Rahul`) with contacts mapped to WhatsApp IDs.
- **Document Conversion Engine** — Batch-convert images (JPG/PNG), Word/Excel/PowerPoint files, and PDFs into a merged PDF via Telegram.
- **Tool Registry & Safety Layer** — Sandboxed tool execution layer (memory/system/desktop/n8n) protected by a deterministic Risk Engine (LOW/MEDIUM/HIGH/CRITICAL) and Confirmation Guard.
- **Secure Remote Control** — Telegram bot with TOTP 2FA; unauthorized access silently triggers an A-Eye webcam snapshot.
- **WhatsApp VIP Auto-Reply** — Focus mode with missed-message tracking and automatic VIP replies.
- **Offline-First** — Core STT (Whisper), TTS (Piper), and LLM inference (Ollama) run fully locally.
- **Ghost Mode & Hotkeys** — Run headlessly without the Electron UI (`GHOST_MODE=true`), and trigger voice capture instantly via a global `Ctrl+Shift+A` hotkey.

---

## System Architecture

```text
[Microphone / Keyboard]
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
            ├── Small model (fallback / streaming)
            └── Medium model (GPU-accelerated, primary)
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

## Core Components

| Component | File | Role |
|---|---|---|
| Wake Word | `modules/wake/wakeWord.js` | AVAWakeAdapter wrapping `ava-listener`, JSON profile |
| VAD Engine | `modules/stt/vadManager.js` | Python bridge to Silero VAD (persistent + oneshot) |
| Whisper STT | `modules/stt/whisperManager.js` | Whisper.cpp runner (final + small model), battery-aware |
| Intent Engine | `core/intent/intentClassifier.js` | 50+ deterministic rule-based intents, zero LLM latency |
| LLM Intent Router | `core/intent/llmIntentRouter.js` | `phi3:mini` fallback for ambiguous query disambiguation |
| Semantic Memory | `core/memory/semanticMemory.js` | Key-value facts with confidence decay |
| Episodic Memory | `core/memory/episodicMemory.js` | Timestamped events, permanent persistence |
| Reflection Memory | `core/memory/reflectionMemory.js` | Background LLM-derived behavioral insights |
| Vector Store | `core/memory/vectorStore.js` | Float32 embeddings, cosine-similarity search |
| Cognitive Engine | `core/reasoning/cognitiveEngine.js`| Cross-layer memory fusion + ranked retrieval |
| LLM Router | `providers/llm/llmRouter.js` | Multi-provider routing with memory injection |
| Planner Engine | `core/reasoning/plannerEngine.js` | Natural language → JSON action plan (LLM) |
| Risk Engine | `safety/riskEngine.js` | Deterministic action safety evaluation & thresholds |
| Confirm Guard | `core/reasoning/confirmManager.js` | Callback-based confirmation for destructive commands |
| Tool Registry | `tools/toolRegistry.js` | Sandboxed multi-tool executor (memory/system/desktop/n8n) |
| n8n Tool | `tools/n8nTool.js` | Webhook bridge to n8n automation workflows |
| Desktop Tool | `tools/desktopTool.js` | Whitelisted OS actions (click/type/keypress/scroll) |
| Email Fetcher | `integrations/email/emailFetcher.js` | Puppeteer-based IITK webmail scraper |
| Email Handler | `integrations/email/emailHandler.js` | Sends emails to n8n webhook → structured events |
| Screen Orchestrator| `modules/vision/screenActionOrchestrator.js` | Step executor with vision-guided click resolution |
| Agent Loop | `agents/agentLoop.js` | Screenshot → OCR → plan → execute loop |
| Screen Skills | `agents/skills/` | Reusable skills: sendMessage, fillForm, navigate, scroll, suggest |
| Content Suggester | `actions/contentSuggester.js` | Screen-aware typing suggestions, user picks 1/2/3/none |
| Contact Book | `utils/contactBook.js` | Name → WhatsApp ID resolution for contacts |
| Conversion Engine | `integrations/telegram/conversionEngine.js`| Batch PDF merger: images + Office docs + PDFs |
| Telegram | `integrations/telegram/telegramService.js` | Secure remote control with TOTP 2FA |
| WhatsApp | `integrations/whatsapp/whatsappBridge.js`| VIP auto-reply via whatsapp-web.js |
| Vision / OCR | `modules/vision/visionRouter.js` | Tesseract OCR + sharp preprocessing |
| A-Eye Service | `modules/aeye/visualService.js` | Covert webcam snapshot via FFmpeg DirectShow |
| Secure Auth | `utils/totpManager.js` | TOTP verification for remote commands |
| Path Config | `utils/pathConfig.js` | Single source of truth for runtime binaries/folders |

---

## Project Structure

Arvsal V2 is heavily modularized to support robust scaling and clear domain boundaries:

```text
arvsal/
├── apps/                          # Electron desktop application (main & renderer)
├── backend/                       # Express server (orchestration) & Python workers (VAD)
├── core/                          # Cognitive systems
│   ├── intent/                    # Deterministic & LLM intent routers
│   ├── memory/                    # Persistent storage models (Semantic, Episodic, Vector)
│   ├── personality/               # Tone, identity, and LLM behavior overrides
│   └── reasoning/                 # Cognitive Engine, Planner Engine, Confirm Guard
├── providers/                     # LLM orchestration
│   ├── llm/                       # Local LLM routing, prompting, validation
│   └── external/                  # ChatGPT, Gemini, Groq API clients
├── modules/                       # Hardware and media processing
│   ├── wake/                      # Wake word engine adapter
│   ├── stt/                       # Whisper STT and Silero VAD managers
│   ├── vision/                    # Screen capture and OCR processing
│   ├── aeye/                      # Hardware camera access
│   └── reflection/                # Background insight generation
├── agents/                        # Autonomous on-screen automation
│   ├── skills/                    # Specialized execution logic (sendMessage, etc)
│   └── arvsal-vision/             # Git submodule (OmniParser) - Planned/Future integration
├── integrations/                  # Third-party services
│   ├── email/                     # Puppeteer mail fetching
│   ├── telegram/                  # Remote control & PDF conversion
│   └── whatsapp/                  # Auto-reply bridge
├── tools/                         # Sandboxed action executors (System, Desktop, n8n, Memory)
├── safety/                        # Risk Engine & Confirmation state
├── actions/                       # Specialized intent implementations
├── utils/                         # Shared utilities (pathConfig, dateResolver, powerMonitor)
├── data/                          # Data Isolation: Git-ignored memory databases & reflections
└── runtime/                       # Portable Dependency Store
    ├── whisper/                   # Git submodule: ggerganov/whisper.cpp (Source)
    ├── piper/                     # TTS binary + models
    ├── ffmpeg/                    # Audio/video processing
    └── ...                        # Logs, temp files, session states
```

---

## Tech Stack

### Platform
| Layer | Technology |
|---|---|
| Desktop App | Electron v40.1 |
| Backend | Node.js + Express.js (port 3000) |
| IPC | Electron IPC with contextIsolation + preload bridge |
| Language | JavaScript (Node.js), Python (worker scripts) |

### AI & Models
| Component | Technology |
|---|---|
| Wake Word | `ava-listener` npm package (Sherpa-ONNX) |
| VAD Engine | Silero VAD (Python) |
| STT Streaming | whisper.cpp — GGML small model |
| STT Final | whisper.cpp — `ggml-medium.bin` (GPU-accelerated) |
| LLM Intent Router | Ollama `phi3:mini` |
| Local LLM Chat | Ollama `llama3` |
| Local LLM Math | Ollama `deepseek-r1:8b` |
| Local LLM Code | Ollama `deepseek-coder` |
| Local LLM Planner | Ollama `arvsal-planner` (custom fine-tuned) |
| Cloud LLM | OpenAI GPT-4, Google Gemini, Groq (LLaMA 3.1) |
| TTS | Piper TTS `en_US-ryan-high.onnx` — offline neural |
| Embeddings | Ollama embedding model |
| Vision / OCR | Tesseract (`node-tesseract-ocr`) + `sharp` |

### Key Libraries
| Library | Purpose |
|---|---|
| `ava-listener` | On-device Wake Word engine |
| `screenshot-desktop` | Screen capture for vision pipeline |
| `whatsapp-web.js` | WhatsApp Web automation (Puppeteer-based) |
| `puppeteer` | Email scraping + headless browser automation |
| `speakeasy` | TOTP 2FA generation and verification |
| `pdf-lib` + `pdf-merger-js` | PDF creation and batch merging |
| `libreoffice-convert` | Word/Excel/PowerPoint → PDF conversion |
| `sharp` | Image preprocessing for OCR |
| `node-cron` | Scheduled background tasks |
| `node-fetch` | n8n webhook HTTP requests with timeout |

---

## How It Works

**1. Wake** — `ava-listener` detects the custom wake phrase on-device. The renderer activates voice capture.

**2. Detect Speech (VAD)** — The captured audio goes through Silero VAD. Only audio containing detected speech is passed to transcription. (Fail-open: if VAD times out, it passes the audio through).

**3. Transcribe** — Whisper runs (GPU-accelerated if plugged in, CPU if on battery). Parallel streams run for live UI updates (small model) and final accuracy (medium model).

**4. Classify** — The deterministic intent classifier processes the transcription through 50+ priority-ordered rules. If ambiguous (`GENERAL_QUESTION`), the `llmIntentRouter` (`phi3:mini`) attempts to safely disambiguate it.

**5. Route** — System commands execute immediately via tools, gated by the `riskEngine`. Email intents trigger the n8n pipeline. Screen action intents enter the agent loop. Conversational or reasoning intents enter the cognitive pipeline.

**6. Remember** — The cognitive engine queries all four memory stores (semantic, episodic, reflective, vector). Results are ranked by `importance × 0.4 + confidence × 0.4 + recency × 0.2`.

**7. Reason** — The LLM router selects the appropriate model based on intent type. Memory context blocks (`[KNOWN FACTS]`, `[PAST CONVERSATIONS]`, `[PATTERNS]`) are injected for local `llama3` queries to ensure context awareness. Cloud models use prompt + context window.

**8. Act (Screen Agent)** — For screen actions: screenshot → Tesseract OCR → `plannerEngine` generates a structured JSON plan → `riskEngine` approves it → `toolRegistry` routes each step → `skills` execute.

**9. Respond** — Output passes through a personality layer. The response is spoken via Piper TTS and displayed in the Electron UI.

**10. Reflect** — After every 8 conversation turns, a background process uses an LLM to generate behavioral insights about the user stored in reflection memory.

---

## n8n Email Intelligence Pipeline

Arvsal integrates directly with **n8n** for email processing automation:

```text
Voice: "check my emails"
        │
        ▼
integrations/email/emailFetcher.js (Puppeteer)
   → Restores session from cookies.json
   → Scrapes IITK webmail inbox (last 24h)
   → Extracts: sender, subject, date, body (top 5)
        │
        ▼
integrations/email/emailHandler.js
   → POSTs email batch to n8n webhook
     (http://localhost:5678/webhook/email-intelligence)
        │
        ▼
n8n workflow
   → LLM-processes emails
   → Returns structured: { events, deadlines, summary }
        │
        ▼
Arvsal speaks the summary + stores in memory
```

---

## Example Use Cases

| Command | What Arvsal Does |
|---|---|
| `"open chrome"` | Spawns Chrome via `systemTool.js` — zero LLM latency |
| `"remember my stack is React and Node"` | Parses key-value pair, stores in semantic memory (`data/memory/memory.json`) |
| `"what did we talk about yesterday?"` | Queries episodic memory by date range, retrieves and summarizes |
| `"check my emails"` | Fetches inbox via Puppeteer → sends to n8n → speaks structured event summary |
| `"deepseek time"` / `"connect to GPT"` | Hot-swaps active LLM mid-session, no restart |
| `"type a reply in WhatsApp"` | Screenshots screen → OCR → JSON plan → `sendMessageSkill` → OS automation |
| `"suggest a reply"` | `contentSuggester` reads screen text, generates 3 options — user picks 1/2/3 by voice |
| `"send message to Rahul"` | `contactBook` resolves "Rahul" to WhatsApp ID → message sent via whatsapp-web.js |
| `"busy study 90"` | Starts 90-minute focus timer; VIP WhatsApp messages are auto-replied and logged |
| `"analyze screen"` (Telegram) | Takes screenshot, runs OCR + vision model, returns analysis via Telegram |
| `"shutdown"` | Checked by `riskEngine` (CRITICAL), prompts "Are you sure?" before executing |
| PDF batch (Telegram) | Send images/docs to Telegram bot → `conversionEngine` merges into a single PDF |

---

## Installation & Setup

### Prerequisites
- Node.js v18+
- Python 3.10+ (for VAD processing)
- [Ollama](https://ollama.ai) with desired models pulled (`llama3`, `phi3:mini`, `deepseek-r1:8b`, `deepseek-coder`)
- [Piper TTS](https://github.com/rhasspy/piper) binary placed in `runtime/piper/`
- FFmpeg on system PATH
- Tesseract OCR installed
- [n8n](https://n8n.io) instance running locally (port 5678) for workflows

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/your-username/arvsal.git
cd arvsal
```

**2. Initialize Submodules & Build Whisper**
Arvsal relies on `whisper.cpp` included as a git submodule.
```bash
git submodule update --init --recursive
cd runtime/whisper
cmake -B build -DWHISPER_CUBLAS=1 
cmake --build build --config Release
cd ../..
```
*(Download `ggml-small.bin` and `ggml-medium.bin` into `runtime/whisper/models/`)*

**3. Install dependencies**
```bash
npm install
```
*(This automatically installs `ava-listener` and sets up the Node environment)*

**4. Configure environment variables**
Create a `.env` file in the project root:
```env
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
TELEGRAM_BOT_TOKEN=your_telegram_token
TELEGRAM_CHAT_ID=your_chat_id
TOTP_SECRET=your_totp_secret
N8N_WEBHOOK_URL=http://localhost:5678/webhook/your-workflow
```

**5. Launch the application**
```bash
npm start
```
This boots the Electron desktop app and the Express backend server on port 3000 simultaneously.

*(Optional: Run `GHOST_MODE=true npm start` for headless execution without the UI.)*

---

## Future Improvements

- **Multi-user support** — Per-user memory namespacing and profile switching
- **OmniParser Vision Integration** — Activate the `agents/arvsal-vision` submodule for precise UI element detection
- **Mobile companion app** — Remote voice input and notification forwarding
- **Proactive notifications** — Pattern-based alerts from reflection memory
- **Plugin architecture** — Sandboxed skill modules loadable at runtime without restart

---

## Why This Project Matters

Arvsal is not a chatbot wrapper. It is a full-stack AI systems engineering project that spans:

- **Speech processing** — Dual-pipeline STT, Silero VAD gating, custom AVAListener wake engine
- **AI orchestration** — Multi-provider LLM routing, memory injection, output validation
- **Memory systems** — 4-layer persistent, data-isolated memory with vector retrieval
- **Agentic automation** — Plan generation, vision-guided execution, tool registries
- **Safety engineering** — Deterministic risk evaluation, action whitelisting, TOTP 2FA, confirmation guards
- **Workflow automation** — n8n integration for email intelligence
- **Messaging integration** — WhatsApp named-contact messaging, VIP auto-reply, Telegram remote control

Every component was built from scratch with production-grade principles: graceful degradation, no single point of failure, strict environment configs (`pathConfig.js`), and a deterministic-first design to eliminate hallucination from high-stakes system commands.

---

## License

**© 2026 Atharv. All rights reserved.**  
Proprietary software. Redistribution, modification, or commercial use without explicit written permission is strictly prohibited.
