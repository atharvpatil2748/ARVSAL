/**
 * MemoryArtifactFactory
 * Normalizes all legacy memory formats into a unified MemoryArtifact V1 struct.
 */

class MemoryArtifactFactory {
    /**
     * Converts a raw storage object into a standard MemoryArtifact.
     * 
     * @param {Object} rawItem The raw memory object from storage
     * @param {string} sourceType 'semantic' | 'episodic' | 'reflection' | 'vector' | 'csg' | 'working'
     * @param {Object} metadata Optional metadata for mapping (e.g., semantic parent key)
     * @returns {Object} MemoryArtifact
     */
    static createArtifact(rawItem, sourceType, metadata = {}) {
        const artifact = {
            id: null,
            sourceType: sourceType,
            sourceId: null,
            content: "",
            timestamp: null,
            entities: [],
            projects: [],
            goals: [],
            decisions: [],
            relationships: [],
            importance: 0.5,
            confidence: 1.0,
            relevanceScore: 0.0,
            clusterId: null
        };

        switch (sourceType) {
            case 'semantic':
                artifact.id = `sem_${metadata.subject}_${metadata.key}`;
                artifact.sourceId = `${metadata.subject}.${metadata.key}`;
                artifact.content = `${metadata.subject} ${metadata.key} is ${rawItem.value}`;
                artifact.timestamp = rawItem.createdAt || null;
                artifact.confidence = rawItem.confidence || 1.0;
                artifact.importance = 0.9; 
                artifact.entities.push(metadata.subject);
                break;

            case 'episodic':
                artifact.id = `ep_${rawItem.timestamp}_${metadata.index || 0}`;
                artifact.sourceId = artifact.id;
                artifact.content = rawItem.value || "";
                artifact.timestamp = rawItem.timestamp || null;
                artifact.confidence = 0.9;
                artifact.importance = rawItem.importance || 0.3; 
                if (rawItem.subject) artifact.entities.push(rawItem.subject);
                break;

            case 'reflection':
                artifact.id = `ref_${rawItem.id}`;
                artifact.sourceId = rawItem.id;
                artifact.content = rawItem.insight || "";
                artifact.timestamp = rawItem.createdAt || null;
                artifact.confidence = rawItem.confidence || 0.8;
                artifact.importance = 0.8; 
                if (rawItem.subject) artifact.entities.push(rawItem.subject);
                if (rawItem.relatedKeys) {
                    artifact.entities.push(...rawItem.relatedKeys);
                }
                break;

            case 'vector':
                artifact.id = `vec_${rawItem.id}`;
                artifact.sourceId = rawItem.id;
                artifact.content = rawItem.text || "";
                artifact.timestamp = rawItem.timestamp || null;
                artifact.confidence = 0.6;
                artifact.importance = rawItem.importance || 0.5;
                if (rawItem.subject) artifact.entities.push(rawItem.subject);
                break;

            case 'csg':
                artifact.id = `csg_${rawItem.id}`;
                artifact.sourceId = rawItem.id;
                const displayName = rawItem.displayName || rawItem.label || rawItem.id;
                artifact.content = `${rawItem.type.toUpperCase()}: ${displayName}. ${rawItem.summary || ""}`;
                artifact.importance = rawItem.weight || 0.8;
                artifact.confidence = 1.0;
                if (rawItem.type === 'project') artifact.projects.push(rawItem.id);
                else if (rawItem.type === 'decision') artifact.decisions.push(rawItem.id);
                else if (rawItem.type === 'goal') artifact.goals.push(rawItem.id);
                else artifact.entities.push(rawItem.id);
                break;

            case 'working':
                artifact.id = `wk_${metadata.id || Date.now()}`;
                artifact.sourceId = metadata.id;
                artifact.content = rawItem.content || rawItem.value || JSON.stringify(rawItem);
                artifact.importance = 1.0; 
                break;
                
            default:
                artifact.id = `unk_${Date.now()}`;
                artifact.content = JSON.stringify(rawItem);
        }

        return artifact;
    }
}

module.exports = MemoryArtifactFactory;
