const fs = require('fs');
const path = require('path');
const RAMIndexer = require('./RAMIndexer');
const MemoryArtifactFactory = require('./MemoryArtifactFactory');

const EPISODIC_PATH = path.resolve(__dirname, '../../../data/memory/episodic_memory.json');
const REFLECTION_PATH = path.resolve(__dirname, '../../../data/memory/reflection_memory.json');
const SEMANTIC_PATH = path.resolve(__dirname, '../../../data/memory/memory.json');
const CSG_PATH = path.resolve(__dirname, '../../../data/memory/cognitive_state_graph.json');
const VECTOR_PATH = path.resolve(__dirname, '../../../data/memory/vector_store.json');

class RelationshipGraph {
    constructor() {
        this.csg = { nodes: {}, edges: [] };
        this.semantic = { facts: {} };
        this.episodic = [];
        this.reflection = [];
        this.vector = [];
        this.loadData();
    }

    loadData() {
        try { this.csg = JSON.parse(fs.readFileSync(CSG_PATH, 'utf8')); } catch(e) { this.csg = { nodes: {}, edges: [] }; }
        try { this.semantic = JSON.parse(fs.readFileSync(SEMANTIC_PATH, 'utf8')); } catch(e) { this.semantic = { facts: {} }; }
        try { this.episodic = JSON.parse(fs.readFileSync(EPISODIC_PATH, 'utf8')); } catch(e) { this.episodic = []; }
        try { this.reflection = JSON.parse(fs.readFileSync(REFLECTION_PATH, 'utf8')); } catch(e) { this.reflection = []; }
        try { this.vector = JSON.parse(fs.readFileSync(VECTOR_PATH, 'utf8')); } catch(e) { this.vector = []; }
    }

    /**
     * Re-reads JSON files from disk (useful for tests or updates during Phase-0)
     */
    refresh() {
        this.loadData();
    }

    /**
     * Traverse graph to gather memory artifacts.
     * Implements Cycle Protection (visitedSet) and MaxDepth.
     * 
     * @param {string} startNodeId The CSG node ID to start traversal from (e.g., 'node::person::sejal')
     * @param {number} maxDepth The maximum relationship hop distance
     * @returns {Array} List of normalized MemoryArtifacts
     */
    gatherArtifacts(startNodeId, maxDepth = 5) {
        const artifacts = [];
        const visitedSet = new Set();
        const artifactIdSet = new Set(); // Prevent duplicate artifact inclusion

        const addArtifact = (artifact) => {
            if (!artifactIdSet.has(artifact.id)) {
                artifactIdSet.add(artifact.id);
                artifacts.push(artifact);
            }
        };

        const gatherFromIndexerIds = (ids) => {
            for (const id of ids) {
                if (id.startsWith('ep_')) {
                    const indexStr = id.split('_').pop();
                    const index = parseInt(indexStr, 10);
                    if (!isNaN(index) && this.episodic[index]) {
                        addArtifact(MemoryArtifactFactory.createArtifact(this.episodic[index], 'episodic', { index }));
                    }
                } else if (id.startsWith('ref_')) {
                    const rId = id.substring(4);
                    const ref = this.reflection.find(r => r.id === rId);
                    if (ref) addArtifact(MemoryArtifactFactory.createArtifact(ref, 'reflection'));
                } else if (id.startsWith('vec_')) {
                    const vId = id.substring(4);
                    const vec = this.vector.find(v => v.id === vId);
                    if (vec) addArtifact(MemoryArtifactFactory.createArtifact(vec, 'vector'));
                } else {
                    // Raw ID
                    const ref = this.reflection.find(r => r.id === id);
                    if (ref) {
                        addArtifact(MemoryArtifactFactory.createArtifact(ref, 'reflection'));
                        continue;
                    }
                    const vec = this.vector.find(v => v.id === id);
                    if (vec) {
                        addArtifact(MemoryArtifactFactory.createArtifact(vec, 'vector'));
                    }
                }
            }
        };

        const traverse = (nodeId, currentDepth) => {
            if (currentDepth > maxDepth) return;
            if (visitedSet.has(nodeId)) return;
            visitedSet.add(nodeId);

            // Phase 0E: Handle temporal date pseudo-nodes (e.g. date::2026-02-11)
            if (nodeId.startsWith('date::')) {
                const dayKey = nodeId.split('::').pop();
                gatherFromIndexerIds(RAMIndexer.getDateIds(dayKey));
                return;
            }

            // 1. Fetch CSG Node Artifact
            const node = this.csg.nodes[nodeId];
            if (node) {
                addArtifact(MemoryArtifactFactory.createArtifact(node, 'csg'));
            }
                
            // 2. Fetch Semantic Facts natively bound to the node's label (or basename fallback)
            const subject = (node && node.label) ? node.label.toLowerCase() : nodeId.split('::').pop();
            if (subject && this.semantic.facts[subject]) {
                for (const [key, factObj] of Object.entries(this.semantic.facts[subject])) {
                    addArtifact(MemoryArtifactFactory.createArtifact(factObj, 'semantic', { subject, key }));
                }
            }

            // 3. Fetch linked Episodic, Reflection, Vector artifacts from RAMIndexer mapping
            gatherFromIndexerIds(RAMIndexer.getEntityIds(nodeId));
            gatherFromIndexerIds(RAMIndexer.getProjectIds(nodeId));
            gatherFromIndexerIds(RAMIndexer.getDecisionIds(nodeId));
            gatherFromIndexerIds(RAMIndexer.getGoalIds(nodeId));

            // Fallback for Phase-0: If the node is not in CSG, use the basename as a raw keyword search
            const basename = nodeId.split('::').pop();
            if (basename) {
                gatherFromIndexerIds(RAMIndexer.getEntityIds(basename));
                gatherFromIndexerIds(RAMIndexer.getVectorIds(basename));
            }

            // 4. Traverse explicitly defined CSG Edges
            const outgoingEdges = this.csg.edges.filter(e => e.source === nodeId || e.targetId === nodeId);
            for (const edge of outgoingEdges) {
                const target = edge.targetId === nodeId ? edge.source : edge.targetId;
                if (target) traverse(target, currentDepth + 1);
            }
            
            // 5. Traverse Parent-Child relationships
            if (node && node.parentId) traverse(node.parentId, currentDepth + 1);
            if (node && node.childIds) {
                for (const cId of node.childIds) traverse(cId, currentDepth + 1);
            }
            if (node && node.relatedIds) {
                for (const rId of node.relatedIds) traverse(rId, currentDepth + 1);
            }
        };

        traverse(startNodeId, 1);
        return artifacts;
    }
}

module.exports = new RelationshipGraph();
