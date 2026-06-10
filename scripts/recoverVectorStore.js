require('module-alias/register');
const path = require('path');
const { reconstructVectorStore } = require('@core/persistence/eventReplay');
const { atomicWriteJsonSync } = require('@utils/fileUtils');
const pathConfig = require('@utils/pathConfig');

const MEMORY_FILE = path.join(pathConfig.MEMORY_DIR, "vector_store.json");

function recover() {
  console.log("Starting Vector Store Disaster Recovery...");
  
  const { vectors, processedCount } = reconstructVectorStore();
  
  if (processedCount === 0) {
    console.log("No VECTOR_UPSERTED events found in the WAL. Nothing to recover.");
    return;
  }
  
  console.log(`Reconstructed ${vectors.length} vectors from ${processedCount} events.`);
  
  try {
    atomicWriteJsonSync(MEMORY_FILE, vectors);
    console.log(`Successfully recovered vector store and saved to ${MEMORY_FILE}`);
  } catch (err) {
    console.error("Failed to write recovered memory to disk:", err.message);
  }
}

recover();
