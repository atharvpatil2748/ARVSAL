/**
 * Preference Manager — Phase 1 (Milestone 2)
 *
 * Owns the Preference Domain: the operational rules of engagement.
 * Loads from / saves to data/worldstate/preferences.json.
 *
 * Rules:
 *   - All writes use atomicWriteJsonSync (crash-safe)
 *   - All mutations emit to WAL
 *   - Application code MUST use this API — never read preferences.json directly
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { atomicWriteJsonSync } = require('@utils/fileUtils');
const eventStore               = require('@core/persistence/eventStore');

const DATA_DIR       = path.resolve(__dirname, '../../data/worldstate');
const PREFS_FILE     = path.join(DATA_DIR, 'preferences.json');

/* ================= BOOTSTRAP ================= */

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const DEFAULT_PREFERENCES = {
  communication: {
    tone:   'direct',   // 'direct' | 'formal' | 'casual' | 'sarcastic'
    length: 'concise'   // 'concise' | 'verbose' | 'minimal'
  },
  schedule: {
    morningBriefing:      false,
    reminderLeadMinutes:  5
  },
  privacy: {
    allowExternalAI: false
  },
  updatedAt: Date.now()
};

/* ================= LOAD ================= */

let _prefs = null;

function _loadFromDisk() {
  ensureDir();
  if (!fs.existsSync(PREFS_FILE)) {
    atomicWriteJsonSync(PREFS_FILE, DEFAULT_PREFERENCES);
    return JSON.parse(JSON.stringify(DEFAULT_PREFERENCES));
  }
  try {
    return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8'));
  } catch (err) {
    console.error('[PreferenceManager] Failed to load preferences.json:', err.message);
    return JSON.parse(JSON.stringify(DEFAULT_PREFERENCES));
  }
}

function _ensureLoaded() {
  if (!_prefs) {
    _prefs = _loadFromDisk();
  }
}

/* ================= PUBLIC API ================= */

/**
 * Returns the current preferences object.
 * @returns {object}
 */
function getPreferences() {
  _ensureLoaded();
  return JSON.parse(JSON.stringify(_prefs)); // defensive copy
}

/**
 * Updates a single preference value at a dotted path (category.key).
 * e.g. updatePreference('communication', 'tone', 'casual')
 *
 * @param {string} category - Top-level key (e.g. 'communication')
 * @param {string} key      - Sub-key (e.g. 'tone')
 * @param {*}      value    - New value
 * @returns {object} Updated preferences
 */
function updatePreference(category, key, value) {
  _ensureLoaded();

  if (!_prefs[category]) {
    _prefs[category] = {};
  }
  _prefs[category][key] = value;
  _prefs.updatedAt = Date.now();

  atomicWriteJsonSync(PREFS_FILE, _prefs);
  eventStore.appendEvent('PREFERENCE_UPDATED', 'preferences', { category, key, value });

  console.log(`[PreferenceManager] Updated: ${category}.${key} = ${JSON.stringify(value)}`);
  return getPreferences();
}

/**
 * Convenience getter for communication tone (used by personality.js).
 * @returns {'direct'|'formal'|'casual'|'sarcastic'}
 */
function getCommunicationTone() {
  _ensureLoaded();
  return (_prefs.communication && _prefs.communication.tone) || 'direct';
}

/**
 * Force reload from disk (useful for testing).
 */
function reload() {
  _prefs = _loadFromDisk();
}

/* ================= EXPORTS ================= */

module.exports = {
  getPreferences,
  updatePreference,
  getCommunicationTone,
  reload
};
