# ARVSAL — .gitignore Analysis Report

> Generated: 2026-05-30 · Total repo size on disk: **~26.4 GB** across 106,682 files

---

## 1. Repository Stack Detected

| Category | Detected |
|---|---|
| **Languages** | JavaScript (Node.js), Python 3.x, HTML/CSS, C++ (whisper.cpp) |
| **Runtime** | Electron v40, Node.js |
| **Frameworks** | Express.js, WhatsApp-Web.js, Puppeteer |
| **Package Manager** | npm (package.json + package-lock.json) |
| **Python Env** | venv (arvsal-vision/venv, AVA-Listener/venv) |
| **Build System** | CMake (whisper.cpp/build) |
| **AI Models** | Whisper GGML/GGUF, OmniParser (Florence/YOLO), HuggingFace NLLB-600M, Sherpa-ONNX, Silero VAD, YOLOv8 |
| **Local LLM** | Ollama (phi3:mini, intent/personality models) |
| **CUDA** | Yes — torch_cuda.dll, cuBLAS, cuDNN, cuFFT, cuSolver, cuRAND |
| **Secrets** | `.env` with GROQ, OpenAI, Gemini, GNews, Telegram API keys |
| **WhatsApp Auth** | `.wwebjs_auth/` session (Chromium profile + cookies) |
| **IDE** | VS Code (`.vscode/` folders) |

---

## 2. Files / Folders > 25 MB — BLOCKED from GitHub

> GitHub hard limit = 100 MB/file · Soft warning = 50 MB

| Size | File |
|---|---|
| **2,952 MB** | `whisper.cpp/models/ggml-large-v3.bin` |
| **1,779 MB** | `node_modules/@huggingface/.../decoder_model.onnx` |
| **1,582 MB** | `node_modules/@huggingface/.../encoder_model.onnx` |
| **1,549 MB** | `whisper.cpp/models/ggml-large-v3-turbo.bin` |
| **1,463 MB** | `whisper.cpp/models/ggml-medium.bin` |
| **1,034 MB** | `backend/arvsal-vision/weights/icon_caption_florence/model.safetensors` |
| **885 MB** | `venv/.../torch_cuda.dll` |
| **667 MB** | HuggingFace ONNX decoder variants (x6) |
| **624 MB** | `venv/.../dnnl.lib` |
| **562 MB** | `venv/.../cudnn_engines_precompiled64_9.dll` |
| **514 MB** | `venv/.../cublasLt64_12.dll` |
| **465 MB** | `whisper.cpp/ggml-small.en.bin` (3 duplicate copies!) |
| **363 MB** | `.wwebjs_auth/` WhatsApp Code Cache |
| **296 MB** | `AVA-Listener/models/sherpa-onnx-*.tar.bz2` |
| **250 MB** | `venv/.../cusparse64_12.dll` |
| **249 MB** | `AVA-Listener/models/encoder.onnx` |
| **238 MB** | `venv/.../torch_cpu.dll` |
| **204 MB** | `node_modules/electron/dist/electron.exe` |
| **117 MB** | `whisper.cpp/build/bin/ggml-cuda.dll` |
| **128 MB** | `venv/.../libpaddle.pyd` |

> [!CAUTION]
> There are **3 duplicate copies** of `ggml-small.en.bin` in the repo (whisper.cpp root, models/, and models/). These alone consume 1.4 GB. Consider consolidating them.

---

## 3. Secrets & Credentials Found

| File | Risk | Status |
|---|---|---|
| `.env` | **CRITICAL** — GROQ, OpenAI, Gemini, Telegram tokens | Ignored |
| `backend/totp_secret.json` | **CRITICAL** — TOTP/2FA secret key | Ignored |
| `cookies.json` | **HIGH** — WhatsApp auth cookie | Ignored |
| `.wwebjs_auth/` | **HIGH** — Full WhatsApp Chromium session (QR bypass) | Ignored |
| `backend/profiles/*.json` | **MEDIUM** — may contain personal conversation data | Ignored |

> [!WARNING]
> The `.env` file contains **live API keys** for 5 external services. Since `git init` just ran, these have **never been committed** — you are safe. Ensure they stay that way forever.

---

## 4. Generated Runtime Data Ignored

| File / Directory | Reason |
|---|---|
| `backend/episodic_memory.json` (1.2 MB) | Personal conversation memory |
| `backend/vector_store.json` (590 KB) | Embedding vectors — regenerated at runtime |
| `backend/memory.json` (8 KB) | User memory store |
| `backend/chat_history.json` (38 KB) | Conversation history |
| `backend/reflection_memory.json` | AI reflections — regenerated |
| `backend/logs/` | Risk log, execution log |
| `backend/toolExecution.log` | Debug log |
| `book/audio_tmp/` | Temporary audio files |
| `book/manuscript.docx/.pdf` | Generated output files |
| `book/context_buffer.json` | Runtime state |

