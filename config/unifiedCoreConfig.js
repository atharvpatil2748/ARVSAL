/**
 * Unified Core Config — Phase 0.5
 *
 * SINGLE SOURCE OF TRUTH for all Unified Cognitive Core settings.
 *
 * Rules:
 *   - No model name appears in unifiedAgentLoop.js directly.
 *   - No hidden fallback chains.
 *   - This file is the ONLY place to change model routing.
 *
 * Architecture Decision:
 *   Primary model: gemma4:e4b (confirmed installed via `ollama list`)
 *   Gemini is the external cloud fallback when ACTIVE_AI === 'gemini'.
 *   There is NO local fallback model. If gemma4:e4b is unavailable,
 *   the loop returns a clear error rather than silently degrading.
 *
 *   Rationale: Silent fallback to phi3:mini produces contract violations
 *   because phi3:mini was never trained for JSON-only structured output.
 *   Explicit failure is always preferable to silent degradation.
 */

'use strict';

const UNIFIED_CORE_CONFIG = {
  /**
   * The primary local Ollama model for Unified Cognitive Core reasoning.
   * Must be verified present via `ollama list` before deployment.
   * Current: gemma4:e4b (9.6 GB, installed 4 weeks ago)
   */
  PRIMARY_MODEL: 'gemma4:e4b',

  /**
   * Maximum ReAct loop iterations before giving up.
   * Prevents infinite loops on malformed model output.
   */
  MAX_ITERATIONS: 5,

  /**
   * Maximum consecutive parse/model errors before hard fallback.
   */
  MAX_CONSECUTIVE_ERRORS: 2,

  /**
   * Timeout per LLM call in milliseconds.
   * gemma4:e4b is larger than phi3:mini — allow more time.
   */
  LLM_TIMEOUT_MS: 90000,

  /**
   * Whether to allow graceful raw-text fallback when the model cannot
   * produce valid JSON after MAX_CONSECUTIVE_ERRORS attempts.
   * Set to false to enforce strict contract compliance (stricter, but surfaces
   * prompt quality issues faster during development).
   */
  ALLOW_RAW_TEXT_FALLBACK: true
};

module.exports = UNIFIED_CORE_CONFIG;
