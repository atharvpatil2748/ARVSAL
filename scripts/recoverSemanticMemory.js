require('module-alias/register');
const path = require('path');
const { reconstructSemanticMemory } = require('@core/persistence/eventReplay');
const { atomicWriteJsonSync } = require('@utils/fileUtils');
const pathConfig = require('@utils/pathConfig');

const MEMORY_FILE = path.join(pathConfig.MEMORY_DIR, "memory.json");

function recover() {
  console.log("Starting Semantic Memory Disaster Recovery...");
  
  const { memory, processedCount } = reconstructSemanticMemory();
  
  if (processedCount === 0) {
    console.log("No FACT_STORED events found in the WAL. Nothing to recover.");
    return;
  }
  
  console.log(`Reconstructed ${Object.keys(memory.facts).length} subjects from ${processedCount} events.`);
  
  try {
    atomicWriteJsonSync(MEMORY_FILE, memory);
    console.log(`Successfully recovered semantic memory and saved to ${MEMORY_FILE}`);
    console.log(`Facts restored: ${processedCount}`);
  } catch (err) {
    console.error("Failed to write recovered memory to disk:", err.message);
  }
}

recover();
