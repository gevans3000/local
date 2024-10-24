// main.js

let controller1 = null;
let controller2 = null;
let controller3 = null;
let controller4 = null;

// Variable to store context for chatBox1
let currentContext1 = [];

// Function to handle "Select All" checkbox behavior
document.addEventListener('DOMContentLoaded', () => {
    const selectAllCheckbox = document.getElementById('selectAllChatBoxes');
    const chatBoxCheckboxes = [
        document.getElementById('selectChatBox2'),
        document.getElementById('selectChatBox3'),
        document.getElementById('selectChatBox4')
    ];

    if (selectAllCheckbox && chatBoxCheckboxes.every(cb => cb !== null)) {
        // When "Select All" is clicked
        selectAllCheckbox.addEventListener('change', () => {
            chatBoxCheckboxes.forEach(checkbox => {
                checkbox.checked = selectAllCheckbox.checked;
            });
        });

        // When any individual checkbox is clicked
        chatBoxCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const allChecked = chatBoxCheckboxes.every(cb => cb.checked);
                selectAllCheckbox.checked = allChecked;
            });
        });
    } else {
        console.error('Select All checkbox or individual chatBox checkboxes not found.');
    }
});

// Function to display messages in the chat box
function displayMessage(chatBoxNumber, user, message, timestamp, tokens = null, isMarkdown = false) {
    const chatBox = document.getElementById(`chatBox${chatBoxNumber}`);
    if (!chatBox) {
        console.error(`ChatBox${chatBoxNumber} not found.`);
        return;
    }

    const messageElement = document.createElement('div');
    messageElement.classList.add('message', user.startsWith('You') ? 'user-message' : 'assistant-message');

    const messageContent = document.createElement('p');
    messageContent.textContent = message;
    if (isMarkdown) {
        // If message is from AI model, apply markdown parsing if necessary
        // This assumes a markdown parser is available
        // For example, using marked.js or similar
        // Here we keep it simple
        messageContent.innerHTML = message;
    }
    messageElement.appendChild(messageContent);

    const messageInfo = document.createElement('span');
    messageInfo.classList.add('message-info');
    messageInfo.textContent = `${user} | ${timestamp}` + (tokens ? ` | Tokens: ${tokens}` : '');
    messageElement.appendChild(messageInfo);

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Function to show spinner
function showSpinner(chatBoxNumber) {
    const spinner = document.getElementById(`spinner${chatBoxNumber}`);
    if (spinner) {
        spinner.style.display = 'inline-block';
    }
}

// Function to hide spinner
function hideSpinner(chatBoxNumber) {
    const spinner = document.getElementById(`spinner${chatBoxNumber}`);
    if (spinner) {
        spinner.style.display = 'none';
    }
}

// Function to show stop button
function showStopButton(chatBoxNumber) {
    const stopButton = document.getElementById(`stopButton${chatBoxNumber}`);
    if (stopButton) {
        stopButton.style.display = 'inline-block';
    }
}

// Function to hide stop button
function hideStopButton(chatBoxNumber) {
    const stopButton = document.getElementById(`stopButton${chatBoxNumber}`);
    if (stopButton) {
        stopButton.style.display = 'none';
    }
}

// Function to handle form submission
async function askQuestion(chatBoxNumber, event = null) {
    if (event) {
        if (event.type === 'keypress' && event.key !== 'Enter') {
            return;
        }
        event.preventDefault();
    }

    const questionInput = document.getElementById(`question${chatBoxNumber}`);
    if (!questionInput) {
        console.error(`Input field for chatBox${chatBoxNumber} not found.`);
        return;
    }

    const question = questionInput.value.trim();
    let model;

    // Determine the model based on chatBoxNumber and textarea input
    if (chatBoxNumber === 2 || chatBoxNumber === 4) {
        const modelInput = document.getElementById(`modelInput${chatBoxNumber}`);
        model = (modelInput && modelInput.value.trim() !== "") ? modelInput.value.trim() : 
                (chatBoxNumber === 2 ? "gpt-4o-mini-2024-07-18" : "meta/llama-3.2-3b-instruct");
    } else {
        model = chatBoxNumber === 1 ? "gpt-4o-mini" :
                "nvidia/llama-3.1-nemotron-70b-instruct"; // For chatBox3
    }

    if (question) {
        const timestamp = new Date().toLocaleTimeString();
        const userIdentifier = `You${chatBoxNumber}`;
        displayMessage(chatBoxNumber, userIdentifier, question, timestamp);

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
            // Prepare context if chatBoxNumber is 1
            let context = [];
            if (chatBoxNumber === 1) {
                context = currentContext1;
            }

            const response = await fetch('/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question: question, model: model, chatBoxNumber: chatBoxNumber, context: context }),
                signal: signal
            });
            const data = await response.json();
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

// Function to handle getting context
async function getContext(chatBoxNumber) {
    try {
        // Show spinner while fetching context
        showSpinner(chatBoxNumber);

        // Collect selected chatboxes
        let selectedChatBoxes = [1]; // ChatBox1 is always selected
        for (let i = 2; i <=4; i++) {
            const checkbox = document.getElementById(`selectChatBox${i}`);
            if (checkbox && checkbox.checked) {
                selectedChatBoxes.push(i);
            }
        }

        const response = await fetch('/get-context', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chatBoxNumbers: selectedChatBoxes }),
        });
        const data = await response.json();
        if (data.context && Array.isArray(data.context)) {
            // Clear existing messages in chatBox1
            const chatBox = document.getElementById(`chatBox1`);
            if (chatBox) {
                const messages = chatBox.querySelectorAll('.message');
                messages.forEach(message => message.remove());
            } else {
                console.error('chatBox1 not found.');
            }

            // Update currentContext1
            currentContext1 = data.context;

            data.context.forEach(message => {
                // Determine if the message is from the AI model by checking if user starts with model prefixes
                const isMarkdown = message.user.startsWith('gpt-') || message.user.startsWith('nvidia/') || message.user.startsWith('meta/');
                displayMessage(1, message.user, message.message, message.timestamp, message.tokens, isMarkdown);
            });
        } else if (data.error) {
            displayMessage(1, 'System', `Failed to get context: ${data.error}`, new Date().toLocaleTimeString());
        }
    } catch (error) {
        console.error('Fetch error:', error);
        displayMessage(1, 'System', 'Error contacting the server.', new Date().toLocaleTimeString());
    } finally {
        // Hide spinner after fetching context
        hideSpinner(chatBoxNumber);
    }
}

// Function to stop a request
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

// Function to get AbortController signal
function getControllerSignal(chatBoxNumber) {
    switch(chatBoxNumber) {
        case 1:
            return controller1 ? controller1.signal : null;
        case 2:
            return controller2 ? controller2.signal : null;
        case 3:
            return controller3 ? controller3.signal : null;
        case 4:
            return controller4 ? controller4.signal : null;
        default:
            return null;
    }
}

// Function to reset AbortController
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
