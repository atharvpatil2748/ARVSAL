# ARVSAL Import Refactor Plan
**Generated:** 2026-05-30 | **Phase:** 6 of 8

> **Strategy:** Use a path alias system (`@` prefixes) to avoid brittle relative paths. In Node.js this is achieved via `module-alias` npm package or native `--experimental-specifier-resolution`. All `require("../../../something")` chains become `require("@core/memory/semanticMemory")`.

---

## Proposed Path Aliases

Add to `package.json`:
```json
"_moduleAliases": {
  "@root"         : ".",
  "@services"     : "./services",
  "@core"         : "./core",
  "@providers"    : "./providers",
  "@agents"       : "./agents",
  "@modules"      : "./modules",
  "@integrations" : "./integrations",
  "@tools"        : "./tools",
  "@safety"       : "./safety",
  "@utils"        : "./utils",
  "@actions"      : "./actions",
  "@config"       : "./config",
  "@data"         : "./data"
}
```

Add to entry point (`services/server.js` line 1):
```js
require('module-alias/register');
```

---

## Import Changes by File

### `apps/electron/main.js`

```js
// OLD
const WakeWordEngine = require("../backend/wakeWord");

// NEW
const WakeWordEngine = require("@modules/wake/wakeWord");
```

---

### `services/server.js` (decomposed from backend/server.js)

```js
// OLD
const chatHistory = require("./chatHistory");
const episodicMemory = require("./episodicMemory");
const memory = require("./memory");
const { extractKey } = require("./themeExtractor");
const normalize = require("./normalizer");
const classifyIntent = require("./intentClassifier");
const { handleIntent } = require("./actions");
const applyPersonality = require("./personality");
const llmRouter = require("./llmRouter");
const { getWeather, getNews } = require("./localSkills");
const { processMemoryQuery } = require("./cognitiveEngine");
const { generatePlan } = require("./plannerEngine");
const { runLLM } = require("./llmRunner");
const { isActionIntent } = require("./actionIntentDetector");
const { sendTelegramMessage, fetchUpdates, ... } = require("./telegramService");
const { enableRemote, disableRemote, isRemoteEnabled } = require("./remoteControl");
const { verifyToken } = require("./totpManager");
const { searchFileByName } = require("./fileSearch");
const { startWhatsApp, sendMessage } = require("./whatsappBridge");
const { enableBusy, disableBusy, isBusy, getBusyState } = require("./busyMode");
const { isVIP } = require("./vipList");
const { addMissed, formatSummary, clearMissed } = require("./missedTracker");
const { canAutoReply, resetCooldown } = require("./autoReplyGuard");
const { getContact, getAllContacts } = require("./contactBook");
const { takeAeyeSnap } = require("./visualService");
const visionRouter = require("./visionRouter");
const { runOCR } = require("./ocrRunner");
const { isTextHeavy } = require("./visionAnalyzer");
const { createTempFile, safeDelete, cleanupAll } = require("./utils/safeTempManager");
const interaction = require("./agent/interactionModeManager");
const conversionEngine = require("./conversionEngine");
const { classifyScreen } = require("./screenClassifier");
const { runFinalWhisper, runSmallWhisper } = require("./whisperManager");
const { handleScreenAction } = require("./screenActionOrchestrator");
const { agentLoop } = require("./agent/agentLoop");
const { suggestContent } = require("./contentSuggester");
const { maybeRunReflection } = require("./reflectionRunner");
const { openApp, openFolder, ... } = require("./systemActions");
const { connectChatGPT, ... } = require("./aiSwitch");
const { setConfirmation, ... } = require("./confirmManager");

// NEW
const chatHistory = require("@core/memory/chatHistory");
const episodicMemory = require("@core/memory/episodicMemory");
const memory = require("@core/memory/semanticMemory");
const { extractKey } = require("@core/memory/themeExtractor");
const normalize = require("@utils/normalizer");
const classifyIntent = require("@core/intent/intentClassifier");
const { handleIntent } = require("@actions/actions");
const applyPersonality = require("@core/personality/personality");
const llmRouter = require("@providers/llm/llmRouter");
const { getWeather, getNews } = require("@actions/localSkills");
const { processMemoryQuery } = require("@core/reasoning/cognitiveEngine");
const { generatePlan } = require("@core/reasoning/plannerEngine");
const { runLLM } = require("@providers/llm/llmRunner");
const { isActionIntent } = require("@core/intent/actionIntentDetector");
const { sendTelegramMessage, fetchUpdates, ... } = require("@integrations/telegram/telegramService");
const { enableRemote, disableRemote, isRemoteEnabled } = require("@utils/remoteControl");
const { verifyToken } = require("@utils/totpManager");
const { searchFileByName } = require("@utils/fileSearch");
const { startWhatsApp, sendMessage } = require("@integrations/whatsapp/whatsappBridge");
const { enableBusy, disableBusy, isBusy, getBusyState } = require("@utils/busyMode");
const { isVIP } = require("@utils/vipList");
const { addMissed, formatSummary, clearMissed } = require("@utils/missedTracker");
const { canAutoReply, resetCooldown } = require("@utils/autoReplyGuard");
const { getContact, getAllContacts } = require("@utils/contactBook");
const { takeAeyeSnap } = require("@modules/aeye/visualService");
const visionRouter = require("@modules/vision/visionRouter");
const { runOCR } = require("@modules/vision/ocrRunner");
const { isTextHeavy } = require("@modules/vision/visionAnalyzer");
const { createTempFile, safeDelete, cleanupAll } = require("@utils/safeTempManager");
const interaction = require("@agents/interactionModeManager");
const conversionEngine = require("@integrations/telegram/conversionEngine");
const { classifyScreen } = require("@modules/vision/screenClassifier");
const { runFinalWhisper, runSmallWhisper } = require("@modules/stt/whisperManager");
const { handleScreenAction } = require("@modules/vision/screenActionOrchestrator");
const { agentLoop } = require("@agents/agentLoop");
const { suggestContent } = require("@actions/contentSuggester");
const { maybeRunReflection } = require("@modules/reflection/reflectionRunner");
const { openApp, openFolder, ... } = require("@actions/systemActions");
const { connectChatGPT, ... } = require("@providers/llm/aiSwitch");
const { setConfirmation, ... } = require("@core/reasoning/confirmManager");
```

