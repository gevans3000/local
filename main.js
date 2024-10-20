// main.js

let controller1 = null;
let controller2 = null;
let controller3 = null;

async function askQuestion(chatBoxNumber) {
    const questionInput = document.getElementById(`question${chatBoxNumber}`);
    const question = questionInput.value.trim();
    const chatBox = document.getElementById(`chatBox${chatBoxNumber}`);
    const inputArea = document.getElementById(`inputArea${chatBoxNumber}`);
    const loadingSpinner = document.getElementById(`loadingSpinner${chatBoxNumber}`);
    const stopButton = document.getElementById(`stopButton${chatBoxNumber}`);
    const model = chatBoxNumber === 1 ? "gpt-4o-mini" :
                  chatBoxNumber === 2 ? "gpt-4o-mini-2024-07-18" :
                                          "gpt-4o";

    if (question) {
        const timestamp = new Date().toLocaleTimeString();
        const questionDiv = document.createElement('div');
        questionDiv.className = 'message';
        questionDiv.innerHTML = `<strong>You:</strong> ${question}<span class="timestamp"> (${timestamp})</span>`;
        chatBox.insertBefore(questionDiv, inputArea.nextSibling);
        // Save to database will be handled by server

        // Show the spinner and stop button
        loadingSpinner.style.display = 'block';
        stopButton.style.display = 'inline-block';

        // Initialize AbortController
        if (chatBoxNumber === 1) {
            controller1 = new AbortController();
        } else if (chatBoxNumber === 2) {
            controller2 = new AbortController();
        } else {
            controller3 = new AbortController();
        }
        const signal = chatBoxNumber === 1 ? controller1.signal :
                       chatBoxNumber === 2 ? controller2.signal :
                                              controller3.signal;

        try {
            const response = await fetch('/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question: question, model: model }),
                signal: signal
            });
            const data = await response.json();
            const responseTimestamp = new Date().toLocaleTimeString();
            if (response.ok) {
                const answerDiv = document.createElement('div');
                // Parse Markdown for GPT-4o responses
                const htmlContent = marked.parse(data.answer);
                answerDiv.className = 'message';
                answerDiv.innerHTML = `<strong>${model}:</strong> ${htmlContent}<span class="timestamp"> (${responseTimestamp})</span>`;
                if(data.usage) {
                    answerDiv.innerHTML += `<span class="timestamp"> [Tokens: ${data.usage.total_tokens}]</span>`;
                }
                chatBox.insertBefore(answerDiv, inputArea.nextSibling);
                // Save to database will be handled by server
            } else {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'message';
                errorDiv.textContent = `Failed to get an answer: ${data.error}`;
                chatBox.insertBefore(errorDiv, inputArea.nextSibling);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                const abortDiv = document.createElement('div');
                abortDiv.className = 'message';
                abortDiv.textContent = 'Request was stopped.';
                chatBox.insertBefore(abortDiv, inputArea.nextSibling);
            } else {
                console.error('Fetch error:', error);
                const errorDiv = document.createElement('div');
                errorDiv.className = 'message';
                errorDiv.textContent = 'Error contacting the server.';
                chatBox.insertBefore(errorDiv, inputArea.nextSibling);
            }
        }

        // Hide the spinner and stop button
        loadingSpinner.style.display = 'none';
        stopButton.style.display = 'none';
        if (chatBoxNumber === 1) {
            controller1 = null;
        } else if (chatBoxNumber === 2) {
            controller2 = null;
        } else {
            controller3 = null;
        }
    } else {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'message';
        warningDiv.textContent = 'Please enter a question.';
        chatBox.insertBefore(warningDiv, inputArea.nextSibling);
    }
    questionInput.value = ''; // Clear the input after asking
    questionInput.focus(); // Refocus to the input field
}

function stopRequest(chatBoxNumber) {
    if (chatBoxNumber === 1 && controller1) {
        controller1.abort();
    } else if (chatBoxNumber === 2 && controller2) {
        controller2.abort();
    } else if (chatBoxNumber === 3 && controller3) {
        controller3.abort();
    }
}
