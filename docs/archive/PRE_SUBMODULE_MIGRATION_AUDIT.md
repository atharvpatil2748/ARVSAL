# PRE_SUBMODULE_MIGRATION_AUDIT

## Scope
- `backend/arvsal-vision`
- `runtime/whisper`
- root repo `.gitmodules`
- related runtime path references for Whisper

## Current findings

### 1. Submodule metadata state
- Root repo has no `.gitmodules` file.
- Root index nevertheless contains gitlink entries for both paths:
  - `backend/arvsal-vision` → mode `160000`, SHA `b0d5c9f5701f7e2be4771872e6e928da77759df3`
  - `runtime/whisper` → mode `160000`, SHA `aa1bc0d1a6dfd70dbb9f60c11df12441e03a9075`
- `git submodule status` fails with:
  - `fatal: no submodule mapping found in .gitmodules for path 'backend/arvsal-vision'`
- `git config --get-regexp '^submodule\.'` returns nothing.

### 2. Nested repo remote state
- `backend/arvsal-vision/.git/config` remote:
  - `url = https://github.com/microsoft/OmniParser.git`
  - `branch = master`
- `runtime/whisper/.git/config` remote:
  - `url = https://github.com/ggerganov/whisper.cpp`
  - `branch = master`
- Nested repo HEADs are on master and match the index gitlink SHAs.

### 3. Git status behavior
- `git status --short backend/arvsal-vision runtime/whisper` shows:
  - `m backend/arvsal-vision`
  - `? runtime/whisper`
- This is an inconsistent state: a tracked gitlink path alongside a missing `.gitmodules` mapping produces both modified and untracked indicators.

### 4. Runtime / source dependency state
- `utils/pathConfig.js` resolves Whisper paths from `runtime/whisper`:
  - `runtime/whisper/build/bin/whisper-cli.exe`
  - `runtime/whisper/models/ggml-small.bin`
  - `runtime/whisper/models/ggml-medium.bin`
- `.env` uses the same runtime paths:
  - `ARVSAL_WHISPER_EXE=./runtime/whisper/build/bin/whisper-cli.exe`
  - `ARVSAL_WHISPER_SMALL_MODEL=./runtime/whisper/models/ggml-small.bin`
  - `ARVSAL_WHISPER_MEDIUM_MODEL=./runtime/whisper/models/ggml-medium.bin`
- Current JS/TS source search shows no active `whisper.cpp` path references in application code, aside from comments in `backend/server.js`.

### 5. Stale configuration paths
- `.vscode/settings.json` still points to the legacy path:
  - `C:/Users/athar/Desktop/arvsal/whisper.cpp`

### 6. Documentation state
- Multiple migration documents continue to describe the desired moves:
  - `backend/arvsal-vision/` → `vision/`
  - `whisper.cpp/` → `stt/whisper.cpp/`
- The project already appears to have relocated the Whisper submodule directory to `runtime/whisper`, while docs still use the old `whisper.cpp` path.

## Risk assessment

### Critical risks
- Missing `.gitmodules` with existing gitlink entries leaves the repo in a broken submodule state.
- Performing `git mv` without restoring `.gitmodules` first may orphan the submodule metadata.
- `runtime/whisper` is currently both a nested repo and a directory path referenced by live runtime config; moving it incorrectly could break the Whisper binary path chain.

### Non-critical but important issues
- Stale `.vscode/settings.json` reference is low-risk but should be updated to avoid confusion.
- Documentation still mentioning `whisper.cpp/` must be reconciled with the current `runtime/whisper` implementation.

## Recommended pre-migration actions

1. Recreate `.gitmodules` from the current root index state before moving anything.
   - Example entries:
     ```ini
     [submodule "backend/arvsal-vision"]
       path = backend/arvsal-vision
       url = https://github.com/microsoft/OmniParser.git

     [submodule "runtime/whisper"]
       path = runtime/whisper
       url = https://github.com/ggerganov/whisper.cpp
     ```
2. `git add .gitmodules` and validate with `git submodule status`.
3. Confirm current nested repo SHA state:
   - `backend/arvsal-vision` HEAD commit: `b0d5c9f5701f7e2be4771872e6e928da77759df3`
   - `runtime/whisper` HEAD commit: `aa1bc0d1a6dfd70dbb9f60c11df12441e03a9075`
4. After `.gitmodules` is restored, move submodules with Git-aware commands.

## Recommended safe migration plan

1. Restore `.gitmodules` with current paths and urls.
2. Validate the submodule index state.
3. Move the submodules with `git mv`:
   - `git mv backend/arvsal-vision vision`
   - `git mv runtime/whisper stt/whisper.cpp`
4. Update `.gitmodules` to the new paths:
   ```ini
   [submodule "vision"]
     path = vision
     url = https://github.com/microsoft/OmniParser.git

   [submodule "stt/whisper.cpp"]
     path = stt/whisper.cpp
     url = https://github.com/ggerganov/whisper.cpp
   ```
5. `git add .gitmodules` and commit the metadata change.
6. Run:
   - `git status`
   - `git submodule status`
   - `git config --get-regexp '^submodule\.'`

## Validation checklist

- [ ] `.gitmodules` exists and contains both `backend/arvsal-vision` and `runtime/whisper` or the updated path equivalents.
- [ ] `git submodule status` reports both submodules without fatal errors.
- [ ] `git status` shows moved submodule paths cleanly.
- [ ] No active application code still resolves `whisper.cpp` directly.
- [ ] `.vscode/settings.json` no longer points at `C:/Users/athar/Desktop/arvsal/whisper.cpp`.

## Conclusion
The repository is currently in an incomplete submodule migration state. Both target directories are present as nested Git repositories and as gitlink entries in the root index, but root metadata is missing. The next safe step is to restore `.gitmodules` before performing any further submodule path relocation.
