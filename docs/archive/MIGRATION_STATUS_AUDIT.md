# Migration Status Audit

**Generated:** 2026-06-02
**Target:** Validation of V2 Source Tree Migration against `ARVSAL_MANUAL_RESTRUCTURE_EXECUTION_GUIDE.md`

## 1. Migration Progress Estimate
**Total Progress: ~70% Complete**
The majority of the source code restructuring (Phase D) and import aliasing (Phase F) has been completed. The runtime binary separation (Phase A) is fully complete. However, Data Migration (Phase B), Config Migration (Phase G), Dead Code Removal (Phase C), and Submodule reorganization are still pending.

## 2. Domain Checklist

| Domain | Status | Notes |
|--------|--------|-------|
| **Runtime Migration** | COMPLETE | FFmpeg, Piper, Whisper, and downloads are fully isolated in `runtime/`. |
| **Electron Shell** | COMPLETE | Moved to `apps/electron` and `apps/renderer`. `package.json` updated. |
| **Core Intent** | COMPLETE | All 5 files moved to `core/intent/`. |
| **Core Memory** | COMPLETED WITH DEVIATIONS | Source files successfully moved, but runtime `.json` data files (`episodic_memory.json`, etc.) were incorrectly copied/left in both `core/memory/` and `backend/` instead of `data/memory/`. |
| **Core Reasoning** | COMPLETE | `cognitiveEngine.js`, `plannerEngine.js`, `confirmManager.js` moved. |
| **Core Personality** | COMPLETE | All 3 files moved correctly. |
| **Providers (LLM + External)** | COMPLETE | Organized cleanly under `providers/llm/` and `providers/external/`. |
| **Agents** | COMPLETED WITH DEVIATIONS | Files moved to `agents/`, but orphaned empty directories (`backend/agent/screenSkills/`) remain in the old tree. |
| **Modules (STT, Vision, Wake, Reflection, AEye)** | COMPLETE | Source files moved. Wake profile pathing repaired in previous audit. Whisper pathing repaired in previous audit. |
| **Modules (TTS)** | NOT STARTED | `ttsEngine.js` and `tts.js` remain in `backend/` (marked as dead code in the guide, but never deleted). |
| **Telegram** | COMPLETE | Moved to `integrations/telegram/`. |
| **WhatsApp** | COMPLETE | Moved to `integrations/whatsapp/`. Sessions mapped to `runtime/`. |
| **Email** | COMPLETED WITH DEVIATIONS | Files moved, but `emailFetcher.js` contains a broken hardcoded `execSync("node backend/email/saveSession.js")` that will fail on re-auth. |
| **Tools** | COMPLETE | All tools moved to `tools/`. Old `backend/tools/` is an empty orphan. |
| **Safety** | COMPLETE | Moved to `safety/`. Old `backend/safety/` is an empty orphan. |
| **Utils** | COMPLETED WITH DEVIATIONS | `pathConfig.js` was **never created**. Instead, paths were resolved using `path.resolve(__dirname, "../../...")` manually. |
| **Actions** | COMPLETE | Moved to `actions/`. |
| **Data** | NOT STARTED | Memory JSON files, `toolExecution.log`, and `totp_secret.json` still pollute `backend/` and `core/memory/`. |
| **Config** | NOT STARTED | `book/config.py` still contains hardcoded absolute paths. |
| **Documentation** | NOT STARTED | `docs/` is empty; all `.md` files remain at the repository root. |
| **Submodules** | NOT STARTED | `backend/arvsal-vision` and `whisper.cpp` have not been moved. |
| **Packaging** | COMPLETE | `package.json` main entry is correctly `apps/electron/main.js`. |

## 3. Guide Inaccuracies & Discoveries

### Hidden Dependencies Discovered
The following active or stub files exist in `backend/` but were **completely omitted** from the migration guide:
- `backend/ai.js`
- `backend/espeak.js`
- `backend/executorEngine.js`
- `backend/llmDebug.js`
- `backend/topicMemory.js`
- `backend/topicTracker.js`

### Guide Inaccuracies
1. **TTS Deletion:** The guide treats `ttsEngine.js` and `tts.js` as dead code for Phase C, but there is no `modules/tts/` domain created for any active TTS logic, leaving a logical gap in the domain map.
2. **Path Resolution Fallback:** The guide mandated the creation of `utils/pathConfig.js` for centralized path logic. This was skipped in favor of hardcoded relative path offsets (e.g., `../..`). While functional, it deviates from the architectural plan.

## 4. Remaining High-Risk Work
1. **`emailFetcher.js` Hardcode:** The `execSync` call to `backend/email/saveSession.js` will cause a fatal crash the moment an email session expires.
2. **Git Submodule Relocation:** Moving `backend/arvsal-vision` and `whisper.cpp` requires careful `.gitmodules` manipulation. If done incorrectly, Git will orphan the submodules.
3. **Data Isolation (Phase B):** The `memory.json` and `vector_store.json` files must be strictly isolated to `data/memory/` and removed from the source tree to prevent Git corruption and state desync.
4. **Unmapped Files:** The 6 hidden files discovered in `backend/` (`topicMemory.js`, etc.) need a domain assignment, or they will remain orphaned alongside `server.js`.

## 5. Guide Deviations
- `pathConfig.js` was not created.
- `.json` data files were duplicated into `core/memory/` instead of isolated in `data/memory/`.
- Orphaned empty directories (`backend/agent`, `backend/email`, etc.) were not deleted after their files were moved.

## 6. Recommended Next Domain
**Phase B (Data Isolation) + Orphan Cleanup**
Before moving submodules or touching configs, the project must clean up the scattered `.json` state files and delete the empty orphaned directories in `backend/`. 

## 7. Do Not Touch Yet
- **`backend/server.js`:** The monolith remains intact and functional. Do not attempt to split it until Data and Config migrations are 100% complete and validated.
- **Git Submodules (`backend/arvsal-vision`, `whisper.cpp`):** Leave these until the very end, as they are the most likely to cause Git index corruption during restructuring.
