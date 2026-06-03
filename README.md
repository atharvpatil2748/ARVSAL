# ARVSAL

### Autonomous Response & Virtual System Analysis Layer

> A deterministic, memory-aware personal AI operating system — built for deep OS control, persistent cognition, hallucination-free automation, and n8n-powered workflow intelligence.

---

## Why ARVSAL Is Different

Most AI assistants are stateless, cloud-locked, or incapable of executing raw system commands safely. Arvsal eliminates these limitations through a hybrid architecture designed for extreme reliability and local control:

1. **Deterministic-First Architecture**: Over 60% of interactions never reach an LLM. High-stakes actions (shutting down, modifying files, opening apps) are handled by a 50+ rule regex intent engine for zero latency and zero hallucination.
2. **Safety-Gated Automation**: System actions are sandboxed inside a `toolRegistry` and evaluated by a deterministic `riskEngine`. Critical actions require explicit callback confirmation.
3. **Local-First Inference**: Core STT (Whisper), Wake Word (AVAListener), TTS (Piper), and primary inference (Ollama) run entirely on-device.
4. **Memory-First Cognition**: Four distinct, cross-pollinating memory systems (Semantic, Episodic, Vector, and Reflective) allow Arvsal to remember you, recall exact conversations by date, and passively deduce behavioral patterns over time.
5. **Agentic Desktop Control**: Arvsal doesn't just chat. It screenshots your screen, parses it with Tesseract OCR, generates a JSON step-by-step plan using a custom fine-tuned `arvsal-planner`, and clicks/types exactly where needed.
6. **Hallucination-Resistant Voice Pipeline**: A persistent Silero VAD (Voice Activity Detection) Python worker pre-screens all audio. If it's just background noise, Whisper is never invoked—eliminating "ghost transcriptions."

---

## Key Features

- **Custom Wake Word** — On-device AVAListener (via Sherpa-ONNX) with JSON-profile configuration. No cloud, no API keys required.
- **Silero VAD Speech Detection** — Fails-open and gates all STT processing to prevent hallucinated transcriptions from background noise.
- **Hybrid Whisper STT** — Dual-pipeline: small model for streaming + GPU-accelerated medium model for final transcription.
- **Battery-Aware GPU Switching** — Whisper automatically uses CUDA GPU acceleration when plugged in, and dynamically falls back to CPU-only inference when on battery.
- **Two-Layer Intent System** — 50+ deterministic rules backed by a sandboxed, fail-safe LLM intent router (`phi3:mini` with 1.2s timeout) for ambiguous queries.
- **Multi-LLM Routing** — Runtime hot-swapping across Ollama (`llama3`, `deepseek-r1`, `deepseek-coder`), OpenAI GPT-4, Google Gemini, and Groq — no restart required.
- **4-Layer Persistent Memory** — Semantic facts, episodic events, LLM-derived reflections, and vector embeddings (`nomic-embed-text`) — fused by a cognitive engine.
- **Vision-Driven Screen Automation** — Screenshot → OCR → LLM action plan → execution layer with DPI scaling correction.
- **Screen Skills Sub-System** — Reusable skills for: sending messages, filling forms, navigating, scrolling, and content suggestions.
- **n8n Email Intelligence Pipeline** — Puppeteer-based email fetcher sends inbox data to an n8n webhook for LLM-structured extraction of events and deadlines.
- **Named Contact Book** — WhatsApp messages sent by name resolution (`send message to Rahul`) with contacts mapped to WhatsApp IDs.
- **Document Conversion Engine** — Batch-convert images (JPG/PNG), Office documents, and PDFs into a merged PDF via Telegram.
- **Secure Remote Control** — Telegram bot with TOTP 2FA; unauthorized access silently triggers an A-Eye webcam snapshot.
- **WhatsApp VIP Auto-Reply** — Focus mode with missed-message tracking and automatic VIP replies.
- **Ghost Mode & Hotkeys** — Run headlessly without the Electron UI (`GHOST_MODE=true`), and trigger voice capture instantly via a global `Ctrl+Shift+A` hotkey.

---

## System Architecture

