require('module-alias/register');
const path = require('path');
const { reconstructReflectionMemory } = require('@core/persistence/eventReplay');
const { atomicWriteJsonSync } = require('@utils/fileUtils');
const pathConfig = require('@utils/pathConfig');

const MEMORY_FILE = path.join(pathConfig.MEMORY_DIR, "reflection_memory.json");

function recover() {
  console.log("Starting Reflection Memory Disaster Recovery...");
  
  const { reflections, processedCount } = reconstructReflectionMemory();
  
  if (processedCount === 0) {
    console.log("No REFLECTION events found in the WAL. Nothing to recover.");
    return;
  }
  
  console.log(`Reconstructed ${reflections.length} reflections from ${processedCount} events.`);
  
  try {
    atomicWriteJsonSync(MEMORY_FILE, reflections);
    console.log(`Successfully recovered reflection memory and saved to ${MEMORY_FILE}`);
  } catch (err) {
    console.error("Failed to write recovered memory to disk:", err.message);
  }
}

recover();
