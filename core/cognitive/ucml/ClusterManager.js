const fs = require('fs');
const path = require('path');

const ALIAS_REGISTRY_PATH = path.resolve(__dirname, '../../../data/memory/aliasRegistry.json');

class ClusterManager {
    constructor() {
        this.aliasRegistry = {};
        this.loadRegistry();
    }

    loadRegistry() {
        try {
            if (fs.existsSync(ALIAS_REGISTRY_PATH)) {
                this.aliasRegistry = JSON.parse(fs.readFileSync(ALIAS_REGISTRY_PATH, 'utf8'));
            }
        } catch (e) {
            console.error("[ClusterManager] Failed to load Alias Registry", e);
        }
    }

    /**
     * Resolves a query/entity to a canonical Cluster ID using deterministic registry.
     */
    resolveAlias(term) {
        if (!term) return null;
        const normalized = term.toLowerCase().trim();
        return this.aliasRegistry[normalized] || `cluster::${normalized.replace(/\\s+/g, '_')}`;
    }

    /**
     * Groups a collection of MemoryArtifacts into a single ClusterArtifact struct.
     */
    createCluster(clusterId, artifacts) {
        return {
            clusterId: clusterId,
            artifacts: artifacts || [],
            summary: `Cluster containing ${artifacts ? artifacts.length : 0} artifacts`
        };
    }
}

module.exports = new ClusterManager();