```text
[Microphone / Keyboard]
      │
      ▼
[AVAListener — ava-listener npm + Sherpa-ONNX]
   Always-on wake phrase detection (on-device, no cloud)
      │
      ▼ wake event
[apps/electron/main.js — IPC Bridge]
   Forwards arvsal:wake to renderer
      │
      ▼
[apps/renderer — MediaRecorder]
   Captures WebM audio, sends to backend via IPC
      │
      ▼
[Silero VAD — modules/stt/vadManager.js → python_worker/vad_worker.py]
   Speech presence check (threshold, min speech duration)
      │
      ├── REJECT (silence / noise) → discard
      │
      └── PASS → Whisper STT
            │
            ├── Small model (fallback / streaming)
            └── Medium model (GPU-accelerated, primary)
                Battery-aware: --no-gpu when on battery
      │
      ▼
[Deterministic Intent Classifier — core/intent/intentClassifier.js]
   Priority-ordered regex rule engine (50+ intents)
      │
      ├── If GENERAL_QUESTION: optional LLM assist
      │   [LLM Intent Router — phi3:mini, sandboxed]
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
   │  EMAIL      → n8n        │  5. applyPersonality()     │
   │  SCREEN_ACTION →         │                            │
   │    agents/agentLoop.js → │                            │
   │    plannerEngine.js →    │                            │
   │    safety/riskEngine.js→ │                            │
   │    tools/toolRegistry    │                            │
   └──────────────────────────┴────────────────────────────┘
      │
      ▼
[RESPONSE] → core/memory/chatHistory.js
           + core/memory/episodicMemory.js
           + modules/reflection/reflectionTrigger.js (background)
      │
      ▼
[TTS — Piper (en_US-ryan-high.onnx)] → runtime/temp/tts/arvsal.wav
```

---

## Core Components

| Component | File | Role |
|---|---|---|
| Wake Word | `modules/wake/wakeWord.js` | AVAWakeAdapter wrapping `ava-listener`, JSON profile |
| VAD Engine | `modules/stt/vadManager.js` | Python bridge to Silero VAD (persistent + oneshot) |
| Whisper STT | `modules/stt/whisperManager.js` | Whisper.cpp runner, battery-aware GPU toggling |
| Intent Engine | `core/intent/intentClassifier.js` | 50+ deterministic rule-based intents |
| LLM Intent Router | `core/intent/llmIntentRouter.js` | `phi3:mini` fallback for query disambiguation |
| Memory System | `core/memory/*.js` | Semantic, Episodic, Vector, Reflection stores |
| Cognitive Engine | `core/reasoning/cognitiveEngine.js`| Cross-layer memory fusion + ranked retrieval |
| LLM Router | `providers/llm/llmRouter.js` | Multi-provider routing with memory injection |
| Planner Engine | `core/reasoning/plannerEngine.js` | Natural language → JSON action plan (LLM) |
| Risk Engine | `safety/riskEngine.js` | Deterministic action safety evaluation & thresholds |
| Tool Registry | `tools/toolRegistry.js` | Sandboxed executor (memory/system/desktop/n8n) |
| Email / n8n | `integrations/email/` | Webmail scraping → n8n webhook routing |
| Agent Loop | `agents/agentLoop.js` | Screenshot → OCR → plan → execute loop |
| Content Suggester | `actions/contentSuggester.js` | Screen-aware typing suggestions (voice selectable) |
| Telegram / TOTP | `integrations/telegram/` | Secure remote control, batch PDF conversion |
| Path Config | `utils/pathConfig.js` | Single source of truth for runtime binaries/folders |

---

## Project Structure

Arvsal V2 is heavily modularized to support robust scaling and domain isolation:

```text
arvsal/
├── apps/                          # Electron desktop application (main & renderer)
├── backend/                       # Express server & Python workers (VAD)
├── core/                          # Cognitive systems (Intent, Memory, Reasoning, Personality)
├── providers/                     # LLM orchestration (Local models, ChatGPT, Gemini, Groq)
├── modules/                       # Hardware (Wake, STT, Vision, A-Eye, Reflection)
├── agents/                        # Autonomous screen automation & OmniParser submodule
├── integrations/                  # Third-party services (Email, Telegram, WhatsApp)
├── tools/                         # Sandboxed action executors
├── safety/                        # Risk Engine & Confirmation state
├── actions/                       # Specialized intent implementations
├── utils/                         # Utilities (pathConfig, powerMonitor, totpManager)
├── data/memory/                   # Git-ignored persistent memory databases
└── runtime/                       # Portable Dependency Store (Whisper, Piper, FFmpeg, logs)
```

