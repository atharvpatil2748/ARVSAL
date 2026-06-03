/**
 * Memory Agent (Phase 5)
 *
 * Owns the full lifecycle of the Cognitive State Manager (CSM) and the CSG.
 * Acts as the authoritative source of context for all other agents (Planner, Researcher).
 */

'use strict';

const csm = require('@core/cognitive/cognitiveStateManager');
const csg = require('@core/cognitive/cognitiveStateGraph');
const cognitiveSnapshot = require('@core/cognitive/cognitiveSnapshot');
const workingMemory = require('@core/cognitive/workingMemory');
const eventBus = require('@core/cognitive/cognitiveEventBus');

class MemoryAgent {
  constructor() {
    this.bus = eventBus;
    this._bindEvents();
  }

  _bindEvents() {
    this.bus.on(this.bus.EVENTS.NODE_PROMOTED, (payload) => {
      console.log(`[MemoryAgent] Node promoted to L1: ${payload.id}`);
    });
    this.bus.on(this.bus.EVENTS.NODE_RESOLVED, (payload) => {
      console.log(`[MemoryAgent] Node resolved, archiving: ${payload.id}`);
    });
  }

  /**
   * Retrieves the universal AgentContext object for the caller.
   * @param {string} text - User query or intent
   * @returns {Promise<object>} AgentContext
   */
  async getAgentContext(text) {
    // 1. Get raw snapshot
    const snapshot = cognitiveSnapshot.load();
    const constraints = cognitiveSnapshot.getConstraints(snapshot);

    // 2. Build working nodes
    const workingNodes = workingMemory.getAll().map(stub => csg.get(stub.id) || stub);

    // 3. Resolve context layer hits
    const activeProject = workingMemory.getActiveProjectId() ? csg.get(workingMemory.getActiveProjectId()) : null;
    const activeGoal = workingMemory.getActiveGoalId() ? csg.get(workingMemory.getActiveGoalId()) : null;

    // 4. Async L2 Search (fast-path fallback)
    let contextLayer = "L1";
    let relevantMemory = [];

    if (text) {
      const l2Hits = await csg.search(text);
      if (l2Hits.length > 0) {
        contextLayer = "L2";
        relevantMemory = l2Hits.slice(0, 5);
      }
    }

    return {
      cognitiveSnapshot: snapshot,
      workingNodes,
      constraints,
      activeProject,
      activeGoal,
      relevantMemory,
      contextLayer,
      availableTools: [
        'upsert_cognitive_node',
        'query_cognitive_graph',
        'resolve_cognitive_node',
        'pin_cognitive_node',
        'record_decision',
        'lookup_decision'
      ]
    };
  }

  /**
   * Directly fetch constraint nodes to evaluate safety of planned actions.
   * @returns {Array} Constraint objects
   */
  getConstraints() {
    return cognitiveSnapshot.getConstraints(cognitiveSnapshot.load());
  }

  /**
   * Perform routine maintenance on the CSG (decay weights, archive old nodes).
   */
  performMaintenance() {
    const nodes = csg.getAll();
    let archived = 0;
    const now = Date.now();
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

    for (const node of nodes) {
      if (node.pinned) continue;
      
      // Decay weight slightly
      if (node.weight > 0) {
        node.weight = Math.max(0, node.weight - 0.005);
      }

      // Archive cold nodes
      if (node.status === 'active' && node.weight < 0.1 && (now - node.lastActive > NINETY_DAYS)) {
        node.status = 'archived';
        archived++;
      }
    }

    if (archived > 0) {
      console.log(`[MemoryAgent] Maintenance complete. Archived ${archived} nodes.`);
      csg.save();
    }
  }
}

module.exports = new MemoryAgent();
