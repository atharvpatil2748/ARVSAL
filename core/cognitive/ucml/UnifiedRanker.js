/**
 * UnifiedRanker
 * Sorts artifacts based on the approved mathematical formula.
 * Separates permanent importance from transient relevance.
 */
class UnifiedRanker {
    /**
     * Ranks artifacts based on the formula:
     * Score = (Importance * 0.45) + (Relevance * 0.35) + (Confidence * 0.1) + (Recency Boost * 0.1)
     */
    rank(artifacts, options = {}) {
        const isContinuityQuery = options.isContinuityQuery || false;
        if (!artifacts || !artifacts.length) return [];
        const now = Date.now();
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

        return artifacts.sort((a, b) => {
            const scoreA = this._computeScore(a, now, THIRTY_DAYS, isContinuityQuery, options.isRelationshipQuery);
            const scoreB = this._computeScore(b, now, THIRTY_DAYS, isContinuityQuery, options.isRelationshipQuery);
            
            // Descending order (highest score first)
            return scoreB - scoreA;
        });
    }

    _computeScore(artifact, now, thirtyDaysMs, isContinuityQuery, isRelationshipQuery) {
        // Recency Boost calculation (exponential decay substitute for performance)
        let recencyBoost = 0.0;
        if (artifact.timestamp) {
            const ageMs = now - artifact.timestamp;
            if (ageMs >= 0) {
                // Decay approaches 0 after ~30 days
                recencyBoost = Math.max(0, 1.0 - (ageMs / thirtyDaysMs));
            }
        }

        let score = 
            (artifact.importance * 0.45) +
            (artifact.relevanceScore * 0.35) +
            (artifact.confidence * 0.10) +
            (recencyBoost * 0.10);

        // Refinement 5: Working Memory Priority Boost
        if (isContinuityQuery && artifact.sourceType === 'working') {
            score += 0.5;
        }

        // Fix 4: Relationship Intent Routing
        if (isRelationshipQuery) {
            if (artifact.sourceType === 'reflection' || artifact.id?.includes('relationship')) {
                score += 0.6; // Massive boost to relationship context
            }
            if (artifact.sourceType === 'semantic' && !artifact.id?.includes('relationship')) {
                score -= 0.3; // Penalize static semantic trivia (favorite color, etc.)
            }
        }

        // Store the final computed rank score on the artifact for trace/debugging
        artifact._rankScore = score;
        return score;
    }
}

module.exports = new UnifiedRanker();
