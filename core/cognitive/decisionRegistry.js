/**
 * Decision Registry (Phase 4)
 *
 * Dedicated toolset for tracking architectural, personal, or system decisions.
 * Stored as specialized 'decision' nodes in the CSG.
 */

'use strict';

const csg = require('@core/cognitive/cognitiveStateGraph');
const nodeTypeRegistry = require('@core/cognitive/nodeTypeRegistry');

/**
 * Record a decision with its rationale and alternatives.
 * @param {object} params
 * @param {string} params.label - The decision title (e.g., "Use LanceDB for Phase 5")
 * @param {string} params.rationale - Why this decision was made
 * @param {string[]} [params.alternatives=[]] - Rejected alternatives
 * @param {string} [params.parentId=null] - Project or Goal ID this belongs to
 * @returns {Promise<object>} The upserted CSG node
 */
async function recordDecision({ label, rationale, alternatives = [], parentId = null }) {
  if (!label || !rationale) {
    throw new Error('label and rationale are required to record a decision.');
  }

  const summary = `Decision: ${rationale}. ` + 
    (alternatives.length ? `Rejected: ${alternatives.join(', ')}.` : '');

  const node = await csg.upsertNode({
    type: 'decision',
    label,
    summary,
    parentId,
    metadata: {
      rationale,
      alternatives
    }
  });

  return node;
}

/**
 * Find decisions matching a query string.
 * @param {string} query 
 * @returns {Promise<object[]>} Array of decision nodes
 */
async function lookupDecision(query) {
  const hits = await csg.search(query);
  return hits.filter(n => n.type === 'decision');
}

module.exports = {
  recordDecision,
  lookupDecision
};
