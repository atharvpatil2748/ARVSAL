# ARVSAL External Dependencies — V2 (Exhaustive)
**Generated:** 2026-05-30 | Second-pass full scan

> **New findings vs V1:** `embeddingModel.js:13` (Ollama EXE), `pythonBridge.js:13` (Python EXE), `systemActions.js:15` (nircmd.exe), `tts.js:5` (eSpeak EXE). V1 missed 4 hardcoded paths.

---

## HARDCODED ABSOLUTE PATH INVENTORY

### 1 · `backend/server.js` — FFmpeg (×3 identical lines)

| # | Line | Exact Value | Usage Type |
|---|------|-------------|-----------|
| 1a | 439 | `C:\Users\athar\Downloads\ffmpeg-8.0.1-essentials_build\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe` | `spawn(ffmpegExe, args)` — `/audio` route WebM→WAV |
| 1b | 560 | same as above | `spawn(ffmpegExe, args)` — `/audio/final` route |
| 1c | 636 | same as above | `spawn(ffmpegExe, args)` — `/audio/stream` route |

**Migration:** `process.env.ARVSAL_FFMPEG_PATH || path.resolve(__dirname, "../runtime/ffmpeg/bin/ffmpeg.exe")`

---

### 2 · `backend/server.js` — Piper TTS EXE (×2 identical lines)

| # | Line | Exact Value | Usage Type |
|---|------|-------------|-----------|
| 2a | 201 | `C:\Users\athar\Downloads\piper_windows_amd64\piper\piper.exe` | `spawn(piperExe, ...)` in `speakLocally()` helper |
| 2b | 698 | same as above | `spawn(piperExe, ...)` in `/speak` route |

**Migration:** `process.env.ARVSAL_PIPER_PATH || path.resolve(__dirname, "../runtime/piper/piper.exe")`

---

### 3 · `backend/server.js` — Piper ONNX Model (×2 identical lines)

| # | Line | Exact Value | Usage Type |
|---|------|-------------|-----------|
| 3a | 204 | `C:\Users\athar\Downloads\piper_windows_amd64\piper\en_US-ryan-high.onnx` | `spawn(piperExe, ["-m", modelPath, ...])` |
| 3b | 701 | same as above | same pattern in `/speak` route |

**Migration:** `process.env.ARVSAL_PIPER_MODEL || path.resolve(__dirname, "../runtime/piper/models/en_US-ryan-high.onnx")`

---

### 4 · `backend/server.js` — Whisper Medium Model

| File | Line | Exact Value | Usage Type |
|------|------|-------------|-----------|
| `backend/server.js` | 537–539 | `path.resolve(__dirname, "../whisper.cpp/models/ggml-medium.bin")` | `const MEDIUM_MODEL_PATH` — passed to `runFinalWhisper()` |

**Migration:** `process.env.ARVSAL_WHISPER_MEDIUM_MODEL || path.resolve(__dirname, "../runtime/whisper/models/ggml-medium.bin")`

---

### 5 · `backend/ttsEngine.js` — Piper Directory (ALL paths)

| Line | Exact Value | Usage Type |
|------|-------------|-----------|
| 5 | `C:\Users\athar\Downloads\piper_windows_amd64\piper` | `const PIPER_DIR` — base for all sub-paths |
| 6 | `path.join(PIPER_DIR, "piper.exe")` | `const PIPER_EXE` — `spawn(PIPER_EXE, ...)` |
| 7 | `path.join(PIPER_DIR, "en_US-ryan-high.onnx")` | `const MODEL` — `-m MODEL` arg |
| 10 | `path.join(PIPER_DIR, "arvsal.wav")` | `const WAV_FILE` — output WAV path |
| 23 | `spawn(PIPER_EXE, [...], { cwd: PIPER_DIR })` | `spawn()` with hardcoded cwd |
| 33 | `spawn("powershell", [...WAV_FILE...])` | PowerShell plays WAV from hardcoded path |

> ⚠️ **Note:** `ttsEngine.js` is dead code (server.js calls Piper inline). Both must be fixed.

**Migration:** Move to `runtime/piper/`, resolve via env vars.

---

### 6 · `backend/telegramService.js` — Downloads Folder

| File | Line | Exact Value | Usage Type |
|------|------|-------------|-----------|
| `backend/telegramService.js` | 93 | `C:\Users\athar\Downloads` | `const saveFolder` — `downloadTelegramFile()` writes here |

**Migration:** `process.env.ARVSAL_DOWNLOAD_DIR || path.resolve(__dirname, "../runtime/downloads")`

