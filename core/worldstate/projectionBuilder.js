/**
 * Projection Builder — Phase 1 (Milestone 1)
 *
 * Assembles a budgeted World State Projection from requested domains.
 * This projection is injected into <WORLD_STATE_PROJECTION> in the LLM prompt.
 *
 * Responsibilities:
 *   - Receive domain list from WorldStateQueryEngine
 *   - Fetch data from Domain Managers
 *   - Enforce a hard token budget (char count approximation)
 *   - Return a structured projection object
 *
 * Ownership: ProjectionBuilder owns projection generation.
 * Domain Managers own the data.
 * LLM owns reasoning.
 */

'use strict';

/* ================= DOMAIN MANAGERS (lazy loaded to avoid circular deps) ================= */

function _getManager(name) {
  // Lazy load to avoid requiring managers that haven't been initialized yet
  try {
    return require(`@core/worldstate/${name}`);
  } catch (err) {
    console.warn(`[ProjectionBuilder] Could not load manager "${name}":`, err.message);
    return null;
  }
}

/* ================= TOKEN BUDGET ================= */

const CHAR_BUDGET = 4000; // ~1000 tokens at 4 chars/token — allows multiple domains to co-exist in context

/* ================= DOMAIN FETCHERS ================= */

/**
 * Each fetcher returns a plain object slice, or null if unavailable.
 */

function _fetchIdentity(requirements = {}) {
  const manager = _getManager('identityManager');
  if (!manager) return null;
  try {
    const profile = manager.getUserProfile();
    const { id, createdAt, updatedAt, ...rest } = profile;
    return rest;
  } catch { return null; }
}

function _fetchPreferences(requirements = {}) {
  const manager = _getManager('preferenceManager');
  if (!manager) return null;
  try {
    return manager.getPreferences();
  } catch { return null; }
}

function _fetchGoals(requirements = {}) {
  const manager = _getManager('goalEngine');
  if (!manager) return null;
  try {
    const { limit = 5, statusFilter = ['Active', 'Pending'] } = requirements;
    const goals = manager.getActiveGoals(statusFilter).slice(0, limit);
    return goals.map(g => ({
      id:       g.id,
      label:    g.label,
      status:   g.status,
      priority: g.priority,
      targetDate: g.targetDate,
      motivation: g.motivation,
      successCriteria: g.successCriteria,
      projects: (g.projectIds || []).length,
      tasks:    (g.taskIds || []).length
    }));
  } catch { return null; }
}

function _fetchRelationships(requirements = {}) {
  const manager = _getManager('relationshipManager');
  if (!manager) return null;
  try {
    const { limit = 5 } = requirements;
    const people = manager.getAllPeople().slice(0, limit);
    return people.map(p => ({
      name:          p.name,
      category:      p.category,
      closenessScore: p.closenessScore,
      status:        p.metadata?.status,
      notes:         p.metadata?.notes
    }));
  } catch { return null; }
}

function _fetchTimeline(requirements = {}) {
  const manager = _getManager('timelineManager');
  if (!manager) return null;
  try {
    const { limit = 50 } = requirements;
    const milestones = manager.getMilestones(limit);
    return milestones.map(m => ({
      date:     m.date,
      label:    m.label,
      category: m.category,
      summary:  m.summary,
      metadata: Object.keys(m.metadata || {}).length > 0 ? m.metadata : undefined
    }));
  } catch { return null; }
}

/* ================= DOMAIN FETCHER MAP ================= */

const DOMAIN_FETCHERS = {
  identity:      _fetchIdentity,
  preferences:   _fetchPreferences,
  goals:         _fetchGoals,
  relationships: _fetchRelationships,
  timeline:      _fetchTimeline
};

/* ================= MAIN BUILD ================= */

/**
 * Builds a World State Projection from requested domains.
 *
 * @param {string[]} requestedDomains   From WorldStateQueryEngine.analyzeQuery()
 * @param {object}  [projectionRequirements]  Per-domain hints
 * @returns {object} { projection: object, serialized: string, domainsIncluded: string[] }
 */
function buildProjection(requestedDomains = [], projectionRequirements = {}) {
  const projection = {};
  const domainsIncluded = [];
  let charCount = 0;

  for (const domain of requestedDomains) {
    if (charCount >= CHAR_BUDGET) {
      console.log(`[ProjectionBuilder] Budget hit (${charCount} chars). Skipping remaining domains.`);
      break;
    }

    const fetcher = DOMAIN_FETCHERS[domain];
    if (!fetcher) {
      console.warn(`[ProjectionBuilder] No fetcher for domain: "${domain}"`);
      continue;
    }

    const requirements = projectionRequirements[domain] || {};
    const data = fetcher(requirements);

    if (data === null || data === undefined) continue;

    const serialized = JSON.stringify(data);
    if (charCount + serialized.length > CHAR_BUDGET) {
      // Partial inclusion not supported — skip this domain
      console.log(`[ProjectionBuilder] Domain "${domain}" skipped (would exceed budget).`);
      continue;
    }

    projection[domain] = data;
    domainsIncluded.push(domain);
    charCount += serialized.length;
  }

  const serialized = JSON.stringify(projection, null, 2);

  console.log(`[ProjectionBuilder] Built projection: domains=[${domainsIncluded.join(', ')}] chars=${charCount}`);

  return { projection, serialized, domainsIncluded };
}

/* ================= EXPORTS ================= */

module.exports = {
  buildProjection
};
