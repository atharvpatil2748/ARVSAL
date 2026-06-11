/**
 * Timeline Manager — Phase 1 (Milestone 5)
 *
 * Owns the Timeline Domain: the autobiographical spine of the user's life.
 * Milestones are IMMUTABLE once created.
 * Storage: data/worldstate/milestones.json
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const { atomicWriteJsonSync } = require('@utils/fileUtils');
const eventStore               = require('@core/persistence/eventStore');

const DATA_DIR        = path.resolve(__dirname, '../../data/worldstate');
const MILESTONES_FILE = path.join(DATA_DIR, 'milestones.json');

/* ================= BOOTSTRAP ================= */

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/* ================= LOAD / SAVE ================= */

let _milestones = null;

function _loadFromDisk() {
  ensureDir();
  if (!fs.existsSync(MILESTONES_FILE)) {
    atomicWriteJsonSync(MILESTONES_FILE, []);
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(MILESTONES_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[TimelineManager] Load failed:', err.message);
    return [];
  }
}

function _ensureLoaded() {
  if (!_milestones) _milestones = _loadFromDisk();
}

function _save() {
  atomicWriteJsonSync(MILESTONES_FILE, _milestones);
}

/* ================= PUBLIC API ================= */

const VALID_CATEGORIES = new Set([
  'education', 'career', 'personal', 'technical', 'social', 'health', 'financial', 'family', 'relationship', 'project', 'other'
]);

/**
 * Adds an immutable milestone to the timeline.
 *
 * @param {object} opts
 * @param {string} opts.label          Description of the milestone
 * @param {string} opts.category       One of the valid categories
 * @param {string} opts.date           ISO date string (e.g. '2024-06-01')
 * @param {string[]} [opts.linkedGoalIds]  Goal ids this milestone relates to
 * @param {number}  [opts.impactScore] 0.0–1.0 significance
 * @param {string}  [opts.summary]     Optional extended description
 * @param {object}  [opts.metadata]    Optional metadata like location, outcome, status
 * @returns {object} The milestone object
 */
function addMilestone({ label, category = 'other', date, linkedGoalIds = [], impactScore = 0.7, summary = '', metadata = {} }) {
  _ensureLoaded();

  if (!label || !date) {
    throw new Error('[TimelineManager] addMilestone() requires label and date');
  }

  let normalizedDate = date;
  if (typeof date === 'string') {
    const lowerDate = date.trim().toLowerCase();
    const now = new Date();
    if (lowerDate === 'today') {
      normalizedDate = now.toISOString().split('T')[0];
    } else if (lowerDate === 'tomorrow') {
      now.setDate(now.getDate() + 1);
      normalizedDate = now.toISOString().split('T')[0];
    } else if (lowerDate === 'yesterday') {
      now.setDate(now.getDate() - 1);
      normalizedDate = now.toISOString().split('T')[0];
    }
  }

  const cat = VALID_CATEGORIES.has(category) ? category : 'other';

  const milestone = {
    id:            `evt_${crypto.randomBytes(4).toString('hex')}`,
    label,
    category:      cat,
    date:          normalizedDate,
    linkedGoalIds,
    impactScore,
    summary,
    metadata,
    createdAt:     Date.now()
  };

  _milestones.push(milestone);
  _save();

  eventStore.appendEvent('MILESTONE_CREATED', 'timeline', { id: milestone.id, label, date, category: cat });
  console.log(`[TimelineManager] Milestone added: "${label}" on ${date}`);
  return { ...milestone };
}

/**
 * Returns milestones sorted by date descending.
 *
 * @param {number} [limit]             Max results (default 20)
 * @param {string} [categoryFilter]    Optional category filter
 * @returns {object[]}
 */
function getMilestones(limit = 20, categoryFilter = null) {
  _ensureLoaded();

  let results = [..._milestones];

  if (categoryFilter) {
    results = results.filter(m => m.category === categoryFilter);
  }

  return results
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

/**
 * Returns milestones within a date range.
 *
 * @param {string} startDate  ISO date string
 * @param {string} endDate    ISO date string
 * @returns {object[]}
 */
function getMilestonesByDateRange(startDate, endDate) {
  _ensureLoaded();

  const start = new Date(startDate);
  const end   = new Date(endDate);

  return _milestones
    .filter(m => {
      const d = new Date(m.date);
      return d >= start && d <= end;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Force reload from disk.
 */
function reload() {
  _milestones = _loadFromDisk();
}

/* ================= EXPORTS ================= */

module.exports = {
  addMilestone,
  getMilestones,
  getMilestonesByDateRange,
  reload
};
