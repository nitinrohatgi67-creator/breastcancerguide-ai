// core/rag.js
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false; 
env.remoteModelPath = 'https://huggingface.co/models'; 

let embeddingPipeline = null;
let vectorizedLibrary = [];

async function initEmbeddingModel() {
    if (!embeddingPipeline) {
        console.log("📥 Loading lightweight BGE embedding model...");
        try {
            embeddingPipeline = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
            console.log("✅ BGE Embedding model ready.");
        } catch (err) {
            console.error("❌ Failed to pull BGE embedding model:", err);
            throw err;
        }
    }
}

/**
 * Robust vector generation that protects the WASM buffer boundary
 */
export async function getVector(text) {
    await initEmbeddingModel();
    
    try {
        // Enforce an absolute character-level safety window (~400 words maximum)
        // to stay safely under BGE's 512-token limit and prevent buffer overflows.
        const safeText = text.substring(0, 2000); 

        const output = await embeddingPipeline(safeText, { 
            pooling: 'mean', 
            normalize: true 
        });

        // SAFE EXTRACTION: Explicitly pull data out via index mapping 
        // to isolate the precise flat array from the Tensor multi-dimensional object
        if (output && output.data) {
            return Array.from(output.data);
        } else if (output && output[0] && output[0].data) {
            return Array.from(output[0].data);
        }
        
        throw new Error("Unexpected tensor output format from embedding structure");
    } catch (error) {
        console.error("❌ Buffer execution error on text block:", text.substring(0, 60), error);
        // Fallback to a zeroed array of correct dimension (384 for BGE Small) to prevent crashing the loop
        return new Array(384).fill(0);
    }
}

function cosineSimilarity(vecA, vecB) {
    return vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
}

export async function prepareVectorLibrary() {
    // If we already loaded it into memory, return it instantly
    if (vectorizedLibrary.length > 0) return vectorizedLibrary;

    try {
        // 🚀 FETCHING PRE-BUILT JSON: This is the speed key
        const response = await fetch("wiki/vector_knowledge.json");
        vectorizedLibrary = await response.json();
        
        console.log(`✅ Loaded ${vectorizedLibrary.length} pre-vectorized sections instantly.`);
        return vectorizedLibrary;
    } catch (error) {
        console.error("❌ Failed to load pre-built library:", error);
        return [];
    }
}

export async function findRelevantContext(userQuery) {
    const library = await prepareVectorLibrary();
    if (library.length === 0) return null;

    const queryVector = await getVector(userQuery);

    let bestMatch = null;
    let highestSimilarity = -1;

    for (const chunk of library) {
        // Skip fallback failure blocks
        if (chunk.vector.every(v => v === 0)) continue;

        const similarity = cosineSimilarity(queryVector, chunk.vector);
        if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            bestMatch = chunk.content;
        }
    }

    if (highestSimilarity < 0.6) {
        console.warn(`⚠️ Semantic match too weak (${highestSimilarity.toFixed(2)}). Rejecting.`);
        return null;
    }

    console.log(`🎯 Vector Match Success! Score: ${highestSimilarity.toFixed(2)}`);
    return bestMatch;
}