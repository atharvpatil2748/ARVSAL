# Memory Path Resolution Audit

## Objective
Trace every code path that reads or writes to memory JSON files to verify that they point to the new `data/memory/` location specified by Phase B Data Isolation.

## Findings: Split-Brain Regression
The Phase B migration effectively isolated the old JSON files into `data/memory/`. However, the path resolution logic within the `core/memory/*.js` files was **never updated**. 

Because these files still rely on `__dirname` to locate their respective JSON stores, and they were moved into `core/memory/`, they are now actively writing **new** JSON files directly into the `core/memory/` source directory, abandoning the historical data in `data/memory/`.

### Broken References Found

The following legacy references must be updated to use `@utils/pathConfig.js`:

1. **`core/memory/semanticMemory.js` (Line 12)**
   - **Current:** `const MEMORY_FILE = path.join(__dirname, "memory.json");`
   - **Expected:** Should use `pathConfig.MEMORY_DIR` + `memory.json`

2. **`core/memory/episodicMemory.js` (Line 13)**
   - **Current:** `const FILE = path.join(__dirname, "episodic_memory.json");`
   - **Expected:** Should use `pathConfig.MEMORY_DIR` + `episodic_memory.json`

3. **`core/memory/chatHistory.js` (Line 17)**
   - **Current:** `const FILE_PATH = path.join(__dirname, "chat_history.json");`
   - **Expected:** Should use `pathConfig.MEMORY_DIR` + `chat_history.json`

4. **`core/memory/reflectionMemory.js` (Line 16)**
   - **Current:** `const FILE = path.join(__dirname, "reflection_memory.json");`
   - **Expected:** Should use `pathConfig.MEMORY_DIR` + `reflection_memory.json`

5. **`core/memory/vectorStore.js` (Line 15)**
   - **Current:** `const FILE = path.resolve(__dirname, "vector_store.json");`
   - **Expected:** Should use `pathConfig.MEMORY_DIR` + `vector_store.json`

### Regression Scan
No occurrences of the old `backend/memory.json` string were found in the codebase. The code is strictly relying on `__dirname`, which dynamically caused the path regression during the Phase B file move.

## Recommendation
Before proceeding, all 5 memory modules in `core/memory/` must be refactored to import and use the central `MEMORY_DIR` exported by `@utils/pathConfig.js`. The newly generated split-brain JSON files in `core/memory/` should be discarded to avoid corrupting the original datasets currently sitting safely in `data/memory/`.
