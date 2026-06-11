/**
 * Goal Engine — Phase 1 (Milestone 4)
 *
 * Implementation layer that manipulates Goal Domain entities.
 * Owns lifecycle of Goals, Projects, and Tasks.
 *
 * Storage:
 *   - data/worldstate/goals.json — denormalized for fast reads
 *   - WAL event emission on every mutation
 *
 * Lifecycle:
 *   Goal:    Pending → Active → Paused → Completed → Abandoned
 *   Project: Active → Archived
 *   Task:    Backlog → InProgress → Blocked → Done
 *
 * Ownership: Goal Domain owns goals. goalEngine is the manager.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const { atomicWriteJsonSync } = require('@utils/fileUtils');
const eventStore               = require('@core/persistence/eventStore');

const DATA_DIR   = path.resolve(__dirname, '../../data/worldstate');
const GOALS_FILE = path.join(DATA_DIR, 'goals.json');

/* ================= STATUS MACHINES ================= */

const GOAL_TRANSITIONS = {
  Pending:   ['Active', 'Abandoned'],
  Active:    ['Paused', 'Completed', 'Abandoned'],
  Paused:    ['Active', 'Abandoned'],
  Completed: [],
  Abandoned: []
};

const TASK_TRANSITIONS = {
  Backlog:    ['InProgress', 'Blocked'],
  InProgress: ['Blocked', 'Done'],
  Blocked:    ['InProgress', 'Done'],
  Done:       []
};

/* ================= BOOTSTRAP ================= */

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const DEFAULT_STORE = { goals: {}, projects: {}, tasks: {} };

/* ================= LOAD / SAVE ================= */

let _store = null;

function _loadFromDisk() {
  ensureDir();
  if (!fs.existsSync(GOALS_FILE)) {
    atomicWriteJsonSync(GOALS_FILE, DEFAULT_STORE);
    return JSON.parse(JSON.stringify(DEFAULT_STORE));
  }
  try {
    return JSON.parse(fs.readFileSync(GOALS_FILE, 'utf8'));
  } catch (err) {
    console.error('[GoalEngine] Load failed:', err.message);
    return JSON.parse(JSON.stringify(DEFAULT_STORE));
  }
}

function _ensureLoaded() {
  if (!_store) _store = _loadFromDisk();
}

function _save() {
  atomicWriteJsonSync(GOALS_FILE, _store);
}

/* ================= GOAL CRUD ================= */

/**
 * Creates a new Goal in the Goal Domain.
 *
 * @param {object} opts
 * @param {string} opts.label
 * @param {number} [opts.priority]     1–10
 * @param {string} [opts.targetDate]   ISO date string
 * @param {string} [opts.motivation]
 * @param {string} [opts.successCriteria]
 * @returns {object} The goal object
 */
function createGoal({ label, priority = 5, targetDate = null, status = 'Pending', motivation = null, successCriteria = null }) {
  _ensureLoaded();

  const id = `goal_${crypto.randomBytes(4).toString('hex')}`;
  const goal = {
    id,
    label,
    status,
    priority,
    targetDate,
    motivation,
    successCriteria,
    projectIds: [],
    taskIds:    [],
    createdAt:  Date.now(),
    updatedAt:  Date.now()
  };

  _store.goals[id] = goal;
  _save();

  eventStore.appendEvent('GOAL_CREATED', 'goals', { id, label, status });
  console.log(`[GoalEngine] Goal created: "${label}" (${id})`);

  return { ...goal };
}

/**
 * Creates a new Project linked to a Goal.
 *
 * @param {object} opts
 * @param {string} opts.label
 * @param {string} opts.goalId         Parent goal id
 * @param {string} [opts.repositoryUri]
 * @returns {object} The project object
 */
function createProject({ label, goalId, repositoryUri = null }) {
  _ensureLoaded();

  if (goalId && !_store.goals[goalId]) {
    throw new Error(`[GoalEngine] Goal not found: ${goalId}`);
  }

  const id = `prj_${crypto.randomBytes(4).toString('hex')}`;
  const project = {
    id,
    label,
    status:        'Active',
    parentGoalId:  goalId || null,
    repositoryUri,
    taskIds:       [],
    createdAt:     Date.now(),
    updatedAt:     Date.now()
  };

  _store.projects[id] = project;

  if (goalId && _store.goals[goalId]) {
    _store.goals[goalId].projectIds.push(id);
    _store.goals[goalId].updatedAt = Date.now();
  }

  _save();
  eventStore.appendEvent('PROJECT_CREATED', 'goals', { id, label, goalId });
  console.log(`[GoalEngine] Project created: "${label}" (${id}) → goal: ${goalId || 'none'}`);
  return { ...project };
}

