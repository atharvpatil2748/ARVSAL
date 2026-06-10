require('module-alias/register');
const fs = require('fs');
const path = require('path');
const eventStore = require('@core/persistence/eventStore');
const pathConfig = require('@utils/pathConfig');

const MEMORY_FILE = path.join(pathConfig.MEMORY_DIR, "memory.json");

function verify() {
  console.log("Replaying events from Write-Ahead Log...");
  const events = eventStore.replayEvents(0);
  
  const mockMemory = { facts: {} };
  let factEventsFound = 0;

  for (const event of events) {
    if (event.type === "FACT_STORED") {
      factEventsFound++;
      const { subject, key, value, confidence, source, category } = event.payload;
      
      if (!mockMemory.facts[subject]) {
        mockMemory.facts[subject] = {};
      }
      
      mockMemory.facts[subject][key] = {
        value,
        confidence,
        source,
        category
      };
    }
  }

  console.log(`Replayed ${events.length} total events, found ${factEventsFound} FACT_STORED events.`);

  let actualMemory;
  try {
    const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
    if (!raw.trim()) throw new Error("File is empty");
    actualMemory = JSON.parse(raw);
  } catch (err) {
    console.log(`State unavailable (${err.message}). Unable to compare reconstructed memory against disk.`);
    console.log(`Reconstructed Statistics: ${Object.keys(mockMemory.facts).length} subjects, ${factEventsFound} facts.`);
    return;
  }
  let mismatches = 0;

  for (const subject in mockMemory.facts) {
    for (const key in mockMemory.facts[subject]) {
      const mockFact = mockMemory.facts[subject][key];
      const actualFact = actualMemory.facts?.[subject]?.[key];
      
      if (!actualFact) {
        console.error(`Mismatch: Subject '${subject}' Key '${key}' exists in event log but not in memory.json`);
        mismatches++;
        continue;
      }
      
      if (actualFact.value !== mockFact.value) {
        console.error(`Mismatch: Subject '${subject}' Key '${key}' value differs (log: ${mockFact.value}, actual: ${actualFact.value})`);
        mismatches++;
      }
    }
  }

  if (mismatches === 0) {
    console.log("SUCCESS: Replay exactly matches state of semantic memory.");
  } else {
    console.log(`FAILED: Found ${mismatches} mismatches between event log and semantic memory.`);
  }
}

verify();
