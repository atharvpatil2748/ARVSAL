# ARVSAL Runtime Directory Design
**Generated:** 2026-05-30 | **Phase:** 7 of 8

---

## Overview

The `runtime/` directory is the **self-contained, portable dependency store** for ARVSAL. It lives inside the repository root but is fully gitignored. A developer runs `node scripts/setup-runtime.js` to populate it.

---

## Complete `runtime/` Tree

```
arvsal/runtime/
│
├── ffmpeg/                         # FFmpeg audio conversion binary
│   └── bin/
│       ├── ffmpeg.exe              # Main executable
│       ├── ffprobe.exe             # Probe tool (included in package)
│       └── ffplay.exe              # Optional player
│
├── piper/                          # Piper TTS engine + voice models
│   ├── piper.exe                   # Piper binary
│   ├── piper_phonemize.dll         # Required DLL
│   ├── espeak-ng-data/             # Phoneme data (bundled with Piper)
│   └── models/
│       ├── en_US-ryan-high.onnx    # Primary TTS voice (Ryan, high quality)
│       ├── en_US-ryan-high.onnx.json  # Voice config
│       └── (additional voices)
│
├── whisper/                        # Whisper.cpp STT binary + models
│   ├── bin/
│   │   ├── whisper-cli.exe         # Primary STT executable
│   │   ├── ggml.dll                # GGML compute library
│   │   ├── ggml-base.dll           # GGML base
│   │   ├── ggml-cpu.dll            # CPU backend
│   │   ├── ggml-cuda.dll           # CUDA GPU backend (if built)
│   │   └── whisper.dll             # Whisper library
│   └── models/
│       ├── ggml-small.en.bin       # Small English model (~487 MB)
│       └── ggml-medium.bin         # Medium multilingual model (~1.5 GB)
│
├── models/                         # AI/ML model weights
│   └── vision/
│       ├── yolov8n.pt              # YOLO UI element detector (6.5 MB)
│       └── omnitool/               # OmniTool / arvsal-vision weights
│           ├── icon_detect/        # Icon detection model
│           │   └── model.safetensors
│           └── icon_caption_florence/   # Florence captioning model
│               └── model.safetensors
│
├── sessions/                       # Authentication sessions (gitignored)
│   ├── email/
│   │   └── cookies.json            # Puppeteer email session cookies
│   └── whatsapp/
│       ├── .wwebjs_auth/           # WhatsApp Web.js auth tokens
│       └── (session data)
│
├── cache/                          # Runtime caches (gitignored)
│   ├── whatsapp/
│   │   └── .wwebjs_cache/          # Chromium profile + cache
│   └── embeddings/                 # HuggingFace model cache (optional)
│
├── temp/                           # Temporary processing files (auto-cleaned)
│   ├── audio/                      # WebM/WAV temp files for Whisper
│   │   └── .gitkeep
│   ├── tts/                        # Piper output WAV files
│   │   └── .gitkeep
│   ├── screen/                     # Screenshot temp files
│   │   └── .gitkeep
│   └── telegram/                   # Telegram batch processing temp
│       └── .gitkeep
│
├── downloads/                      # Telegram file downloads (persisted)
│   └── .gitkeep
│
└── logs/                           # Runtime logs (gitignored)
    ├── risk.log
    ├── toolExecution.log
    └── debug.log
```

---

## Gitignore Rules for `runtime/`

Add these lines to `.gitignore`:

```gitignore
# Runtime directory — DO NOT commit
/runtime/ffmpeg/
/runtime/piper/
/runtime/whisper/
/runtime/models/
/runtime/sessions/
/runtime/cache/
/runtime/temp/
/runtime/downloads/
/runtime/logs/

# Keep directory structure
!/runtime/**/.gitkeep
```

---

## Environment Variable Mapping

Each `runtime/` path is controlled by a `.env` variable:

| `runtime/` Path | Environment Variable | Default Value |
|----------------|---------------------|--------------|
| `runtime/ffmpeg/bin/ffmpeg.exe` | `ARVSAL_FFMPEG_PATH` | `./runtime/ffmpeg/bin/ffmpeg.exe` |
| `runtime/piper/piper.exe` | `ARVSAL_PIPER_PATH` | `./runtime/piper/piper.exe` |
| `runtime/piper/models/en_US-ryan-high.onnx` | `ARVSAL_PIPER_MODEL` | `./runtime/piper/models/en_US-ryan-high.onnx` |
| `runtime/whisper/bin/whisper-cli.exe` | `ARVSAL_WHISPER_EXE` | `./runtime/whisper/bin/whisper-cli.exe` |
| `runtime/whisper/models/ggml-small.en.bin` | `ARVSAL_WHISPER_SMALL_MODEL` | `./runtime/whisper/models/ggml-small.en.bin` |
| `runtime/whisper/models/ggml-medium.bin` | `ARVSAL_WHISPER_MEDIUM_MODEL` | `./runtime/whisper/models/ggml-medium.bin` |
| `runtime/downloads/` | `ARVSAL_DOWNLOAD_DIR` | `./runtime/downloads` |
| `runtime/temp/` | `ARVSAL_TEMP_DIR` | `./runtime/temp` |
| `runtime/logs/` | `ARVSAL_LOG_DIR` | `./runtime/logs` |
| `runtime/sessions/email/cookies.json` | `ARVSAL_EMAIL_COOKIES` | `./runtime/sessions/email/cookies.json` |

