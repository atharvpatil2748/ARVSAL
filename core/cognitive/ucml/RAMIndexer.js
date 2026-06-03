const fs = require('fs').promises;
const path = require('path');

const EPISODIC_PATH = path.resolve(__dirname, '../../../data/memory/episodic_memory.json');
const REFLECTION_PATH = path.resolve(__dirname, '../../../data/memory/reflection_memory.json');
const CSG_PATH = path.resolve(__dirname, '../../../data/memory/cognitive_state_graph.json');
const VECTOR_PATH = path.resolve(__dirname, '../../../data/memory/vector_store.json');
const SNAPSHOT_PATH = path.resolve(__dirname, '../../../data/memory/cognitive_snapshot.json');
const REFLECTION_SYNONYMS_PATH = path.resolve(__dirname, '../../../data/memory/reflection_synonyms.json');

class RAMIndexer {
    constructor() {
        this.entityIndex = new Map();
        this.dateIndex = new Map();
        this.projectIndex = new Map();
        this.goalIndex = new Map();
        this.decisionIndex = new Map();
        this.relationshipIndex = new Map();
        this.vectorKeywordIndex = new Map();
        this.csgKeywordIndex = new Map();
        this.reflectionKeyIndex = new Map(); // Fix 1: direct relatedKey → refId mapping
        this.snapshotArtifacts = [];          // Fix 3: working memory from cognitive_snapshot
        
        this.isInitialized = false;
        this.metrics = {
            bootTimeMs: 0,
            memoryUsedMb: 0
        };
    }

    async initialize() {
        if (this.isInitialized) return;
        const start = Date.now();
        const initialMemory = process.memoryUsage().heapUsed;

        try {
            // Load JSONs safely (fallback to empty structs if missing)
            const [episodicRaw, reflectionRaw, csgRaw, vectorRaw, snapshotRaw, synonymsRaw] = await Promise.all([
                fs.readFile(EPISODIC_PATH, 'utf8').catch(() => '[]'),
                fs.readFile(REFLECTION_PATH, 'utf8').catch(() => '[]'),
                fs.readFile(CSG_PATH, 'utf8').catch(() => '{"nodes":{}}'),
                fs.readFile(VECTOR_PATH, 'utf8').catch(() => '[]'),
                fs.readFile(SNAPSHOT_PATH, 'utf8').catch(() => '{}'),
                fs.readFile(REFLECTION_SYNONYMS_PATH, 'utf8').catch(() => '[]')
            ]);

            const episodic = JSON.parse(episodicRaw);
            const reflection = JSON.parse(reflectionRaw);
            const csg = JSON.parse(csgRaw);
            const vector = JSON.parse(vectorRaw);
            const snapshot = JSON.parse(snapshotRaw);
            const reflectionSynonyms = JSON.parse(synonymsRaw);

            // 1. Parse CSG Nodes to build keyword dictionary for inverted mapping
            const csgNodes = Object.values(csg.nodes || {});
            
            // Map: Keyword -> Set<Node>
            const keywordToNodeMap = new Map(); 
            
            for (const node of csgNodes) {
                const keywords = [node.label, ...(node.synonyms || [])]
                    .filter(k => k)
                    .map(k => k.toLowerCase());
                
                // Refinement 4: Decision Reverse Index (parse accepted/rejected techs from summary)
                if (node.type === 'decision' && node.summary) {
                    const techMatches = [...node.summary.matchAll(/(?:Rejected|Use):?\s+([A-Za-z0-9,\s]+)(?:\.|$)/gi)];
                    for (const match of techMatches) {
                        if (match[1]) {
                            const techs = match[1].split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 2);
                            keywords.push(...techs);
                        }
                    }
                }
                
                for (const kw of keywords) {
                    if (!keywordToNodeMap.has(kw)) keywordToNodeMap.set(kw, new Set());
                    keywordToNodeMap.get(kw).add(node);
                    
                    // Gap 4 Fix: Also map keywords directly to the node ID for retrieval
                    // Split the keyword into tokens to map individual words to the node
                    const tokens = kw.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length > 2);
                    for (const t of tokens) {
                        if (!this.csgKeywordIndex.has(t)) this.csgKeywordIndex.set(t, new Set());
                        this.csgKeywordIndex.get(t).add(node.id);
                    }
                }
            }

