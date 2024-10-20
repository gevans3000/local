// ui.js

function displayMessage(chatBoxNumber, user, content, timestamp, tokens = null, isMarkdown = false) {
    const chatBox = document.getElementById(`chatBox${chatBoxNumber}`);
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

    chatBox.insertBefore(messageDiv, document.getElementById(`inputArea${chatBoxNumber}`).nextSibling);
}

function showSpinner(chatBoxNumber) {
    document.getElementById(`loadingSpinner${chatBoxNumber}`).style.display = 'block';
}

function hideSpinner(chatBoxNumber) {
    document.getElementById(`loadingSpinner${chatBoxNumber}`).style.display = 'none';
}

function showStopButton(chatBoxNumber) {
    document.getElementById(`stopButton${chatBoxNumber}`).style.display = 'inline-block';
}

function hideStopButton(chatBoxNumber) {
    document.getElementById(`stopButton${chatBoxNumber}`).style.display = 'none';
}