---

## Per-Component Detailed Notes

### FFmpeg
- **Version:** 8.0.1 essentials build (Windows)
- **Used by:** Audio pipeline (`/audio`, `/audio/final`, `/audio/stream`), A-Eye webcam capture
- **Size:** ~75 MB
- **Source:** https://ffmpeg.org/download.html → Windows builds by BtbN or gyan.dev
- **Install command:** `node scripts/setup-runtime.js --component ffmpeg`

### Piper TTS
- **Version:** piper_windows_amd64 (latest)
- **Used by:** `/speak` route, `speakLocally()` helper in server.js
- **Size:** ~25 MB (binary) + ~65 MB (ryan-high model)
- **Source:** https://github.com/rhasspy/piper/releases
- **Note:** Place `espeak-ng-data/` next to `piper.exe` — required for phonemization
- **Note:** WAV temp file must NOT be written inside the piper binary dir

### Whisper STT
- **Executable:** Compiled from `stt/whisper.cpp/` (already in repo)
- **DLLs:** Must be alongside `whisper-cli.exe` in `bin/` — they're produced by the build
- **Models:** Large files — downloaded separately, not in git
- **GPU:** `ggml-cuda.dll` present → GPU inference when plugged in; `--no-gpu` when on battery
- **Note:** `WHISPER_CWD` must be `runtime/whisper/bin/` for DLLs to load

### YOLO Vision Model
- **File:** `yolov8n.pt` (Ultralytics YOLOv8 Nano)
- **Used by:** `agents/vision_worker/yolo_detector.py`
- **Size:** 6.5 MB
- **Source:** Auto-downloaded by ultralytics on first use (OR manually placed)

### OmniTool Weights (arvsal-vision)
- **Used by:** `vision/` (gradio_demo.py, omnitool/)
- **Size:** Large (Florence model ~500MB+)
- **Source:** HuggingFace — downloaded via `huggingface-cli` or the gradio demo on first run

### WhatsApp Session
- **Generated by:** `whatsapp-web.js` on first auth scan
- **Contains:** Chromium profile + encrypted auth tokens
- **Note:** `.wwebjs_cache/` can grow to several hundred MB — periodically clean

### Temp Directory
- **Managed by:** `utils/safeTempManager.js`
- **Lifecycle:** Files created with prefix + timestamp; cleaned on process exit
- **Note:** `cleanupAll()` is called on `process.exit`, `SIGINT`, `SIGTERM`, `uncaughtException`

---

## `setup-runtime.js` Skeleton (scripts/setup-runtime.js)

```js
/**
 * ARVSAL Runtime Setup Script
 * Downloads and installs all required external binaries and models.
 * Run: node scripts/setup-runtime.js
 */
const fs = require("fs");
const path = require("path");

const RUNTIME = path.resolve(__dirname, "../runtime");

const DIRS = [
  "ffmpeg/bin",
  "piper/models",
  "whisper/bin",
  "whisper/models",
  "models/vision",
  "sessions/email",
  "sessions/whatsapp",
  "cache/whatsapp",
  "temp/audio",
  "temp/tts",
  "temp/screen",
  "temp/telegram",
  "downloads",
  "logs"
];

console.log("Creating runtime directory structure...");
for (const dir of DIRS) {
  fs.mkdirSync(path.join(RUNTIME, dir), { recursive: true });
}

console.log("✅ Runtime directories created.");
console.log("\nNext steps:");
console.log("  1. Copy ffmpeg.exe to runtime/ffmpeg/bin/");
console.log("  2. Copy piper.exe + models to runtime/piper/");
console.log("  3. Copy whisper-cli.exe + DLLs to runtime/whisper/bin/");
console.log("  4. Copy ggml-*.bin models to runtime/whisper/models/");
console.log("  5. Run: npm run backend");
```

---

## `health-check.js` Skeleton (scripts/health-check.js)

```js
/**
 * ARVSAL Health Check
 * Verifies all required runtime files exist before starting.
 */
const { FFMPEG_EXE, PIPER_EXE, WHISPER_EXE, SMALL_MODEL_PATH, MEDIUM_MODEL_PATH } = require("../utils/pathConfig");
const fs = require("fs");

const checks = [
  { label: "FFmpeg",         path: FFMPEG_EXE },
  { label: "Piper TTS",      path: PIPER_EXE },
  { label: "Whisper CLI",    path: WHISPER_EXE },
  { label: "Whisper Small",  path: SMALL_MODEL_PATH },
  { label: "Whisper Medium", path: MEDIUM_MODEL_PATH },
];

let allOk = true;
for (const c of checks) {
  const ok = fs.existsSync(c.path);
  console.log(`${ok ? "✅" : "❌"} ${c.label}: ${c.path}`);
  if (!ok) allOk = false;
}

if (!allOk) {
  console.error("\n⚠️  Some runtime files are missing. Run: node scripts/setup-runtime.js");
  process.exit(1);
}
console.log("\n✅ All runtime checks passed.");
```
