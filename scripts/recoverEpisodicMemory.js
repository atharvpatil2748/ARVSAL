require('module-alias/register');
const path = require('path');
const { reconstructEpisodicMemory } = require('@core/persistence/eventReplay');
const { atomicWriteJsonSync } = require('@utils/fileUtils');
const pathConfig = require('@utils/pathConfig');

const MEMORY_FILE = path.join(pathConfig.MEMORY_DIR, "episodic_memory.json");

function recover() {
  console.log("Starting Episodic Memory Disaster Recovery...");
  
  const { episodes, processedCount } = reconstructEpisodicMemory();
  
  if (processedCount === 0) {
    console.log("No EPISODE_STORED events found in the WAL. Nothing to recover.");
    return;
  }
  
  console.log(`Reconstructed ${episodes.length} episodes from ${processedCount} events.`);
  
  try {
    atomicWriteJsonSync(MEMORY_FILE, episodes);
    console.log(`Successfully recovered episodic memory and saved to ${MEMORY_FILE}`);
  } catch (err) {
    console.error("Failed to write recovered memory to disk:", err.message);
  }
}

recover();