---

### 7 · `backend/embeddingModel.js` — Ollama EXE ⭐ NEW

| File | Line | Exact Value | Usage Type |
|------|------|-------------|-----------|
| `backend/embeddingModel.js` | 12–13 | `C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe` | `const OLLAMA_PATH` — `spawn(OLLAMA_PATH, ["run", "nomic-embed-text"])` |

> ⚠️ **Missed in V1.** This is the embedding pipeline for vector memory — critical.

**Migration:** `process.env.ARVSAL_OLLAMA_PATH || "ollama"` (rely on PATH when possible)

---

### 8 · `backend/agent/pythonBridge.js` — Python EXE ⭐ NEW

| File | Line | Exact Value | Usage Type |
|------|------|-------------|-----------|
| `backend/agent/pythonBridge.js` | 13 | `C:\Users\athar\AppData\Local\Python\pythoncore-3.14-64\python.exe` | `const PYTHON` — `spawn(PYTHON, [SCRIPT, ...args])` |

> ⚠️ **Missed in V1.** Hard-pinned to Python 3.14 at a non-standard AppData path. Any version change or OS reinstall breaks vision agent.

**Migration:** `process.env.ARVSAL_PYTHON_PATH || "python"` (rely on PATH)

---

### 9 · `backend/agent/pythonBridge.js` — Python Script Path

| File | Line | Exact Value | Usage Type |
|------|------|-------------|-----------|
| `backend/agent/pythonBridge.js` | 15 | `path.join(__dirname, "../python_worker/main.py")` | `const SCRIPT` — relative `__dirname` path |

**Status:** ✅ Relative — safe after file moves, but must update if `pythonBridge.js` moves.

---

### 10 · `backend/systemActions.js` — nircmd.exe ⭐ NEW

| File | Line | Exact Value | Usage Type |
|------|------|-------------|-----------|
| `backend/systemActions.js` | 15 | `C:\Windows\System32\nircmd.exe` | `const NIRCMD` — volume control commands |
| `backend/systemActions.js` | 237 | same (commented-out duplicate) | Dead code |

> ⚠️ **Missed in V1.** `nircmd.exe` is a third-party tool placed in System32 (non-standard). The active line 15 is used for volume control.

**Migration:** `process.env.ARVSAL_NIRCMD_PATH || path.resolve(__dirname, "../runtime/nircmd/nircmd.exe")`

---

### 11 · `backend/tts.js` — eSpeak EXE ⭐ NEW

| File | Line | Exact Value | Usage Type |
|------|------|-------------|-----------|
| `backend/tts.js` | 5 | `"C:\Program Files (x86)\eSpeak\command_line\espeak.exe"` | String in `exec()` call |

> ⚠️ **Missed in V1.** Dead code file, but contains a hardcoded path. Not called from server.js.

**Status:** Dead code — delete the file.

---

### 12 · `book/config.py` — Ollama EXE

| File | Line | Exact Value | Usage Type |
|------|------|-------------|-----------|
| `book/config.py` | 50–52 | `C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe` | `OLLAMA_EXE = Path(...)` — `subprocess.run([OLLAMA_EXE, ...])` |

**Migration:**
```python
OLLAMA_EXE = Path(os.getenv("ARVSAL_OLLAMA_PATH", r"C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe"))
```

---

### 13 · `book/config.py` — LibreOffice soffice.exe

| File | Line | Exact Value | Usage Type |
|------|------|-------------|-----------|
| `book/config.py` | 58–60 | `C:\Program Files\LibreOffice\program\soffice.exe` | `SOFFICE_EXE = Path(...)` — `subprocess.run([SOFFICE_EXE, ...])` |

**Migration:**
```python
SOFFICE_EXE = Path(os.getenv("ARVSAL_SOFFICE_PATH", r"C:\Program Files\LibreOffice\program\soffice.exe"))
```

---

### 14 · `backend/python_worker/config.py` — YOLO model (relative)

| File | Line | Exact Value | Usage Type |
|------|------|-------------|-----------|
| `backend/python_worker/config.py` | 2 | `"models/ui_yolo.pt"` | `YOLO_MODEL_PATH` — relative, CWD-dependent |
| `backend/python_worker/yolo_detector.py` | 7 | `"models/yolo_ui.pt"` | `YOLO("models/yolo_ui.pt")` — different filename! |

> ⚠️ **Inconsistency:** `config.py` says `ui_yolo.pt`, `yolo_detector.py` says `yolo_ui.pt`. One is wrong. Both are CWD-relative (fragile).

