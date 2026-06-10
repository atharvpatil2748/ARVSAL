/**
 * Response Parser — Phase 0.5
 *
 * Implements the Structured Response Contract for the Unified Agent Loop.
 *
 * Supported response types:
 *   - tool_call
 *   - final_response
 *   - delegate
 *   - request_context
 *
 * Model-agnostic: handles strict JSON, markdown-fenced JSON,
 * and partially broken JSON from weaker local models.
 *
 * Design principle:
 *   This parser NEVER crashes. On any failure it returns a typed error
 *   object that allows the agent loop to self-correct.
 */

'use strict';

/* ================= VALID TYPES ================= */

const VALID_TYPES = new Set([
  'tool_call',
  'final_response',
  'delegate',
  'request_context'
]);

/* ================= JSON EXTRACTION ================= */

/**
 * Attempts to extract a raw JSON object string from LLM output.
 * Handles markdown code fences (```json ... ```) and trailing prose.
 *
 * @param {string} raw - Raw LLM output
 * @returns {string} Extracted JSON string or original string
 */
function extractJsonString(raw) {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw.trim();

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // Collapse literal newlines to spaces (fixes unescaped newlines in string values)
  text = text.replace(/\r?\n/g, ' ');

  // Extract the first complete { ... } block
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    return text.substring(firstBrace, lastBrace + 1).trim();
  }

  return text;
}

/* ================= SCHEMA VALIDATION ================= */

/**
 * Validates a parsed response object against the Structured Response Contract.
 *
 * @param {object} parsed - Parsed JSON object
 * @returns {{ valid: boolean, error?: string }}
 */
function validate(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Response is not a JSON object.' };
  }

  if (!parsed.type || !VALID_TYPES.has(parsed.type)) {
    return {
      valid: false,
      error: `Missing or invalid 'type' field. Expected one of: ${[...VALID_TYPES].join(', ')}.`
    };
  }

  if (parsed.type === 'tool_call') {
    if (!parsed.tool || typeof parsed.tool !== 'string') {
      return { valid: false, error: "tool_call requires 'tool' (string) field." };
    }
    if (!parsed.action || typeof parsed.action !== 'string') {
      return { valid: false, error: "tool_call requires 'action' (string) field." };
    }
    if (parsed.params !== undefined && typeof parsed.params !== 'object') {
      return { valid: false, error: "tool_call 'params' must be an object if present." };
    }
  }

  if (parsed.type === 'final_response') {
    if (!parsed.response || typeof parsed.response !== 'string') {
      return { valid: false, error: "final_response requires 'response' (string) field." };
    }
  }

  if (parsed.type === 'delegate') {
    if (!parsed.target || typeof parsed.target !== 'string') {
      return { valid: false, error: "delegate requires 'target' (string) field." };
    }
    if (!parsed.task || typeof parsed.task !== 'string') {
      return { valid: false, error: "delegate requires 'task' (string) field." };
    }
  }

  if (parsed.type === 'request_context') {
    if (!parsed.question || typeof parsed.question !== 'string') {
      return { valid: false, error: "request_context requires 'question' (string) field." };
    }
  }

  return { valid: true };
}

/* ================= MAIN PARSER ================= */

/**
 * Parses raw LLM output against the Structured Response Contract.
 *
 * @param {string} rawLLMOutput - Raw text from any LLM
 * @returns {object} Parsed and validated response, or typed error object
 */
function parse(rawLLMOutput) {
  if (!rawLLMOutput || typeof rawLLMOutput !== 'string') {
    return {
      type: 'error',
      message: 'LLM returned empty or non-string output.',
      raw: rawLLMOutput
    };
  }

  const jsonString = extractJsonString(rawLLMOutput);

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    return {
      type: 'error',
      message: `Invalid JSON format. Could not parse LLM output. Error: ${e.message}`,
      raw: rawLLMOutput.substring(0, 500)  // cap for log safety
    };
  }

  const { valid, error } = validate(parsed);
  if (!valid) {
    return {
      type: 'error',
      message: `Schema validation failed: ${error}`,
      parsed,
      raw: rawLLMOutput.substring(0, 500)
    };
  }

  return parsed;
}

module.exports = { parse };
