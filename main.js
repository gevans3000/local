// main.js

// AbortControllers for each chat box
let controller1 = null;
let controller2 = null;
let controller3 = null;
let controller4 = null;

// Variable to store context for chatBox1
let currentContext1 = [];

// Object to store system prompts for each chatBox
const systemPrompts = {};

// Function to handle "Select All" checkbox behavior and system prompts
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

    // Inject gear icons and setup system prompt functionality for each chatBox
    for (let i = 1; i <= 4; i++) {
        const chatBoxHeader = document.querySelector(`#chatBox${i} h1`);
        if (chatBoxHeader) {
            // Create gear icon
            const gearIcon = document.createElement('span');
            gearIcon.innerHTML = '⚙️';
            gearIcon.style.cursor = 'pointer';
            gearIcon.style.marginLeft = '10px';
            gearIcon.title = 'Set System Prompt';
            gearIcon.setAttribute('aria-label', 'Set System Prompt');

            // Append gear icon to header
            chatBoxHeader.appendChild(gearIcon);

            // Create system prompt overlay
            const overlay = document.createElement('div');
            overlay.id = `systemPromptOverlay${i}`;
            overlay.style.display = 'none';
            overlay.style.position = 'fixed';
            overlay.style.top = '50%';
            overlay.style.left = '50%';
            overlay.style.transform = 'translate(-50%, -50%)';
            overlay.style.backgroundColor = '#fff';
            overlay.style.border = '1px solid #ccc';
            overlay.style.padding = '20px';
            overlay.style.boxShadow = '0 2px 8px rgba(0,0,0,0.26)';
            overlay.style.zIndex = '1000';

            // Create close button
            const closeButton = document.createElement('span');
            closeButton.innerHTML = '✖️';
            closeButton.style.float = 'right';
            closeButton.style.cursor = 'pointer';
            closeButton.title = 'Close';
            closeButton.setAttribute('aria-label', 'Close');

            // Create textarea for system prompt
            const textarea = document.createElement('textarea');
            textarea.id = `systemPromptTextarea${i}`;
            textarea.rows = 4;
            textarea.cols = 50;
            textarea.placeholder = 'Enter system prompt here...';
            textarea.style.width = '100%';

            // Append elements to overlay
            overlay.appendChild(closeButton);
            const label = document.createElement('label');
            label.htmlFor = textarea.id;
            label.textContent = 'System Prompt:';
            overlay.appendChild(label);
            overlay.appendChild(document.createElement('br'));
            overlay.appendChild(textarea);

            // Append overlay to body
            document.body.appendChild(overlay);

            // Event listener to show overlay on gear icon click
            gearIcon.addEventListener('click', () => {
                overlay.style.display = 'block';
                textarea.focus();
            });

            // Event listener to close overlay
            closeButton.addEventListener('click', () => {
                overlay.style.display = 'none';
            });
        } else {
            console.error(`Header for chatBox${i} not found.`);
        }
    }
});

// Function to display messages in the chat box
function displayMessage(chatBoxNumber, user, message, timestamp, tokens = null, isMarkdown = false) {
    const messagesContainer = document.getElementById(`messages${chatBoxNumber}`);
    if (!messagesContainer) {
        console.error(`Messages container for chatBox${chatBoxNumber} not found.`);
        return;
    }

    const messageElement = document.createElement('div');
    messageElement.classList.add('message', user.startsWith('You') ? 'user-message' : 'assistant-message');

    const messageContent = document.createElement('p');
    if (isMarkdown && user !== 'System') {
        // Parse and sanitize markdown content
        const rawHtmlContent = marked.parse(message);
        const sanitizedHtmlContent = DOMPurify.sanitize(rawHtmlContent);
        messageContent.innerHTML = sanitizedHtmlContent;
    } else {
        messageContent.textContent = message;
    }
    messageElement.appendChild(messageContent);

    const messageInfo = document.createElement('span');
    messageInfo.classList.add('message-info');
    messageInfo.textContent = `${user} | ${timestamp}` + (tokens ? ` | Tokens: ${tokens}` : '');
    messageElement.appendChild(messageInfo);

    // Insert the message at the top of the messages container
    messagesContainer.insertBefore(messageElement, messagesContainer.firstChild);
}

// Refactored function to set element visibility
function setElementVisibility(elementId, visible) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = visible ? 'inline-block' : 'none';
    }
}

