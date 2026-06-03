# ARVSAL Gitignore Audit Report

## 1. Current .gitignore weaknesses

- `package-lock.json`, `yarn.lock`, and `pnpm-lock.yaml` were ignored. These are dependency lock files/config and should generally be tracked when present.
- The file used broad audio ignore rules (`*.wav`, `*.webm`, `*.oga`, `*.ogg`, `*.mp3`, `*.mp4`, `*.m4a`, `*.aac`, `*.flac`) that hid legitimate source assets such as `apps/renderer/assets/yes_sir.wav`.
- Runtime folders were partially missing from ignore rules: `runtime/logs/`, `runtime/ffmpeg/`, `runtime/nircmd/`, `runtime/piper/`, `runtime/sessions/`, `runtime/temp/`, and `runtime/cache/` were not fully ignored.
- Data folders containing runtime-generated state were not ignored: `data/cache/`, `data/memory/`, `data/security/`, and `data/sessions/`.
- `data/security/totp_secret.json` and equivalent sensitive security state were not sufficiently excluded by directory-wide ignore rules.
- `runtime/whisper/` was untracked and is configured in `.gitmodules` as a Git submodule path. This is a special case that may require submodule handling beyond `.gitignore`.

## 2. New entries added

- `runtime/cache/`
- `runtime/ffmpeg/`
- `runtime/logs/`
- `runtime/nircmd/`
- `runtime/piper/`
- `runtime/sessions/`
- `runtime/temp/`
- `runtime/whisper/`
- `data/cache/`
- `data/memory/`
- `data/security/`
- `data/sessions/`

## 3. Entries removed

- `package-lock.json`
- `yarn.lock`
- `pnpm-lock.yaml`
- global runtime audio extension ignore rules:
  - `*.wav`
  - `*.webm`
  - `*.oga`
  - `*.ogg`
  - `*.mp3`
  - `*.mp4`
  - `*.m4a`
  - `*.aac`
  - `*.flac`

## 4. Security findings

- `.env` and `.env.*` are correctly ignored.
- `cookies.json` is ignored.
- `data/security/totp_secret.json` is now covered by `data/security/` and by `totp_secret.json`.
- `runtime/sessions/` now covers WhatsApp/Chromium session stores and browser cache state stored under `runtime/sessions/whatsapp/session/`.
- Backend persistent memory files such as `backend/chat_history.json`, `backend/memory.json`, `backend/episodic_memory.json`, `backend/vector_store.json`, and `backend/reflection_memory.json` remain ignored.

## 5. Runtime artifact findings

- `runtime/sessions/whatsapp/session/` contains machine-specific browser and auth state, cookies, cache DBs, service worker storage, and crash reports. These are runtime-only and should not be tracked.
- `runtime/logs/`, `runtime/ffmpeg/`, `runtime/nircmd/`, `runtime/piper/`, and `runtime/temp/` are generated runtime artifacts and should be ignored.
- `data/memory/`, `data/cache/`, and `data/sessions/` are generated or session persistence directories; they should not be committed.
- `book/audio_tmp/` is the only audio temp folder explicitly ignored, preventing source audio assets from being hidden by an overly broad audio suffix rule.

## 6. Final recommended .gitignore changes

The `.gitignore` file was updated to:

- keep dependency lockfiles tracked by removing lockfile ignore lines
- ignore runtime-specific directories explicitly
- ignore generated data and session directories in `data/`
- narrow audio ignores so only `book/audio_tmp/` remains ignored instead of all `*.wav`, `*.mp3`, etc.

### Key final ignore rules

```gitignore
node_modules/

runtime/cache/
runtime/ffmpeg/
runtime/logs/
runtime/nircmd/
runtime/piper/
runtime/sessions/
runtime/temp/

data/cache/
data/memory/
data/security/
data/sessions/

book/audio_tmp/
```

## Notes

- `runtime/whisper/` is present in the repository as a nested Whisper checkout/submodule path. This path is now listed in `.gitignore`, but because it appears to be handled as a submodule by Git, its final behavior may require submodule configuration or cleanup beyond this audit.
- Source assets such as `apps/renderer/assets/yes_sir.wav` are no longer affected by the previous broad audio ignore rules.
