/**
 * Topic Index (Phase 2)
 *
 * Fast O(1) keyword → ID mapping for archive items.
 * Allows retrieving relevant archive items without O(N) embedding scans.
 * Stored at data/memory/topic_index.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const pathConfig = require('@utils/pathConfig');

const INDEX_FILE = path.join(pathConfig.MEMORY_DIR, 'topic_index.json');

// Memory map: normalized_topic_string -> { episodicIds: [], semanticKeys: [], reflectionIds: [], lastIndexed: number }
let _index = new Map();
let _lastSaved = 0;

function _normalize(topic) {
  return (topic || '').toString().toLowerCase().trim();
}

/**
 * Load the index from disk into memory.
 */
function load() {
  try {
    if (!fs.existsSync(INDEX_FILE)) {
      _index.clear();
      save();
      return;
    }
    const raw = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    _index = new Map(Object.entries(raw));
  } catch (err) {
    console.error('[TopicIndex] Load failed:', err.message);
    _index = new Map();
  }
}

/**
 * Save the index to disk.
 */
function save() {
  try {
    const raw = Object.fromEntries(_index.entries());
    const tmp = INDEX_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(raw), 'utf8');
    fs.renameSync(tmp, INDEX_FILE);
    _lastSaved = Date.now();
  } catch (err) {
    console.error('[TopicIndex] Save failed:', err.message);
  }
}

/**
 * Ensure a topic exists in the index.
 */
function _ensureTopic(topic) {
  const t = _normalize(topic);
  if (!t) return null;
  if (!_index.has(t)) {
    _index.set(t, { episodicIds: [], semanticKeys: [], reflectionIds: [], lastIndexed: Date.now() });
  }
  return t;
}

/**
 * Index an episodic memory ID under a topic.
 */
function addEpisode(topic, id) {
  const t = _ensureTopic(topic);
  if (!t || !id) return;
  const entry = _index.get(t);
  if (!entry.episodicIds.includes(id)) {
    entry.episodicIds.push(id);
    entry.lastIndexed = Date.now();
  }
}

/**
 * Index a semantic memory key under a topic.
 */
function addSemanticKey(topic, key) {
  const t = _ensureTopic(topic);
  if (!t || !key) return;
  const entry = _index.get(t);
  if (!entry.semanticKeys.includes(key)) {
    entry.semanticKeys.push(key);
    entry.lastIndexed = Date.now();
  }
}

/**
 * Index a reflection ID under a topic.
 */
function addReflection(topic, id) {
  const t = _ensureTopic(topic);
  if (!t || !id) return;
  const entry = _index.get(t);
  if (!entry.reflectionIds.includes(id)) {
    entry.reflectionIds.push(id);
    entry.lastIndexed = Date.now();
  }
}

/**
 * Retrieve indexed item IDs for a topic.
 * @param {string} topic
 * @returns {object|null}
 */
function get(topic) {
  return _index.get(_normalize(topic)) || null;
}

/**
 * Clear the entire index.
 */
function clear() {
  _index.clear();
  save();
}

module.exports = {
  load,
  save,
  addEpisode,
  addSemanticKey,
  addReflection,
  get,
  clear
};
