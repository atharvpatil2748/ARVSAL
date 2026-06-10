/**
 * Phase 0.5 Context Builder Test Script
 *
 * Validates that buildContext produces a well-formed system prompt
 * combining memory, persona, tools, and world state placeholders.
 *
 * Usage: node scripts/testContextBuilder.js
 */

require('module-alias/register');
const { buildContext, fetchCapabilities, fetchWorldState } = require('@core/cognitive/unifiedContextBuilder');

async function run() {
  console.log('=== Phase 0.5 Context Builder Test ===\n');

  const testQueries = [
    'Hello, how are you?',
    'What do you remember about me?',
    'Open calculator'
  ];

  for (const query of testQueries) {
    console.log(`\n--- Query: "${query}" ---`);
    try {
      const { systemPrompt, memoryResults } = await buildContext(query, 'GENERAL');

      // Verify required blocks are present
      const checks = [
        ['<SYSTEM_PERSONA>', systemPrompt.includes('<SYSTEM_PERSONA>')],
        ['</SYSTEM_PERSONA>', systemPrompt.includes('</SYSTEM_PERSONA>')],
        ['<WORLD_STATE_PROJECTION>', systemPrompt.includes('<WORLD_STATE_PROJECTION>')],
        ['<AVAILABLE_TOOLS>', systemPrompt.includes('<AVAILABLE_TOOLS>')],
        ['<MEMORY_CONTEXT', systemPrompt.includes('<MEMORY_CONTEXT')],
        ['Response contract', systemPrompt.includes('RESPONSE CONTRACT')]
      ];

      let allPass = true;
      for (const [name, result] of checks) {
        const status = result ? '✅' : '❌';
        console.log(`  ${status} ${name}`);
        if (!result) allPass = false;
      }

      const approxTokens = Math.ceil(systemPrompt.length / 4);
      const tokenStatus = approxTokens < 4000 ? '✅' : '⚠️ OVER LIMIT';
      console.log(`  ${tokenStatus} Approx tokens: ${approxTokens}/4000`);
      console.log(`  Memory recall strength: ${memoryResults.recallStrength.toFixed(2)}`);
      console.log(`  Memory items: ${memoryResults.relevantMemory.length}`);

      if (allPass) {
        console.log('  PASS: Context builder produced valid output.');
      } else {
        console.log('  FAIL: Missing required context blocks.');
      }
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }
  }

  console.log('\n=== Test Complete ===');
}

run();