            // Helper to index an item against CSG keywords using brute string inclusion.
            // Also index raw tokens if they match known aliases.
            const indexItem = (itemText, itemId) => {
                if (!itemText) return;
                const textLower = itemText.toLowerCase();
                
                // 1. Index by CSG node keywords
                for (const [kw, nodes] of keywordToNodeMap.entries()) {
                    if (textLower.includes(kw)) {
                        for (const node of nodes) {
                            let targetIndex;
                            if (node.type === 'person' || node.type === 'entity') targetIndex = this.entityIndex;
                            else if (node.type === 'project') targetIndex = this.projectIndex;
                            else if (node.type === 'goal') targetIndex = this.goalIndex;
                            else if (node.type === 'decision') targetIndex = this.decisionIndex;
                            else targetIndex = this.entityIndex; // fallback
                            
                            if (!targetIndex.has(node.id)) targetIndex.set(node.id, new Set());
                            targetIndex.get(node.id).add(itemId);
                        }
                    }
                }

                // 2. Index raw words into a KeywordIndex for fallback when CSG nodes are missing
                const words = textLower.split(/\\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length > 2);
                for (const w of words) {
                    if (!this.entityIndex.has(w)) this.entityIndex.set(w, new Set());
                    this.entityIndex.get(w).add(itemId);
                }
            };

            // 2. Index Episodic Memory
            for (let i = 0; i < episodic.length; i++) {
                const ep = episodic[i];
                const id = `ep_${ep.timestamp}_${i}`; // Pseudo ID for Phase-0 legacy compatibility
                
                // Date Index
                if (ep.dayKey) {
                    if (!this.dateIndex.has(ep.dayKey)) this.dateIndex.set(ep.dayKey, new Set());
                    this.dateIndex.get(ep.dayKey).add(id);
                }

                indexItem(ep.value, id);
            }

