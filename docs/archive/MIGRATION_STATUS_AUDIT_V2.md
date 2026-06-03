# Migration Status Audit V2

**Generated:** 2026-06-02
**Target:** Current source tree verification for ARVSAL V2 migration.

## 1. Overall Completion Estimate
**Estimated Completion: ~82%**

The repository has completed the majority of the core migration work. The primary outstanding items are cleanup of legacy backend stubs, `book/config.py` hardcoded paths, root-level documentation archival, and final safe submodule reorganization.

## 2. Domain Checklist

| Domain | Status | Notes |
|--------|--------|-------|
| **Runtime Migration** | COMPLETE | `runtime/` now contains the expected binaries and support directories. `utils/pathConfig.js` centralizes runtime paths. |
| **Electron Shell** | COMPLETE | Electron app remains in `apps/electron` and `apps/renderer`. |
| **Core Intent** | COMPLETE | Intent files are already consolidated under `core/intent/`. |
| **Core Memory** | COMPLETE | `core/memory/*` now resolve exclusively to `data/memory/` via `pathConfig.MEMORY_DIR`. No `.json` files remain in `core/memory/`. |
| **Core Reasoning** | COMPLETE | Reasoning modules are already migrated. |
| **Core Personality** | COMPLETE | Personality modules are migrated and active. |
| **Providers (LLM + External)** | COMPLETE | LLM and external provider files are organized under `providers/`. |
| **Agents** | COMPLETE WITH DEVIATIONS | Agent logic is migrated, but legacy empty backend directories remain under `backend/agent`. |
| **Modules (STT, Vision, Wake, Reflection, AEye)** | COMPLETE | `modules/stt/whisperManager.js` and VAD startup are wired correctly; vision and reflection modules are migrated. |
| **Modules (TTS)** | PARTIALLY COMPLETE | Active TTS runtime is inline in `backend/server.js` and the live system uses Piper, but legacy stubs remain in `backend/`. |
| **Telegram** | COMPLETE | Telegram integration is migrated correctly. |
| **WhatsApp** | COMPLETE | WhatsApp integration is migrated correctly. |
| **Email** | COMPLETE | `integrations/email/emailFetcher.js` uses `@utils/pathConfig` and calls `saveSession.js` with `path.resolve(__dirname, "saveSession.js")`. |
| **Tools** | COMPLETE WITH DEVIATIONS | Tools are migrated, but legacy empty `backend/tools` remains. |
| **Safety** | COMPLETE WITH DEVIATIONS | Safety code is migrated, but legacy empty `backend/safety` remains. |
| **Utils** | COMPLETE | `utils/pathConfig.js` exists and is actively used by memory, email, Telegram, and Whisper modules. |
| **Actions** | COMPLETE | Action files are migrated. |
| **Data** | COMPLETE WITH DEVIATIONS | Memory state is canonicalized to `data/memory/`; `data/security/totp_secret.json` exists. A stale `backend/logs/toolExecution.log` artifact remains. |
| **Config** | PARTIALLY COMPLETE | `book/config.py` still had hardcoded Windows paths at runtime. A fix has now been applied to use `OLLAMA_EXE` and `SOFFICE_EXE` from environment variables. |
| **Documentation** | NOT STARTED | Root-level analysis docs remain at the repo root and have not yet been archived into `docs/archive/`. |
| **Submodules** | PARTIALLY COMPLETE | `backend/arvsal-vision` and `whisper.cpp` are preserved in place. Final `git mv` reorganization has not yet occurred. |
| **Packaging** | COMPLETE | `package.json` points to the Electron entry and packaging remains intact. |

## 3. Verified Fixes

- `integrations/email/emailFetcher.js` no longer hardcodes `backend/email/saveSession.js` in a branch of its logic; it uses `path.resolve(__dirname, "saveSession.js")`.
- `utils/pathConfig.js` is present and used by:
  - `core/memory/semanticMemory.js`
  - `core/memory/episodicMemory.js`
  - `core/memory/chatHistory.js`
  - `core/memory/reflectionMemory.js`
  - `core/memory/vectorStore.js`
  - `modules/stt/whisperManager.js`
  - `integrations/telegram/telegramService.js`
- `backend/server.js` imports `@modules/stt/whisperManager` and starts the persistent VAD worker:
  - `process.nextTick(() => vadManager.startPersistentWorker().catch(() => {}));`
- No `.json` files exist in `core/memory/` and `data/memory/` contains the canonical memory store.

## 4. Hidden Backend Files Discovered

The following legacy backend files are present and appear to be unreferenced by active code paths:
- `backend/ai.js`
- `backend/espeak.js`
- `backend/executorEngine.js`
- `backend/llmDebug.js`
- `backend/topicMemory.js`
- `backend/topicTracker.js`
- `backend/tts.js`
- `backend/ttsEngine.js`

These files are currently only referenced from migration documentation, not from runtime source.

## 5. Remaining Work

1. Delete legacy backend stubs and remove orphan backend directories.
2. Archive root-level migration documents into `docs/archive/`.
3. Remove stale `backend/logs/toolExecution.log` if it is a duplicate artifact.
4. Finalize submodule path changes for `backend/arvsal-vision`, `whisper.cpp`, and `.gitmodules` after cleanup.

## 6. Risk Notes

- `backend/server.js` must be preserved and should not be split until cleanup is complete.
- `backend/arvsal-vision` and `whisper.cpp` must remain undisturbed until submodule relocation is planned.
- The main migration risk remaining is stale legacy backend state rather than active runtime wiring.
