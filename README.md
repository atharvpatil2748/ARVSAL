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

- **Custom Wake Word** — On-device Picovoice Porcupine model trained specifically on the word "Arvsal"
- **Hybrid Whisper STT** — Dual-pipeline: small model for real-time streaming + GPU-accelerated medium model for high-accuracy final transcription
- **Deterministic Intent Engine** — 40+ priority-ordered regex rules with zero LLM latency for system commands
- **Multi-LLM Routing** — Runtime hot-swapping across Ollama (llama3, deepseek-r1, deepseek-coder, phi3), OpenAI GPT-4, Google Gemini, and Groq — no restart required
- **4-Layer Persistent Memory** — Semantic facts, episodic events, LLM-derived reflections, and vector embedding store — fused by a cognitive engine
- **Vision-Driven Screen Automation** — Screenshot → OCR → LLM action plan → robotjs execution with DPI scaling correction
- **Screen Skills Sub-System** — Reusable skills for: sending messages, filling forms, navigating, scrolling, and content suggestions
- **n8n Email Intelligence Pipeline** — Puppeteer-based email fetcher sends inbox data to an n8n webhook for LLM-structured extraction of events, deadlines, and summaries
- **Content Suggester** — Context-aware typing suggestions generated from screen content, selectable by voice (1/2/3/none)
- **Named Contact Book** — WhatsApp messages sent by name resolution (`send message to Rahul`) with 100+ contacts mapped to WhatsApp IDs
- **Document Conversion Engine** — Batch-convert images (JPG/PNG), Word/Excel/PowerPoint files, and PDFs into a merged PDF via Telegram
- **Tool Registry** — Sandboxed tool execution layer (memory / system / desktop / n8n) with action whitelisting and execution logging
- **Secure Remote Control** — Telegram bot with TOTP 2FA; unauthorized access silently triggers an A-Eye webcam snapshot
- **WhatsApp VIP Auto-Reply** — Focus mode with missed-message tracking and automatic VIP replies
- **Topic Tracker** — Conversation context tracker with confidence decay and 10-minute TTL
- **Confirmation Guard** — Destructive commands (shutdown, restart, sleep) always require explicit confirmation
- **Offline-First** — Core STT (Whisper), TTS (Piper), and LLM inference (Ollama) run fully locally

---

## System Architecture

```
[Microphone / Keyboard]
        │
        ▼
[WAKE WORD — Picovoice Porcupine (.ppn)]
   Custom-trained model, always-on background loop
        │
        ▼
[AUDIO CAPTURE — MediaRecorder / PvRecorder]
        │
   WebM → PCM dual-stream:
   ┌──────────────────────────────────────┐
   │  STREAMING  (real-time UI feedback)  │ → /audio/pcm → whisper.cpp small model
   │  Chunks every ~500ms                 │   → live transcription display
   └──────────────────────────────────────┘
   ┌──────────────────────────────────────┐
   │  FINAL  (high accuracy)              │ → /audio/final → whisper.cpp medium model
   │  Full recording on silence detection │   (GPU-accelerated, ggml-medium.bin)
   └──────────────────────────────────────┘
        │
        ▼
[FFmpeg — WebM → WAV 16kHz mono] → size guard (<40KB = silence, rejected)
        │
        ▼
[TRANSCRIPTION] → stripWakeWord() → normalize() → cleanNormalizedText
        │
        ▼
[DETERMINISTIC INTENT CLASSIFIER — intentClassifier.js]
   Zero LLM. Priority-ordered rule engine (40+ intents):
   CONFIRM_YES/NO → AI_MODE → MEMORY_OPS → TIME/WEATHER/NEWS →
   SCREEN_ACTION → SEARCH/YOUTUBE → APPS → SMALLTALK → GENERAL_QUESTION
        │
        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                   ROUTING SWITCH (server.js)                  │
   ├───────────────────────────┬──────────────────────────────────┤
   │  NON-LLM INTENTS          │  LLM INTENTS                     │
   │  (immediate execution)    │  (cognitive pipeline)            │
   │                           │                                  │
   │  OPEN_APP   → spawn       │  1. cognitiveEngine              │
   │  VOLUME     → nircmd      │     (4-layer memory fusion)      │
   │  SHUTDOWN   → confirm     │  2. llmRouter (model select)     │
   │  SEARCH     → browser     │  3. Prompt assembly              │
   │  WHATSAPP   → contactBook │  4. LLM inference                │
   │  EMAIL      → emailFetcher│  5. Output validation            │
   │               → n8n       │  6. applyPersonality()           │
   │  SCREEN_ACTION →          │                                  │
   │    agentLoop →            │                                  │
   │    plannerEngine →        │                                  │
   │    screenOrchestrator →   │                                  │
   │    screenSkills / tools   │                                  │
   └───────────────────────────┴──────────────────────────────────┘
        │
        ▼
[PERSONALITY LAYER] → zero-latency post-process (no LLM)
        │
        ▼
[RESPONSE] → chatHistory + episodicMemory → maybeRunReflection()
             topicTracker.setActiveTopic()
        │
        ▼
[TTS — Piper (en_US-ryan-high.onnx)] → WAV → PowerShell playback
        │
        ▼
[ELECTRON UI — text display + audio]
```