---

### `core/memory/episodicMemory.js`

```js
// OLD
const { scoreImportance } = require("./importanceScorer");
const { embedText } = require("./embeddingModel");       // lazy
const { addVector } = require("./vectorStore");          // lazy

// NEW
const { scoreImportance } = require("@core/memory/importanceScorer");
const { embedText } = require("@providers/llm/embeddingModel");  // lazy
const { addVector } = require("@core/memory/vectorStore");        // lazy
```

---

### `core/memory/semanticMemory.js` (was memory.js)

```js
// OLD
const normalizeKeyExternal = require("./keyNormalizer");
const { embedText } = require("./embeddingModel");   // lazy
const { addVector } = require("./vectorStore");       // lazy

// NEW
const normalizeKeyExternal = require("@core/memory/keyNormalizer");
const { embedText } = require("@providers/llm/embeddingModel");  // lazy
const { addVector } = require("@core/memory/vectorStore");        // lazy
```

---

### `core/reasoning/plannerEngine.js`

```js
// OLD
const { runLLM } = require("./llmRunner");
const { askGemini } = require("./geminiClient");
const { getActiveAI } = require("./aiSwitch");

// NEW
const { runLLM } = require("@providers/llm/llmRunner");
const { askGemini } = require("@providers/external/geminiClient");
const { getActiveAI } = require("@providers/llm/aiSwitch");
```

---

### `providers/llm/llmRouter.js`

```js
// OLD
const { runLLM } = require("./llmRunner");
const chatHistory = require("./chatHistory");
const memory = require("./memory");
const episodicMemory = require("./episodicMemory");
const { buildPrompt } = require("./llmPrompt");
const { getIdentity } = require("./identity");
const { getActiveAI } = require("./aiSwitch");
const { askChatGPT } = require("./chatgptClient");
const { askGemini } = require("./geminiClient");
const { askGroq } = require("./groqClient");

// NEW
const { runLLM } = require("@providers/llm/llmRunner");
const chatHistory = require("@core/memory/chatHistory");
const memory = require("@core/memory/semanticMemory");
const episodicMemory = require("@core/memory/episodicMemory");
const { buildPrompt } = require("@providers/llm/llmPrompt");
const { getIdentity } = require("@core/personality/identity");
const { getActiveAI } = require("@providers/llm/aiSwitch");
const { askChatGPT } = require("@providers/external/chatgptClient");
const { askGemini } = require("@providers/external/geminiClient");
const { askGroq } = require("@providers/external/groqClient");
```

