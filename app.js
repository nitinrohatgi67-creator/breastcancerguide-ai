// app.js
import { initMary } from "../core/engine.js";

// Active conversation memory log
let messageHistory = [
    { role: "assistant", content: "Hello! I'm Mary. How can I help you today?" }
];

async function bootstrapApp() {
    console.log("📡 Initializing browser layout event drivers...");
    const loadingScreen = document.getElementById("loading-screen");
    const loadingText = document.getElementById("loading-text");
    const barFill = document.getElementById("progress-bar-fill");

    try {
        const askMary = await initMary((report) => {
            if (loadingText) {
                loadingText.innerHTML = `<strong>Waking up Mary...</strong><br><span style='font-size:0.75rem; color:#667085;'>${report.text}</span>`;
            }
            if (barFill && report.progress !== undefined) {
                const percentage = Math.floor(report.progress * 100);
                barFill.style.width = `${percentage}%`;
            }
        });

        if (loadingScreen) {
            loadingScreen.style.opacity = "0";
            setTimeout(() => { loadingScreen.style.display = "none"; }, 400);
        }

        setupChatInterface(askMary);

    } catch (error) {
        console.error("❌ App loading sequence broken:", error);
        if (loadingText) {
            loadingText.innerHTML = "<span style='color:#ed4c83; font-weight:bold;'>Engine failed to load.</span>";
        }
    }
}

function setupChatInterface(askMary) {
    const sendBtn = document.getElementById("send-btn");
    const userInput = document.getElementById("user-input");
    const chatContainer = document.getElementById("chat-container");
    const downloadBtn = document.getElementById("download-btn");
    const clearBtn = document.getElementById("clear-btn");

    function appendMessageElement(role, text) {
        const msgBubble = document.createElement("div");
        msgBubble.classList.add("msg-bubble", role === "user" ? "user" : "assistant");
        msgBubble.innerText = text;
        chatContainer.appendChild(msgBubble);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return msgBubble;
    }

    async function handleUserSubmit() {
        const queryText = userInput.value.trim();
        if (!queryText) return;

        userInput.value = "";
        appendMessageElement("user", queryText);
        
        // We do NOT add the user prompt to history yet; let the engine handle the flow
        // The engine now manages the context injection.
        const assistantBubble = appendMessageElement("assistant", "Thinking...");

        try {
            userInput.disabled = true;
            sendBtn.disabled = true;

            // Stream response
            await askMary(queryText, messageHistory, (textSnippet) => {
                if (assistantBubble.innerText === "Thinking...") assistantBubble.innerText = "";
                assistantBubble.innerText += textSnippet;
                chatContainer.scrollTop = chatContainer.scrollHeight;
            });

            // Update memory with final result
            messageHistory.push({ role: "user", content: queryText });
            messageHistory.push({ role: "assistant", content: assistantBubble.innerText });

        } catch (err) {
            console.error(err);
            assistantBubble.innerText = "I'm sorry, I encountered an error. Please try again.";
        } finally {
            userInput.disabled = false;
            sendBtn.disabled = false;
            userInput.focus();
        }
    }

    function downloadChatHistory() {
        if (messageHistory.length <= 1) {
            alert("No conversation history found.");
            return;
        }
        let transcript = "breastcancer.ai Transcript\n========================\n\n";
        messageHistory.forEach(m => transcript += `[${m.role.toUpperCase()}]: ${m.content}\n\n`);
        
        const blob = new Blob([transcript], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Transcript.txt";
        a.click();
    }

    function clearChatHistory() {
        messageHistory = [{ role: "assistant", content: "Hello! I'm Mary. How can I help you today?" }];
        chatContainer.innerHTML = "";
        appendMessageElement("assistant", messageHistory[0].content);
    }

    sendBtn.addEventListener("click", handleUserSubmit);
    userInput.addEventListener("keypress", (e) => { if (e.key === "Enter") handleUserSubmit(); });
    if (downloadBtn) downloadBtn.addEventListener("click", downloadChatHistory);
    if (clearBtn) clearBtn.addEventListener("click", clearChatHistory);
}

document.addEventListener("DOMContentLoaded", bootstrapApp);