/**
 * Creates a new Task linked to a Project.
 *
 * @param {object} opts
 * @param {string} opts.label
 * @param {string} [opts.projectId]    Parent project id
 * @param {string} [opts.goalId]       Parent goal id (if no project)
 * @param {string} [opts.requiredCapability]
 * @returns {object} The task object
 */
function createTask({ label, projectId = null, goalId = null, requiredCapability = null }) {
  _ensureLoaded();

  const id = `tsk_${crypto.randomBytes(4).toString('hex')}`;
  const task = {
    id,
    label,
    status:              'Backlog',
    parentProjectId:     projectId,
    parentGoalId:        goalId,
    requiredCapability,
    dependsOn:           [],
    createdAt:           Date.now(),
    updatedAt:           Date.now()
  };

  _store.tasks[id] = task;

  if (projectId && _store.projects[projectId]) {
    _store.projects[projectId].taskIds.push(id);
    _store.projects[projectId].updatedAt = Date.now();
  } else if (goalId && _store.goals[goalId]) {
    _store.goals[goalId].taskIds.push(id);
    _store.goals[goalId].updatedAt = Date.now();
  }

  _save();
  eventStore.appendEvent('TASK_CREATED', 'goals', { id, label, projectId, goalId });
  console.log(`[GoalEngine] Task created: "${label}" (${id})`);
  return { ...task };
}

/* ================= STATUS TRANSITIONS ================= */

/**
 * Transitions a Goal, Project, or Task to a new status.
 *
 * @param {string} id      Entity id (goal/project/task)
 * @param {string} status  New status
 * @returns {object} Updated entity
 */
function updateStatus(id, status) {
  _ensureLoaded();

  let entity = _store.goals[id] || _store.projects[id] || _store.tasks[id];
  if (!entity) throw new Error(`[GoalEngine] Entity not found: ${id}`);

  const entityType = _store.goals[id] ? 'goal' : _store.projects[id] ? 'project' : 'task';

  // Validate transition
  const transitions = entityType === 'task' ? TASK_TRANSITIONS : GOAL_TRANSITIONS;
  const allowed = transitions[entity.status];
  if (allowed !== undefined && !allowed.includes(status)) {
    throw new Error(`[GoalEngine] Invalid transition: ${entity.status} → ${status} for ${entityType}`);
  }

  entity.status    = status;
  entity.updatedAt = Date.now();
  _save();

  eventStore.appendEvent('STATUS_UPDATED', 'goals', { id, entityType, newStatus: status });
  console.log(`[GoalEngine] ${entityType} ${id} → ${status}`);

  return { ...entity };
}

/* ================= QUERIES ================= */

/**
 * Returns all goals with status in the given list (default: Active + Pending).
 * @param {string[]} [statuses]
 * @returns {object[]}
 */
function getActiveGoals(statuses = ['Active', 'Pending']) {
  _ensureLoaded();
  return Object.values(_store.goals)
    .filter(g => statuses.includes(g.status))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Returns the full hierarchy: Goal → Projects → Tasks.
 * @param {string} goalId
 * @returns {object|null}
 */
function getGoalHierarchy(goalId) {
  _ensureLoaded();
  const goal = _store.goals[goalId];
  if (!goal) return null;

  const projects = (goal.projectIds || [])
    .map(pid => {
      const proj = _store.projects[pid];
      if (!proj) return null;
      const tasks = (proj.taskIds || []).map(tid => _store.tasks[tid]).filter(Boolean);
      return { ...proj, tasks };
    })
    .filter(Boolean);

  const directTasks = (goal.taskIds || []).map(tid => _store.tasks[tid]).filter(Boolean);

  return { ...goal, projects, directTasks };
}

/**
 * Returns a specific goal by id.
 * @param {string} goalId
 * @returns {object|null}
 */
function getGoal(goalId) {
  _ensureLoaded();
  return _store.goals[goalId] ? { ..._store.goals[goalId] } : null;
}

/**
 * Returns all projects.
 */
function getAllProjects() {
  _ensureLoaded();
  return Object.values(_store.projects);
}

/**
 * Returns all tasks.
 */
function getAllTasks() {
  _ensureLoaded();
  return Object.values(_store.tasks);
}

/**
 * Force reload from disk.
 */
function reload() {
  _store = _loadFromDisk();
}

/* ================= EXPORTS ================= */

module.exports = {
  createGoal,
  createProject,
  createTask,
  updateStatus,
  getActiveGoals,
  getGoalHierarchy,
  getGoal,
  getAllProjects,
  getAllTasks,
  reload
};
