// ui.js

function displayMessage(chatBoxNumber, user, content, timestamp, tokens = null, isMarkdown = false) {
    const chatBox = document.getElementById(`chatBox${chatBoxNumber}`);
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';

    const userStrong = document.createElement('strong');
    userStrong.textContent = `${user}:`;

    if (user === 'System') {
        // Style system messages differently
        messageDiv.style.fontStyle = 'italic';
        messageDiv.style.color = '#555';
    }

    messageDiv.appendChild(userStrong);

    if (isMarkdown && user !== 'System') {
        // Use a markdown parser and sanitize the HTML output
        const rawHtmlContent = marked.parse(content);
        const sanitizedHtmlContent = DOMPurify.sanitize(rawHtmlContent);
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = sanitizedHtmlContent;
        messageDiv.appendChild(contentDiv);
    } else {
        const contentSpan = document.createElement('span');
        contentSpan.textContent = ` ${content}`;
        messageDiv.appendChild(contentSpan);
    }

    if (timestamp) {
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'timestamp';
        timestampSpan.textContent = ` (${timestamp})`;
        messageDiv.appendChild(timestampSpan);
    }

    if (tokens) {
        const tokensSpan = document.createElement('span');
        tokensSpan.className = 'timestamp';
        tokensSpan.textContent = ` [Tokens: ${tokens}]`;
        messageDiv.appendChild(tokensSpan);
    }

    chatBox.insertBefore(messageDiv, document.getElementById(`inputArea${chatBoxNumber}`).nextSibling);
}

function setElementVisibility(elementId, visible) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = visible ? 'inline-block' : 'none';
    }
}

function showSpinner(chatBoxNumber) {
    setElementVisibility(`loadingSpinner${chatBoxNumber}`, true);
}

function hideSpinner(chatBoxNumber) {
    setElementVisibility(`loadingSpinner${chatBoxNumber}`, false);
}

function showStopButton(chatBoxNumber) {
    setElementVisibility(`stopButton${chatBoxNumber}`, true);
}

function hideStopButton(chatBoxNumber) {
    setElementVisibility(`stopButton${chatBoxNumber}`, false);
}
