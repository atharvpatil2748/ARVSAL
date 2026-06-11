/**
 * Identity Manager — Phase 1 (Milestone 2)
 *
 * Owns the Identity Domain: the fundamental "Self" of the user.
 * Loads from / saves to data/worldstate/profile.json.
 *
 * Rules:
 *   - All writes use atomicWriteJsonSync (crash-safe)
 *   - All mutations emit an event to the WAL
 *   - This manager is the ONLY authoritative interface for identity data
 *   - Application code MUST NOT read profile.json directly
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { atomicWriteJsonSync } = require('@utils/fileUtils');
const eventStore               = require('@core/persistence/eventStore');

const DATA_DIR   = path.resolve(__dirname, '../../data/worldstate');
const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');

/* ================= BOOTSTRAP ================= */

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const DEFAULT_PROFILE = {
  id:              'usr_01',
  primaryName:     'Atharv',
  timezone:        'Asia/Kolkata',
  profession:      'Mechanical Engineering Student',
  institution:     'IIT Kanpur',
  primaryLanguage: 'en',
  location:        'Kanpur, Uttar Pradesh, India',
  birthdate:       '2006-08-27',
  createdAt:       Date.now(),
  updatedAt:       Date.now()
};

/* ================= LOAD ================= */

let _profile = null;

function _loadFromDisk() {
  ensureDir();
  if (!fs.existsSync(PROFILE_FILE)) {
    atomicWriteJsonSync(PROFILE_FILE, DEFAULT_PROFILE);
    return { ...DEFAULT_PROFILE };
  }
  try {
    return JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
  } catch (err) {
    console.error('[IdentityManager] Failed to load profile.json:', err.message);
    return { ...DEFAULT_PROFILE };
  }
}

function _ensureLoaded() {
  if (!_profile) {
    _profile = _loadFromDisk();
  }
}

/* ================= PUBLIC API ================= */

/**
 * Returns the current user profile object.
 * @returns {object}
 */
function getUserProfile() {
  _ensureLoaded();
  return { ..._profile };
}

/**
 * Merges patch fields into the user profile and persists atomically.
 * Emits IDENTITY_UPDATED to WAL.
 *
 * @param {object} patch - Fields to update (e.g. { profession: 'Engineer' })
 * @returns {object} The updated profile
 */
function updateUserProfile(patch) {
  _ensureLoaded();
  if (!patch || typeof patch !== 'object') {
    throw new Error('[IdentityManager] updateUserProfile() requires a patch object');
  }

  // Prevent overwriting immutable fields
  const IMMUTABLE = new Set(['id', 'createdAt']);
  for (const key of IMMUTABLE) {
    if (key in patch) {
      console.warn(`[IdentityManager] Attempt to overwrite immutable field "${key}" ignored.`);
      delete patch[key];
    }
  }

  _profile = {
    ..._profile,
    ...patch,
    updatedAt: Date.now()
  };

  atomicWriteJsonSync(PROFILE_FILE, _profile);
  eventStore.appendEvent('IDENTITY_UPDATED', 'identity', { fields: Object.keys(patch) });

  console.log('[IdentityManager] Profile updated:', Object.keys(patch).join(', '));
  return { ..._profile };
}

/**
 * Force reload from disk (useful for testing).
 */
function reload() {
  _profile = _loadFromDisk();
}

/* ================= EXPORTS ================= */

module.exports = {
  getUserProfile,
  updateUserProfile,
  reload
};
