# README Rewrite Changelog

This document summarizes the changes made to the `README_V2_DRAFT.md` compared to the original `README.md` to reflect the V2 modular architecture.

## Sections Rewritten
1. **System Architecture Diagram**: Completely redesigned to show the `ava-listener` wake system, the Silero VAD gating pipeline, and the two-layer intent routing. Removed legacy paths like `PvRecorder` and replaced monolithic routes with modular paths.
2. **Core Components Table**: Updated *every single file path* to reflect the new domain-driven folder structure (e.g., `core/`, `providers/`, `integrations/`, `modules/`, etc. instead of the flat `backend/` directory). Added missing files (`safety/riskEngine.js`, `modules/stt/vadManager.js`, `utils/pathConfig.js`, etc.).
3. **Tech Stack & Libraries**: Replaced Picovoice Porcupine with `ava-listener` (Sherpa-ONNX). Added Silero VAD and `phi3:mini` (for the LLM Intent Router). Removed `robotjs` as it is handled within `desktopTool.js` (abstracted).
4. **How It Works**: Updated the narrative of the 10-step pipeline to include Silero VAD gating step, battery-aware GPU detection, and the LLM intent disambiguation step (`llmIntentRouter.js`).
5. **Installation Steps**: Rewritten to document the `runtime/whisper` Git submodule setup and compilation requirement. Removed `PICOVOICE_ACCESS_KEY` from the `.env` example.

## Sections Removed
1. **Old Monolithic Paths**: All references to `backend/[module].js` for core logic were removed.
2. **Picovoice References**: All references to Porcupine, `.ppn` files, and `PvRecorder` were removed as they are no longer in the codebase.
3. **Topic Tracker Feature**: Removed from the feature list and diagrams, as it was confirmed as dead/removed code in the codebase search.
4. **Inaccurate Streaming Description**: Removed the description implying the small Whisper model is always constantly streaming without gating.

## New Sections Added
1. **Project Structure Tree**: Added a new ASCII tree visualizing the `apps/`, `core/`, `providers/`, `modules/`, `integrations/`, `agents/`, `tools/`, `safety/`, `actions/`, `utils/`, `data/`, and `runtime/` directories.
2. **VAD Pipeline Documentation**: Added documentation for the Silero VAD integration (fail-open persistent/oneshot worker) that now gates the STT engines.
3. **Ghost Mode & Hotkeys**: Added documentation for running the app headlessly (`GHOST_MODE=true`) and using the `Ctrl+Shift+A` global hotkey.
4. **Safety Layer**: Documented the deterministic `riskEngine.js` for action execution safety.
5. **Data Isolation Model**: Documented the `data/memory/` directory as the persistent, git-ignored data store.
6. **Battery-Aware GPU Switching**: Documented the `utils/powerMonitor.js` feature that manages Whisper's `--no-gpu` flag.

## Assumptions Made
1. **OmniParser (`arvsal-vision`)**: Documented as a "Planned/Future" submodule integration rather than currently active, because while the submodule exists at `agents/arvsal-vision`, a codebase grep did not find it being actively imported or invoked in `server.js` or the agent loop.
2. **Piper TTS Integration**: Kept in the documentation under `runtime/piper/` despite not finding a dedicated TTS manager file, as it is referenced as the core local text-to-speech mechanism in `server.js` (handled via backend endpoints or PowerShell playback).

## Items Requiring Manual Review
1. **OmniParser Vision Integration**: The developer should verify if they want `arvsal-vision` listed as a future item, or if it is invoked via an external script not caught by the search.
2. **RobotJS vs Desktop Tool**: `desktopTool.js` relies on OS automation. Confirm if `robotjs` is still the backend library or if another desktop automation library has replaced it.
3. **Verify Git Submodule URL**: Ensure that `whisper.cpp` is properly configured in `.gitmodules` as documented in the installation instructions.
