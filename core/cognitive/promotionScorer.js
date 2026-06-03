/**
 * Promotion Scorer (Phase 2)
 *
 * Calculates a weighted promotion score for CSG candidates.
 * Score > 0.60 → promote to L2 CCG
 * Score > 0.85 → auto-pin candidate
 *
 * Formula:
 * PromotionScore = 
 *   (peak_importance  * 0.35) +
 *   (recency_score    * 0.25) +
 *   (log10(frequency+1) * 0.15) +
 *   (emphasis_signal  * 0.15) +
 *   (reflection_hit   * 0.10)
 */

'use strict';

const THRESHOLD_PROMOTE = 0.60;
const THRESHOLD_PIN = 0.85;

/**
 * Calculate promotion score for a topic/concept.
 * @param {object} params
 * @param {number} [params.peakImportance=0.5] - Max importance across episodes (0-1)
 * @param {number} [params.lastActive] - Timestamp of last mention
 * @param {number} [params.frequency=1] - Number of times mentioned/sessions
 * @param {number} [params.emphasis=0] - Boolean or 0-1 for explicit emphasis
 * @param {number} [params.reflectionHit=0] - Boolean or 0-1 if found in reflections
 * @returns {number} Score between 0 and 1
 */
function calculateScore({
  peakImportance = 0.5,
  lastActive = Date.now(),
  frequency = 1,
  emphasis = 0,
  reflectionHit = 0
}) {
  // Normalize inputs
  const pImp = Math.min(Math.max(peakImportance, 0), 1);
  const freq = Math.max(frequency, 0);
  const emp = emphasis ? 1.0 : 0.0;
  const ref = reflectionHit ? 1.0 : 0.0;

  // Recency score (linear decay over 30 days)
  const daysSince = Math.max(0, (Date.now() - lastActive) / (1000 * 60 * 60 * 24));
  const recency = Math.max(0, 1.0 - (daysSince / 30.0));

  // Frequency (log-dampened to prevent spam-promotion)
  // log10(10) = 1.0, log10(100) = 2.0 (we cap effect around 10-15 mentions)
  const freqScore = Math.min(Math.log10(freq + 1) / Math.log10(10), 1.0);

  const score = (pImp * 0.35) +
                (recency * 0.25) +
                (freqScore * 0.15) +
                (emp * 0.15) +
                (ref * 0.10);

  return Math.min(Math.max(score, 0), 1.0);
}

function shouldPromote(score) {
  return score >= THRESHOLD_PROMOTE;
}

function shouldPin(score) {
  return score >= THRESHOLD_PIN;
}

module.exports = {
  calculateScore,
  shouldPromote,
  shouldPin,
  THRESHOLD_PROMOTE,
  THRESHOLD_PIN
};
