/**
 * Cognitive State Graph (CSG - Phase 2)
 *
 * Persisted graph of typed cognitive nodes.
 * Bridges ephemeral working memory (L1) and deep archive (L3).
 *
 * Implements:
 *  - Typed nodes via NodeTypeRegistry
 *  - Disk persistence with write-batching
 *  - O(1) label index
 *  - activeIndex for semantic search filtering
 *  - Hybrid retrieval (label fast-path + semantic fallback)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const pathConfig = require('@utils/pathConfig');
const { embedText } = require('@core/memory/embeddingModel');
const nodeTypeRegistry = require('@core/cognitive/nodeTypeRegistry');
const { generateSynonyms } = require('@core/cognitive/synonymExpander');
const { atomicWriteJsonSync } = require('@utils/fileUtils');
const { calculateScore } = require('@core/cognitive/promotionScorer');
const eventBus = require('@core/cognitive/cognitiveEventBus');
const eventStore = require('@core/persistence/eventStore');

const CSG_FILE = path.join(pathConfig.MEMORY_DIR, 'cognitive_state_graph.json');

/* ================= STATE ================= */

let _nodes = new Map();
let _edges = []; // Not heavily used yet, but part of schema
let _lastUpdated = Date.now();

// Indexes
let _labelIndex = new Map();   // normalized_label → nodeId
let _synonymIndex = new Map(); // normalized_synonym → nodeId
let _activeIndex = new Set();  // set of nodeIds where weight > 0.2

// Batching
let _pendingSave = false;
let _saveTimer = null;

/* ================= HELPERS ================= */

function _normalize(text) {
  return (text || '').toString().toLowerCase().trim().replace(/[^\w\s-]/g, '');
}

function _cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function _rebuildIndexes() {
  _labelIndex.clear();
  _synonymIndex.clear();
  _activeIndex.clear();

  for (const [id, node] of _nodes.entries()) {
    const nl = _normalize(node.label);
    if (nl) _labelIndex.set(nl, id);

    if (Array.isArray(node.synonyms)) {
      for (const syn of node.synonyms) {
        const ns = _normalize(syn);
        if (ns) _synonymIndex.set(ns, id);
      }
    }

    if (node.weight > 0.2 || node.pinned || nodeTypeRegistry.get(node.type).alwaysInContext) {
      _activeIndex.add(id);
    }
  }
}

function _scheduleSave() {
  _pendingSave = true;
  if (!_saveTimer) {
    _saveTimer = setTimeout(() => {
      save();
    }, 60000); // 60s write-batching
  }
}

/* ================= LOAD / SAVE ================= */

function load() {
  try {
    if (!fs.existsSync(CSG_FILE)) {
      _nodes.clear();
      _edges = [];
      _rebuildIndexes();
      save(); // immediately write default
      return;
    }

    const raw = JSON.parse(fs.readFileSync(CSG_FILE, 'utf8'));
    _nodes = new Map(Object.entries(raw.nodes || {}));
    _edges = raw.edges || [];
    _lastUpdated = raw.lastUpdated || Date.now();
    _rebuildIndexes();
    console.log(`[CSG] Loaded ${_nodes.size} nodes.`);
  } catch (err) {
    console.error('[CSG] Load failed:', err.message);
    _nodes.clear();
    _edges = [];
    _rebuildIndexes();
  }
}

function save() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  _pendingSave = false;

  try {
    const raw = {
      nodes: Object.fromEntries(_nodes.entries()),
      edges: _edges,
      lastUpdated: Date.now()
    };
    atomicWriteJsonSync(CSG_FILE, raw);
  } catch (err) {
    console.error('[CSG] Save failed:', err.message);
  }
}

/* ================= CRUD ================= */

/**
 * Creates or updates a node.
 * Automatically generates embedding and synonyms if new.
 */