---

### `modules/stt/whisperManager.js`

```js
// OLD
const { isOnBattery } = require("./utils/powerMonitor");
// WHISPER_EXE resolved via: path.resolve(__dirname, "../whisper.cpp/build/bin/whisper-cli.exe")
// SMALL_MODEL resolved via: path.resolve(__dirname, "../whisper.cpp/models/ggml-small.en.bin")

// NEW
const { isOnBattery } = require("@utils/powerMonitor");
const { WHISPER_EXE, SMALL_MODEL_PATH } = require("@utils/pathConfig");
// pathConfig.js reads from process.env.ARVSAL_WHISPER_EXE etc.
```

---

### `services/audio/audioRoutes.js` (split from server.js)

```js
// OLD (in server.js)
// const ffmpegExe = "C:\\Users\\athar\\Downloads\\ffmpeg-8.0.1-essentials_build\\...\\ffmpeg.exe";
// const piperExe = "C:\\Users\\athar\\Downloads\\piper_windows_amd64\\piper\\piper.exe";
// const modelPath = "C:\\Users\\athar\\Downloads\\piper_windows_amd64\\piper\\en_US-ryan-high.onnx";

// NEW
const { FFMPEG_EXE, PIPER_EXE, PIPER_MODEL } = require("@utils/pathConfig");
```

---

### `agents/agentLoop.js`

```js
// OLD
const { captureScreen } = require("../screenCapture");
const { runOCR } = require("../ocrRunner");
const { classifyScreen } = require("../screenClassifier");
const uiState = require("./uiStateStore");
const { buildWorldContext } = require("./worldModel");
const { generatePlan } = require("../plannerEngine");
const { validateStep } = require("./actionValidator");
const { handleScreenAction } = require("../screenActionOrchestrator");
const { evaluateActionFeedback } = require("./actionFeedback");
const { executeSkill, isSkill } = require("./screenSkills/skillRegistry");

// NEW
const { captureScreen } = require("@modules/vision/screenCapture");
const { runOCR } = require("@modules/vision/ocrRunner");
const { classifyScreen } = require("@modules/vision/screenClassifier");
const uiState = require("@agents/uiStateStore");
const { buildWorldContext } = require("@agents/worldModel");
const { generatePlan } = require("@core/reasoning/plannerEngine");
const { validateStep } = require("@agents/actionValidator");
const { handleScreenAction } = require("@modules/vision/screenActionOrchestrator");
const { evaluateActionFeedback } = require("@agents/actionFeedback");
const { executeSkill, isSkill } = require("@agents/skills/skillRegistry");
```

---

### `tools/toolRegistry.js`

```js
// OLD
const memoryTool = require("./memoryTool");
const systemTool = require("./systemTool");
const desktopTool = require("./desktopTool");
const n8nTool = require("./n8nTool");
const LOG_FILE = path.join(__dirname, "../toolExecution.log");

// NEW
const memoryTool = require("@tools/memoryTool");
const systemTool = require("@tools/systemTool");
const desktopTool = require("@tools/desktopTool");
const n8nTool = require("@tools/n8nTool");
const LOG_FILE = path.join(process.env.ARVSAL_LOG_DIR || "./runtime/logs", "toolExecution.log");
```

---

### `tools/memoryTool.js`

```js
// OLD
const memory = require("../memory");
const episodicMemory = require("../episodicMemory");

// NEW
const memory = require("@core/memory/semanticMemory");
const episodicMemory = require("@core/memory/episodicMemory");
```

---

### `modules/wake/wakeWord.js`

```js
// OLD
const PACKAGE_PROFILE_PATH = path.resolve(__dirname, '../node_modules/ava-listener/profiles/arvsal.json');
const LOCAL_PROFILE_PATH = path.resolve(__dirname, 'profiles/arvsal.json');

// NEW
const PACKAGE_PROFILE_PATH = path.resolve(__dirname, '../../node_modules/ava-listener/profiles/arvsal.json');
const LOCAL_PROFILE_PATH = path.resolve(__dirname, '../../config/profiles/arvsal.json');
```

