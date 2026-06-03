# ARVSAL Restructure Readiness Report
**Generated:** 2026-05-30 | **Phase:** 8 of 8

---

## Executive Summary

ARVSAL is a production-active, complex AI assistant with **~110 active source files**, **7 hardcoded external paths**, **1 monolithic 1828-line server**, and **~490 MB of untracked runtime artifacts** (models/binaries) outside the repo. The restructuring is **high-reward** but must be executed in ordered phases to avoid breaking the running system.

---

## Scores

| Metric | Score | Notes |
|--------|-------|-------|
| **Complexity** | 8 / 10 | ~110 source files, monolith decomposition, path rewiring |
| **Risk** | 6 / 10 | System is live/active; wrong import breaks entire runtime |
| **Estimated Effort** | 3–5 days | Careful, tested migration |
| **Automation Potential** | 9 / 10 | Phase 5 can be scripted — file moves + sed for imports |
| **Breaking Change Risk** | Medium | All import paths change; no logic changes needed |
| **Rollback Difficulty** | Low | Git history preserves original; can revert any phase |

---

## Quantified Impact

| Category | Count |
|---------|-------|
| Files to move | ~110 source files |
| Files to delete | ~12 dead/duplicate files |
| Import lines to update | ~214 |
| Hardcoded paths to fix | 7 |
| Environment variables to add | 10 |
| New directories to create | ~35 |
| New files to create | 3 (`pathConfig.js`, `setup-runtime.js`, `health-check.js`) |
| Data (gitignore) to relocate | ~2 MB JSON + 6 MB screenshots |
| Runtime binaries to move | ~600 MB (FFmpeg + Piper + Whisper models) |
| Duplicate files to delete | 1 × 487 MB (whisper model duplicate) |

---

## Risk Analysis by Component

| Component | Risk | Why |
|-----------|------|-----|
| `server.js` decomposition | 🔴 HIGH | All routes + helpers must be split without losing state sharing |
| Import path rewiring | 🟡 MEDIUM | ~214 changes, but purely mechanical — no logic |
| Hardcoded path fixing | 🟡 MEDIUM | 7 locations; must ensure env vars load before path reads |
| Memory JSON relocation | 🟢 LOW | Just update `path.join(__dirname, ...)` references |
| Runtime binary moves | 🟢 LOW | Binaries are external; just update path in `.env` |
| WhatsApp session move | 🟡 MEDIUM | whatsapp-web.js path must be explicitly set in config |
| Profile path update (wakeWord) | 🟢 LOW | Single path change in `wakeWord.js` |
| Book engine config | 🟢 LOW | Python strings in `config.py` → os.getenv() |
| whisper.cpp submodule | 🟢 LOW | Submodule reference update only |
| Dead code deletion | 🟢 LOW | Verified non-referenced files only |

---

## Breaking Change Risks

### 1. `server.js` Split (HIGHEST RISK)
**Risk:** Shared module-level state (e.g., `_heavyBusy`, `_pendingSuggestion`, `speaking`, `streamFullText`) must survive decomposition.
**Mitigation:** Extract shared state into a `services/state.js` singleton before splitting routes.

### 2. Lazy Requires Inside Switch Cases
**Risk:** `server.js` uses `require()` inside switch-case blocks. Moving files invalidates these paths.
**Mitigation:** Convert all lazy requires to top-level imports during migration.

### 3. `whatsapp-web.js` Auth Path
**Risk:** `whatsapp-web.js` stores its session by default at the process CWD. Moving `.wwebjs_auth/` requires passing explicit `authStrategy` config.
**Mitigation:** Add `LocalAuth({ dataPath: process.env.ARVSAL_SESSION_DIR })` to whatsappBridge.js.

### 4. `module-alias` Bootstrap Order
**Risk:** `require('module-alias/register')` must be the FIRST line in any entry point using `@` aliases.
**Mitigation:** Add to `services/server.js` line 1 AND `apps/electron/main.js` line 1.

### 5. Whisper DLL Loading
**Risk:** `whisper-cli.exe` requires DLLs to be in the same directory (CWD = `bin/`). Moving the binary invalidates `WHISPER_CWD`.
**Mitigation:** Set `WHISPER_CWD = path.dirname(WHISPER_EXE)` — this is already done in whisperManager.js.

---

## Recommended Migration Order

> Execute phases strictly in order. Each phase must pass a smoke test before proceeding.

### Phase A — Preparation (Day 1 Morning)
1. Create `runtime/` directory skeleton with `setup-runtime.js`
2. Copy (not move) all external binaries into `runtime/`
3. Create `utils/pathConfig.js`
4. Add environment variables to `.env`
5. Update `whisperManager.js` to use `pathConfig.js`
6. Update `ttsEngine.js`/server.js Piper references to use `pathConfig.js`
7. Update `telegramService.js` download folder reference
8. **Smoke test:** Start backend, confirm STT and TTS still work

### Phase B — Data Isolation (Day 1 Afternoon)
1. Create `data/` directory structure
2. Copy (not move) all `backend/*.json` files to `data/memory/`
3. Update all `path.join(__dirname, "memory.json")` etc. to read from `pathConfig.js`
4. Move `cookies.json` → `data/sessions/email/cookies.json`
5. Update `emailFetcher.js` cookie path
6. Move `.wwebjs_auth/`, `.wwebjs_cache/` → `data/sessions/whatsapp/`
7. Update whatsapp-web.js `dataPath` config
8. **Smoke test:** Confirm memory load/save, WhatsApp auth, email fetch

