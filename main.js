// main.js

let controller1 = null;
let controller2 = null;
let controller3 = null;
let controller4 = null;

async function askQuestion(chatBoxNumber) {
    const questionInput = document.getElementById(`question${chatBoxNumber}`);
    const question = questionInput.value.trim();
    const model = chatBoxNumber === 1 ? "gpt-4o-mini" :
                  chatBoxNumber === 2 ? "gpt-4o-mini-2024-07-18" :
                  "nvidia/llama-3.1-nemotron-70b-instruct"; // Same model for chatBox3 and chatBox4

    if (question) {
        const timestamp = new Date().toLocaleTimeString();
        displayMessage(chatBoxNumber, 'You', question, timestamp);
        
        // Show spinner and stop button
        showSpinner(chatBoxNumber);
        showStopButton(chatBoxNumber);

        // Initialize AbortController
        if (chatBoxNumber === 1) {
            controller1 = new AbortController();
        } else if (chatBoxNumber === 2) {
            controller2 = new AbortController();
        } else if (chatBoxNumber === 3) {
            controller3 = new AbortController();
        } else if (chatBoxNumber === 4) {
            controller4 = new AbortController();
        }
        const signal = chatBoxNumber === 1 ? controller1.signal :
                       chatBoxNumber === 2 ? controller2.signal :
                       chatBoxNumber === 3 ? controller3.signal :
                                              controller4.signal;

        try {
            const data = await sendQuestion(question, model);
            const responseTimestamp = new Date().toLocaleTimeString();
            if (data.answer) {
                const tokensUsed = data.usage ? data.usage.total_tokens : null;
                displayMessage(chatBoxNumber, model, data.answer, responseTimestamp, tokensUsed, true);
            } else if (data.error) {
                displayMessage(chatBoxNumber, 'System', `Failed to get an answer: ${data.error}`, responseTimestamp);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                displayMessage(chatBoxNumber, 'System', 'Request was stopped.', new Date().toLocaleTimeString());
            } else {
                console.error('Fetch error:', error);
                displayMessage(chatBoxNumber, 'System', 'Error contacting the server.', new Date().toLocaleTimeString());
            }
        } finally {
            // Hide spinner and stop button
            hideSpinner(chatBoxNumber);
            hideStopButton(chatBoxNumber);
            if (chatBoxNumber === 1) {
                controller1 = null;
            } else if (chatBoxNumber === 2) {
                controller2 = null;
            } else if (chatBoxNumber === 3) {
                controller3 = null;
            } else if (chatBoxNumber === 4) {
                controller4 = null;
            }
        }

        questionInput.value = '';
        questionInput.focus();
    } else {
        displayMessage(chatBoxNumber, 'System', 'Please enter a question.');
    }
}

function stopRequest(chatBoxNumber) {
    if (chatBoxNumber === 1 && controller1) {
        controller1.abort();
    } else if (chatBoxNumber === 2 && controller2) {
        controller2.abort();
    } else if (chatBoxNumber === 3 && controller3) {
        controller3.abort();
    } else if (chatBoxNumber === 4 && controller4) {
        controller4.abort();
    }
}
