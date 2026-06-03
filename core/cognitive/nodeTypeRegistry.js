/**
 * NodeTypeRegistry
 *
 * Extensible registry for Cognitive State Graph node types.
 * New types are registered via register() — no code changes to CSG required.
 * All built-in types are registered at module load.
 *
 * Phase 1 — Foundation
 */

'use strict';

const registry = new Map();

/**
 * Register a node type with its behavioral config.
 * @param {string} type
 * @param {object} config
 */
function register(type, config = {}) {
  if (!type || typeof type !== 'string') {
    console.warn('[NodeTypeRegistry] register() called with invalid type:', type);
    return;
  }

  registry.set(type.toLowerCase(), {
    defaultWeight:   typeof config.defaultWeight   === 'number' ? config.defaultWeight   : 0.5,
    decayRate:       typeof config.decayRate       === 'number' ? config.decayRate       : 0.03,
    alwaysInContext: config.alwaysInContext === true,
    allowsStatus:    config.allowsStatus   !== false,   // default true
    allowsPromotion: config.allowsPromotion !== false,  // default true
    description:     typeof config.description === 'string' ? config.description : ''
  });
}

/**
 * Get config for a type. Falls back to 'topic' for unknown types.
 * @param {string} type
 * @returns {object}
 */
function get(type) {
  return registry.get((type || '').toLowerCase()) || registry.get('topic');
}

/**
 * Check if a type is explicitly registered.
 * @param {string} type
 * @returns {boolean}
 */
function isValid(type) {
  return registry.has((type || '').toLowerCase());
}

/**
 * Return all registered types as a plain object.
 * @returns {object}
 */
function getAll() {
  return Object.fromEntries(registry.entries());
}

/**
 * Return all type names where alwaysInContext === true.
 * @returns {string[]}
 */
function getAlwaysInContextTypes() {
  const result = [];
  for (const [type, cfg] of registry.entries()) {
    if (cfg.alwaysInContext) result.push(type);
  }
  return result;
}

/* ================= BUILT-IN TYPE REGISTRATIONS ================= */

//                   type            defaultWeight  decayRate  alwaysInContext  allowsStatus  allowsPromotion
register('project',    { defaultWeight: 0.8,  decayRate: 0.02,  alwaysInContext: false, allowsStatus: true,  allowsPromotion: true,  description: 'Active project or workstream' });
register('goal',       { defaultWeight: 0.9,  decayRate: 0.01,  alwaysInContext: false, allowsStatus: true,  allowsPromotion: true,  description: 'High-level objective being pursued' });
register('task',       { defaultWeight: 0.7,  decayRate: 0.03,  alwaysInContext: false, allowsStatus: true,  allowsPromotion: true,  description: 'Concrete unit of work' });
register('person',     { defaultWeight: 0.8,  decayRate: 0.01,  alwaysInContext: false, allowsStatus: false, allowsPromotion: false, description: 'Named individual known to the user' });
register('decision',   { defaultWeight: 0.9,  decayRate: 0.005, alwaysInContext: false, allowsStatus: false, allowsPromotion: false, description: 'Recorded decision with rationale and rejected alternatives' });
register('constraint', { defaultWeight: 1.0,  decayRate: 0.0,   alwaysInContext: true,  allowsStatus: false, allowsPromotion: false, description: 'Standing rule or architectural requirement' });
register('concept',    { defaultWeight: 0.6,  decayRate: 0.04,  alwaysInContext: false, allowsStatus: false, allowsPromotion: true,  description: 'Technical or domain concept' });
register('problem',    { defaultWeight: 0.7,  decayRate: 0.02,  alwaysInContext: false, allowsStatus: true,  allowsPromotion: true,  description: 'Open issue or challenge' });
register('topic',      { defaultWeight: 0.5,  decayRate: 0.05,  alwaysInContext: false, allowsStatus: false, allowsPromotion: true,  description: 'General discussion topic (default fallback)' });
register('workflow',   { defaultWeight: 0.75, decayRate: 0.02,  alwaysInContext: false, allowsStatus: true,  allowsPromotion: true,  description: 'Multi-step process or execution plan' });
register('tool',       { defaultWeight: 0.6,  decayRate: 0.01,  alwaysInContext: false, allowsStatus: false, allowsPromotion: false, description: 'Software tool or technical capability' });
register('agent',      { defaultWeight: 0.7,  decayRate: 0.0,   alwaysInContext: false, allowsStatus: false, allowsPromotion: false, description: 'AI agent component' });

/* ================= EXPORTS ================= */

module.exports = {
  register,
  get,
  isValid,
  getAll,
  getAlwaysInContextTypes
};