---

## Core Components

| Component | File | Role |
|---|---|---|
| Wake Word | `electron/main.js` + `.ppn` | Custom Porcupine model, always-on wake loop |
| STT Streaming | `backend/server.js /audio/pcm` | whisper.cpp small model, real-time chunks |
| STT Final | `backend/whisperManager.js` | whisper.cpp medium model, GPU-accelerated |
| Intent Engine | `backend/intentClassifier.js` | 40+ rule-based intents, zero LLM |
| Semantic Memory | `backend/memory.js` | Key-value facts with confidence decay |
| Episodic Memory | `backend/episodicMemory.js` | Timestamped events, permanent persistence |
| Reflection Memory | `backend/reflectionMemory.js` + `reflectionRunner.js` | Background LLM-derived behavioral insights |
| Vector Store | `backend/vectorStore.js` | Float32 embeddings, cosine-similarity search |
| Cognitive Engine | `backend/cognitiveEngine.js` | Cross-layer memory fusion + ranked retrieval |
| Topic Tracker | `backend/topicTracker.js` | Active conversation topic with 10-min TTL + decay |
| LLM Router | `backend/llmRouter.js` | Multi-provider routing with memory injection |
| Planner Engine | `backend/plannerEngine.js` | Natural language → JSON action plan (LLM) |
| Tool Registry | `backend/tools/toolRegistry.js` | Sandboxed multi-tool executor (memory/system/desktop/n8n) |
| n8n Tool | `backend/tools/n8nTool.js` | Webhook bridge to n8n automation workflows |
| Desktop Tool | `backend/tools/desktopTool.js` | Whitelisted robotjs actions (click/type/keypress/scroll) |
| Email Fetcher | `backend/email/emailFetcher.js` | Puppeteer-based IITK webmail scraper with session restore |
| Email Handler | `backend/email/emailHandler.js` | Sends emails to n8n webhook → structured events/deadlines |
| Screen Orchestrator | `backend/screenActionOrchestrator.js` | Step executor with vision-guided click resolution |
| Agent Loop | `backend/agent/agentLoop.js` | Screenshot → OCR → plan → execute loop |
| Screen Skills | `backend/agent/screenSkills/` | Reusable skills: sendMessage, fillForm, navigate, scroll, suggest |
| Content Suggester | `backend/contentSuggester.js` | Screen-aware typing suggestions, user picks 1/2/3/none |
| Contact Book | `backend/contactBook.js` | Name → WhatsApp ID resolution for 100+ contacts |
| Conversion Engine | `backend/conversionEngine.js` | Batch PDF merger: images + Office docs + PDFs via LibreOffice |
| TTS | `/speak` endpoint + Piper binary | Offline neural voice synthesis |
| Telegram | `backend/telegramService.js` | Secure remote control with TOTP 2FA |
| WhatsApp | `backend/whatsappBridge.js` | VIP auto-reply via whatsapp-web.js |
| Vision / OCR | `backend/visionRouter.js` + `ocrRunner.js` | Tesseract OCR + sharp preprocessing |
| Confirm Guard | `backend/confirmManager.js` | Callback-based confirmation for destructive commands |
| Secure Auth | `backend/totpManager.js` | TOTP verification + A-Eye unauthorized access trap |

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
| Wake Word | Picovoice Porcupine — custom-trained `.ppn` model |
| STT Streaming | whisper.cpp — GGML small model |
| STT Final | whisper.cpp — `ggml-medium.bin` (GPU-accelerated) |
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
| `robotjs` | Native OS mouse/keyboard automation |
| `screenshot-desktop` | Screen capture for vision pipeline |
| `whatsapp-web.js` | WhatsApp Web automation (Puppeteer-based) |
| `puppeteer` | Email scraping + headless browser automation |
| `speakeasy` | TOTP 2FA generation and verification |
| `pdf-lib` + `pdf-merger-js` | PDF creation and batch merging |
| `libreoffice-convert` | Word/Excel/PowerPoint → PDF conversion |
| `sharp` | Image preprocessing for OCR |
| `node-cron` | Scheduled background tasks |
| `node-fetch` | n8n webhook HTTP requests with timeout |
| `@google/generative-ai` | Gemini API client |
| `openai` | OpenAI API client |