---

## 5. What WILL Be Committed (201 source files)

**Root level:** `README.md`, `package.json`, `.gitignore`, `.clinerules`, `planner.mf`, `arvsal_analysis.md`, `book_engine_plan.md`, `ui_modernization_plan.md`

**`electron/`** — All renderer, main, preload JS + HTML/CSS + wake-word `.ppn`

**`backend/`** — All `*.js` source modules (server.js, llmRunner, plannerEngine, cognitiveEngine, etc.)

**`backend/agent/`** — All agent loop JS files + screen skills

**`backend/python_worker/`** — Python `.py` source only (no `__pycache__`, no model weights)

**`backend/email/`** — Email handler JS files

**`backend/tools/`** — Tool registry JS files

**`backend/utils/`** — Utility JS files

**`backend/safety/`** — Risk engine and confirmation engine files

**`backend/arvsal-vision/`** — Treated as **git submodule** (has its own `.git`)

**`whisper.cpp/`** — Treated as **git submodule** (has its own `.git`)

**`AVA-Listener/`** — Documentation, scripts, Python source (models excluded)

**`book/`** — Python source files (engine.py, transcriber.py, llm_processor.py, etc.)

**`frontend/`** — Frontend source

---

## 6. Submodules Detected — Require Manual Action

Two directories contain their own `.git` repositories:

| Directory | Status |
|---|---|
| `whisper.cpp/` | Has own `.git` — appears as untracked blob to parent git |
| `backend/arvsal-vision/` | Has own `.git` — appears as untracked blob to parent git |

> [!IMPORTANT]
> You must choose one of two options for each:
>
> **Option A (Recommended):** Register as a proper git submodule
> ```bash
> git submodule add https://github.com/microsoft/OmniParser backend/arvsal-vision
> git submodule add https://github.com/ggerganov/whisper.cpp whisper.cpp
> ```
>
> **Option B:** Remove their `.git` folders and commit as regular code (only if you own the fork)
> ```bash
> Remove-Item -Recurse -Force whisper.cpp\.git
> Remove-Item -Recurse -Force backend\arvsal-vision\.git
> ```

---

## 7. Ignored Directory Size Breakdown

| Directory | Size | Ignored |
|---|---|---|
| `node_modules/` | ~10 GB | Yes |
| `backend/arvsal-vision/venv/` | ~6.2 GB | Yes |
| `whisper.cpp/models/` (GGML bins) | ~6.9 GB | Yes |
| `whisper.cpp/build/` | ~322 MB | Yes |
| `.wwebjs_auth/` | ~904 MB | Yes |
| `.wwebjs_cache/` | ~57 MB | Yes |
| `AVA-Listener/ava-listener/models/` | ~600 MB | Yes |
| HuggingFace ONNX cache (in node_modules) | ~7 GB | Yes (via node_modules/) |
| **Total ignored** | **~26 GB** | |

---

## 8. Estimated GitHub Repository Size After Ignoring

| Category | Estimated Size |
|---|---|
| Source code (JS, Python, HTML, CSS) | ~4 MB |
| Documentation (MD files) | ~1 MB |
| Electron assets | ~1 MB |
| whisper.cpp submodule pointer | ~0 KB (pointer only) |
| arvsal-vision submodule pointer | ~0 KB (pointer only) |
| **Total estimated push size** | **~6-8 MB** |

---

## 9. Files Needing Manual Review Before Committing

| File | Concern |
|---|---|
| `backend/profiles/arvsal.json` | May contain personal name/user data |
| `backend/profiles/jarvis.json` | Same as above |
| `backend/profiles/debug.json` | Debug profile — probably fine |
| `electron/renderer/arv-sal_en_windows_v4_0_0.ppn` | Picovoice wake-word model (binary) — check license before distributing |
| `backend/arvsal-vision/` | Has own `.git` — decide: submodule or flatten? |
| `whisper.cpp/` | Has own `.git` — decide: submodule or flatten? |
| `utils_vad.py` | Root-level Python file — confirm if source or generated artifact |

---

## 10. Git Commands to Proceed

```bash
# Stage all clean source files
git add .

# CRITICAL: verify nothing sensitive slipped through before pushing
git status

# Commit
git commit -m "chore: initial commit — ARVSAL v1.0.0"

# Push
git push -u origin main
```

> [!TIP]
> Always run `git status` after `git add .` and scan the output for any `.env`, `.bin`, `.key`, or `totp` files before pushing. A leaked API key can be compromised within seconds of hitting GitHub.
