// main.js

// AbortControllers for each chat box
let controllers = {};

// Variable to store context for chatBox1
let currentContext1 = [];

// Object to store system prompts for each chatBox
const systemPrompts = {};

/**
 * Handles the visibility of elements by their ID.
 *
 * @param {string} elementId - The ID of the element to show or hide.
 * @param {boolean} visible - Whether the element should be visible.
 */
function setElementVisibility(elementId, visible) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = visible ? 'inline-block' : 'none';
    }
}

/**
 * Shows the loading spinner for a specific chat box.
 *
 * @param {number} chatBoxNumber - The number of the chat box.
 */
function showSpinner(chatBoxNumber) {
    setElementVisibility(`loadingSpinner${chatBoxNumber}`, true);
}

/**
 * Hides the loading spinner for a specific chat box.
 *
 * @param {number} chatBoxNumber - The number of the chat box.
 */
function hideSpinner(chatBoxNumber) {
    setElementVisibility(`loadingSpinner${chatBoxNumber}`, false);
}

/**
 * Shows the stop button for a specific chat box.
 *
 * @param {number} chatBoxNumber - The number of the chat box.
 */
function showStopButton(chatBoxNumber) {
    setElementVisibility(`stopButton${chatBoxNumber}`, true);
}

/**
 * Hides the stop button for a specific chat box.
 *
 * @param {number} chatBoxNumber - The number of the chat box.
 */
function hideStopButton(chatBoxNumber) {
    setElementVisibility(`stopButton${chatBoxNumber}`, false);
}

/**
 * Displays a message in the specified chat box.
 *
 * @param {number} chatBoxNumber - The number of the chat box.
 * @param {string} user - The user identifier ('You1', 'gpt-4o-mini', etc.).
 * @param {string} message - The message content.
 * @param {string} timestamp - The timestamp of the message.
 * @param {number} [tokens=null] - The number of tokens used (optional).
 * @param {boolean} [isMarkdown=false] - Whether the message content is Markdown.
 */
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

/**
 * Sets up event handlers for the dropdown checkboxes.
 */
function setupDropdownHandlers() {
    const dropdownContainers = document.querySelectorAll('.dropdown-container');

    dropdownContainers.forEach(dropdown => {
        const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length === 0) {
            console.error('No checkboxes found in dropdown.');
            return;
        }

        const selectAllCheckbox = dropdown.querySelector('.selectAllChatBoxes');
        const chatBoxCheckboxes = Array.from(dropdown.querySelectorAll('.selectChatBox'));

        // Event listener for "Select All"
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', () => {
                chatBoxCheckboxes.forEach(cb => {
                    cb.checked = selectAllCheckbox.checked;
                });
            });
        }

        // Event listeners for individual checkboxes
        chatBoxCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const allChecked = chatBoxCheckboxes.every(cb => cb.checked);
                selectAllCheckbox.checked = allChecked;
            });
        });
    });
}

/**
 * Handles the "Get Context" button click.
 */
function getContext() {
    const event = window.event;
    if (!event) {
        console.error('Event not found.');
        return;
    }

    const button = event.target || event.srcElement;
    const chatBox = button.closest('.chat-box');
    if (!chatBox) {
        console.error('Chat box container not found.');
        return;
    }

    const dropdownContent = chatBox.querySelector('.dropdown-content');
    if (!dropdownContent) {
        console.error('Dropdown content not found.');
        return;
    }

    const checkboxes = dropdownContent.querySelectorAll('input[type="checkbox"]');
    if (checkboxes.length === 0) {
        console.error('No checkboxes found in dropdown.');
        return;
    }

    const selectAllCheckbox = dropdownContent.querySelector('.selectAllChatBoxes');
    const chatBoxCheckboxes = Array.from(dropdownContent.querySelectorAll('.selectChatBox'));

    let selectedChatBoxes = [];

    if (selectAllCheckbox && selectAllCheckbox.checked) {
        selectedChatBoxes = [1, 2, 3, 4];
    } else {
        chatBoxCheckboxes.forEach(cb => {
            if (cb.checked) {
                const num = parseInt(cb.dataset.chatbox);
                if (!isNaN(num)) selectedChatBoxes.push(num);
            }
        });
    }

    if (selectedChatBoxes.length === 0) {
        alert('Please select at least one chatbox to get context.');
        return;
    }

    // Clear all messages in the current chatBox
    const currentMessages = chatBox.querySelector('.messages');
    if (currentMessages) {
        currentMessages.innerHTML = '';
    }

    // Fetch and update context for selected chatboxes
    fetchContext(selectedChatBoxes);
}

/**
 * Fetches context from the server for the specified chat boxes.
 *
 * @param {number[]} chatBoxNumbers - Array of chat box numbers to fetch context for.
 */
async function fetchContext(chatBoxNumbers) {
    try {
        // Show spinner for selected chatboxes
        chatBoxNumbers.forEach(number => {
            showSpinner(number);
        });

        const response = await sendGetContextRequest(chatBoxNumbers);

        if (response.context && Array.isArray(response.context)) {
            // Clear and update messages for each selected chatbox
            chatBoxNumbers.forEach(number => {
                const messagesContainer = document.getElementById(`messages${number}`);
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                }

                // Filter context for the specific chatbox
                const contextForBox = response.context.filter(msg => msg.chatBoxNumber === number);

                contextForBox.slice().reverse().forEach(message => {
                    const isMarkdown = message.user.startsWith('gpt-') || message.user.startsWith('nvidia/') || message.user.startsWith('meta/');
                    displayMessage(number, message.user, message.message, message.timestamp, message.tokens, isMarkdown);
                });
            });
        } else if (response.error) {
            chatBoxNumbers.forEach(number => {
                displayMessage(number, 'System', `Failed to get context: ${response.error}`, new Date().toLocaleTimeString());
            });
        }
    } catch (error) {
        console.error('Error fetching context:', error);
        chatBoxNumbers.forEach(number => {
            displayMessage(number, 'System', 'Error contacting the server.', new Date().toLocaleTimeString());
        });
    } finally {
        // Hide spinner for selected chatboxes
        chatBoxNumbers.forEach(number => {
            hideSpinner(number);
        });
    }
}

/**
 * Sends a request to the server to get context for the specified chat boxes.
 *
 * @param {number[]} chatBoxNumbers - Array of chat box numbers to get context for.
 * @returns {Promise<object>} - The server response.
 * @throws {Error} - Throws an error if the request fails.
 */
async function sendGetContextRequest(chatBoxNumbers) {
    const response = await fetch('/get-context', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatBoxNumbers: chatBoxNumbers }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch context.');
    }

    return await response.json();
}

/**
 * Handles the submission of a question in a specific chat box.
 *
 * @param {number} chatBoxNumber - The number of the chat box.
 * @param {Event} [event=null] - The event triggering the submission.
 */
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
        controllers[chatBoxNumber] = new AbortController();
        const signal = controllers[chatBoxNumber].signal;

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
            delete controllers[chatBoxNumber];
        }

        questionInput.value = '';
        questionInput.focus();
    } else {
        displayMessage(chatBoxNumber, 'System', 'Please enter a question.', new Date().toLocaleTimeString());
    }
}

/**
 * Stops an ongoing request in a specific chat box.
 *
 * @param {number} chatBoxNumber - The number of the chat box.
 */
function stopRequest(chatBoxNumber) {
    const controller = controllers[chatBoxNumber];
    if (controller) controller.abort();
}

// Initialize handlers on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    setupDropdownHandlers();
});
