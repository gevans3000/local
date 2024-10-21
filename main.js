// main.js

let controller1 = null;
let controller2 = null;
let controller3 = null;
let controller4 = null;

async function askQuestion(chatBoxNumber) {
    const questionInput = document.getElementById(`question${chatBoxNumber}`);
    const question = questionInput.value.trim();
    let model;

    // Determine the model based on chatBoxNumber and textarea input
    if (chatBoxNumber === 2 || chatBoxNumber === 4) {
        const modelInput = document.getElementById(`modelInput${chatBoxNumber}`).value.trim();
        model = modelInput !== "" ? modelInput : 
                (chatBoxNumber === 2 ? "gpt-4o-mini-2024-07-18" : "meta/llama-3.2-3b-instruct");
    } else {
        model = chatBoxNumber === 1 ? "gpt-4o-mini" :
                "nvidia/llama-3.1-nemotron-70b-instruct"; // For chatBox3
    }

    if (question) {
        const timestamp = new Date().toLocaleTimeString();
        displayMessage(chatBoxNumber, 'You', question, timestamp);

        // Show spinner and stop button
        showSpinner(chatBoxNumber);
        showStopButton(chatBoxNumber);

        // Initialize AbortController
        switch(chatBoxNumber) {
            case 1:
                controller1 = new AbortController();
                break;
            case 2:
                controller2 = new AbortController();
                break;
            case 3:
                controller3 = new AbortController();
                break;
            case 4:
                controller4 = new AbortController();
                break;
        }

        const signal = getControllerSignal(chatBoxNumber);

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
            resetController(chatBoxNumber);
        }

        questionInput.value = '';
        questionInput.focus();
    } else {
        displayMessage(chatBoxNumber, 'System', 'Please enter a question.');
    }
}

function stopRequest(chatBoxNumber) {
    switch(chatBoxNumber) {
        case 1:
            if (controller1) controller1.abort();
            break;
        case 2:
            if (controller2) controller2.abort();
            break;
        case 3:
            if (controller3) controller3.abort();
            break;
        case 4:
            if (controller4) controller4.abort();
            break;
        default:
            console.error('Invalid chatBoxNumber:', chatBoxNumber);
    }
}

function getControllerSignal(chatBoxNumber) {
    switch(chatBoxNumber) {
        case 1:
            return controller1.signal;
        case 2:
            return controller2.signal;
        case 3:
            return controller3.signal;
        case 4:
            return controller4.signal;
        default:
            return null;
    }
}

function resetController(chatBoxNumber) {
    switch(chatBoxNumber) {
        case 1:
            controller1 = null;
            break;
        case 2:
            controller2 = null;
            break;
        case 3:
            controller3 = null;
            break;
        case 4:
            controller4 = null;
            break;
    }
}