async function upsertNode({ type, label, summary = '', pinned = false, parentId = null, metadata = {} }) {
  const normLabel = _normalize(label);
  if (!normLabel) return null;

  // If type invalid, default to topic
  const nodeType = nodeTypeRegistry.isValid(type) ? type : 'topic';
  const typeConfig = nodeTypeRegistry.get(nodeType);

  // Slugify label for ID
  const slug = normLabel.replace(/\s+/g, '_');
  const id = `node::${nodeType}::${slug}`;

  let node = _nodes.get(id);

  if (!node) {
    // Create new
    node = {
      id,
      type: nodeType,
      label,
      synonyms: [],
      embedding: null,
      weight: typeConfig.defaultWeight,
      pinned,
      status: typeConfig.allowsStatus ? 'active' : null,
      summary,
      promotionScore: typeConfig.allowsPromotion ? 0.6 : null, // starts eligible
      sessionCount: 1,
      firstSeen: Date.now(),
      lastActive: Date.now(),
      parentId,
      childIds: [],
      relatedIds: [],
      metadata
    };
    _nodes.set(id, node);

    eventBus.emit(eventBus.EVENTS.NODE_PROMOTED, node);

    // Fire and forget async population
    setImmediate(async () => {
      try {
        if (!node.embedding) {
          node.embedding = await embedText(label);
        }
        if (!node.synonyms.length) {
          node.synonyms = await generateSynonyms(label);
        }
        _rebuildIndexes();
        _scheduleSave();
      } catch (err) {
        console.warn(`[CSG] Async population failed for ${id}:`, err.message);
      }
    });

  } else {
    // Update existing
    node.weight = Math.min(1.0, node.weight + 0.1);
    node.sessionCount += 1;
    node.lastActive = Date.now();
    if (summary) node.summary = summary;
    if (pinned) node.pinned = true;
    Object.assign(node.metadata, metadata);

    // Recalculate promotion score if applicable
    if (typeConfig.allowsPromotion) {
      node.promotionScore = calculateScore({
        peakImportance: 0.8, // Approximation since we don't link full episodic tree yet
        lastActive: node.lastActive,
        frequency: node.sessionCount
      });
    }
  }

  _rebuildIndexes();
  _scheduleSave();
  eventStore.appendEvent("NODE_UPSERTED", "cognitive", { node });
  return node;
}

function get(id) {
  return _nodes.get(id) || null;
}

function has(id) {
  return _nodes.has(id);
}

function getAll() {
  return [..._nodes.values()];
}

/* ================= RETRIEVAL ================= */

/**
 * Hybrid search: Label/Synonym fast-path -> Semantic fallback.
 * @param {string} text 
 * @returns {Promise<Array>} Array of nodes
 */
async function search(text) {
  const normText = _normalize(text);
  if (!normText) return [];

  const hits = new Map();

  // 1. Fast Path: Label & Synonym exact inclusion
  for (const [lbl, id] of _labelIndex.entries()) {
    if (normText.includes(lbl) || lbl.includes(normText)) {
      const n = _nodes.get(id);
      if (n) hits.set(id, n);
    }
  }
  for (const [syn, id] of _synonymIndex.entries()) {
    if (normText.includes(syn) || syn.includes(normText)) {
      const n = _nodes.get(id);
      if (n) hits.set(id, n);
    }
  }

  if (hits.size > 0) {
    return [...hits.values()]; // Found deterministic matches
  }

  // 2. Semantic Fallback (only against activeIndex)
  const queryEmb = await embedText(text);
  if (!queryEmb) return [];

  const semanticHits = [];
  for (const id of _activeIndex) {
    const node = _nodes.get(id);
    if (!node || !node.embedding) continue;
    
    const sim = _cosineSimilarity(queryEmb, node.embedding);
    if (sim > 0.65) {
      semanticHits.push({ node, sim });
    }
  }

  return semanticHits
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 5)
    .map(h => h.node);
}

/**
 * Force synchronous save (used on process exit)
 */
function flush() {
  if (_pendingSave) save();
}

module.exports = {
  load,
  save,
  flush,
  upsertNode,
  get,
  has,
  getAll,
  search
};
