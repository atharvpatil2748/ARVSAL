/**
 * Cognitive State Snapshot
 *
 * Persists ARVSAL's current cognitive state across process restarts.
 * Loaded at startup → Working Memory pre-populated immediately.
 * Saved every 5 minutes and on shutdown.
 *
 * Uses atomic write (temp file → rename) to prevent corruption.
 *
 * Schema: v2
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const pathConfig      = require('@utils/pathConfig');
const SNAPSHOT_FILE   = path.join(pathConfig.MEMORY_DIR, 'cognitive_snapshot.json');
const SNAPSHOT_VERSION = 2;

let _cachedSnapshot = null;

/* ================= BUILT-IN CONSTRAINTS ================= */
// Seeded on first startup. Stored inline in snapshot until CSG exists (Phase 2).

const BUILTIN_CONSTRAINTS = [
  {
    id:               'node::constraint::privacy_first',
    label:            'privacy-first',
    rationale:        'No personal memory transmitted to external AI providers (ChatGPT, Gemini, Groq). Local LLM (You) has full clearance to discuss personal memories. Do not refuse.',
    scope:            'global',
    violationResponse:'block'
  },
  {
    id:               'node::constraint::local_first',
    label:            'local-first',
    rationale:        'No cloud dependency. Full data ownership. No managed memory services.',
    scope:            'global',
    violationResponse:'block'
  },
  {
    id:               'node::constraint::deterministic_memory',
    label:            'deterministic-memory',
    rationale:        'Archive writes are never LLM-generated. Deterministic write paths only.',
    scope:            'global',
    violationResponse:'warn'
  },
  {
    id:               'node::constraint::archive_integrity',
    label:            'archive-integrity',
    rationale:        'The long-term archive is the permanent source of truth. Never replaced, never surrendered.',
    scope:            'global',
    violationResponse:'block'
  }
];

/* ================= DEFAULT SNAPSHOT ================= */

function _createDefault() {
  return {
    version:               SNAPSHOT_VERSION,
    savedAt:               Date.now(),
    sessionId:             new Date().toISOString().slice(0, 10),

    // Active cognitive state
    activeProjectId:       null,
    activeGoalIds:         [],
    unresolvedProblemIds:  [],
    pendingTaskIds:        [],
    recentDecisionIds:     [],

    // Constraints (inline until CSG Phase 2)
    activeConstraintIds:   BUILTIN_CONSTRAINTS.map(c => c.id),
    constraints:           BUILTIN_CONSTRAINTS,

    // Working Memory L1 seed
    workingMemoryNodeIds:  [],

    // Turn context
    lastUserIntent:        null,
    lastDiscussionSummary: null,
    lastTopics:            []
  };
}

/* ================= LOAD ================= */

/**
 * Load snapshot from disk. Returns default if missing or corrupt.
 * Migrates older schema versions automatically.
 * @returns {object} snapshot
 */
function load() {
  if (_cachedSnapshot) return _cachedSnapshot;

  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) {
      const fresh = _createDefault();
      save(fresh);
      console.log('[CognitiveSnapshot] First run — seeded default snapshot with built-in constraints.');
      _cachedSnapshot = fresh;
      return fresh;
    }

    const raw = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));

    // Schema migration
    if (!raw.version || raw.version < SNAPSHOT_VERSION) {
      const migrated = Object.assign(_createDefault(), raw);
      migrated.version = SNAPSHOT_VERSION;

      // Ensure constraints are always present
      if (!Array.isArray(migrated.constraints) || !migrated.constraints.length) {
        migrated.constraints         = BUILTIN_CONSTRAINTS;
        migrated.activeConstraintIds = BUILTIN_CONSTRAINTS.map(c => c.id);
      }

      // Ensure lastUserIntent field exists
      if (!('lastUserIntent' in migrated)) migrated.lastUserIntent = null;

      save(migrated);
      console.log('[CognitiveSnapshot] Migrated snapshot to v2.');
      _cachedSnapshot = migrated;
      return migrated;
    }

    console.log(
      `[CognitiveSnapshot] Loaded.` +
      ` Project: ${raw.activeProjectId || 'none'}.` +
      ` Topics: ${(raw.lastTopics || []).slice(0, 3).join(', ') || 'none'}.` +
      ` LastIntent: ${raw.lastUserIntent || 'none'}.`
    );
    
    _cachedSnapshot = raw;
    return raw;

  } catch (err) {
    console.error('[CognitiveSnapshot] Load failed:', err.message, '— falling back to default.');
    _cachedSnapshot = _createDefault();
    return _cachedSnapshot;
  }
}

/* ================= SAVE ================= */

/**
 * Atomically save snapshot to disk.
 * Uses temp file + rename to prevent corruption on crash.
 * @param {object} snapshot
 */
function save(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;

  try {
    snapshot.savedAt = Date.now();
    snapshot.version = SNAPSHOT_VERSION;

    const tmp = SNAPSHOT_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), 'utf8');
    fs.renameSync(tmp, SNAPSHOT_FILE);

    _cachedSnapshot = snapshot;

  } catch (err) {
    console.error('[CognitiveSnapshot] Save failed:', err.message);
  }
}

/* ================= UPDATE HELPERS ================= */

/**
 * Update the snapshot with per-turn signals.
 * Call after each command response before save().
 * @param {object} opts
 * @param {object} opts.snapshot — the live snapshot object
 * @param {string} [opts.intent] — current intent string
 * @param {string[]} [opts.topics] — topics detected this turn
 */
function updateFromTurn({ snapshot, intent = null, topics = [] }) {
  if (!snapshot || typeof snapshot !== 'object') return;

  if (intent) snapshot.lastUserIntent = intent;

  if (Array.isArray(topics) && topics.length) {
    const merged = [...new Set([...topics, ...(snapshot.lastTopics || [])])];
    snapshot.lastTopics = merged.slice(0, 10);
  }

  snapshot.sessionId = new Date().toISOString().slice(0, 10);
}

/**
 * Merge Working Memory snapshot data back into the main snapshot before saving.
 * @param {object} snapshot
 * @param {object} wmData — from workingMemory.getSnapshotData()
 */
function mergeWorkingMemory(snapshot, wmData) {
  if (!snapshot || !wmData) return;
  snapshot.workingMemoryNodeIds = wmData.workingMemoryNodeIds || [];
  if (wmData.activeProjectId !== undefined) snapshot.activeProjectId = wmData.activeProjectId;
  if (wmData.activeGoalId)    snapshot.activeGoalIds = [wmData.activeGoalId];
}

/* ================= CONSTRAINT ACCESS ================= */

/**
 * Get constraints from snapshot. Falls back to built-in constraints.
 * @param {object} snapshot
 * @returns {object[]}
 */
function getConstraints(snapshot) {
  if (snapshot && Array.isArray(snapshot.constraints) && snapshot.constraints.length) {
    return snapshot.constraints;
  }
  return BUILTIN_CONSTRAINTS;
}

/* ================= EXPORTS ================= */

module.exports = {
  load,
  save,
  updateFromTurn,
  mergeWorkingMemory,
  getConstraints,
  BUILTIN_CONSTRAINTS
};
