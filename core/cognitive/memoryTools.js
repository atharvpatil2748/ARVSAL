/**
 * Memory Tools (Phase 4)
 *
 * Full CRUD interface for the Cognitive State Graph (CSG).
 * Exposes methods intended to be wrapped by the LLM tool registry.
 */

'use strict';

const csg = require('@core/cognitive/cognitiveStateGraph');
const workingMemory = require('@core/cognitive/workingMemory');

/**
 * Creates or updates a node in the CSG.
 * @param {object} params
 * @param {string} params.type - e.g. project, goal, task, topic
 * @param {string} params.label - The title of the node
 * @param {string} [params.summary] - Explanation or status
 * @param {boolean} [params.pinned=false] - Whether to pin to L1
 * @param {string} [params.parentId] - Optional parent node ID
 * @returns {Promise<object>}
 */
async function upsertMemoryNode({ type, label, summary = '', pinned = false, parentId = null }) {
  if (!type || !label) {
    throw new Error('type and label are required to upsert a memory node.');
  }

  const node = await csg.upsertNode({ type, label, summary, pinned, parentId });
  
  // Bring to working memory (L1) automatically since we interacted with it
  if (node) {
    workingMemory.set(node.id, { id: node.id, label: node.label, type: node.type });
  }

  return node;
}

/**
 * Queries the CSG using hybrid search.
 * @param {object} params
 * @param {string} params.query - The search string
 * @returns {Promise<object[]>}
 */
async function queryMemoryGraph({ query }) {
  if (!query) return [];
  const hits = await csg.search(query);
  return hits;
}

/**
 * Marks a project or task as completed/resolved.
 * @param {object} params
 * @param {string} params.nodeId - The ID of the node
 * @returns {Promise<boolean>}
 */
async function resolveMemoryNode({ nodeId }) {
  const node = csg.get(nodeId);
  if (!node) return false;

  node.status = 'resolved';
  node.weight = 0; // Drop weight so it stops showing up in semantic searches easily
  if (node.pinned) {
    node.pinned = false;
    workingMemory.unpin(nodeId);
  }
  
  csg.save();
  return true;
}

/**
 * Pins a node to Working Memory (L1).
 * @param {object} params
 * @param {string} params.nodeId
 * @returns {Promise<boolean>}
 */
async function pinToWorkingMemory({ nodeId }) {
  const node = csg.get(nodeId);
  if (!node) return false;

  node.pinned = true;
  workingMemory.set(nodeId, { id: node.id, label: node.label, type: node.type }, { pinned: true });
  csg.save();
  return true;
}

module.exports = {
  upsertMemoryNode,
  queryMemoryGraph,
  resolveMemoryNode,
  pinToWorkingMemory
};