### Phase C — Dead Code Removal (Day 2 Morning)
1. Delete `backend/ttsEngine.js`, `backend/tts.js`, `backend/espeak.js`, `backend/llmDebug.js`
2. Remove commented-out code blocks in `llmRunner.js`, `episodicMemory.js`, `plannerEngine.js`
3. Delete `electron/arv-sal_en_windows_v4_0_0.ppn`
4. Delete `whisper.cpp/ggml-small.en.bin` (487 MB duplicate)
5. Delete `backend/logs/screenshot.png`, `fix_log.py`, `README.pdf`, `planner.mf` (investigate first)
6. Move dev docs to `docs/archive/`
7. **Smoke test:** Full startup with no import errors

### Phase D — Directory Restructuring (Day 2 Afternoon – Day 3)
1. Create all target directories from `ARVSAL_V2_FOLDER_STRUCTURE.md`
2. Move files per `ARVSAL_MIGRATION_PLAN.md` — one domain at a time:
   - `core/` (memory, intent, reasoning, personality)
   - `providers/` (LLM, external AI clients)
   - `modules/` (STT, TTS, vision, wake, reflection)
   - `integrations/` (Telegram, WhatsApp, email)
   - `tools/`, `safety/`, `utils/`, `actions/`
   - `agents/` (agent loop + skills)
   - `apps/` (Electron shell)
3. After each domain move, update all imports in that domain
4. **Smoke test after each domain**

### Phase E — Server Decomposition (Day 4)
1. Extract shared state from `server.js` → `services/state.js`
2. Extract audio routes → `services/audio/audioRoutes.js`
3. Extract /command route → `services/command/commandRoute.js`
4. Extract /speak route → `services/tts/ttsRoute.js`
5. Extract Telegram listener → `integrations/telegram/telegramListener.js`
6. Extract WhatsApp listener → `integrations/whatsapp/whatsappListener.js`
7. Create thin `services/server.js` that mounts all routes
8. **Smoke test:** Full E2E — voice → Whisper → command → LLM → Piper TTS

### Phase F — Import Alias System (Day 5)
1. Install `module-alias`: `npm install module-alias`
2. Add `_moduleAliases` to `package.json`
3. Add `require('module-alias/register')` to all entry points
4. Replace all relative imports with `@` aliases per `ARVSAL_IMPORT_REFACTOR_PLAN.md`
5. Update `package.json` scripts if needed
6. **Final smoke test:** Complete end-to-end system test

### Phase G — Book Engine + Config (Day 5 Afternoon)
1. Update `book/config.py` to use `os.getenv()` for all hardcoded paths
2. Move wake word profiles to `config/profiles/`
3. Update `wakeWord.js` profile paths
4. Create `.env.example` with all variable keys (no values)
5. Update `.gitignore` with new `runtime/`, `data/` rules
6. **Final validation:** Run health-check script

---

## Automation Opportunity

The following phases can be fully scripted (no manual judgment needed):

```bash
# Example: Auto-update import paths after file moves
# Rewrites all require("./memory") → require("@core/memory/semanticMemory")
# Can be implemented as a Node.js script using AST transformation (jscodeshift)
# or simple regex replacement for mechanical 1:1 renames

node scripts/rewrite-imports.js
```

A `scripts/migrate.js` can handle:
- Creating directories
- Moving files  
- Rewriting `require()` paths using a mapping table derived from `ARVSAL_MIGRATION_PLAN.md`

This would reduce the 3–5 day estimate to **1 day of validation + review**.

---

## Post-Migration Checklist

- [ ] `node scripts/health-check.js` passes all checks
- [ ] `npm run backend` starts without errors
- [ ] Wake word detection triggers correctly
- [ ] Voice → Whisper → STT works
- [ ] LLM response via Ollama works
- [ ] Piper TTS audio plays in renderer
- [ ] Telegram bot receives and responds
- [ ] WhatsApp bridge initializes
- [ ] Memory load/save persists across restarts
- [ ] Agent loop executes a screen action
- [ ] No `Cannot find module` errors in console
- [ ] All `.json` data files load from `data/memory/`
- [ ] All temp files created in `runtime/temp/`
- [ ] Logs written to `runtime/logs/`
- [ ] `episodic_memory.json` not growing unbounded (add rotation if needed)
- [ ] `.env` has no hardcoded absolute Windows paths

---

## Long-Term Recommendations

| Recommendation | Priority | Effort |
|---------------|----------|--------|
| Add episodic memory rotation (cap at 5000 entries) | HIGH | 30 min |
| Split `server.js` monolith | HIGH | 1 day |
| Add `module-alias` path aliases | HIGH | 2 hrs |
| Create `utils/pathConfig.js` | HIGH | 1 hr |
| Add health check at startup | MEDIUM | 2 hrs |
| Add TypeScript types (JSDoc at minimum) | MEDIUM | Ongoing |
| Write integration tests for audio pipeline | MEDIUM | 1 day |
| Add proper logging library (winston/pino) | MEDIUM | 4 hrs |
| SQLite for memory instead of flat JSON | LOW | 2 days |
| Docker container for Python workers | LOW | 1 day |
| Formal API contract (OpenAPI spec) | LOW | 1 day |
