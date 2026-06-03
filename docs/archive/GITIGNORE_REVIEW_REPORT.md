# ARVSAL Gitignore Review Report

This report evaluates two critical entries in the project's `.gitignore` file:
1. `data/memory/`
2. `runtime/whisper/`

For each entry, we examine its alignment with ARVSAL's long-term architecture and determine its optimal tracking status (Remain Ignored, Partially Ignored, or Tracked).

---

## 1. Directory: `data/memory/`

### A. Architectural Alignment
Ignoring the `data/memory/` directory **aligns perfectly** with ARVSAL's long-term architecture for several reasons:
* **Data Isolation Principle:** One of the core tenets of the ARVSAL restructures (specifically Phase B Data Isolation) is to separate static application logic (source code) from dynamic, runtime-generated state and databases.
* **Privacy and Security:** Files under `data/memory/` (such as `chat_history.json`, `episodic_memory.json`, `memory.json`, `reflection_memory.json`, and `vector_store.json`) contain sensitive, user-specific information, including private chat logs, identity facts, and vector embeddings. Committing these to a shared or public repository is a severe security risk.
* **Git Cleanliness & Diff Noise:** Because these files are updated programmatically upon every single execution or interaction with the agent, tracking them would cause massive, continuous Git diff noise and unavoidable merge conflicts for collaborating developers.
* **Portability:** Every fresh clone of ARVSAL should start with a clean slate. Local interaction memory should be generated and persisted locally, not checked into version control.

### B. Tracking Status Determination
* **Recommendation:** **Be Partially Ignored**
* **Rationale:** 
  While the dynamic JSON files must never be tracked, a complete ignore of the directory (`data/memory/`) poses a structural issue. 
  In the current implementation of the memory modules (e.g., `core/memory/semanticMemory.js` and `core/memory/vectorStore.js`), files are written directly to `data/memory/` without programmatically creating the directory first (i.e., they do not run recursive directory checks/creation on write). If the directory `data/memory/` does not exist (which is the case on a fresh clone if the directory is completely ignored and untracked), the write operations will fail silently under `try/catch` safety blocks.
  
  To guarantee that the directory structure is preserved on a clean checkout without tracking any of the private dynamic data files, ARVSAL should adopt a **partial ignore** pattern. This is achieved by placing a `.gitkeep` file inside the directory and configuring `.gitignore` to track only that file:
  ```gitignore
  # Ignore all files inside data/memory
  data/memory/*
  # Do not ignore the placeholder directory marker
  !data/memory/.gitkeep
  ```

---

## 2. Directory: `runtime/whisper/`

### A. Architectural Alignment
Ignoring the `runtime/whisper/` directory **aligns with the long-term target architecture**, but introduces an **active conflict in the current transition state**:
* **Binary and Large Weight Isolation:** ARVSAL's runtime design dictates that the `runtime/` folder acts as a local, portable dependency store. Compiled binaries (such as `whisper-cli.exe`, DLLs, and build folders) and heavy ML weights (such as `ggml-medium.bin`, which is ~1.5 GB) are platform-dependent and should never be committed to Git. Thus, ignoring this folder's binary contents is correct.
* **Submodule Source Separation:** According to the planned submodule migration (detailed in `PRE_SUBMODULE_MIGRATION_AUDIT.md`), the source code for the Whisper submodule is intended to be moved from `runtime/whisper` to a source directory like `stt/whisper.cpp` (or `modules/stt/whisper.cpp`). Once relocated, `runtime/whisper/` will strictly contain local binaries and model weights, meaning it must be completely ignored.

### B. Tracking Status Determination
* **Recommendation:** **Remain Ignored (Long-term Target) / Be Partially Ignored (Transition-term)**
* **Rationale:**
  * **Current Conflict:** The Whisper submodule is currently tracked in the parent Git index at `runtime/whisper` (mode `160000` gitlink). When a directory is tracked as a submodule in the index, adding it to the parent `.gitignore` as a blanket ignore (`runtime/whisper/`) is a conflict. It can cause Git to suppress status changes inside the submodule, ignore untracked files within the submodule checkout, or interfere with `git submodule update` commands.
  * **Resolution Strategy:**
    1. **Transition-term (Immediate):** To resolve the active Git index conflict without moving folders yet, the `.gitignore` should be updated to a **partial ignore** pattern. Instead of ignoring the entire `runtime/whisper/` folder, it should ignore only the build outputs, executables, and model weights, while leaving the submodule directory itself unignored:
       ```gitignore
       runtime/whisper/build/
       runtime/whisper/bin/
       runtime/whisper/models/
       runtime/whisper/ggml-*.bin
       runtime/whisper/*.dll
       runtime/whisper/*.exe
       ```
    2. **Long-term (Target State):** Once the planned submodule relocation is executed (moving the Whisper source code submodule to `stt/whisper.cpp`), the `runtime/whisper/` directory will contain nothing but local binaries and models. At that point, the blanket ignore rule `runtime/whisper/` should be restored, and `stt/whisper.cpp/` will be tracked as the submodule path.