            // 3. Index Reflection Memory
            for (const ref of reflection) {
                if (!ref.id) continue;
                indexItem(ref.insight, ref.id);
                
                // Fix 1: Map relatedKeys DIRECTLY into reflectionKeyIndex AND entityIndex
                // This ensures natural language tokens like "hobby", "romantic_emotion", "sejal"
                // can retrieve reflections without requiring a matching CSG node ID.
                if (ref.relatedKeys) {
                    for (const key of ref.relatedKeys) {
                        const kw = key.toLowerCase().replace(/_/g, ' '); // normalize underscore keys
                        const kwRaw = key.toLowerCase(); // also store raw form
                        
                        // Direct reflectionKeyIndex mapping (primary fix)
                        if (!this.reflectionKeyIndex.has(kw)) this.reflectionKeyIndex.set(kw, new Set());
                        this.reflectionKeyIndex.get(kw).add(ref.id);
                        if (kw !== kwRaw) {
                            if (!this.reflectionKeyIndex.has(kwRaw)) this.reflectionKeyIndex.set(kwRaw, new Set());
                            this.reflectionKeyIndex.get(kwRaw).add(ref.id);
                        }
                        
                        // Also index individual words of multi-word keys (e.g., "romantic emotion" → "romantic", "emotion")
                        const keyWords = kw.split(/\s+/).filter(w => w.length > 2);
                        for (const kWord of keyWords) {
                            if (!this.reflectionKeyIndex.has(kWord)) this.reflectionKeyIndex.set(kWord, new Set());
                            this.reflectionKeyIndex.get(kWord).add(ref.id);
                        }
                        
                        // Also try CSG mapping if node exists
                        if (keywordToNodeMap.has(kwRaw)) {
                            for (const node of keywordToNodeMap.get(kwRaw)) {
                                let targetIndex;
                                if (node.type === 'person') targetIndex = this.entityIndex;
                                else if (node.type === 'project') targetIndex = this.projectIndex;
                                else if (node.type === 'decision') targetIndex = this.decisionIndex;
                                else if (node.type === 'goal') targetIndex = this.goalIndex;
                                else targetIndex = this.entityIndex;
                                if (!targetIndex.has(node.id)) targetIndex.set(node.id, new Set());
                                targetIndex.get(node.id).add(ref.id);
                            }
                        }
                    }
                }
                
                // Also index words from insight text into reflectionKeyIndex for content-based retrieval
                if (ref.insight) {
                    const insightWords = ref.insight.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z]/g, '')).filter(w => w.length > 3);
                    for (const w of insightWords) {
                        if (!this.reflectionKeyIndex.has(w)) this.reflectionKeyIndex.set(w, new Set());
                        this.reflectionKeyIndex.get(w).add(ref.id);
                    }
                }
            }

            // Refinement 3: Map reflection synonyms to ALL reflection IDs
            if (reflectionSynonyms && reflectionSynonyms.length > 0) {
                const allRefIds = reflection.filter(r => r.id).map(r => r.id);
                for (const syn of reflectionSynonyms) {
                    const synLower = syn.toLowerCase();
                    if (!this.reflectionKeyIndex.has(synLower)) this.reflectionKeyIndex.set(synLower, new Set());
                    for (const id of allRefIds) {
                        this.reflectionKeyIndex.get(synLower).add(id);
                    }
                }
            }

            // 4. Index Vector Store
            for (const vec of vector) {
                if (!vec.id || !vec.text) continue;
                const textLower = vec.text.toLowerCase();
                
                // Gap 5 Fix: Parse and index all alphanumeric tokens from vector texts
                const words = textLower.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length > 2);
                for (const w of words) {
                    if (!this.vectorKeywordIndex.has(w)) this.vectorKeywordIndex.set(w, new Set());
                    this.vectorKeywordIndex.get(w).add(vec.id);
                }
            }

            // Fix 3: Load Cognitive Snapshot as first-class working memory artifacts
            if (snapshot && typeof snapshot === 'object') {
                const MemoryArtifactFactory = require('./MemoryArtifactFactory');
                const snapshotEntries = [];

                if (snapshot.lastTopics && snapshot.lastTopics.length > 0) {
                    snapshotEntries.push({ content: `Last session topics: ${snapshot.lastTopics.join(', ')}.`, importance: 1.0, sourceKey: 'lastTopics' });
                }
                if (snapshot.lastDiscussionSummary) {
                    snapshotEntries.push({ content: `Last discussion: ${snapshot.lastDiscussionSummary}`, importance: 1.0, sourceKey: 'lastDiscussion' });
                }
                if (snapshot.activeProjectId) {
                    snapshotEntries.push({ content: `Active project: ${snapshot.activeProjectId}`, importance: 0.9, sourceKey: 'activeProject' });
                }
                if (snapshot.constraints) {
                    for (const c of snapshot.constraints) {
                        snapshotEntries.push({ content: `System constraint [${c.label}]: ${c.rationale}`, importance: 0.95, sourceKey: `constraint_${c.id}` });
                    }
                }

                for (const entry of snapshotEntries) {
                    this.snapshotArtifacts.push(MemoryArtifactFactory.createArtifact(
                        { content: entry.content, value: entry.content, importance: entry.importance },
                        'working',
                        { id: `snap_${entry.sourceKey}` }
                    ));
                }
            }

            this.isInitialized = true;
            this.metrics.bootTimeMs = Date.now() - start;
            this.metrics.memoryUsedMb = Math.round((process.memoryUsage().heapUsed - initialMemory) / 1024 / 1024 * 100) / 100;
            
            console.log(`[UCML] RAMIndexer initialized in ${this.metrics.bootTimeMs}ms. Memory overhead: ${this.metrics.memoryUsedMb}MB. Snapshot artifacts: ${this.snapshotArtifacts.length}.`);
        } catch (error) {
            console.error("[UCML] FATAL: RAMIndexer failed to initialize", error);
            // Do not block app startup if memory corrupts, but flag it.
            this.isInitialized = false; 
        }
    }

    // --- ACCESSORS ---
    getEntityIds(nodeIdOrKeyword) { return Array.from(this.entityIndex.get(nodeIdOrKeyword) || []); }
    getDateIds(dayKey) { return Array.from(this.dateIndex.get(dayKey) || []); }
    getProjectIds(nodeId) { return Array.from(this.projectIndex.get(nodeId) || []); }
    getDecisionIds(nodeId) { return Array.from(this.decisionIndex.get(nodeId) || []); }
    getGoalIds(nodeId) { return Array.from(this.goalIndex.get(nodeId) || []); }
    getVectorIds(keyword) { return Array.from(this.vectorKeywordIndex.get(keyword.toLowerCase()) || []); }
    getCsgIds(keyword) { return Array.from(this.csgKeywordIndex.get(keyword.toLowerCase()) || []); }
    getReflectionIds(keyword) { return Array.from(this.reflectionKeyIndex.get(keyword.toLowerCase()) || []); } // Fix 1
    getSnapshotArtifacts() { return this.snapshotArtifacts; } // Fix 3
    
    getMetrics() { return this.metrics; }
}

// Export a singleton instance
module.exports = new RAMIndexer();
