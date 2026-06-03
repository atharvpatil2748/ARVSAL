# Migration Remaining Work Checklist

Based on current repo validation, the following tasks remain outstanding.

## 1. Confirmed Completed
- [x] `integrations/email/emailFetcher.js` uses `require("@utils/pathConfig").EMAIL_COOKIES_PATH` and `path.resolve(__dirname, "saveSession.js")`.
- [x] All core memory modules now reference `pathConfig.MEMORY_DIR`.
- [x] No `.json` files remain under `core/memory/`.
- [x] `backend/server.js` imports `@modules/stt/whisperManager` and starts the persistent VAD worker from `backend/vadManager.js`.
- [x] `utils/pathConfig.js` exists and is actively used.
- [x] `data/security/totp_secret.json` is present.
- [x] `docs/archive/` exists.

## 2. Pending Phase C Cleanup
- [ ] Remove orphan empty backend directories:
  - `backend/agent`
  - `backend/agent/screenSkills`
  - `backend/email`
  - `backend/safety`
  - `backend/tools`
  - `backend/utils`
- [ ] Review and remove legacy dead backend stubs if confirmed unreferenced:
  - `backend/tts.js`
  - `backend/ttsEngine.js`
  - `backend/espeak.js`
  - `backend/llmDebug.js`
  - `backend/ai.js`
  - `backend/executorEngine.js`
  - `backend/topicMemory.js`
  - `backend/topicTracker.js`
- [ ] Remove stale log artifact if it is not required:
  - `backend/logs/toolExecution.log`
- [ ] Archive root-level migration documentation into `docs/archive/`.
- [ ] Update `book/config.py` to load `OLLAMA_EXE` and `SOFFICE_EXE` from environment variables instead of hardcoded absolute Windows paths.

## 3. Pending Phase G / Submodule Work
- [ ] Preserve and later relocate submodules safely:
  - `backend/arvsal-vision`
  - `whisper.cpp`
  - `.gitmodules`
- [ ] Update `.gitmodules` only after cleanup is complete.
