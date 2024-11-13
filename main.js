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

    const msgCountInput = document.querySelector(`#chatBox${chatBoxNumber} .msg-count-input`);
    let msgCount = 10; // Default value
    if (msgCountInput) {
        const value = parseInt(msgCountInput.value, 10);
        if (!isNaN(value) && value >= 1 && value <= 99) {
            msgCount = value;
        }
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

    // Maintain only the last N messages
    const allMessages = messagesContainer.querySelectorAll('.message');
    if (allMessages.length > msgCount) {
        for (let i = msgCount; i < allMessages.length; i++) {
            messagesContainer.removeChild(allMessages[i]);
        }
    }
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
 *
 * @param {number} chatBoxNumber - The number of the chat box.
 */
async function getContext(chatBoxNumber) {
    const chatBox = document.getElementById(`chatBox${chatBoxNumber}`);
    if (!chatBox) {
        console.error(`ChatBox with ID chatBox${chatBoxNumber} not found.`);
        return;
    }

    const dropdownContent = chatBox.querySelector('.dropdown-content');
    if (!dropdownContent) {
        console.error(`Dropdown content for chatBox${chatBoxNumber} not found.`);
        return;
    }

    // Get all selected chatboxes
    const selectedChatBoxes = Array.from(dropdownContent.querySelectorAll('input.selectChatBox:checked'))
        .map(cb => parseInt(cb.dataset.chatbox, 10))
        .filter(num => !isNaN(num));

    if (selectedChatBoxes.length === 0) {
        alert('Please select at least one chatbox to get context.');
        return;
    }

    // Get Msg Count value
    const msgCountInput = chatBox.querySelector('.msg-count-input');
    let msgCount = 10; // Default value
    if (msgCountInput) {
        const value = parseInt(msgCountInput.value, 10);
        if (!isNaN(value) && value >= 1 && value <= 99) {
            msgCount = value;
        }
    }

    // Show spinner
    showSpinner(chatBoxNumber);

    try {
        const contextData = await fetchContext(selectedChatBoxes);
        if (!Array.isArray(contextData.context)) {
            throw new Error('Invalid context data received.');
        }

        // Sort messages by timestamp ascending
        contextData.context.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Slice to last N messages
        const limitedContext = contextData.context.slice(-msgCount);

        // Clear current messages
        const messagesContainer = chatBox.querySelector('.messages');
        messagesContainer.innerHTML = '';

        // Populate messages from limited context
        limitedContext.forEach(message => {
            displayMessage(
                chatBoxNumber,
                message.user,
                message.message,
                message.timestamp,
                message.tokens,
                isMarkdownUser(message.user)
            );
        });
    } catch (error) {
        console.error('Error fetching context:', error);
        displayMessage(chatBoxNumber, 'System', 'Failed to retrieve context.', new Date().toLocaleTimeString());
    } finally {
        // Hide spinner
        hideSpinner(chatBoxNumber);
    }
}

/**
 * Determines if the user is using Markdown based on their identifier.
 *
 * @param {string} user - The user identifier.
 * @returns {boolean} - True if Markdown should be used, else false.
 */
function isMarkdownUser(user) {
    return user.startsWith('gpt-') || user.startsWith('nvidia/') || user.startsWith('meta/');
}

/**
 * Fetches context data from the server for the specified chatboxes.
 *
 * @param {number[]} chatBoxNumbers - Array of chatbox numbers to fetch context from.
 * @returns {Promise<object>} - The context data from the server.
 * @throws {Error} - Throws an error if the request fails.
 */
async function fetchContext(chatBoxNumbers) {
    try {
        const response = await fetch('/get-context', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chatBoxNumbers }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch context.');
        }

        const data = await response.json();
        if (!data || !Array.isArray(data.context)) {
            throw new Error('Invalid context data format.');
        }

        return data;
    } catch (error) {
        throw error;
    }
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
            if (systemPrompts[chatBoxNumber]) {
                context.push({ user: `System`, message: systemPrompts[chatBoxNumber] });
            }

            // Get Msg Count value
            const chatBox = document.getElementById(`chatBox${chatBoxNumber}`);
            const msgCountInput = chatBox.querySelector('.msg-count-input');
            let msgCount = 10; // Default value
            if (msgCountInput) {
                const value = parseInt(msgCountInput.value, 10);
                if (!isNaN(value) && value >= 1 && value <= 99) {
                    msgCount = value;
                }
            }

            // Fetch context from selected chatboxes
            const dropdownContent = chatBox.querySelector('.dropdown-content');
            const selectedChatBoxes = Array.from(dropdownContent.querySelectorAll('input.selectChatBox:checked'))
                .map(cb => parseInt(cb.dataset.chatbox, 10))
                .filter(num => !isNaN(num));

            if (selectedChatBoxes.length > 0) {
                const contextData = await fetchContext(selectedChatBoxes);
                if (Array.isArray(contextData.context)) {
                    // Sort messages by timestamp ascending
                    contextData.context.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                    // Slice to last N messages
                    const limitedContext = contextData.context.slice(-msgCount);

                    limitedContext.forEach(msg => {
                        if (msg.user.startsWith('You')) {
                            context.push({ user: msg.user, message: msg.message });
                        } else if (msg.user === 'System') {
                            context.push({ user: 'System', message: msg.message });
                        } else {
                            context.push({ user: msg.user, message: msg.message });
                        }
                    });
                }
            }

            // Include system prompt in context if not already included
            if (systemPrompts[chatBoxNumber] && !context.some(msg => msg.user === 'System')) {
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

/**
 * Initializes the UI by setting up necessary event listeners and configurations.
 */
function initializeUI() {
    // Setup dropdown functionality for each chat box
    document.querySelectorAll('.chat-box').forEach(chatBox => {
        const dropdownButton = chatBox.querySelector('.dropdown-button');
        const dropdownContent = chatBox.querySelector('.dropdown-content');

        if (dropdownButton && dropdownContent) {
            // Toggle dropdown visibility on button click
            dropdownButton.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent the event from bubbling up to the window
                const isVisible = dropdownContent.classList.contains('show');
                // Toggle the 'show' class
                dropdownContent.classList.toggle('show', !isVisible);
            });

            // Prevent clicks inside the dropdown from closing it
            dropdownContent.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        }

        // Handle "Get Context" button functionality
        const getContextButton = chatBox.querySelector('.get-context-button');
        if (getContextButton) {
            getContextButton.addEventListener('click', () => {
                const chatBoxNumber = getChatBoxNumber(chatBox);
                if (chatBoxNumber !== null) {
                    getContext(chatBoxNumber);
                } else {
                    console.error('Unable to determine chatBoxNumber.');
                }
            });
        }

        // Add "Msg Count" input box
        addMsgCountInput(chatBox);
    });

    // Close all dropdowns when clicking outside
    window.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-content.show').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    });

    // Setup dropdown checkbox handlers
    setupDropdownHandlers();
}

