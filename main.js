// main.js

let controller = null;

async function askQuestion() {
    const questionInput = document.getElementById('question');
    const question = questionInput.value.trim();

    if (!question) {
        displayMessage('System', 'Please enter a question.', new Date().toLocaleTimeString());
        return;
    }

    const timestamp = new Date().toLocaleTimeString();
    displayMessage('You', question, timestamp);

    showSpinner();
    showStopButton();

    controller = new AbortController();

    try {
        const data = await sendQuestion(question);
        const responseTimestamp = new Date().toLocaleTimeString();

        if (data.answer) {
            displayMessage('GPT-4o', data.answer, responseTimestamp, data.usage ? data.usage.total_tokens : null, true);
        } else if (data.error) {
            displayMessage('System', `Failed to get an answer: ${data.error}`, responseTimestamp);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            displayMessage('System', 'Request was stopped.', new Date().toLocaleTimeString());
        } else {
            console.error('Fetch error:', error);
            displayMessage('System', 'Error contacting the server.', new Date().toLocaleTimeString());
        }
    } finally {
        hideSpinner();
        hideStopButton();
        controller = null;
    }

    questionInput.value = '';
    questionInput.focus();
}

function stopRequest() {
    if (controller) {
        controller.abort();
    }
}
