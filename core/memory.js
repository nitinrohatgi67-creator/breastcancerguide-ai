export const memory = {
    get: () => JSON.parse(localStorage.getItem('mary_chat')) || [],
    save: (history) => localStorage.setItem('mary_chat', JSON.stringify(history.slice(-10))),
    clear: () => localStorage.removeItem('mary_chat'),
    download: (history) => {
        const text = history.map(m => `${m.role}: ${m.content}`).join('\n\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "my-chat-with-mary.txt";
        a.click();
    }
};