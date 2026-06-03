# ARVSAL External Dependencies Audit
**Generated:** 2026-05-30 | **Phase:** 2 of 8

> **Critical Finding:** ARVSAL has **7 hardcoded absolute Windows paths** scattered across source files. Every runtime binary lives outside the repository root. This makes the project impossible to clone-and-run without manual path correction.

---

## Summary Table

| # | Dependency | Type | Current Location | Recommended Location |
|---|-----------|------|-----------------|---------------------|
| 1 | FFmpeg | Binary | `C:\Users\athar\Downloads\ffmpeg-8.0.1-essentials_build\...\ffmpeg.exe` | `ARVSAL/runtime/ffmpeg/bin/ffmpeg.exe` |
| 2 | Piper TTS | Binary + Model | `C:\Users\athar\Downloads\piper_windows_amd64\piper\` | `ARVSAL/runtime/piper/` |
| 3 | Piper ONNX Model | Model File | `C:\Users\athar\Downloads\piper_windows_amd64\piper\en_US-ryan-high.onnx` | `ARVSAL/runtime/piper/models/en_US-ryan-high.onnx` |
| 4 | Piper WAV temp | Runtime file | `C:\Users\athar\Downloads\piper_windows_amd64\piper\arvsal.wav` | `ARVSAL/runtime/temp/tts/` |
| 5 | Ollama EXE | Binary | `C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe` | System PATH (not bundled) |
| 6 | LibreOffice soffice | Binary | `C:\Program Files\LibreOffice\program\soffice.exe` | `ARVSAL/runtime/soffice/` or System PATH |
| 7 | Telegram Downloads | Folder | `C:\Users\athar\Downloads` | `ARVSAL/runtime/downloads/` |
| 8 | whisper-cli.exe | Binary (compiled) | `whisper.cpp/build/bin/whisper-cli.exe` | `ARVSAL/runtime/whisper/bin/whisper-cli.exe` |
| 9 | ggml-small.en.bin | Model | `whisper.cpp/models/ggml-small.en.bin` | `ARVSAL/runtime/whisper/models/` |
| 10 | ggml-medium.bin | Model | `whisper.cpp/models/ggml-medium.bin` | `ARVSAL/runtime/whisper/models/` |
| 11 | ggml-small.en.bin (duplicate) | Model | `whisper.cpp/ggml-small.en.bin` | ❌ DELETE (duplicate) |
| 12 | yolov8n.pt | Model | `backend/python_worker/models/yolov8n.pt` | `ARVSAL/runtime/models/vision/yolov8n.pt` |
| 13 | arvsal-vision weights | Model | `backend/arvsal-vision/weights/` | `ARVSAL/runtime/models/vision/omnitool/` |
| 14 | .wwebjs_auth | Session data | `arvsal/.wwebjs_auth/` | `ARVSAL/runtime/sessions/whatsapp/` |
| 15 | .wwebjs_cache | Cache | `arvsal/.wwebjs_cache/` | `ARVSAL/runtime/cache/whatsapp/` |
| 16 | cookies.json | Credentials | `arvsal/cookies.json` | `ARVSAL/runtime/sessions/email/cookies.json` |

---

## Detailed Entries

---

### 1. FFmpeg Binary

**Purpose:** Audio format conversion (WebM → WAV) for Whisper STT pipeline

**Current Path:**
```
C:\Users\athar\Downloads\ffmpeg-8.0.1-essentials_build\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe
```

**Recommended Path:**
```
ARVSAL/runtime/ffmpeg/bin/ffmpeg.exe
```

**Referencing Files & Lines:**

| File | Lines | Context |
|------|-------|---------|
| `backend/server.js` | 439 | `/audio` route — WebM to WAV for small Whisper model |
| `backend/server.js` | 560 | `/audio/final` route — WebM to WAV for medium Whisper model |
| `backend/server.js` | 636 | `/audio/stream` route — WebM to WAV for streaming |
| `backend/visualService.js` | 29 | A-Eye webcam capture (invokes `ffmpeg` from PATH) |

**Notes:**
- Used in 3 separate audio routes in `server.js` — same hardcoded path duplicated 3 times.
- `visualService.js` calls `ffmpeg` without a path (relies on system PATH).
- Should be resolved via environment variable `ARVSAL_FFMPEG_PATH`.

---

### 2. Piper TTS Binary

**Purpose:** Text-to-Speech synthesis using the Piper neural TTS engine

**Current Path:**
```
C:\Users\athar\Downloads\piper_windows_amd64\piper\piper.exe
```

**Recommended Path:**
```
ARVSAL/runtime/piper/piper.exe
```

**Referencing Files & Lines:**

| File | Lines | Context |
|------|-------|---------|
| `backend/server.js` | 200–201 | `speakLocally()` helper — local TTS for status messages |
| `backend/server.js` | 697–701 | `/speak` route — TTS for renderer |
| `backend/ttsEngine.js` | 5–10 | `PIPER_DIR`, `PIPER_EXE`, `MODEL`, `WAV_FILE` constants |

**Notes:**
- `ttsEngine.js` appears unused (server.js calls Piper directly inline).
- Both `speakLocally()` and `/speak` duplicate the Piper invocation logic.

---

### 3. Piper ONNX Voice Model

**Purpose:** Neural TTS voice model (Ryan, high quality, American English)

**Current Path:**
```
C:\Users\athar\Downloads\piper_windows_amd64\piper\en_US-ryan-high.onnx
```

**Recommended Path:**
```
ARVSAL/runtime/piper/models/en_US-ryan-high.onnx
ARVSAL/runtime/piper/models/en_US-ryan-high.onnx.json
```

**Referencing Files & Lines:**

| File | Lines | Context |
|------|-------|---------|
| `backend/server.js` | 203–204 | speakLocally() model path |
| `backend/server.js` | 700–701 | /speak route model path |
| `backend/ttsEngine.js` | 7 | MODEL constant |

---

### 4. Piper WAV Temp File (Runtime Artifact in Binary Dir)

**Purpose:** Temporary audio output file from Piper TTS

**Current Path:**
```
C:\Users\athar\Downloads\piper_windows_amd64\piper\arvsal.wav
```

**Problem:** Temp file written inside the Piper binary directory — wrong practice.

**Recommended Path:**
```
ARVSAL/runtime/temp/tts/arvsal.wav  (or use OS tmpdir)
```

**Referencing Files & Lines:**

| File | Lines |
|------|-------|
| `backend/ttsEngine.js` | 10 |

---

### 5. Ollama Executable

**Purpose:** Local LLM inference engine (Ollama). Runs models like llama3, phi3, deepseek.

**Current Path:**
```
C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe
```

**Recommended:** Require Ollama in system PATH. Not bundled. Document requirement in README.

**Referencing Files & Lines:**

| File | Lines | Context |
|------|-------|---------|
| `book/config.py` | 50–52 | `OLLAMA_EXE` constant |
| `book/llm_processor.py` | (via config) | Called via subprocess |

**Notes:**
- `backend/llmRunner.js` does NOT use the EXE directly — it calls Ollama via HTTP API on port 11434. Ollama must be running as a service.
- Only `book/` subsystem uses the EXE path directly.

---

### 6. LibreOffice soffice

**Purpose:** Headless LibreOffice for DOCX → PDF conversion in the Book Engine

**Current Path:**
```
C:\Program Files\LibreOffice\program\soffice.exe
```

**Recommended Path:**
```
System PATH (document as prerequisite) or ARVSAL/runtime/soffice/
```

**Referencing Files & Lines:**

| File | Lines | Context |
|------|-------|---------|
| `book/config.py` | 58–60 | `SOFFICE_EXE` constant |
| `book/converter.py` | (via config) | Called via subprocess |

---

### 7. Telegram File Download Folder

**Purpose:** Destination for files received via Telegram bot

**Current Path:**
```
C:\Users\athar\Downloads
```

**Recommended Path:**
```
ARVSAL/runtime/downloads/
```

**Referencing Files & Lines:**

| File | Line | Context |
|------|------|---------|
| `backend/telegramService.js` | 93 | `const saveFolder = "C:\\Users\\athar\\Downloads"` |

---

### 8. Whisper CLI Binary

**Purpose:** Speech-to-Text inference (compiled C++ whisper binary)

**Current Path:**
```
whisper.cpp/build/bin/whisper-cli.exe
```
*(Relative to backend/ — resolves to `../whisper.cpp/build/bin/whisper-cli.exe`)*

**Recommended Path:**
```
ARVSAL/runtime/whisper/bin/whisper-cli.exe
```

**Referencing Files & Lines:**

| File | Lines | Context |
|------|-------|---------|
| `backend/whisperManager.js` | 5–8 | `WHISPER_EXE` constant — relative `path.resolve` |

---

### 9. Whisper Small English Model

**Purpose:** Fast STT model for real-time/streaming transcription

**Current Path:**
```
whisper.cpp/models/ggml-small.en.bin  (used)
whisper.cpp/ggml-small.en.bin         (DUPLICATE — 487 MB, should be deleted)
```

**Recommended Path:**
```
ARVSAL/runtime/whisper/models/ggml-small.en.bin
```

**Referencing Files & Lines:**

| File | Lines |
|------|-------|
| `backend/whisperManager.js` | 12–15 |

---

### 10. Whisper Medium Model

**Purpose:** High-accuracy STT model for final transcription

**Current Path:**
```
whisper.cpp/models/ggml-medium.bin
```
*(Resolved via `path.resolve(__dirname, "../whisper.cpp/models/ggml-medium.bin")` in server.js)*

**Recommended Path:**
```
ARVSAL/runtime/whisper/models/ggml-medium.bin
```

**Referencing Files & Lines:**

| File | Lines | Context |
|------|-------|---------|
| `backend/server.js` | 537–540 | `MEDIUM_MODEL_PATH` constant |

---

### 11. YOLOv8 Nano Model

**Purpose:** UI element detection in the Python vision worker

**Current Path:**
```
backend/python_worker/models/yolov8n.pt  (6.5 MB)
```

**Recommended Path:**
```
ARVSAL/runtime/models/vision/yolov8n.pt
```

**Referencing Files & Lines:**

| File | Lines |
|------|-------|
| `backend/python_worker/yolo_detector.py` | (implicit — default YOLOv8 path) |

---

### 12. arvsal-vision Weights (OmniTool)

**Purpose:** Icon detection and caption Florence model weights for arvsal-vision

**Current Path:**
```
backend/arvsal-vision/weights/icon_detect/
backend/arvsal-vision/weights/icon_caption_florence/
backend/arvsal-vision/weights/.cache/
```

**Recommended Path:**
```
ARVSAL/runtime/models/vision/omnitool/
```

**Notes:** This is a git submodule (OmniParser by Microsoft). Weights are gitignored upstream.

---

### 13. WhatsApp Session Data

**Purpose:** Browser session for WhatsApp Web.js

**Current Paths:**
```
arvsal/.wwebjs_auth/     (authentication tokens)
arvsal/.wwebjs_cache/    (Chromium cache)
```

**Recommended Paths:**
```
ARVSAL/runtime/sessions/whatsapp/.wwebjs_auth/
ARVSAL/runtime/cache/whatsapp/.wwebjs_cache/
```

**Notes:** These are auto-generated by `whatsapp-web.js`. Currently at repository root — pollutes project structure.

---

### 14. Email Session Cookies

**Purpose:** Puppeteer browser cookies for IITK webmail session

**Current Path:**
```
arvsal/cookies.json  (root level)
```

**Recommended Path:**
```
ARVSAL/runtime/sessions/email/cookies.json
```

**Referencing Files & Lines:**

| File | Line |
|------|------|
| `backend/email/emailFetcher.js` | 17 (`fs.readFileSync("cookies.json")`) |
| `backend/email/saveSession.js` | (writes cookies.json) |

**Notes:** Path is relative — depends on CWD being `arvsal/`. Fragile.

---

## Proposed Environment Variables

Replace all hardcoded paths with these environment variables in `.env`:

```env
# Runtime Binary Paths
ARVSAL_FFMPEG_PATH=./runtime/ffmpeg/bin/ffmpeg.exe
ARVSAL_PIPER_PATH=./runtime/piper/piper.exe
ARVSAL_PIPER_MODEL=./runtime/piper/models/en_US-ryan-high.onnx
ARVSAL_WHISPER_EXE=./runtime/whisper/bin/whisper-cli.exe
ARVSAL_WHISPER_SMALL_MODEL=./runtime/whisper/models/ggml-small.en.bin
ARVSAL_WHISPER_MEDIUM_MODEL=./runtime/whisper/models/ggml-medium.bin
ARVSAL_SOFFICE_PATH=./runtime/soffice/program/soffice.exe

# Runtime Data Paths
ARVSAL_DOWNLOAD_DIR=./runtime/downloads/
ARVSAL_TEMP_DIR=./runtime/temp/
ARVSAL_SESSION_DIR=./runtime/sessions/

# External Services (keep in .env)
OLLAMA_HOST=http://127.0.0.1:11434
```

---

## Runtime Directories Currently Outside Repository

```
C:\Users\athar\Downloads\ffmpeg-8.0.1-essentials_build\       ← FFmpeg binary
C:\Users\athar\Downloads\piper_windows_amd64\piper\            ← Piper binary + model
C:\Users\athar\AppData\Local\Programs\Ollama\                  ← Ollama (system install)
C:\Program Files\LibreOffice\program\                          ← LibreOffice (system install)
C:\Users\athar\Downloads\                                      ← Telegram file downloads
%TEMP%\                                                        ← visualService.js temp files
```