/**
 * Adds a "Msg Count" input box to the dropdown content of a chat box.
 *
 * @param {HTMLElement} chatBox - The chat box element.
 */
function addMsgCountInput(chatBox) {
    const dropdownContent = chatBox.querySelector('.dropdown-content');
    if (!dropdownContent) {
        console.error('Dropdown content not found for chat box.');
        return;
    }

    // Create the container for Msg Count
    const msgCountContainer = document.createElement('div');
    msgCountContainer.classList.add('msg-count-container');
    msgCountContainer.style.marginTop = '10px';

    // Create the label
    const msgCountLabel = document.createElement('label');
    msgCountLabel.textContent = 'Msg Count: ';
    msgCountLabel.setAttribute('for', `msgCount${getChatBoxNumber(chatBox)}`);

    // Create the input
    const msgCountInput = document.createElement('input');
    msgCountInput.type = 'number';
    msgCountInput.id = `msgCount${getChatBoxNumber(chatBox)}`;
    msgCountInput.classList.add('msg-count-input');
    msgCountInput.min = '1';
    msgCountInput.max = '99';
    msgCountInput.value = '10';
    msgCountInput.style.width = '50px';
    msgCountInput.style.marginLeft = '5px';

    // Add event listener to handle changes
    msgCountInput.addEventListener('change', () => {
        let value = parseInt(msgCountInput.value, 10);
        if (isNaN(value) || value < 1) {
            value = 1;
        } else if (value > 99) {
            value = 99;
        }
        msgCountInput.value = value;
        updateMessageDisplay(getChatBoxNumber(chatBox));
    });

    // Append elements
    msgCountLabel.appendChild(msgCountInput);
    msgCountContainer.appendChild(msgCountLabel);
    dropdownContent.appendChild(msgCountContainer);
}

/**
 * Updates the message display based on the Msg Count value.
 *
 * @param {number} chatBoxNumber - The number of the chat box.
 */
function updateMessageDisplay(chatBoxNumber) {
    const chatBox = document.getElementById(`chatBox${chatBoxNumber}`);
    if (!chatBox) {
        console.error(`ChatBox with ID chatBox${chatBoxNumber} not found.`);
        return;
    }

    const messagesContainer = chatBox.querySelector('.messages');
    const msgCountInput = chatBox.querySelector('.msg-count-input');
    let msgCount = 10; // Default value
    if (msgCountInput) {
        const value = parseInt(msgCountInput.value, 10);
        if (!isNaN(value) && value >= 1 && value <= 99) {
            msgCount = value;
        }
    }

    const allMessages = messagesContainer.querySelectorAll('.message');
    if (allMessages.length > msgCount) {
        for (let i = msgCount; i < allMessages.length; i++) {
            allMessages[i].style.display = 'none';
        }
    }

    // Show the last N messages
    for (let i = 0; i < allMessages.length; i++) {
        if (i < msgCount) {
            allMessages[i].style.display = 'block';
        }
    }
}

/**
 * Retrieves the chatbox number from the chatbox element.
 *
 * @param {HTMLElement} chatBox - The chatbox element.
 * @returns {number|null} - The chatbox number.
 */
function getChatBoxNumber(chatBox) {
    const id = chatBox.id;
    const match = id.match(/chatBox(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Closes an ongoing request in a specific chat box.
 *
 * @param {number} chatBoxNumber - The number of the chat box.
 */
function stopRequest(chatBoxNumber) {
    const controller = controllers[chatBoxNumber];
    if (controller) controller.abort();
}

/**
 * Global error handling middleware
 */
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
});

/**
 * Starts the initialization of the UI.
 */
document.addEventListener('DOMContentLoaded', initializeUI);
