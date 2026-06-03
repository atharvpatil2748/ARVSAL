/**
 * Working Memory (Layer 1)
 *
 * In-RAM LRU cache of currently active cognitive nodes.
 * Pre-populated from Cognitive State Snapshot at startup.
 *
 * Rules:
 *   - Hard cap: 30 nodes
 *   - Max pinned: 5 (prevents pin-abuse)
 *   - LRU eviction: least recently accessed non-pinned node removed at cap
 *   - Eviction does NOT delete data — node lives in CSG (L2) on disk
 *   - Idle nodes (> 30 min no access) are evicted proactively
 *
 * Phase 1: holds lightweight node stubs from snapshot.
 * Phase 3: holds full CSGNode references when CSM is wired.
 */

'use strict';

const MAX_SIZE    = 30;
const MAX_PINNED  = 5;
const IDLE_MS     = 30 * 60 * 1000;  // 30 minutes

/* ================= STATE ================= */

let _nodes          = new Map();   // nodeId → { stub, hitCount, lastAccessed, pinned }
let _activeProjectId = null;
let _activeGoalId    = null;
let _sessionId       = null;
let _startedAt       = Date.now();

/* ================= INIT ================= */

/**
 * Initialize Working Memory from a Cognitive State Snapshot.
 * Safe to call multiple times (re-initializes).
 * @param {{ snapshot?: object }} opts
 */
function init({ snapshot = null } = {}) {
  _nodes.clear();
  _activeProjectId = null;
  _activeGoalId    = null;
  _startedAt       = Date.now();
  _sessionId       = new Date().toISOString().slice(0, 10);

  if (!snapshot) {
    console.log('[WorkingMemory] Initialized empty (no snapshot).');
    return;
  }

  _activeProjectId = snapshot.activeProjectId || null;
  _activeGoalId    = (Array.isArray(snapshot.activeGoalIds) && snapshot.activeGoalIds[0]) || null;

  const ids = Array.isArray(snapshot.workingMemoryNodeIds)
    ? snapshot.workingMemoryNodeIds
    : [];

  for (const id of ids.slice(0, MAX_SIZE)) {
    if (typeof id !== 'string') continue;
    const label = id.split('::').slice(2).join(' ').replace(/_/g, ' ') || id;
    _nodes.set(id, {
      stub:         { id, label, type: id.split('::')[1] || 'topic' },
      hitCount:     1,
      lastAccessed: Date.now(),
      pinned:       false
    });
  }

  console.log(
    `[WorkingMemory] Initialized: ${_nodes.size} nodes from snapshot.` +
    ` ActiveProject: ${_activeProjectId || 'none'}`
  );
}

/* ================= CORE ACCESS ================= */

function has(nodeId) {
  return _nodes.has(nodeId);
}

/**
 * Get a node stub from L1. Updates hitCount and lastAccessed.
 * Returns null if not in L1.
 */
function get(nodeId) {
  const entry = _nodes.get(nodeId);
  if (!entry) return null;
  entry.hitCount++;
  entry.lastAccessed = Date.now();
  return entry.stub;
}

/**
 * Insert or update a node in L1.
 * Triggers LRU eviction if at capacity.
 */
function set(nodeId, stub, { pinned = false } = {}) {
  if (!nodeId || typeof nodeId !== 'string') return;

  if (_nodes.has(nodeId)) {
    const entry = _nodes.get(nodeId);
    entry.stub        = stub;
    entry.hitCount++;
    entry.lastAccessed = Date.now();
    if (pinned) entry.pinned = true;
    return;
  }

  if (_nodes.size >= MAX_SIZE) _evictLRU();

  _nodes.set(nodeId, {
    stub,
    hitCount:     1,
    lastAccessed: Date.now(),
    pinned
  });
}

/* ================= PINNING ================= */

function pin(nodeId) {
  const pinnedCount = [..._nodes.values()].filter(e => e.pinned).length;
  if (pinnedCount >= MAX_PINNED) {
    console.warn('[WorkingMemory] Max pinned nodes reached. Unpin one first.');
    return false;
  }
  const entry = _nodes.get(nodeId);
  if (entry) { entry.pinned = true; return true; }
  return false;
}

function unpin(nodeId) {
  const entry = _nodes.get(nodeId);
  if (entry) entry.pinned = false;
}

/* ================= EVICTION ================= */

function _evictLRU() {
  let oldest     = null;
  let oldestTime = Infinity;

  for (const [id, entry] of _nodes.entries()) {
    if (!entry.pinned && entry.lastAccessed < oldestTime) {
      oldestTime = entry.lastAccessed;
      oldest     = id;
    }
  }

  if (oldest) {
    _nodes.delete(oldest);
    console.log(`[WorkingMemory] LRU evicted: ${oldest}`);
  }
}

/**
 * Evict all idle (> 30 min) non-pinned nodes.
 * Called on a timer by server.js.
 */
function evictIdle() {
  const cutoff = Date.now() - IDLE_MS;
  let count    = 0;

  for (const [id, entry] of _nodes.entries()) {
    if (!entry.pinned && entry.lastAccessed < cutoff) {
      _nodes.delete(id);
      count++;
    }
  }

  if (count > 0) {
    console.log(`[WorkingMemory] Idle-evicted ${count} node(s).`);
  }
}

/* ================= ACTIVE PROJECT / GOAL ================= */

function setActiveProject(nodeId) { _activeProjectId = nodeId || null; }
function setActiveGoal(nodeId)    { _activeGoalId    = nodeId || null; }
function getActiveProjectId()     { return _activeProjectId; }
function getActiveGoalId()        { return _activeGoalId; }
function getSessionId()           { return _sessionId; }

/* ================= SNAPSHOT SUPPORT ================= */

/**
 * Return a lightweight snapshot of L1 state for persistence.
 */
function getSnapshotData() {
  return {
    workingMemoryNodeIds: [..._nodes.keys()].slice(0, 20),
    activeProjectId:      _activeProjectId,
    activeGoalId:         _activeGoalId,
    sessionId:            _sessionId
  };
}

/**
 * Return all current L1 entries as an array (for debugging / CSM use).
 */
function getAll() {
  return [..._nodes.entries()].map(([id, e]) => ({
    id,
    ...e.stub,
    hitCount:     e.hitCount,
    lastAccessed: e.lastAccessed,
    pinned:       e.pinned
  }));
}

function size()  { return _nodes.size; }
function clear() {
  _nodes.clear();
  _activeProjectId = null;
  _activeGoalId    = null;
}

/* ================= EXPORTS ================= */

module.exports = {
  init,
  has,
  get,
  set,
  pin,
  unpin,
  evictIdle,
  setActiveProject,
  setActiveGoal,
  getActiveProjectId,
  getActiveGoalId,
  getSessionId,
  getSnapshotData,
  getAll,
  size,
  clear
};
