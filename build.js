import fs from 'fs';
import { pipeline } from '@xenova/transformers';

async function build() {
    // 1. Load your local markdown
    const rawMarkdown = fs.readFileSync('wiki/master_knowledge.md', 'utf8');
    const rawSections = rawMarkdown.split(/\n\n+/).filter(s => s.trim().length > 100);

    // 2. Load the embedding model (BGE)
    console.log("📥 Loading model...");
    const getEmbedding = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');

    let finalLibrary = [];
    
    // 3. Process the chunks
    for (const [index, section] of rawSections.entries()) {
        const output = await getEmbedding(section, { pooling: 'mean', normalize: true });
        
        finalLibrary.push({
            content: section.trim(),
            vector: Array.from(output.data)
        });
        console.log(`Processed ${index + 1}/${rawSections.length}`);
    }

    // 4. Save the file
    fs.writeFileSync('wiki/vector_knowledge.json', JSON.stringify(finalLibrary));
    console.log("✅ Successfully created wiki/vector_knowledge.json");
}

build();