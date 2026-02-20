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
const MIN_IMPORTANCE_AVG = 0.58;
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
  const recent = episodicMemory.getBySubject(subject, 20);
  if (!recent || recent.length < MIN_EVENTS_FOR_REFLECTION) {
    return null;
  }

  // Filter meaningful, non-noise events
  const meaningful = recent.filter(e =>
    e &&
    e.importance >= 0.5 &&
    e.type === "conversation" &&
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
  const keyCounts = {};

  for (const e of meaningful) {
    if (!e.key) continue;

    keyCounts[e.key] = (keyCounts[e.key] || 0) + 1;
    keyStats[e.key] = (keyStats[e.key] || 0) + (e.importance || 0);
  }

  const dominantKeys = Object.keys(keyCounts).filter(key => {
    const count = keyCounts[key];
    const avgKeyImportance = keyStats[key] / count;

    return (
      count >= 3 &&                 // frequency threshold
      avgKeyImportance >= 0.55      // quality threshold
    );
  });

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