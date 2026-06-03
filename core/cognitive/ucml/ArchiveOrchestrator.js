const RelationshipGraph = require('./RelationshipGraph');
const ClusterManager = require('./ClusterManager');
const MRE = require('./MemoryRetrievalEvaluator');
const UnifiedRanker = require('./UnifiedRanker');
const RAMIndexer = require('./RAMIndexer');

/**
 * ArchiveOrchestrator
 * The Scatter-Gather Engine. Extracts intent, queries all systems, filters, ranks, and clusters.
 */
class ArchiveOrchestrator {
    
    /**
     * Executes the UCML memory retrieval pipeline.
     * 
     * @param {string} query The raw user query
     * @param {Array<string>} explicitEntities (Optional) Explicitly extracted entities to anchor the search
     * @returns {Object} Payload containing ranked artifacts and execution stats
     */
    async queryUnifiedMemory(query, explicitEntities = []) {
        let rawArtifacts = [];
        const targetNodes = new Set();
        
        // 1. SCATTER (Determine hubs to query)
        
        // A. Resolve explicit entities to CSG node probes
        for (const entity of explicitEntities) {
            const clusterId = ClusterManager.resolveAlias(entity);
            if (clusterId) {
                const basename = clusterId.replace('cluster::', '');
                targetNodes.add(`node::person::${basename}`);
                targetNodes.add(`node::project::${basename}`);
                targetNodes.add(`node::decision::${basename}`);
                targetNodes.add(`node::goal::${basename}`);
                targetNodes.add(`node::entity::${basename}`);
            }
        }

        const lowerQuery = query ? query.toLowerCase() : "";

        // B1. Temporal Parser (Gap 2 Fix)
        if (lowerQuery.includes("yesterday")) {
            const yesterday = new Date(Date.now() - 86400000);
            targetNodes.add(`date::${yesterday.toISOString().split('T')[0]}`);
            if (process.env.UCML_DEBUG === 'true') targetNodes._tempDetected = "yesterday";
        }
        if (lowerQuery.includes("today")) {
            const today = new Date();
            targetNodes.add(`date::${today.toISOString().split('T')[0]}`);
            if (process.env.UCML_DEBUG === 'true') targetNodes._tempDetected = "today";
        }
        if (lowerQuery.includes("last week")) {
            const lastWeek = new Date(Date.now() - 7 * 86400000);
            targetNodes.add(`date::${lastWeek.toISOString().split('T')[0]}`);
            if (process.env.UCML_DEBUG === 'true') targetNodes._tempDetected = "last week";
        }

        const dateRegex = /\b(?:(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)|(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?)\b/g;
        const monthMap = {
            "jan": "01", "january": "01", "feb": "02", "february": "02", "mar": "03", "march": "03",
            "apr": "04", "april": "04", "may": "05", "jun": "06", "june": "06", "jul": "07", "july": "07",
            "aug": "08", "august": "08", "sep": "09", "september": "09", "oct": "10", "october": "10",
            "nov": "11", "november": "11", "dec": "12", "december": "12"
        };
        let match;
        while ((match = dateRegex.exec(lowerQuery)) !== null) {
            const day = (match[1] || match[4]).padStart(2, '0');
            const monthStr = (match[2] || match[3]).toLowerCase();
            const monthNum = monthMap[monthStr];
            const currentYear = new Date().getFullYear(); // Phase-0 assumption
            const dayKey = `date::${currentYear}-${monthNum}-${day}`;
            targetNodes.add(dayKey);
            if (process.env.UCML_DEBUG === 'true') targetNodes._tempDetected = dayKey;
        }

        // B2. Substring Alias Matching (Gap 3 Fix)
        if (ClusterManager.aliasRegistry) {
            for (const [alias, clusterId] of Object.entries(ClusterManager.aliasRegistry)) {
                if (lowerQuery.includes(alias)) {
                    const basename = clusterId.replace('cluster::', '');
                    targetNodes.add(`node::person::${basename}`);
                    targetNodes.add(`node::project::${basename}`);
                    targetNodes.add(`node::decision::${basename}`);
                    targetNodes.add(`node::goal::${basename}`);
                    targetNodes.add(`node::entity::${basename}`);
                }
            }
        }

        // B3. Token Fallback, CSG Index mapping, Reflection routing, and Vector routing
        const allQueryTokens = [];
        if (query) {
            const STOPWORDS = new Set(["the", "and", "what", "tell", "you", "are", "know", "how", "why", "when", "where", "which", "who", "that", "this", "then", "there", "their", "they", "from", "with", "have", "has", "had", "will", "would", "could", "should", "can", "may", "might"]);
            const tokens = lowerQuery.replace(/'s\b/g, "").split(/\s+/).map(t => t.replace(/[^a-z0-9]/g, "")).filter(t => t.length > 2 && !STOPWORDS.has(t));
            allQueryTokens.push(...tokens);
            for (const token of tokens) {
                // If it wasn't caught by substring for some reason
                const clusterId = ClusterManager.aliasRegistry[token];
                if (clusterId) {
                    const basename = clusterId.replace('cluster::', '');
                    targetNodes.add(`node::person::${basename}`);
                    targetNodes.add(`node::project::${basename}`);
                    targetNodes.add(`node::decision::${basename}`);
                    targetNodes.add(`node::goal::${basename}`);
                    targetNodes.add(`node::entity::${basename}`);
                }

                // Query RAMIndexer for exact CSG node IDs that possess this token
                const csgIds = RAMIndexer.getCsgIds(token);
                for (const id of csgIds) targetNodes.add(id);
                
                // Fallback for Phase-0: If token has no CSG, query it directly as an entity
                targetNodes.add(`node::entity::${token}`);
            }
        }

        // 2. GATHER (Traverse Relationship Graph)
        for (const nodeId of targetNodes) {
            const artifacts = RelationshipGraph.gatherArtifacts(nodeId, 3);
            artifacts.forEach(a => { if (!a._debugReason) a._debugReason = `CSG node traversal: ${nodeId}`; });
            rawArtifacts.push(...artifacts);
        }

        // Fix 1: REFLECTION SCATTER — directly gather reflections via relatedKey index
        for (const token of allQueryTokens) {
            const refIds = RAMIndexer.getReflectionIds(token);
            for (const refId of refIds) {
                const ref = RelationshipGraph.reflection.find(r => r.id === refId);
                if (ref) {
                    const MemoryArtifactFactory = require('./MemoryArtifactFactory');
                    const art = MemoryArtifactFactory.createArtifact(ref, 'reflection');
                    art._directScatter = true; // Mark as explicitly targeted — MRE must not drop
                    art._debugReason = `Reflection token match: ${token}`;
                    rawArtifacts.push(art);
                }
            }
        }

        // Fix 2: VECTOR SCATTER — directly call getVectorIds for each token
        for (const token of allQueryTokens) {
            const vecIds = RAMIndexer.getVectorIds(token);
            for (const vecId of vecIds) {
                const vec = RelationshipGraph.vector.find(v => v.id === vecId);
                if (vec) {
                    const MemoryArtifactFactory = require('./MemoryArtifactFactory');
                    const art = MemoryArtifactFactory.createArtifact(vec, 'vector');
                    art._directScatter = true; // Mark as explicitly targeted
                    art._debugReason = `Vector token match: ${token}`;
                    rawArtifacts.push(art);
                }
            }
        }

        // Fix 3: SNAPSHOT SCATTER — inject snapshot working memory for continuity-intent queries
        const CONTINUITY_SIGNALS = ['continue', 'working', 'active', 'before', 'restart', 'last', 'previous', 'were we', 'were you', 'what were', 'what was', 'what are we', 'pick up', 'pick it', 'recall', 'remember when', 'resume'];
        const isContinuityQuery = CONTINUITY_SIGNALS.some(s => lowerQuery.includes(s));
        if (isContinuityQuery) {
            let snaps = RAMIndexer.getSnapshotArtifacts();
            const CONSTRAINT_SIGNALS = ['system', 'architecture', 'privacy', 'memory', 'constraint'];
            const wantsConstraints = CONSTRAINT_SIGNALS.some(s => lowerQuery.includes(s));
            if (!wantsConstraints) {
                snaps = snaps.filter(a => !a.id.includes('constraint'));
            }
            snaps.forEach(a => { if (!a._debugReason) a._debugReason = `Continuity signal triggered working memory.`; });
            rawArtifacts.push(...snaps);
        }

        // Fix 4: RELATIONSHIP INTENT — detect and route
        const RELATIONSHIP_SIGNALS = ['between', 'relationship', 'friend', 'friends', 'feel', 'feeling', 'going on with', 'think about me'];
        const isRelationshipQuery = RELATIONSHIP_SIGNALS.some(s => lowerQuery.includes(s));
        
        // If relationship query, strip out irrelevant project/goal artifacts to prevent graph bleed (e.g. Apollo)
        if (isRelationshipQuery) {
            rawArtifacts = rawArtifacts.filter(a => {
                if (a.sourceType === 'csg') {
                    if (a.id && (a.id.includes('project::') || a.id.includes('goal::') || a.id.includes('task::'))) return false;
                }
                return true;
            });
        }

        // 3. Deduplicate
        const uniqueMap = new Map();
        for (const art of rawArtifacts) {
            uniqueMap.set(art.id, art);
        }
        rawArtifacts = Array.from(uniqueMap.values());

        // Fix 5: VECTOR GATING
        const hasSemanticOrEntity = rawArtifacts.some(a => ['semantic', 'csg', 'episodic'].includes(a.sourceType));
        if (hasSemanticOrEntity) {
            const vectors = rawArtifacts.filter(a => a.sourceType === 'vector');
            if (vectors.length > 3) {
                const keepers = vectors.slice(0, 3);
                rawArtifacts = rawArtifacts.filter(a => a.sourceType !== 'vector').concat(keepers);
            }
        }

        // 4. MRE (Evaluation and Pruning)
        const prunedOut = [];
        const prunedArtifacts = MRE.evaluate(rawArtifacts, query, prunedOut);

        // 5. UNIFIED RANKER (Sorting)
        const rankedArtifacts = UnifiedRanker.rank(prunedArtifacts, { isContinuityQuery, isRelationshipQuery });

        if (process.env.UCML_DEBUG === 'true') {
            console.log(`\n================================================\nUCML TRACE START\n================\n\nQuery: ${query}\nIntent: ${isContinuityQuery ? 'Continuity' : 'Standard'}`);
            if (targetNodes._tempDetected) console.log(`Temporal Detection: ${targetNodes._tempDetected}`);
            console.log(`Timestamp: ${new Date().toISOString()}\n`);
            
            console.log(`[UCML SCATTER SUMMARY]`);
            const counts = { semantic: 0, episodic: 0, reflection: 0, vector: 0, csg: 0, project: 0, decision: 0, goal: 0, working: 0 };
            rawArtifacts.forEach(a => counts[a.sourceType] = (counts[a.sourceType] || 0) + 1);
            for (const [k, v] of Object.entries(counts)) {
                if (v > 0) console.log(`  ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`);
            }
            console.log(`  Total Scattered: ${rawArtifacts.length}\n`);

            console.log(`[UCML MRE SUMMARY]\n  Survived: ${prunedArtifacts.length}\n  Pruned: ${prunedOut.length}\n`);

            console.log(`[UCML RANKING SUMMARY]\nTop 10 Ranked Artifacts:`);
            rankedArtifacts.slice(0, 10).forEach((a, idx) => {
                console.log(`  #${idx + 1} [${a.sourceType}] ${a.sourceId || a.id} (Score: ${(a._rankScore || 0).toFixed(2)})`);
            });
            console.log('');
        }

        return {
            query: query,
            artifacts: rankedArtifacts,
            stats: {
                totalScattered: rawArtifacts.length,
                totalPruned: rawArtifacts.length - prunedArtifacts.length,
                totalRanked: rankedArtifacts.length
            }
        };
    }
}

module.exports = new ArchiveOrchestrator();
