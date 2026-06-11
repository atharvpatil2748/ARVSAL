/**
 * World State Query Engine — Phase 1 (Milestone 1)
 *
 * STRICTLY DETERMINISTIC. No LLM calls.
 * Uses heuristics, keyword signals, entity detection, working memory anchors,
 * and conversation context to determine which World State domains are relevant.
 *
 * Responsibilities:
 *   - analyzeQuery(query, intentHint, workingMemory)
 *   - detectRelevantDomains(signals)
 *   - buildProjectionRequest(domains, requirements)
 *
 * Output shape:
 *   {
 *     requestedDomains: string[],  // e.g. ['identity','goals','relationships']
 *     projectionRequirements: { ... }
 *   }
 *
 * Ownership: WorldStateQueryEngine owns domain selection.
 * The IntentClassifier provides a hint only — it does NOT drive this logic.
 */

'use strict';

/* ================= DOMAIN KEYWORD SIGNALS ================= */

const DOMAIN_SIGNALS = {
  identity: [
    /\b(who am i|my name|my profession|my timezone|my location|atharv|about me|myself)\b/i,
    /\b(i am a|i'm a|my background|i study|i work|my job|my role|located|where do i live|where am i from|do for work|my career)\b/i,
    /\b(languages?|speak|core values?|values?|life mission|my mission|my purpose)\b/i,
  ],
  goals: [
    /\b(goal|goals|objective|objectives|target|aim|ambition|aspiration)\b/i,
    /\b(project|projects|build|building|working on|trying to|want to achieve)\b/i,
    /\b(task|tasks|todo|to-do|backlog|milestone|deadlines?)\b/i,
    /\b(status|progress|what have i|where am i with|priority|important|spiritual peace|fitness transformation|arvsal)\b/i,
  ],
  relationships: [
    /\b(friend|friends|colleague|colleague|mentor|family|partner|people|person|who is|working with|who am i working with)\b/i,
    /\b(sejal|rahul|dr\.|professor|someone i know|about them|how is [a-z]+)\b/i,
    /\b(relationship|relationships|know|meet|met|introduced|connected)\b/i,
  ],
  timeline: [
    /\b(when|milestone|milestones|history|life event|started|began|founded|joined|graduated|admitted)\b/i,
    /\b(timeline|before|after|since|used to|back in|remember when|ago|year|happened in|during|in 20[0-9]{2})\b/i,
    /\b(autobiography|life|journey|past|background story)\b/i,
  ],
  preferences: [
    /\b(prefer|preference|like|dislike|tone|style|how i like|communication|remind me|schedule|briefing)\b/i,
    /\b(setting|settings|configure|configuration|privacy|do not disturb|dnd)\b/i,
  ],
};

/* ================= INTENT HINT → DOMAIN MAP ================= */

const INTENT_DOMAIN_HINTS = {
  MEMORY_SUMMARY:   ['identity', 'goals'],
  EPISODIC_RECALL:  ['timeline'],
  META_MEMORY:      ['identity', 'preferences'],
  CODING_QUERY:     [],
  GENERAL_QUESTION: [],          // rely on keyword scan
  SMALLTALK:        [],
  MATH_QUERY:       [],
};

/* ================= CORE ANALYSIS ================= */

/**
 * Analyzes a user query to determine which World State domains are relevant.
 * DETERMINISTIC — no LLM calls.
 *
 * @param {string} query              Raw user query
 * @param {string} [intentHint]       Intent label from intentClassifier (hint only)
 * @param {object} [workingMemory]    workingMemory module reference for L1 anchors
 * @returns {{ requestedDomains: string[], projectionRequirements: object }}
 */
function analyzeQuery(query, intentHint = 'GENERAL_QUESTION', workingMemory = null) {
  const domainSet = new Set();

  // 1. Keyword signal scan — primary detection mechanism
  for (const [domain, patterns] of Object.entries(DOMAIN_SIGNALS)) {
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        domainSet.add(domain);
        break; // one match per domain is enough
      }
    }
  }

  // 2. Intent hint — additive only (does not override keyword scan)
  const hintDomains = INTENT_DOMAIN_HINTS[intentHint] || [];
  for (const d of hintDomains) domainSet.add(d);

  // 3. Working memory anchors — if active goal or project, inject goals domain
  if (workingMemory) {
    const activeGoalId    = typeof workingMemory.getActiveGoalId    === 'function' ? workingMemory.getActiveGoalId()    : null;
    const activeProjectId = typeof workingMemory.getActiveProjectId === 'function' ? workingMemory.getActiveProjectId() : null;
    if (activeGoalId || activeProjectId) {
      domainSet.add('goals');
    }
  }

  const requestedDomains = [...domainSet];

  // 5. Build projection requirements (token budget hints per domain)
  const projectionRequirements = buildProjectionRequirements(requestedDomains);

  console.log(`[WorldStateQueryEngine] query="${query.substring(0, 80)}" intent=${intentHint} → domains=[${requestedDomains.join(', ')}]`);

  return { requestedDomains, projectionRequirements };
}

/* ================= PROJECTION REQUIREMENTS ================= */

/**
 * Returns per-domain projection requirements (token budget, depth, etc.)
 * These are advisory hints consumed by ProjectionBuilder.
 */
function buildProjectionRequirements(domains) {
  const requirements = {};
  for (const domain of domains) {
    switch (domain) {
      case 'identity':
        requirements.identity = { maxFields: 8, includePreferences: false };
        break;
      case 'goals':
        requirements.goals = { limit: 5, statusFilter: ['Active', 'Pending'], includeProjects: true, includeTasks: true, maxTasksPerGoal: 3 };
        break;
      case 'relationships':
        requirements.relationships = { limit: 5, includeCloseness: true };
        break;
      case 'timeline':
        requirements.timeline = { limit: 5, sort: 'desc' };
        break;
      case 'preferences':
        requirements.preferences = { includeAll: true };
        break;
      default:
        requirements[domain] = {};
    }
  }
  return requirements;
}

/* ================= EXPORTS ================= */

module.exports = {
  analyzeQuery,
  buildProjectionRequirements
};
