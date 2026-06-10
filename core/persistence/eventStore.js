const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EVENTS_DIR = path.resolve(__dirname, '../../data/events');
const LOG_PATH = path.join(EVENTS_DIR, 'event_log.jsonl');

// Ensure directory exists
if (!fs.existsSync(EVENTS_DIR)) {
  fs.mkdirSync(EVENTS_DIR, { recursive: true });
}

/**
 * Appends an event to the Write-Ahead Log (WAL).
 * @param {string} type - Event type (e.g., 'FACT_STORED')
 * @param {string} domain - Domain (e.g., 'memory')
 * @param {any} payload - Event payload
 * @param {string} source - Source of the event
 * @param {string} sessionId - Current session ID
 */
function appendEvent(type, domain, payload, source = "system", sessionId = "system") {
  const event = {
    id: crypto.randomUUID(),
    version: 1,
    type,
    domain,
    source,
    payload,
    timestamp: Date.now(),
    sessionId
  };

  const line = JSON.stringify(event) + '\n';
  fs.appendFileSync(LOG_PATH, line, 'utf8');
  return event;
}

/**
 * Replays events from the log.
 * @param {number} sinceTimestamp - Only replay events after this timestamp
 * @returns {Array} Array of parsed events
 */
function replayEvents(sinceTimestamp = 0) {
  if (!fs.existsSync(LOG_PATH)) return [];

  const content = fs.readFileSync(LOG_PATH, 'utf8');
  const lines = content.split('\n');
  const events = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.timestamp >= sinceTimestamp) {
        events.push(event);
      }
    } catch (err) {
      console.warn(`[eventStore] Failed to parse event line: ${line.substring(0, 50)}...`);
    }
  }

  return events;
}

module.exports = {
  appendEvent,
  replayEvents
};
