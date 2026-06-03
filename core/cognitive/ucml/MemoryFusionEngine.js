/**
 * MemoryFusionEngine
 * Assembles a strictly budgeted and formatted prompt context block from ranked artifacts.
 */
class MemoryFusionEngine {
    constructor() {
        this.budgets = {
            semantic: 5,
            episodic: 5,
            reflection: 3,
            decision: 2,
            project: 2,
            vector: 3,
            working: 6
        };
    }

    /**
     * Fuses the ranked artifacts into a markdown context block.
     * @param {Array} rankedArtifacts List of artifacts sorted by score
     * @returns {string} Formatted markdown block
     */
    fuse(rankedArtifacts) {
        if (!rankedArtifacts || rankedArtifacts.length === 0) return "";

        const counts = {
            semantic: 0,
            episodic: 0,
            reflection: 0,
            decision: 0,
            project: 0,
            vector: 0,
            csg: 0,
            working: 0
        };

        const categories = {
            semantic: [],
            episodic: [],
            reflection: [],
            decision: [],
            project: [],
            vector: [],
            csg: [],
            working: []
        };

        for (const art of rankedArtifacts) {
            const type = art.sourceType;
            if (counts[type] !== undefined) {
                // If it's a type with a budget, enforce it
                if (this.budgets[type] && counts[type] >= this.budgets[type]) continue;
                
                counts[type]++;
                categories[type].push(art);
            }
        }

        let block = ``;

        // We emit facts based on the strict hierarchy

        const formatLabel = (text) => {
            if (typeof text !== 'string') return text;
            return text.replace(/node::(project|goal|task|person|entity|decision|date)::([a-zA-Z0-9_-]+)/g, (match, type, id) => {
                return id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            });
        };

        if (categories.csg.length > 0) {
            block += `[ACTIVE PROJECTS & GOALS]\n`;
            for (const art of categories.csg) {
                block += `- ${formatLabel(art.content)}\n`;
            }
            block += `\n`;
        }

        if (categories.semantic.length > 0) {
            block += `[VERIFIED FACTS (L3)]\n`;
            for (const art of categories.semantic) {
                block += `- ${formatLabel(art.content)}\n`;
            }
            block += `\n`;
        }

        if (categories.reflection.length > 0) {
            block += `[SYNTHESIZED REFLECTIONS]\n`;
            for (const art of categories.reflection) {
                block += `- ${formatLabel(art.content)}\n`;
            }
            block += `\n`;
        }

        if (categories.episodic.length > 0) {
            block += `[HISTORICAL EPISODES]\n`;
            for (const art of categories.episodic) {
                let text = formatLabel(art.content.trim());
                if (text.length > 150) text = text.substring(0, 147) + '...';
                const auditTag = (art.importance >= 0.8) ? ` [IMP:${art.importance}]` : '';
                if (art.timestamp) {
                    block += `- [${new Date(art.timestamp).toISOString().split('T')[0]}] ${text}${auditTag}\n`;
                } else {
                    block += `- ${text}${auditTag}\n`;
                }
            }
            block += `\n`;
        }

        if (categories.vector.length > 0) {
            block += `[ASSOCIATIVE MEMORY]\n`;
            for (const art of categories.vector) {
                let text = formatLabel(art.content.trim());
                if (text.length > 150) text = text.substring(0, 147) + '...';
                block += `- ${text}\n`;
            }
            block += `\n`;
        }

        if (categories.working.length > 0) {
            block += `[WORKING MEMORY / SESSION CONTEXT]\n`;
            for (const art of categories.working) {
                block += `- ${formatLabel(art.content.trim())}\n`;
            }
            block += `\n`;
        }

        if (process.env.UCML_DEBUG === 'true') {
            const charCount = block.length;
            const tokenCount = Math.ceil(charCount / 4);
            console.log(`[UCML FUSION]`);
            console.log(`Semantic Facts: ${categories.semantic.length}`);
            console.log(`Episodes: ${categories.episodic.length}`);
            console.log(`Reflections: ${categories.reflection.length}`);
            console.log(`Vectors: ${categories.vector.length}`);
            console.log(`Projects: 0`);
            console.log(`Decisions: 0`);
            console.log(`CSG: ${categories.csg.length}`);
            console.log(`Working: ${categories.working.length}`);
            console.log(`Prompt Characters: ${charCount}`);
            console.log(`Prompt Tokens (estimate): ${tokenCount}\n`);
            
            console.log(`================================================\nUCML MEMORY BLOCK\n=================\n`);
            console.log(block);
            console.log(`================================================\n`);
        }

        // Issue 4 Fix: Self-Identity Salience
        // Map third-person "arvsal" facts to "your" so the LLM identifies with them.
        block = block.replace(/^-\s+arvsal\b/gmi, '- your');

        return block;
    }
}

module.exports = new MemoryFusionEngine();