---

## Tech Stack

### AI & Models
| Component | Technology |
|---|---|
| Wake Word | `ava-listener` npm package (Sherpa-ONNX) |
| VAD Engine | Silero VAD (Python) |
| STT Final | whisper.cpp — `ggml-medium.bin` (GPU-accelerated) |
| Intent Disambiguation| Ollama `phi3:mini` |
| Local Chat | Ollama `llama3` |
| Local Math / Code | Ollama `deepseek-r1:8b`, `deepseek-coder` |
| Local Planner | Ollama `arvsal-planner` (custom fine-tuned) |
| Cloud LLMs | OpenAI GPT-4, Google Gemini, Groq (LLaMA 3.1) |
| TTS | Piper TTS `en_US-ryan-high.onnx` — offline neural |
| Embeddings | Ollama `nomic-embed-text` |

### Key Libraries
- **Desktop/Browser Automation**: `robotjs`, `puppeteer`, `whatsapp-web.js`
- **Vision/Media**: `screenshot-desktop`, `sharp`, `node-tesseract-ocr`, `pdf-lib`
- **Security**: `speakeasy` (TOTP 2FA)

---

## Example Use Cases

| Command | What Arvsal Does |
|---|---|
| `"open chrome"` | Spawns Chrome via `systemTool.js` — zero LLM latency |
| `"remember my stack is React"`| Parses key-value pair, stores in semantic memory (`data/memory/memory.json`) |
| `"what did we talk about yesterday?"`| Queries episodic memory by date range, retrieves and summarizes |
| `"check my emails"` | Puppeteer scrapes inbox → sends to n8n webhook → speaks structured summary |
| `"deepseek time"` | Hot-swaps active LLM mid-session, no restart required |
| `"type a reply in WhatsApp"` | Screenshots screen → OCR → JSON plan → `sendMessageSkill` → OS automation |
| `"suggest a reply"` | Reads screen text, generates 3 options — user picks 1/2/3 by voice |
| `"send message to Rahul"` | Resolves "Rahul" to WhatsApp ID → message sent natively |
| `"shutdown"` | Checked by `riskEngine` (CRITICAL), prompts "Are you sure?" before executing |

---

## Installation & Setup

### Prerequisites
- Node.js v18+
- Python 3.10+ (for VAD processing)
- [Ollama](https://ollama.ai) with models (`llama3`, `phi3:mini`, `arvsal-planner`, `nomic-embed-text`)
- [Piper TTS](https://github.com/rhasspy/piper) binary placed in `runtime/piper/`
- FFmpeg on system PATH
- Tesseract OCR installed

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/your-username/arvsal.git
cd arvsal
```

**2. Initialize Submodules & Build Whisper**
Arvsal relies on `whisper.cpp` included as a Git submodule.
```bash
git submodule update --init --recursive
cd runtime/whisper
cmake -B build -DWHISPER_CUBLAS=1 
cmake --build build --config Release
cd ../..
```
*(Place `ggml-small.bin` and `ggml-medium.bin` into `runtime/whisper/models/`)*

**3. Install dependencies**
```bash
npm install
```

**4. Configure environment variables (`.env`)**
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
*(Run `GHOST_MODE=true npm start` for headless execution without the Electron UI.)*

---

## Future Improvements
- **OmniParser Vision Integration** — The `agents/arvsal-vision` submodule (Microsoft OmniParser) is currently active via a standalone Gradio interface; full integration into the core `agentLoop.js` is planned for pixel-perfect UI element detection.
- **Multi-user support** — Per-user memory namespacing and profile switching.
- **Plugin architecture** — Sandboxed skill modules loadable at runtime.

---

## License

**© 2026 Atharv. All rights reserved.**  
Proprietary software. Redistribution, modification, or commercial use without explicit written permission is strictly prohibited.
