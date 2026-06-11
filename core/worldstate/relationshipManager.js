/**
 * Relationship Manager — Phase 1 (Milestone 3)
 *
 * Owns the Relationship Domain.
 * Application code must NEVER manipulate CSG edges directly for relationships.
 * This is the sole public API.
 *
 * Storage:
 *   - People (nodes) live in CSG as type='person'
 *   - Relationships (edges) live in CSG via addEdge
 *
 * WAL:
 *   - RELATIONSHIP_CREATED emitted on addRelationship()
 *   - PERSON_CREATED emitted on addPerson()
 */

'use strict';

const crypto = require('crypto');
const csg = require('@core/cognitive/cognitiveStateGraph');
const eventStore = require('@core/persistence/eventStore');

/* ================= INITIALIZATION ================= */

// Ensure CSG is loaded when this module is required
csg.load();

/* ================= PERSON CRUD ================= */

/**
 * Creates or updates a Person entity in the Relationship Domain using CSG.
 *
 * @param {object} opts
 * @param {string} opts.name            Required
 * @param {string} [opts.category]      'friend' | 'family' | 'colleague' | 'mentor' | 'other'
 * @param {number} [opts.closenessScore] 0.0–1.0
 * @param {object} [opts.metadata]
 * @returns {Promise<object>} The person object
 */
async function addPerson({ name, category = 'other', closenessScore = 0.5, metadata = {} }) {
  const normName = name.trim().toLowerCase();
  
  // Try to find existing
  let existing = findPersonByName(name);
  let id;
  if (existing) {
    id = existing.id;
  } else {
    // We let CSG handle ID generation, but we pass label
  }

  const mergedMetadata = {
    ...metadata,
    category,
    closenessScore,
    lastMentioned: Date.now()
  };

  const node = await csg.upsertNode({
    type: 'person',
    label: name.trim(),
    metadata: mergedMetadata
  });

  if (!existing) {
    eventStore.appendEvent('PERSON_CREATED', 'relationships', { id: node.id, name: node.label });
    console.log(`[RelationshipManager] Person added: ${node.label} (${node.id})`);
  } else {
    console.log(`[RelationshipManager] Person updated: ${node.label} (${node.id})`);
  }

  return _mapNodeToPerson(node);
}

function _mapNodeToPerson(node) {
  return {
    id: node.id,
    name: node.label,
    category: node.metadata?.category || 'other',
    closenessScore: node.metadata?.closenessScore || 0.5,
    lastMentioned: node.metadata?.lastMentioned || node.lastActive,
    createdAt: node.firstSeen,
    metadata: node.metadata
  };
}

/**
 * Returns all known people.
 * @returns {object[]}
 */
function getAllPeople() {
  return csg.getAll().filter(n => n.type === 'person').map(_mapNodeToPerson);
}

/**
 * Finds a person by name (case-insensitive).
 * @param {string} name
 * @returns {object|null}
 */
function findPersonByName(name) {
  const norm = (name || '').trim().toLowerCase();
  const node = csg.getAll().find(n => n.type === 'person' && n.label.toLowerCase() === norm);
  return node ? _mapNodeToPerson(node) : null;
}

/* ================= RELATIONSHIP EDGES ================= */

const VALID_EDGE_TYPES = new Set([
  'friend_of', 'family_of', 'child_of', 'parent_of', 'sibling_of', 'colleague_of', 'mentored_by', 'knows',
  'collaborates_with', 'romantic_partner', 'acquaintance'
]);

/**
 * Creates a typed relationship edge between two people (or user → person).
 *
 * @param {object} opts
 * @param {string} opts.sourceId       Person id or 'usr_01'
 * @param {string} opts.targetId       Person id
 * @param {string} opts.type           Edge type from VALID_EDGE_TYPES
 * @param {string} [opts.provenance]   Source of this relationship ('user_stated', etc.)
 * @returns {object} The edge object
 */
function addRelationship({ sourceId, targetId, type, provenance = 'user_stated' }) {
  const edgeType = VALID_EDGE_TYPES.has(type) ? type : 'knows';

  const edge = csg.addEdge(sourceId, targetId, edgeType, provenance);
  
  // NOTE: csg.addEdge already emits EDGE_CREATED, but we can emit a domain-specific one
  eventStore.appendEvent('RELATIONSHIP_CREATED', 'relationships', { source: sourceId, target: targetId, type: edgeType });
  console.log(`[RelationshipManager] Relationship: ${sourceId} --${edgeType}--> ${targetId}`);
  
  return _mapEdge(edge);
}

function _mapEdge(edge) {
  return {
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    type: edge.type,
    provenance: edge.provenance,
    since: edge.createdAt,
    createdAt: edge.createdAt
  };
}

/**
 * Returns all edges for a given person id (both directions).
 * @param {string} personId
 * @returns {object[]}
 */
function getRelationships(personId) {
  return csg.getEdgesForNode(personId).map(_mapEdge);
}

/**
 * Returns all edges in the relationship graph.
 * @returns {object[]}
 */
function getAllEdges() {
  // csg doesn't expose getAllEdges right now, we can filter getEdgesForNode or just implement a small hack:
  // We'll iterate all person nodes and collect their edges.
  const edges = new Map();
  const people = getAllPeople();
  for (const p of people) {
    const eList = csg.getEdgesForNode(p.id);
    for (const e of eList) {
      edges.set(e.id, e);
    }
  }
  return Array.from(edges.values()).map(_mapEdge);
}

/**
 * Force reload from disk.
 */
function reload() {
  csg.load();
}

/* ================= EXPORTS ================= */

module.exports = {
  addPerson,
  getAllPeople,
  findPersonByName,
  addRelationship,
  getRelationships,
  getAllEdges,
  reload
};
