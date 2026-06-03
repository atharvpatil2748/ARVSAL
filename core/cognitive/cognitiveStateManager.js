/**
 * Cognitive State Manager (CSM) — Phase 3
 *
 * Orchestrates L1 (Working Memory) and L2 (Cognitive State Graph)
 * to construct a high-density, low-latency context block for local LLMs.
 * Bypasses the O(N) embedding bottleneck of the legacy cognitiveEngine.
 */

'use strict';

const workingMemory = require('@core/cognitive/workingMemory');
const csg = require('@core/cognitive/cognitiveStateGraph');
const nodeTypeRegistry = require('@core/cognitive/nodeTypeRegistry');
const cognitiveSnapshot = require('@core/cognitive/cognitiveSnapshot');

const ArchiveOrchestrator = require('@core/cognitive/ucml/ArchiveOrchestrator');
const MemoryFusionEngine = require('@core/cognitive/ucml/MemoryFusionEngine');

/**
 * Builds the cognitive context block for a conversation turn.
 * Target latency: < 10ms.
 * 
 * @param {object} params
 * @param {string} params.text - The user's input text
 * @param {boolean} params.isLocalModel - True if routing to Ollama, False if external
 * @returns {Promise<string>} The formatted context string to prepend to the LLM prompt
 */
async function getContextBlock({ text, isLocalModel }) {
  // PRIVACY FIRST: Never inject personal memory or cognitive state into external AI APIs
  if (!isLocalModel) {
    return "";
  }

  const lines = [];
  const activeIds = new Set();

  // 1. Snapshot Built-in Constraints (always injected first)
  const snapshot = cognitiveSnapshot.load();
  const constraints = cognitiveSnapshot.getConstraints(snapshot);
  
  if (constraints.length > 0) {
    lines.push('[SYSTEM CONSTRAINTS]');
    for (const c of constraints) {
      if (c.label && c.rationale) {
        lines.push(`- ${c.label.toUpperCase()}: ${c.rationale}`);
      }
    }
    lines.push('');
  }

  // 2. Working Memory (L1) - Ephemeral Context
  // We pull pinned nodes + recently accessed nodes
  const l1Nodes = workingMemory.getAll().slice(0, 10);
  if (l1Nodes.length > 0) {
    lines.push('[ACTIVE WORKING MEMORY]');
    for (const node of l1Nodes) {
      activeIds.add(node.id);
      
      // If it's just a stub, try to promote it to a full CSG representation
      const fullNode = csg.get(node.id);
      if (fullNode && fullNode.summary) {
        lines.push(`- [${fullNode.type}] ${fullNode.label}: ${fullNode.summary}`);
      } else {
        lines.push(`- [${node.type || 'topic'}] ${node.label || node.id}`);
      }
    }
    lines.push('');
  }

  // 3. Cognitive State Graph (L2) - Fast Hybrid Search
  // If the user mentions something not in L1, find it in L2 and pull it in
  const l2Hits = await csg.search(text);
  const newL2Hits = l2Hits.filter(n => !activeIds.has(n.id)).slice(0, 5);

  if (newL2Hits.length > 0) {
    lines.push('[RELEVANT COGNITIVE CONTEXT]');
    for (const node of newL2Hits) {
      activeIds.add(node.id);
      
      // Promote to L1 (Working Memory) since it was recalled
      workingMemory.set(node.id, { id: node.id, label: node.label, type: node.type });

      let entry = `- [${node.type}] ${node.label}`;
      if (node.summary) entry += `: ${node.summary}`;
      lines.push(entry);
    }
    lines.push('');
  }

  if (process.env.UCML_ENABLED === 'true') {
    // PHASE-0 UCML INJECTION
    const result = await ArchiveOrchestrator.queryUnifiedMemory(text);
    const fusedBlock = MemoryFusionEngine.fuse(result.artifacts);
    
    if (fusedBlock) {
      lines.push(fusedBlock);
    }
  }

  // 4. Always-in-Context CSG Nodes
  // Check the registry for types that must ALWAYS be injected (like dynamic constraints)
  const alwaysTypes = nodeTypeRegistry.getAlwaysInContextTypes();
  if (alwaysTypes.length > 0) {
    const csgNodes = csg.getAll();
    const dynamicConstraints = csgNodes.filter(n => alwaysTypes.includes(n.type) && !activeIds.has(n.id));
    
    if (dynamicConstraints.length > 0) {
      lines.push('[DYNAMIC CONSTRAINTS]');
      for (const node of dynamicConstraints) {
        let entry = `- [${node.type}] ${node.label}`;
        if (node.summary) entry += `: ${node.summary}`;
        lines.push(entry);
      }
      lines.push('');
    }
  }

  if (lines.length === 0) {
    return "";
  }
  
  const output = `=== COGNITIVE STATE ===\n${lines.join('\n')}\n=======================\n\n`;

  return output;
}

module.exports = {
  getContextBlock
};
