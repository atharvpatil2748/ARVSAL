/**
 * Reflection Trigger Logic
 *
 * Decides WHEN a reflection should be generated.
 *
 * - NEVER calls LLM
 * - NEVER writes memory directly
 * - ONLY emits structured reflection signals
 *
 * Deterministic, theme-aware, low-noise.
 */

const episodicMemory = require("./episodicMemory");


/* ================= CONFIG ================= */

const MIN_EVENTS_FOR_REFLECTION = 3;
const MIN_IMPORTANCE_AVG = 0.65;
const MIN_KEY_DOMINANCE = 2;


/* ================= UTIL ================= */

function normalizeSubject(subject) {
  return String(subject || "user").toLowerCase().trim();
}


/* ================= CORE ================= */

/**
 * Decide whether reflection should run
 * @param {string} subject
 * @returns {object|null}
 */
function shouldTriggerReflection(subject = "user") {
  subject = normalizeSubject(subject);

  // Pull recent episodic memory
  const recent = episodicMemory.getBySubject(subject, 12);
  if (!recent || recent.length < MIN_EVENTS_FOR_REFLECTION) {
    return null;
  }

  // Filter meaningful, non-noise events
  const meaningful = recent.filter(e =>
    e &&
    e.importance >= 0.5 &&
    e.type !== "response" &&
    e.type !== "system" &&
    typeof e.value === "string" &&
    e.value.length > 5
  );

  if (meaningful.length < MIN_EVENTS_FOR_REFLECTION) {
    return null;
  }

  // Calculate average importance
  const avgImportance =
    meaningful.reduce((sum, e) => sum + (e.importance || 0), 0) /
    meaningful.length;

  if (avgImportance < MIN_IMPORTANCE_AVG) {
    return null;
  }

  // Theme cohesion via key dominance
  const keyStats = {};
  for (const e of meaningful) {
    if (!e.key) continue;
    keyStats[e.key] = (keyStats[e.key] || 0) + e.importance;
  }

  const dominantKeys = Object.entries(keyStats)
    .filter(([, score]) => score >= MIN_KEY_DOMINANCE)
    .map(([key]) => key);

  // 🚫 No coherent theme → no reflection
  if (!dominantKeys.length) {
    return null;
  }

  // Use most recent meaningful samples (true recency)
  const sampleEvents = meaningful
    .slice(0, 5)
    .map(e => ({
      type: e.type,
      key: e.key || null,
      value: e.value,
      importance: e.importance
    }));

  return {
    subject,
    reason: "coherent_pattern_detected",
    avgImportance,
    dominantKeys,
    sampleEvents
  };
}


/* ================= EXPORT ================= */

module.exports = {
  shouldTriggerReflection
};