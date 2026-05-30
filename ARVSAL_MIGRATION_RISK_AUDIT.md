# ARVSAL Migration Risk Audit

**Date:** 2026-05-30
**Target Document:** ARVSAL_MANUAL_RESTRUCTURE_EXECUTION_GUIDE.md
**Objective:** Critical review of migration instructions to identify technical blindspots, architectural risks, and potential breakage points before execution.

---

## 1. Incorrect Assumptions
**Severity:** CRITICAL
**Description:** The guide assumes that simply moving `electron/main.js` to `apps/electron/main.js` is sufficient for startup. However, the `package.json` `"main"` field points to the original location.
**Why it is dangerous:** Running `npm start` or `electron .` will instantly crash with `Error: Cannot find module 'electron/main.js'`, preventing the application from even launching.
**Mitigation:** Add an explicit step in Phase D to update the `package.json` `"main"` field to `"apps/electron/main.js"`.

## 2. Missing Dependencies
**Severity:** MEDIUM
**Description:** The guide instructs the user to `npm install module-alias` but does not specify installing it as a standard dependency vs devDependency.
**Why it is dangerous:** If installed as a devDependency (`npm i -D`), it will not be bundled when building the Electron app for production, causing fatal runtime crashes.
**Mitigation:** Explicitly specify `npm install module-alias --save` in the guide.

## 3. Missing Import Updates
**Severity:** HIGH
**Description:** The path to `apps/renderer/index.html` within `apps/electron/main.js`. 
**Why it is dangerous:** In V1, `main.js` loaded the HTML via `loadFile('renderer/index.html')`. In V2, `main.js` has moved one level deeper (or parallel) relative to the `renderer` folder. If `mainWindow.loadFile` isn't updated to reflect the new relative path (e.g., `../renderer/index.html`), the Electron window will open to a blank white screen.
**Mitigation:** Add a step in Phase D to update the `BrowserWindow.loadFile()` relative path in `apps/electron/main.js`.

## 4. Circular Dependency Risks
**Severity:** HIGH
**Description:** The extraction of shared state to `services/state.js`.
**Why it is dangerous:** If `state.js` attempts to import any helper functions or configuration from other route files to manage its state, it will create a Node.js circular dependency. This results in imported modules resolving as empty objects `{}`, causing cryptic `TypeError: X is not a function` crashes.
**Mitigation:** Explicitly document that `services/state.js` must be a pure POJO (Plain Old JavaScript Object) with getters/setters and MUST NOT import any other internal modules.

## 5. Runtime Breakage Risks (Child Processes)
**Severity:** CRITICAL
**Description:** The use of `@aliases` within child processes.
**Why it is dangerous:** The guide updates `integrations/email/saveSession.js` to use `@utils/pathConfig`. However, this file is executed via a separate `execSync("node ...")` call. Child processes do NOT inherit the `module-alias` registry from the main `server.js`. The child process will crash with `Cannot find module '@utils/pathConfig'`.
**Mitigation:** Add a strict rule: Any file executed directly via `spawn`, `exec`, or `execSync` must include `require('module-alias/register')` at the very top of that specific file.

## 6. IPC Breakage Risks
**Severity:** LOW
**Description:** The guide correctly identifies that IPC routes remain unchanged because they use HTTP POST (`localhost:3000`).
**Why it is dangerous:** If any IPC channels relied on relative file paths passed from Renderer to Main to Backend, they would break. Fortunately, ARVSAL uses standard HTTP payload routing.
**Mitigation:** Ensure that `services/server.js` starts fully before the Electron renderer sends any startup IPC commands. 

## 7. Express Route Registration Risks
**Severity:** HIGH
**Description:** Breaking the 1828-line `server.js` into domain routes (`services/audio/audioRoutes.js`).
**Why it is dangerous:** The guide skips the Express Router boilerplate. If developers just copy-paste `app.post(...)` blocks into the new files without wrapping them in `const router = express.Router(); module.exports = router;` and properly mounting them with `app.use('/', audioRoutes)` in `server.js`, all endpoints will 404. Furthermore, global middleware (like `express.json()`) must be mounted *before* the routers.
**Mitigation:** Provide a code snippet in Phase E showing exactly how to wrap the extracted code in `express.Router()` and mount it in `services/server.js`.

## 8. Socket.IO Risks
**Severity:** MEDIUM
**Description:** Potential detachment of WebSockets during server decomposition.
**Why it is dangerous:** If ARVSAL uses Socket.IO for streaming audio (e.g., `arvsal:streamAudio`), extracting routes into separate files disconnects them from the global `io` instance. Event emitters inside `audioRoutes.js` won't have access to the socket to stream data back to the client.
**Mitigation:** If Socket.IO is used, implement a dependency injection pattern where the `io` instance is passed to the router: `module.exports = function(io) { ... }`.