**Migration:** Use `path.join(os.path.dirname(__file__), "models", "yolov8n.pt")`

---

### 15 · `backend/whisperManager.js` — Whisper Binary + Model (relative)

| Line | Exact Value | Usage Type |
|------|-------------|-----------|
| 5–8 | `path.resolve(__dirname, "../whisper.cpp/build/bin/whisper-cli.exe")` | `const WHISPER_EXE` |
| 12–15 | `path.resolve(__dirname, "../whisper.cpp/models/ggml-small.en.bin")` | `const SMALL_MODEL_PATH` |
| 64 | `execFile(WHISPER_EXE, args, { cwd: whisperDir })` | `cwd` derived from `path.dirname(WHISPER_EXE)` |

**Status:** Relative — safe now, but must update after runtime/ reorganization.

**Migration:** `process.env.ARVSAL_WHISPER_EXE || path.resolve(__dirname, "../runtime/whisper/bin/whisper-cli.exe")`

---

### 16 · `backend/wakeWord.js` — Profile Paths (relative)

| Line | Exact Value | Usage Type |
|------|-------------|-----------|
| 21 | `path.resolve(__dirname, '../node_modules/ava-listener/profiles/arvsal.json')` | Package profile source |
| 22 | `path.resolve(__dirname, 'profiles/arvsal.json')` | Local profile destination |

**Status:** Relative — will break if `wakeWord.js` moves directories.

---

### 17 · `backend/email/emailFetcher.js` — execSync path + cookies

| Line | Exact Value | Usage Type |
|------|-------------|-----------|
| 4 | `require("child_process").execSync` | Used at lines 21, 40, 88 |
| 21, 40, 88 | `execSync("node backend/email/saveSession.js", ...)` | Hardcoded relative shell path — CWD-dependent |
| ~17 | `fs.readFileSync("cookies.json")` | Relative — reads from process CWD |

> ⚠️ **CWD-dependent.** Works only when started from `arvsal/` root.

---

### 18 · `backend/tools/toolRegistry.js` — Log file path

| Line | Exact Value | Usage Type |
|------|-------------|-----------|
| 25 | `path.join(__dirname, "../toolExecution.log")` | Writes logs to `backend/toolExecution.log` |

---

### 19 · `backend/safety/riskEngine.js` — Log file path

| Line | Exact Value | Usage Type |
|------|-------------|-----------|
| 18 | `path.join(__dirname, "../logs/risk.log")` | Writes to `backend/logs/risk.log` |

---

### 20 · `backend/tools/desktopTool.js` — Log + screenshot paths

| Line | Exact Value | Usage Type |
|------|-------------|-----------|
| 17 | `path.join(__dirname, "../logs/toolExecution.log")` | Tool execution log |
| 190 | `path.join(__dirname, "../logs/screenshot.png")` | Screenshot saved to logs folder (5.9 MB) |

---

### 21 · `backend/tools/n8nTool.js` — Log file path

| Line | Exact Value | Usage Type |
|------|-------------|-----------|
| 22 | `path.join(__dirname, "../logs/toolExecution.log")` | ⚠️ Duplicates toolRegistry.js — two files write to same log |

---

### 22 · Data files stored next to source

| File | Line | Exact Value | Problem |
|------|------|-------------|---------|
| `backend/memory.js` | 12 | `path.join(__dirname, "memory.json")` | Data next to source |
| `backend/episodicMemory.js` | 13 | `path.join(__dirname, "episodic_memory.json")` | 1.2 MB next to source |
| `backend/vectorStore.js` | 15 | `path.resolve(__dirname, "vector_store.json")` | 620 KB next to source |
| `backend/reflectionMemory.js` | 16 | `path.join(__dirname, "reflection_memory.json")` | Data next to source |
| `backend/chatHistory.js` | 17 | `path.join(__dirname, "chat_history.json")` | Data next to source |
| `backend/totpManager.js` | 5 | `path.join(__dirname, "totp_secret.json")` | ⚠️ Sensitive credential next to source |
| `backend/identity.js` | 13 | `path.join(__dirname, "identity.json")` | Config next to source |

---

### 23 · `backend/visualService.js` — FFmpeg via PATH

| Line | Exact Value | Usage Type |
|------|-------------|-----------|
| 29 | `` `ffmpeg -f dshow -i video="Integrated Camera" ...` `` | `exec(ffmpegCmd)` — relies on `ffmpeg` being in system PATH |

