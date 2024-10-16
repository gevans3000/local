// ui.js

function displayMessage(user, content, timestamp, tokens = null, isMarkdown = false) {
    const chatBox = document.getElementById('chatBox');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';

    if(isMarkdown) {
        const htmlContent = marked.parse(content);
        messageDiv.innerHTML = `<strong>${user}:</strong> ${htmlContent}`;
    } else {
        messageDiv.innerHTML = `<strong>${user}:</strong> ${content}`;
    }

    if(timestamp) {
        messageDiv.innerHTML += `<span class="timestamp"> (${timestamp})</span>`;
    }
    if(tokens) {
        messageDiv.innerHTML += `<span class="timestamp"> [Tokens: ${tokens}]</span>`;
    }

    chatBox.insertBefore(messageDiv, document.getElementById('inputArea').nextSibling);
   
}

function showSpinner() {
    document.getElementById('loadingSpinner').style.display = 'block';
}

function hideSpinner() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

function showStopButton() {
    document.getElementById('stopButton').style.display = 'inline-block';
}

function hideStopButton() {
    document.getElementById('stopButton').style.display = 'none';
}