## 9. Frontend Build Risks
**Severity:** MEDIUM
**Description:** Asset path resolution in `apps/renderer/index.html`.
**Why it is dangerous:** The guide moves CSS to `styles/` and Audio to `assets/`. While it mentions updating `<link>` tags, dynamically loaded assets (e.g., JS creating an `Audio('yes_sir.wav')` object) will fail if their paths are hardcoded in `ui.js`.
**Mitigation:** Audit `apps/renderer/ui.js` for any hardcoded relative paths to assets and update them to point to `assets/`.

## 10. Electron-Specific Risks (ASAR Packaging)
**Severity:** CRITICAL
**Description:** Hardcoding binary paths resolving to `__dirname` inside an ASAR archive.
**Why it is dangerous:** When an Electron app is built for production, all source files are packed into a read-only `app.asar` archive. If `pathConfig.js` resolves `runtime/whisper-cli.exe` relative to `__dirname`, Node will attempt to spawn an executable located *inside* the `.asar` file, which the Windows OS will reject with an `ENOENT` error. The entire AI pipeline will fail in production.
**Mitigation:** Document that `runtime/` must be explicitly excluded from the ASAR packing process (`asarUnpack`), and `pathConfig.js` must handle production paths using `process.resourcesPath` or `app.getAppPath().replace('app.asar', 'app.asar.unpacked')`.

## 11. Dead-Code False Positives
**Severity:** HIGH
**Description:** The deletion of `arv-sal_en_windows_v4_0_0.ppn`.
**Why it is dangerous:** The guide claims it's orphaned because `ava-listener` is used. However, `ava-listener` is likely a wrapper that still requires the underlying Picovoice `.ppn` model file to detect the specific "Arvsal" wake word. If the `config/profiles/arvsal.json` internally points to this `.ppn` file, deleting it will completely break wake word detection.
**Mitigation:** Before deleting, inspect the contents of `arvsal.json` to confirm it does not reference the `.ppn` file. Keep the `.ppn` file in `config/profiles/` if referenced.

## 12. Model Migration Risks
**Severity:** MEDIUM
**Description:** Inconsistency in YOLO vision model naming.
**Why it is dangerous:** `python_worker/config.py` references `ui_yolo.pt`, while `yolo_detector.py` references `yolo_ui.pt`. Moving the file as `yolov8n.pt` requires updating the Python scripts. If Python scripts run with a different Working Directory than expected, the relative paths to the model will fail.
**Mitigation:** Ensure `pythonBridge.js` explicitly passes the `--model` path as a CLI argument to the Python script, relying on `pathConfig.js`, rather than hardcoding paths inside the Python code.

## 13. Path Alias Conflicts
**Severity:** LOW
**Description:** Using `@` for `module-alias`.
**Why it is dangerous:** While common, if the project ever installs a third-party npm package under a scoped namespace (e.g., `@core/some-lib`), the `module-alias` interceptor will hijack the require call, breaking the third-party library. 
**Mitigation:** Use strict regex boundaries in `_moduleAliases` or switch to the `#` prefix native to Node.js (e.g., `#core/intent`) utilizing `package.json` `imports` if using Node v12.20+.

## 14. Environment Variable Conflicts
**Severity:** MEDIUM
**Description:** `.env` using relative paths (e.g., `./runtime/ffmpeg/bin/ffmpeg.exe`).
**Why it is dangerous:** Relative paths are resolved against the `process.cwd()`. If a developer launches the app from inside the `apps/` directory instead of the project root, all paths will resolve incorrectly, crashing the external binaries.
**Mitigation:** The `utils/pathConfig.js` implementation properly wraps these in `path.resolve(ROOT, v)`, which mitigates this. However, it relies on `__dirname` relative to `utils/`. This works, but must be robust against the ASAR packaging risk mentioned in #10.

## 15. Rollback Weaknesses
**Severity:** HIGH
**Description:** The emergency rollback utilizes `git reset --hard`.
**Why it is dangerous:** `git reset --hard` only modifies tracked files. It will *not* delete the newly created, untracked `core/`, `modules/`, and `services/` directories. This leaves the project in a polluted, hybrid state where old code and new orphaned directories coexist, potentially causing IDE indexing issues or lazy-load conflicts.
**Mitigation:** Update the rollback playbook to explicitly include `git clean -fd` to obliterate untracked directories, ensuring a genuinely clean V1 state. (Note: Only do this AFTER ensuring runtime data isn't deleted, which is handled by `.gitignore`).