> ⚠️ No absolute path, but PATH-dependent. Different from the `ffmpeg.exe` used in audio routes.

---

### 24 · `backend/visionRunner.js` — Ollama via PATH

| Line | Exact Value | Usage Type |
|------|-------------|-----------|
| 13 | `spawn("ollama", ["run", model, prompt])` | Relies on `ollama` in system PATH |

---

### 25 · `backend/ollamaWarmup.js` — Ollama via PATH

| Line | Exact Value | Usage Type |
|------|-------------|-----------|
| 10 | `spawn("ollama", ["run", model, "Say hello"])` | Relies on `ollama` in system PATH |

---

### 26 · `backend/conversionEngine.js` — os.tmpdir()

| Line | Exact Value | Usage Type |
|------|-------------|-----------|
| 17 | `path.join(os.tmpdir(), \`arvsal_batch_...\`)` | Batch workspace in system temp |
| 44 | `path.join(os.tmpdir(), finalPdfName)` | Final PDF in system temp |

---

### 27 · `backend/visualService.js` — os.tmpdir()

| Line | Exact Value | Usage Type |
|------|-------------|-----------|
| 19 | `path.join(os.tmpdir(), \`arvsal_aeye_${Date.now()}.jpg\`)` | Webcam snapshot in system temp |

---

## COMPLETE HARDCODED PATH COUNT

| # | File | Line(s) | Path | Type | New in V2? |
|---|------|---------|------|------|-----------|
| 1 | `server.js` | 439, 560, 636 | FFmpeg EXE (×3) | Absolute Win | No |
| 2 | `server.js` | 201, 698 | Piper EXE (×2) | Absolute Win | No |
| 3 | `server.js` | 204, 701 | Piper ONNX (×2) | Absolute Win | No |
| 4 | `server.js` | 537 | Whisper medium model | Relative | No |
| 5 | `ttsEngine.js` | 5–10 | Piper DIR, EXE, model, WAV | Absolute Win | No |
| 6 | `telegramService.js` | 93 | Downloads folder | Absolute Win | No |
| 7 | `embeddingModel.js` | 13 | Ollama EXE | Absolute Win | ✅ YES |
| 8 | `pythonBridge.js` | 13 | Python 3.14 EXE | Absolute Win | ✅ YES |
| 9 | `systemActions.js` | 15 | nircmd.exe (System32) | Absolute Win | ✅ YES |
| 10 | `tts.js` | 5 | eSpeak EXE | Absolute Win | ✅ YES |
| 11 | `book/config.py` | 51 | Ollama EXE | Absolute Win | No |
| 12 | `book/config.py` | 59 | soffice.exe | Absolute Win | No |
| 13 | `python_worker/yolo_detector.py` | 7 | `models/yolo_ui.pt` | Relative (CWD) | No |
| 14 | `python_worker/config.py` | 2 | `models/ui_yolo.pt` | Relative (CWD) | No |
| 15 | `whisperManager.js` | 5–15 | Whisper EXE + model | Relative `__dirname` | No |
| 16 | `wakeWord.js` | 21–22 | Profile paths | Relative `__dirname` | No |
| 17 | `emailFetcher.js` | 21, 40, 88 | `node backend/email/saveSession.js` | Relative shell | ✅ YES |

**V1 found: 13 paths. V2 found: 17 distinct path locations (11 unique files).**

---

## PROCESS SPAWNING INVENTORY

All files using `spawn()`, `exec()`, `execFile()`, `execSync()`, or `subprocess`:

