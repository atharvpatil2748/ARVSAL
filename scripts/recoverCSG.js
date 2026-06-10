require('module-alias/register');
const path = require('path');
const { reconstructCognitiveStateGraph } = require('@core/persistence/eventReplay');
const { atomicWriteJsonSync } = require('@utils/fileUtils');
const pathConfig = require('@utils/pathConfig');

const MEMORY_FILE = path.join(pathConfig.MEMORY_DIR, "cognitive_state_graph.json");

function recover() {
  console.log("Starting Cognitive State Graph Disaster Recovery...");
  
  const { nodes, edges, processedCount } = reconstructCognitiveStateGraph();
  
  if (processedCount === 0) {
    console.log("No NODE_UPSERTED events found in the WAL. Nothing to recover.");
    return;
  }
  
  console.log(`Reconstructed ${Object.keys(nodes).length} nodes from ${processedCount} events.`);
  
  const raw = {
    nodes,
    edges,
    lastUpdated: Date.now()
  };
  
  try {
    atomicWriteJsonSync(MEMORY_FILE, raw);
    console.log(`Successfully recovered cognitive state graph and saved to ${MEMORY_FILE}`);
  } catch (err) {
    console.error("Failed to write recovered memory to disk:", err.message);
  }
}

recover();
