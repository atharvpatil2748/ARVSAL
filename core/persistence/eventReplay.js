const eventStore = require('./eventStore');

function reconstructSemanticMemory() {
  const events = eventStore.replayEvents(0);
  const memory = { facts: {} };
  let processedCount = 0;

  for (const event of events) {
    if (event.domain === 'memory' && event.type === 'FACT_STORED') {
      const { subject, key, value, confidence, source, category } = event.payload;
      
      if (!memory.facts[subject]) {
        memory.facts[subject] = {};
      }
      
      memory.facts[subject][key] = {
        value,
        confidence: confidence ?? 1.0,
        source: source ?? 'system',
        category: category ?? 'general',
        protected: category === 'identity' || category === 'relationship',
        updatedAt: event.timestamp
      };
      processedCount++;
    }
  }
  return { memory, processedCount };
}

function reconstructEpisodicMemory() {
  const events = eventStore.replayEvents(0);
  const episodes = [];
  let processedCount = 0;

  for (const event of events) {
    if (event.domain === 'memory' && event.type === 'EPISODE_STORED') {
      // Create episode format exactly as expected by episodic memory
      // We stored: { text: value, importance } (or the full object, let's accommodate both)
      
      const payload = event.payload;
      
      // If we stored full objects:
      if (payload.id && payload.timestamp) {
        episodes.push(payload);
      } else {
        // Fallback for minimal payload mapping
        const ts = event.timestamp;
        const d = new Date(ts);
        const oneJan = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
        
        episodes.push({
          id: `ep_${ts}_${Math.random().toString(36).substring(2, 6)}`,
          type: payload.type || "conversation",
          subject: payload.subject || "user",
          key: payload.key || null,
          value: payload.text || payload.value,
          source: payload.source || "user",
          importance: payload.importance || 0.4,
          meta: payload.meta || null,
          sessionId: event.sessionId,
          timestamp: ts,
          dayKey: d.toISOString().slice(0, 10),
          weekKey: `${d.getFullYear()}-W${weekNum}`,
          monthKey: `${d.getFullYear()}-${d.getMonth() + 1}`
        });
      }
      processedCount++;
    }
  }
  return { episodes, processedCount };
}

function reconstructReflectionMemory() {
  const events = eventStore.replayEvents(0);
  let reflectionsMap = new Map();
  let processedCount = 0;

  for (const event of events) {
    if (event.domain !== 'memory') continue;

    if (event.type === 'REFLECTION_STORED') {
      reflectionsMap.set(event.payload.id, event.payload);
      processedCount++;
    } else if (event.type === 'REFLECTION_REINFORCED') {
      const { subject, insight, confidence } = event.payload;
      for (const [id, r] of reflectionsMap.entries()) {
        if (r.subject === subject && r.insight.toLowerCase() === insight.toLowerCase()) {
          r.confidence = confidence;
          r.lastUpdated = event.timestamp;
        }
      }
      processedCount++;
    } else if (event.type === 'REFLECTION_FORGOTTEN') {
      const { subject } = event.payload;
      for (const [id, r] of reflectionsMap.entries()) {
        if (r.subject === subject) {
          reflectionsMap.delete(id);
        }
      }
      processedCount++;
    } else if (event.type === 'REFLECTION_CLEARED') {
      reflectionsMap.clear();
      processedCount++;
    }
  }
  
  return { reflections: Array.from(reflectionsMap.values()), processedCount };
}

function reconstructVectorStore() {
  const events = eventStore.replayEvents(0);
  let store = [];
  let processedCount = 0;
  
  const MAX_VECTORS = 5000;
  const VECTOR_TTL_MS = 90 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const event of events) {
    if (event.domain === 'memory' && event.type === 'VECTOR_UPSERTED') {
      store.push(event.payload);
      processedCount++;
    }
  }

  // Apply cleanup exactly like vectorStore does on load/add
  store = store.filter(
    v =>
      v &&
      Array.isArray(v.embedding) &&
      typeof v.timestamp === "number" &&
      now - v.timestamp <= VECTOR_TTL_MS
  );

  if (store.length > MAX_VECTORS) {
    store = store.slice(-MAX_VECTORS);
  }

  return { vectors: store, processedCount };
}

function reconstructCognitiveStateGraph() {
  const events = eventStore.replayEvents(0);
  const nodes = {};
  let processedCount = 0;

  for (const event of events) {
    if (event.domain === 'cognitive' && event.type === 'NODE_UPSERTED') {
      const node = event.payload.node;
      if (node && node.id) {
        nodes[node.id] = node;
        processedCount++;
      }
    }
  }

  return { nodes, edges: [], processedCount };
}

module.exports = {
  reconstructSemanticMemory,
  reconstructEpisodicMemory,
  reconstructReflectionMemory,
  reconstructVectorStore,
  reconstructCognitiveStateGraph
};