| File | Line(s) | Call | Target Binary |
|------|---------|------|--------------|
| `backend/server.js` | 207 | `spawn(piperExe, [...])` | Piper TTS (hardcoded) |
| `backend/server.js` | 215 | `spawn("powershell", [...])` | PowerShell (PATH) |
| `backend/server.js` | 456 | `spawn(ffmpegExe, args)` | FFmpeg (hardcoded) |
| `backend/server.js` | 574 | `spawn(ffmpegExe, args)` | FFmpeg (hardcoded) |
| `backend/server.js` | 652 | `spawn(ffmpegExe, args)` | FFmpeg (hardcoded) |
| `backend/server.js` | 703 | `spawn(piperExe, [...])` | Piper TTS (hardcoded) |
| `backend/whisperManager.js` | 64 | `execFile(WHISPER_EXE, args)` | whisper-cli.exe (relative) |
| `backend/embeddingModel.js` | 47 | `spawn(OLLAMA_PATH, [...])` | Ollama (hardcoded) |
| `backend/agent/pythonBridge.js` | 23 | `spawn(PYTHON, [SCRIPT, ...])` | Python EXE (hardcoded) |
| `backend/visionRunner.js` | 13 | `spawn("ollama", [...])` | Ollama (PATH) |
| `backend/ollamaWarmup.js` | 10 | `spawn("ollama", [...])` | Ollama (PATH) |
| `backend/visualService.js` | 33 | `exec(ffmpegCmd)` | FFmpeg (PATH) |
| `backend/tools/systemTool.js` | 150,178,213,230,258 | `exec(command)` | Various OS commands |
| `backend/systemActions.js` | 39 | `exec(...)` | OS commands (nircmd) |
| `backend/email/emailFetcher.js` | 21, 40, 88 | `execSync("node backend/email/saveSession.js")` | Node (PATH, CWD-relative) |
| `backend/ttsEngine.js` | 23, 33 | `spawn(PIPER_EXE, ...)`, `spawn("powershell", ...)` | Piper (hardcoded) — dead |
| `backend/tts.js` | 18 | `exec(...)` | eSpeak (hardcoded) — dead |
| `backend/espeak.js` | 8 | `exec(...)` | eSpeak — dead |
| `backend/utils/powerMonitor.js` | 12 | `execFile(...)` | `powershell` — ACPI query |
| `backend/wakeWord.js` | (via AVAListener) | `spawn(...)` | ava-listener internal |
| `electron/main.js` | 26 | `spawn("node", [backendPath])` | Node (PATH) |
| `book/converter.py` | 83 | `subprocess.run([SOFFICE_EXE, ...])` | soffice.exe (hardcoded) |
| `book/llm_processor.py` | ~209 | `requests.post("http://localhost:11434/api/generate")` | Ollama HTTP API |

---

## ENVIRONMENT VARIABLE USAGE

### Variables currently read via `process.env`

| Variable | File(s) | Line(s) | Purpose |
|----------|---------|---------|---------|
| `TELEGRAM_BOT_TOKEN` | `telegramService.js` | 6, 57, 74, 113 | Telegram API auth |
| `TELEGRAM_CHAT_ID` | `telegramService.js`, `server.js` | 7, 58, 1726 | Authorized chat |
| `OPENAI_API_KEY` | `chatgptClient.js` | 19–20 | OpenAI auth |
| `GEMINI_API_KEY` | `geminiClient.js` | 37 | Gemini auth |
| `GROQ_API_KEY` | `groqClient.js`, `ai.js` | 32, 16 | Groq auth |
| `GNEWS_API_KEY` | `localSkills.js` | 54 | GNews weather/news |
| `N8N_WEBHOOK_URL` | `n8nTool.js` | 19 | n8n automation webhook |
| `LLM_DEBUG` | `llmRouter.js`, `llmRunner.js`, `llmDebug.js` | 22, 120, 1 | Debug logging flag |
| `ARVSAL_WAKE_DEBUG` | `wakeWord.js`, `whisperManager.js` | 125, 76 | Wake/Whisper debug |
| `GHOST_MODE` | `electron/main.js` | 7 | Ghost/silent mode |
| `BOOK_AUTHORIZED_CHATS` | `book/config.py` | 44 | Extra Telegram chat IDs |
| `TELEGRAM_BOT_TOKEN` | `book/config.py` | 38 | Book engine Telegram |
| `TELEGRAM_CHAT_ID` | `book/config.py` | 39 | Book engine chat |

### Variables NOT yet read but should be (migration targets)

| Variable | Purpose |
|----------|---------|
| `ARVSAL_FFMPEG_PATH` | FFmpeg binary location |
| `ARVSAL_PIPER_PATH` | Piper binary location |
| `ARVSAL_PIPER_MODEL` | Piper ONNX model |
| `ARVSAL_WHISPER_EXE` | Whisper CLI binary |
| `ARVSAL_WHISPER_SMALL_MODEL` | Small Whisper model |
| `ARVSAL_WHISPER_MEDIUM_MODEL` | Medium Whisper model |
| `ARVSAL_OLLAMA_PATH` | Ollama EXE (used by embeddingModel.js) |
| `ARVSAL_PYTHON_PATH` | Python EXE (used by pythonBridge.js) |
| `ARVSAL_NIRCMD_PATH` | nircmd.exe (used by systemActions.js) |
| `ARVSAL_DOWNLOAD_DIR` | Telegram download folder |
| `ARVSAL_DATA_DIR` | JSON data files base directory |
| `ARVSAL_LOG_DIR` | Log files directory |
