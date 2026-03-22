/**
 * Reflection Runner
 *
 * - Async, fully FIRE-AND-FORGET
 * - Per-theme cooldown (not per-subject)
 * - Minimum-turns guard before re-triggering
 * - Detached IIFE: can NEVER block a response
 * - Fail-safe
 *
 * Phase 3 HARDENED + Phase 9 Non-Blocking Fix
 */

const { shouldTriggerReflection } = require("./reflectionTrigger");
const { generateReflection } = require("./reflectionGenerator");
const reflectionMemory = require("./reflectionMemory");


/* ================= CONFIG ================= */

// 30 minutes per theme (not per subject)
const REFLECTION_COOLDOWN_MS = 30 * 60 * 1000;

// Minimum new conversational turns required since last reflection
const MIN_TURNS_SINCE_LAST = 8;


/* ================= STATE ================= */

// Map<themeHash, timestamp> — keyed by dominant theme set, NOT just subject
const cooldownMap = new Map();

// Map<subject, turnCount> — tracks new turns since last reflection
const turnsSinceReflection = new Map();

// Map<subject, totalTurns> — used to compute delta
const lastReflectedAt = new Map();


/* ================= TURN TRACKING ================= */

/**
 * Call this on every new conversational event so we can
 * enforce the minimum-turns gate.
 * @param {string} subject
 */
function recordTurn(subject = "user") {
  subject = String(subject).toLowerCase().trim();
  const current = turnsSinceReflection.get(subject) || 0;
  turnsSinceReflection.set(subject, current + 1);
}


/* ================= THEME HASH ================= */

function themeHash(subject, dominantKeys = []) {
  const sorted = [...dominantKeys].sort().join("|");
  return `${String(subject).toLowerCase().trim()}::${sorted}`;
}


/* ================= COOLDOWN CHECK ================= */

function canRunTheme(subject, dominantKeys) {
  const hash = themeHash(subject, dominantKeys);
  const now = Date.now();
  const last = cooldownMap.get(hash);

  if (last && now - last < REFLECTION_COOLDOWN_MS) {
    return false;
  }

  cooldownMap.set(hash, now);
  return true;
}


/* ================= TURN GATE ================= */

function hasEnoughNewTurns(subject) {
  const turns = turnsSinceReflection.get(subject) || 0;
  return turns >= MIN_TURNS_SINCE_LAST;
}

function resetTurns(subject) {
  turnsSinceReflection.set(subject, 0);
}


/* ================= SAFE GUARDS ================= */

function isValidSignal(signal) {
  return (
    signal &&
    typeof signal === "object" &&
    typeof signal.subject === "string" &&
    Array.isArray(signal.sampleEvents) &&
    signal.sampleEvents.length >= 2
  );
}


/* ================= DETACHED RUNNER ================= */

/**
 * Internal async work — runs in a detached IIFE.
 * Will NEVER propagate latency to the caller.
 */
async function _runReflectionWork(subject, signal) {
  try {
    if (!canRunTheme(subject, signal.dominantKeys)) return;

    const reflection = await generateReflection(signal);
    if (!reflection || typeof reflection.summary !== "string") return;

    console.log("[Reflection] Generated:", reflection.summary);

    // Store primary insight
    reflectionMemory.addReflection({
      subject: reflection.subject || subject,
      insight: reflection.summary,
      confidence: reflection.confidence,
      relatedKeys: signal.dominantKeys || [],
      source: "reflection-engine"
    });

    // Store individual insights as weaker reflections
    if (Array.isArray(reflection.insights)) {
      for (const insight of reflection.insights) {
        if (typeof insight === "string" && insight.length > 10) {
          reflectionMemory.addReflection({
            subject: reflection.subject || subject,
            insight,
            confidence: Math.max(0.4, reflection.confidence - 0.2),
            relatedKeys: signal.dominantKeys || [],
            source: "reflection-engine-detail"
          });
        }
      }
    }

    // Reset turn count after a successful reflection
    resetTurns(subject);

  } catch {
    // 🔒 ABSOLUTE FAIL-SAFE — never crash anything
  }
}


/* ================= PUBLIC API ================= */

/**
 * Decide + generate + store reflection.
 * ALWAYS fire-and-forget: caller MUST NOT await this.
 * @param {string} subject
 */
async function maybeRunReflection(subject = "user") {
  try {
    subject = String(subject).toLowerCase().trim();

    // Count this call as a new turn regardless
    recordTurn(subject);

    // Gate 1: Not enough new turns since last reflection
    if (!hasEnoughNewTurns(subject)) return;

    // Gate 2: Check if trigger conditions are met
    const signal = shouldTriggerReflection(subject);
    if (!isValidSignal(signal)) return;

    // Gate 3: Per-theme cooldown (checked INSIDE detached work
    // so we record the timestamp at execution time, not scheduling time)

    // 🔥 DETACHED — run in background, never block the caller
    setImmediate(() => {
      _runReflectionWork(subject, signal).catch(() => { });
    });

  } catch {
    // 🔒 ABSOLUTE FAIL-SAFE
  }
}


module.exports = { maybeRunReflection, recordTurn };