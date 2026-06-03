/**
 * MemoryRetrievalEvaluator (MRE)
 * Responsible for pruning low-value, irrelevant, or redundant artifacts before ranking.
 */
class MemoryRetrievalEvaluator {
    /**
     * Evaluates and prunes low-value artifacts.
     * @param {Array} artifacts List of MemoryArtifacts
     * @param {string} query The user's original query to compute relevance
     */
    evaluate(artifacts, query, prunedOut = []) {
        if (!artifacts || !artifacts.length) return [];
        const queryLower = query ? query.toLowerCase() : "";
        const queryTokens = queryLower.split(/\s+/).filter(t => t.length > 2);

        return artifacts.filter(artifact => {
            // 1. Calculate heuristic relevance (0.0 to 1.0)
            let relevance = 0.0;
            const contentLower = artifact.content.toLowerCase();
            
            if (queryTokens.length === 0) {
                relevance = 0.5; // Neutral relevance if no query
            } else {
                let matchCount = 0;
                for (const token of queryTokens) {
                    if (contentLower.includes(token)) matchCount++;
                }
                
                // Gap 1 Fix: Replace length penalty with a fixed heuristic bonus
                const isTemporalQuery = queryLower.includes("yesterday") || queryLower.includes("today") || queryLower.match(/\b\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/);

                if (matchCount > 0) {
                    relevance = 0.8; // Base relevance for any fallback match (0.8 * 0.2 = 0.16 -> clears 0.15 floor)
                    
                    // If it explicitly matches an alias, boost to 1.0
                    const ClusterManager = require('./ClusterManager');
                    for (const token of queryTokens) {
                        if (contentLower.includes(token) && ClusterManager.aliasRegistry && ClusterManager.aliasRegistry[token]) {
                            relevance = 1.0;
                            break;
                        }
                    }
                } 
                
                // Gap 2 Fix: Boost temporal relevance if it's a date query
                if (isTemporalQuery) {
                    relevance = Math.max(relevance, 0.8);
                }
            }
            
            // Assign calculated relevance to the artifact struct
            artifact.relevanceScore = relevance;

            // 2. Prune redundant/insignificant artifacts
            // Bypass for foundational types and directly targeted artifacts
            if (artifact.sourceType === 'semantic' || artifact.sourceType === 'csg' || artifact.sourceType === 'working') {
                return true;
            }
            if (artifact._directScatter) {
                // Artifact was explicitly retrieved via reflection key or vector token index
                // Grant guaranteed relevance to prevent false pruning
                if (artifact.relevanceScore < 0.5) artifact.relevanceScore = 0.5;
                return true;
            }

            const retrievalScore = artifact.importance * artifact.relevanceScore;
            
            if (queryLower.includes("11 february")) {
                console.log(`[DEBUG MRE] ${artifact.id} | Imp: ${artifact.importance} | Rel: ${artifact.relevanceScore} | Score: ${retrievalScore}`);
            }

            // Prune if score is too low
            if (retrievalScore < 0.15) {
                artifact._pruneReason = `MRE threshold (${retrievalScore.toFixed(2)} < 0.15)`;
                prunedOut.push(artifact);
                return false;
            }

            return true;
        });
    }
}

module.exports = new MemoryRetrievalEvaluator();