---

## How It Works

**1. Wake** — Porcupine detects the custom wake word "Arvsal" on-device. The renderer activates voice capture.

**2. Transcribe** — Audio streams in parallel: the small Whisper model shows live text; the medium model produces accurate final output when silence is detected.

**3. Classify** — The deterministic intent classifier processes the transcription through 40+ priority-ordered rules. No LLM involved at this stage.

**4. Route** — System commands (apps, volume, shutdown, search) execute immediately. Email intents trigger the n8n pipeline. Screen action intents enter the agent loop. Conversational or reasoning intents enter the cognitive pipeline.

**5. Remember** — The cognitive engine queries all four memory stores (semantic, episodic, reflective, vector). Results are ranked by `importance × 0.4 + confidence × 0.4 + recency × 0.2` and injected into the LLM prompt.

**6. Reason** — The LLM router selects the appropriate model based on intent type and active AI provider. The prompt includes structured memory context blocks: `[KNOWN FACTS]`, `[PAST CONVERSATIONS]`, `[PATTERNS ABOUT USER]`.

**7. Act (Screen Agent)** — For screen actions: screenshot → Tesseract OCR → `plannerEngine` generates a structured JSON plan → `toolRegistry` routes each step to desktop/memory/system/n8n tool → `screenSkills` (sendMessage, fillForm, navigate, etc.) execute via robotjs.

**8. Respond** — Output passes through a personality layer and output guard filters. The response is spoken via Piper TTS and displayed in the Electron UI.

**9. Track** — `topicTracker` updates the active conversation topic with confidence scoring and 10-minute TTL decay.

**10. Reflect** — After every 8 conversation turns, a background process (fire-and-forget, `setImmediate`) uses an LLM to generate behavioral insights about the user stored in reflection memory — without ever delaying a response.

---

## n8n Email Intelligence Pipeline

Arvsal integrates directly with **n8n** for email processing automation:

