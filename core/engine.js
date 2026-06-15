import * as webLLM from "https://esm.run/@mlc-ai/web-llm";
import { findRelevantContext } from "./rag.js";

// Official stable WebLLM built-in model identifier for Google Gemma-2 2B
const MODEL_ID = "gemma-2-2b-it-q4f16_1-MLC";
let engine = null;

export async function initMary(onProgressUpdate) {
    console.log(`📡 Initializing stable core WebLLM model: ${MODEL_ID}`);

    try {
        // Explicitly set the configuration to use the official MLC CDN to fix CORS issues
        engine = await webLLM.CreateMLCEngine(MODEL_ID, {
            initProgressCallback: (report) => {
                console.log("📦 Model Download Status:", report.text);
                if (onProgressUpdate) {
                    onProgressUpdate(report);
                }
            },
            model_list: [{
                model: "https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC/resolve/main/",
                model_id: MODEL_ID,
                model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/gemma-2b-it/gemma-2b-it-q4f16_1-MLC-webgpu.wasm"
            }]
        });
        console.log("✅ WebLLM engine loaded successfully with Gemma 2.");
    } catch (err) {
        console.error("❌ Failed to initialize WebLLM with Gemma-2:", err);
        throw err;
    }

    return async function initMary(userQuery, chatHistory, onChunkReceived) {
        console.log("🚀 initMary pipeline activated.");
        
        // Fetch background facts from your local RAG system
        const localEnglishContext = await findRelevantContext(userQuery);
        console.log("📋 Local library facts matching complete.");

        // Clear out the display frame immediately for clean UI streaming
        onChunkReceived("");

        // RULE 1: If RAG doesn't find a high-quality match, stop early at the code level
        if (!localEnglishContext) {
            onChunkReceived("I'm sorry, I don't have that specific information in my clinical library. Please consult your oncologist.");
            return;
        }

        // RULE 2: Clean, authoritative system prompt telling Gemma exactly how to style the retrieved text
        const systemInstruction = `You are Mary, a supportive and accurate breast cancer educational assistant. 
Your task is to summarize the provided "Library Context" to answer the user's question clearly.

Instructions:
- Provide a clear, natural summary based ONLY on the Library Context facts.
- If the answer to a question is not contained within the provided Library Context, you must say: "I do not have that information in my current library."
- Do not use information from your own training data if it is not supported by the Library Context.
- Use simple eighth grade level language
- 🌍 If the user asks in a language other than English, detect that language and respond naturally in that same language.';

Library Context:
${localEnglishContext}`;

        const messages = [
            { role: "system", content: systemInstruction }
        ];

        // Safely map past history turns
        if (chatHistory && chatHistory.length > 0) {
            chatHistory.forEach((msg) => {
                if (msg.role === "user" || msg.role === "assistant") {
                    messages.push({ role: msg.role, content: msg.content });
                }
            });
        }

        // Add the current user query turn
        messages.push({ role: "user", content: userQuery });

        try {
            const replyChunks = await engine.chat.completions.create({
                messages: messages,
                stream: true, 
                temperature: 0.2, // Slightly adjusted to allow fluent summarization without hallucinations
                max_tokens: 500
            });

            for await (const chunk of replyChunks) {
                if (chunk.choices && chunk.choices[0]) {
                    const wordSnippet = chunk.choices[0].delta?.content || "";
                    if (wordSnippet) {
                        onChunkReceived(wordSnippet);
                    }
                }
            }

            console.log("🏁 Gemma 2 streaming extraction loop complete.");

        } catch (streamError) {
            console.error("❌ Error during Gemma 2 streaming loop:", streamError);
            onChunkReceived("An internal error occurred while trying to process the text.");
        }
    };
}
