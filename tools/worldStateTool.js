/**
 * World State Tool — Phase 1 (Milestone 6)
 *
 * Path B: Explicit LLM access to query and mutate reality.
 * Used by the Unified Agent Loop when automatic projection (Path A) is insufficient.
 *
 * Input schema (from LLM):
 *   { tool: "worldstate", action: "<action>", params: { ... } }
 *
 * All write operations emit to the WAL via their respective managers.
 */

'use strict';

/* ================= DOMAIN MANAGERS ================= */

const identityManager     = require('@core/worldstate/identityManager');
const preferenceManager   = require('@core/worldstate/preferenceManager');
const relationshipManager = require('@core/worldstate/relationshipManager');
const goalEngine          = require('@core/worldstate/goalEngine');
const timelineManager     = require('@core/worldstate/timelineManager');

/* ================= ACTIONS ================= */

const ACTIONS = {

  // ── READ ─────────────────────────────────────────────

  get_identity: (_params) => {
    return { success: true, data: identityManager.getUserProfile() };
  },

  get_preferences: (_params) => {
    return { success: true, data: preferenceManager.getPreferences() };
  },

  get_active_goals: ({ statuses } = {}) => {
    const goals = goalEngine.getActiveGoals(statuses);
    return { success: true, data: goals };
  },

  get_goal: ({ goalId }) => {
    if (!goalId) return { success: false, error: 'goalId is required' };
    const hierarchy = goalEngine.getGoalHierarchy(goalId);
    return hierarchy
      ? { success: true, data: hierarchy }
      : { success: false, error: `Goal not found: ${goalId}` };
  },

  get_people: (_params) => {
    return { success: true, data: relationshipManager.getAllPeople() };
  },

  get_relationships: ({ personId }) => {
    if (!personId) return { success: false, error: 'personId is required' };
    return { success: true, data: relationshipManager.getRelationships(personId) };
  },

  get_timeline: ({ limit, category } = {}) => {
    return { success: true, data: timelineManager.getMilestones(limit || 10, category || null) };
  },

  // ── WRITE ────────────────────────────────────────────

  update_identity: (params) => {
    if (!params || typeof params !== 'object') return { success: false, error: 'params must be an object' };
    const updated = identityManager.updateUserProfile(params);
    return { success: true, data: updated };
  },

  update_preference: ({ category, key, value }) => {
    if (!category || !key || value === undefined) return { success: false, error: 'category, key, value required' };
    const updated = preferenceManager.updatePreference(category, key, value);
    return { success: true, data: updated };
  },

  create_goal: ({ label, priority, targetDate } = {}) => {
    if (!label) return { success: false, error: 'label is required' };
    const goal = goalEngine.createGoal({ label, priority: priority || 5, targetDate: targetDate || null });
    return { success: true, data: goal };
  },

  create_project: ({ label, goalId, repositoryUri } = {}) => {
    if (!label) return { success: false, error: 'label is required' };
    try {
      const project = goalEngine.createProject({ label, goalId: goalId || null, repositoryUri: repositoryUri || null });
      return { success: true, data: project };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  create_task: ({ label, projectId, goalId, requiredCapability } = {}) => {
    if (!label) return { success: false, error: 'label is required' };
    const task = goalEngine.createTask({ label, projectId: projectId || null, goalId: goalId || null, requiredCapability: requiredCapability || null });
    return { success: true, data: task };
  },

  update_goal_status: ({ id, status }) => {
    if (!id || !status) return { success: false, error: 'id and status are required' };
    try {
      const updated = goalEngine.updateStatus(id, status);
      return { success: true, data: updated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  add_person: ({ name, category, closenessScore } = {}) => {
    if (!name) return { success: false, error: 'name is required' };
    const person = relationshipManager.addPerson({ name, category: category || 'other', closenessScore: closenessScore || 0.5 });
    return { success: true, data: person };
  },

  add_relationship: ({ sourceId, targetId, type } = {}) => {
    if (!sourceId || !targetId || !type) return { success: false, error: 'sourceId, targetId, type required' };
    const edge = relationshipManager.addRelationship({ sourceId, targetId, type });
    return { success: true, data: edge };
  },

  add_milestone: ({ label, category, date, linkedGoalIds, impactScore, summary } = {}) => {
    if (!label || !date) return { success: false, error: 'label and date are required' };
    try {
      const milestone = timelineManager.addMilestone({ label, category: category || 'other', date, linkedGoalIds: linkedGoalIds || [], impactScore: impactScore || 0.7, summary: summary || '' });
      return { success: true, data: milestone };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

/* ================= EXECUTE ================= */

async function execute({ action, params = {} }) {
  const handler = ACTIONS[action];
  if (!handler) {
    return {
      success: false,
      error: `Unknown worldstate action: "${action}". Valid actions: ${Object.keys(ACTIONS).join(', ')}`
    };
  }

  try {
    const result = handler(params);
    return result;
  } catch (err) {
    console.error(`[WorldStateTool] Action "${action}" threw:`, err.message);
    return { success: false, error: err.message };
  }
}

/* ================= DESCRIPTION (for LLM capability exposure) ================= */

const DESCRIPTION = `Manage ARVSAL's World State: read or write goals, projects, tasks, relationships, timeline milestones, identity, and preferences. Use read actions freely. Write actions (create/update) mutate persistent reality and emit to the audit log.`;

/* ================= EXPORTS ================= */

module.exports = {
  execute,
  DESCRIPTION,
  SUPPORTED_ACTIONS: Object.keys(ACTIONS)
};