```
Voice: "check my emails"
        │
        ▼
emailFetcher.js (Puppeteer)
   → Restores session from cookies.json
   → Scrapes IITK webmail inbox (last 24h)
   → Extracts: sender, subject, date, body (top 5)
        │
        ▼
emailHandler.js
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

The `n8nTool.js` in the tool registry also forwards structured automation requests to n8n from within the screen agent pipeline, with a 15-second timeout and execution logging.

---

## Example Use Cases

| Command | What Arvsal Does |
|---|---|
| `"open chrome"` | Spawns Chrome via `child_process.spawn` — zero LLM |
| `"remember my stack is React and Node"` | Parses key-value pair, stores in semantic memory with confidence score |
| `"what did we talk about yesterday?"` | Queries episodic memory by `dayKey`, retrieves and summarizes relevant episodes |
| `"check my emails"` | Fetches inbox via Puppeteer → sends to n8n → speaks structured event/deadline summary |
| `"deepseek time"` / `"connect to GPT"` | Hot-swaps active LLM mid-session, no restart |
| `"type a reply in WhatsApp"` | Screenshots screen → OCR → JSON plan → `sendMessageSkill` → robotjs executes |
| `"suggest a reply"` | `contentSuggester` reads screen text, generates 3 options — user picks 1/2/3 by voice |
| `"send message to Rahul"` | `contactBook` resolves "Rahul" to WhatsApp ID → message sent via whatsapp-web.js |
| `"busy study 90"` | Starts 90-minute focus timer; VIP WhatsApp messages are auto-replied and logged |
| `"analyze screen"` (Telegram) | Takes screenshot, runs OCR + vision model, returns analysis via Telegram |
| `"shutdown"` | Stores callback in `confirmManager`, prompts "Are you sure?" before executing |
| PDF batch (Telegram) | Send images/docs to Telegram bot → `conversionEngine` merges into a single PDF |

---

## Installation & Setup

### Prerequisites
- Node.js v18+
- [Ollama](https://ollama.ai) with desired models pulled (`llama3`, `deepseek-r1:8b`, `deepseek-coder`)
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) binary with `ggml-medium.bin` model
- [Piper TTS](https://github.com/rhasspy/piper) binary with `en_US-ryan-high.onnx` model
- FFmpeg on system PATH
- Tesseract OCR installed
- [n8n](https://n8n.io) instance running locally (port 5678) for email intelligence workflows

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/your-username/arvsal.git
cd arvsal
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure environment variables**

Create a `.env` file in the project root:
```env
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
TELEGRAM_BOT_TOKEN=your_telegram_token
TELEGRAM_CHAT_ID=your_chat_id
TOTP_SECRET=your_totp_secret
PICOVOICE_ACCESS_KEY=your_picovoice_key
N8N_WEBHOOK_URL=http://localhost:5678/webhook/your-workflow
```

**4. Launch the application**
```bash
npm start
```

This boots the Electron desktop app (wake word detection + UI) and the Express backend server on port 3000 simultaneously.

---

## Future Improvements

- **Multi-user support** — Per-user memory namespacing and profile switching
- **Mobile companion app** — Remote voice input and notification forwarding
- **Proactive notifications** — Pattern-based alerts from reflection memory (e.g., "You usually start studying at this time")
- **Plugin architecture** — Sandboxed skill modules loadable at runtime without restart
- **Expanded n8n workflows** — Calendar sync, GitHub notifications, and task queue management
- **Agent recovery** — Multi-step automation with self-healing on step failure

---

## Why This Project Matters

Arvsal is not a chatbot wrapper. It is a full-stack AI systems engineering project that spans:

- **Speech processing** — Dual-pipeline STT, custom wake word, offline TTS
- **AI orchestration** — Multi-provider LLM routing, prompt engineering, output validation
- **Memory systems** — 4-layer persistent memory with vector retrieval (graduate-level AI design)
- **Agentic automation** — Plan generation, vision-guided execution, screen skills, DPI correction
- **Workflow automation** — n8n integration for email intelligence and structured event extraction
- **Document processing** — Batch image/Office/PDF conversion to merged PDF via LibreOffice
- **Security engineering** — TOTP 2FA, A-Eye unauthorized-access photography, command gating
- **Messaging integration** — WhatsApp named-contact messaging, VIP auto-reply, Telegram remote control

Every component was built from scratch with production-grade principles: graceful degradation, no single point of failure, sandboxed tool execution, action whitelisting, and deterministic-first design to eliminate hallucination from high-stakes commands.

---

## License

**© 2026 Atharv. All rights reserved.**  
Proprietary software. Redistribution, modification, or commercial use without explicit written permission is strictly prohibited.
