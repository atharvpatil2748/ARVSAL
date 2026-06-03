/**
 * Synonym Expander (Phase 2)
 *
 * Uses local LLM to generate synonyms for CSG nodes.
 * Fire-and-forget, async operation. Updates the CSG node once complete.
 */

'use strict';

const { runLLM } = require('@providers/llm/llmRunner');

/**
 * Generate synonyms for a given label.
 * @param {string} label - The label to expand (e.g. 'memory redesign')
 * @returns {Promise<string[]>} Array of synonyms
 */
async function generateSynonyms(label) {
  if (!label || typeof label !== 'string') return [];

  const prompt = `You are a linguistic synonym generator. 
Provide a comma-separated list of 3 to 5 alternative terms or phrases that mean the exact same thing as "${label}".
Do not include any explanations, bullet points, or numbering. Just the comma-separated terms.
Example for "memory redesign": memory architecture, cognitive layer, memory rewrite`;

  try {
    // We use a small, fast local model if possible. Llama3 is default for text processing.
    const result = await runLLM({
      model: 'llama3',
      prompt,
      timeout: 15000,
      isStructured: true
    });

    if (!result) return [];

    // Parse CSV output
    const synonyms = result
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0 && s !== label.toLowerCase());

    // Deduplicate and return max 5
    return [...new Set(synonyms)].slice(0, 5);

  } catch (err) {
    console.warn('[SynonymExpander] Failed to generate synonyms:', err.message);
    return [];
  }
}

module.exports = {
  generateSynonyms
};
