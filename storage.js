// storage.js

function saveChatToLocalStorage(user, text, timestamp, tokens = null) {
    const chatHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];
    chatHistory.push({ user, text, timestamp, tokens });
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}

function loadChatFromLocalStorage() {
    const chatHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];
    const chatBox = document.getElementById('chatBox');
    // Reverse the chat history to display latest messages on top
    chatHistory.reverse().forEach(entry => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        if(entry.user === 'GPT-4o') {
            // Parse Markdown for GPT-4o messages
            const htmlContent = marked.parse(entry.text);
            messageDiv.innerHTML = `<strong>${entry.user}:</strong> ${htmlContent}`;
        } else {
            messageDiv.innerHTML = `<strong>${entry.user}:</strong> ${entry.text}`;
        }
        if(entry.timestamp) {
            messageDiv.innerHTML += `<span class="timestamp"> (${entry.timestamp})</span>`;
        }
        if(entry.tokens) {
            messageDiv.innerHTML += `<span class="timestamp"> [Tokens: ${entry.tokens}]</span>`;
        }
        chatBox.appendChild(messageDiv);
    });
    // Scroll to top to show the latest messages
    chatBox.scrollTop = 0;
}