---

### `integrations/email/emailFetcher.js`

```js
// OLD
cookies = JSON.parse(fs.readFileSync("cookies.json"));

// NEW
const { EMAIL_COOKIES_PATH } = require("@utils/pathConfig");
cookies = JSON.parse(fs.readFileSync(EMAIL_COOKIES_PATH));
// EMAIL_COOKIES_PATH = process.env.ARVSAL_SESSION_DIR + "/email/cookies.json"
```

---

### `integrations/telegram/telegramService.js`

```js
// OLD
const saveFolder = "C:\\Users\\athar\\Downloads";

// NEW
const saveFolder = process.env.ARVSAL_DOWNLOAD_DIR || path.resolve(__dirname, "../../runtime/downloads");
```

---

### `modules/aeye/visualService.js`

```js
// OLD
const ffmpegCmd = `ffmpeg -f dshow ...`;   // relies on system PATH

// NEW
const { FFMPEG_EXE } = require("@utils/pathConfig");
const ffmpegCmd = `"${FFMPEG_EXE}" -f dshow ...`;
```

---

### `book/config.py`

```python
# OLD (hardcoded)
OLLAMA_EXE = Path(r"C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe")
SOFFICE_EXE = Path(r"C:\Program Files\LibreOffice\program\soffice.exe")

# NEW (from .env)
import os
OLLAMA_EXE  = Path(os.getenv("ARVSAL_OLLAMA_PATH", r"C:\Users\athar\AppData\Local\Programs\Ollama\ollama.exe"))
SOFFICE_EXE = Path(os.getenv("ARVSAL_SOFFICE_PATH", r"C:\Program Files\LibreOffice\program\soffice.exe"))
```

---

## New File: `utils/pathConfig.js`

This new file centralizes ALL path resolution from environment variables:

```js
// utils/pathConfig.js
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function resolve(envVar, fallback) {
  const v = process.env[envVar];
  if (v) return path.isAbsolute(v) ? v : path.resolve(ROOT, v);
  return path.resolve(ROOT, fallback);
}

module.exports = {
  FFMPEG_EXE:           resolve("ARVSAL_FFMPEG_PATH",         "runtime/ffmpeg/bin/ffmpeg.exe"),
  PIPER_EXE:            resolve("ARVSAL_PIPER_PATH",           "runtime/piper/piper.exe"),
  PIPER_MODEL:          resolve("ARVSAL_PIPER_MODEL",          "runtime/piper/models/en_US-ryan-high.onnx"),
  WHISPER_EXE:          resolve("ARVSAL_WHISPER_EXE",          "runtime/whisper/bin/whisper-cli.exe"),
  SMALL_MODEL_PATH:     resolve("ARVSAL_WHISPER_SMALL_MODEL",  "runtime/whisper/models/ggml-small.en.bin"),
  MEDIUM_MODEL_PATH:    resolve("ARVSAL_WHISPER_MEDIUM_MODEL", "runtime/whisper/models/ggml-medium.bin"),
  DOWNLOAD_DIR:         resolve("ARVSAL_DOWNLOAD_DIR",         "runtime/downloads"),
  TEMP_DIR:             resolve("ARVSAL_TEMP_DIR",             "runtime/temp"),
  LOG_DIR:              resolve("ARVSAL_LOG_DIR",              "runtime/logs"),
  EMAIL_COOKIES_PATH:   resolve("ARVSAL_EMAIL_COOKIES",        "data/sessions/email/cookies.json"),
  MEMORY_DIR:           resolve("ARVSAL_MEMORY_DIR",           "data/memory"),
};
```

---

## Summary of Import Changes

| Category | Files Changed | Total Import Lines Changed |
|---------|--------------|--------------------------|
| services/ | 1 (server.js → 4 route files) | ~40 imports |
| core/ | ~20 files | ~45 imports |
| providers/ | ~10 files | ~25 imports |
| agents/ | ~17 files | ~35 imports |
| modules/ | ~12 files | ~20 imports |
| integrations/ | ~6 files | ~15 imports |
| tools/ | 5 files | ~12 imports |
| safety/ | 2 files | ~4 imports |
| utils/ | ~10 files | ~8 imports |
| actions/ | ~4 files | ~10 imports |
| **TOTAL** | **~90 files** | **~214 import lines** |