// Show/hide spinner using the refactored function
function showSpinner(chatBoxNumber) {
    setElementVisibility(`loadingSpinner${chatBoxNumber}`, true);
}

function hideSpinner(chatBoxNumber) {
    setElementVisibility(`loadingSpinner${chatBoxNumber}`, false);
}

// Show/hide stop button using the refactored function
function showStopButton(chatBoxNumber) {
    setElementVisibility(`stopButton${chatBoxNumber}`, true);
}

function hideStopButton(chatBoxNumber) {
    setElementVisibility(`stopButton${chatBoxNumber}`, false);
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
        setController(chatBoxNumber, new AbortController());
        const signal = getControllerSignal(chatBoxNumber);

        try {
            // Retrieve system prompt if set
            const systemPromptTextarea = document.getElementById(`systemPromptTextarea${chatBoxNumber}`);
            const systemPrompt = systemPromptTextarea ? systemPromptTextarea.value.trim() : "";
            if (systemPrompt) {
                systemPrompts[chatBoxNumber] = systemPrompt;
            }

            // Prepare context
            let context = [];
            if (chatBoxNumber === 1 && currentContext1.length > 0) {
                context = [...currentContext1];
            }

            // Include system prompt in context
            if (systemPrompts[chatBoxNumber]) {
                context.unshift({ user: `System`, message: systemPrompts[chatBoxNumber] });
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
        displayMessage(chatBoxNumber, 'System', 'Please enter a question.', new Date().toLocaleTimeString());
    }
}

// Function to handle getting context
async function getContext(chatBoxNumber) {
    try {
        // Show spinner while fetching context
        showSpinner(chatBoxNumber);

        // Collect selected chatboxes
        let selectedChatBoxes = [];
        for (let i = 2; i <= 4; i++) {
            const checkbox = document.getElementById(`selectChatBox${i}`);
            if (checkbox && checkbox.checked) {
                selectedChatBoxes.push(i);
            }
        }

        if (selectedChatBoxes.length === 0) {
            displayMessage(chatBoxNumber, 'System', 'No chat boxes selected.', new Date().toLocaleTimeString());
            hideSpinner(chatBoxNumber);
            return;
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
            const messagesContainer = document.getElementById(`messages${chatBoxNumber}`);
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
            } else {
                console.error(`Messages container for chatBox${chatBoxNumber} not found.`);
            }

            // Update currentContext1
            currentContext1 = data.context;

            // Reverse the context array to display most recent messages at the top
            data.context.slice().reverse().forEach(message => {
                const isMarkdown = message.user.startsWith('gpt-') || message.user.startsWith('nvidia/') || message.user.startsWith('meta/');
                displayMessage(chatBoxNumber, message.user, message.message, message.timestamp, message.tokens, isMarkdown);
            });
        } else if (data.error) {
            displayMessage(chatBoxNumber, 'System', `Failed to get context: ${data.error}`, new Date().toLocaleTimeString());
        }
    } catch (error) {
        console.error('Fetch error:', error);
        displayMessage(chatBoxNumber, 'System', 'Error contacting the server.', new Date().toLocaleTimeString());
    } finally {
        // Hide spinner after fetching context
        hideSpinner(chatBoxNumber);
    }
}

// Function to stop a request
function stopRequest(chatBoxNumber) {
    const controller = getController(chatBoxNumber);
    if (controller) controller.abort();
}

// Function to get AbortController signal
function getControllerSignal(chatBoxNumber) {
    const controller = getController(chatBoxNumber);
    return controller ? controller.signal : null;
}

// Function to set AbortController for a chatBox
function setController(chatBoxNumber, controller) {
    switch(chatBoxNumber) {
        case 1:
            controller1 = controller;
            break;
        case 2:
            controller2 = controller;
            break;
        case 3:
            controller3 = controller;
            break;
        case 4:
            controller4 = controller;
            break;
        default:
            console.error('Invalid chatBoxNumber:', chatBoxNumber);
    }
}

// Function to get AbortController for a chatBox
function getController(chatBoxNumber) {
    switch(chatBoxNumber) {
        case 1:
            return controller1;
        case 2:
            return controller2;
        case 3:
            return controller3;
        case 4:
            return controller4;
        default:
            console.error('Invalid chatBoxNumber:', chatBoxNumber);
            return null;
    }
}

// Function to reset AbortController
function resetController(chatBoxNumber) {
    setController(chatBoxNumber, null);
}
