// ui.js

/**
 * Displays a message in the specified chat box.
 *
 * @param {number} chatBoxNumber - The number of the chat box.
 * @param {string} user - The user identifier ('You1', 'gpt-4o-mini', etc.).
 * @param {string} content - The message content.
 * @param {string} timestamp - The timestamp of the message.
 * @param {number} [tokens=null] - The number of tokens used (optional).
 * @param {boolean} [isMarkdown=false] - Whether the message content is Markdown.
 */
function displayMessage(chatBoxNumber, user, content, timestamp, tokens = null, isMarkdown = false) {
    const chatBox = document.getElementById(`chatBox${chatBoxNumber}`);
    if (!chatBox) {
        console.error(`ChatBox with ID chatBox${chatBoxNumber} not found.`);
        return;
    }

    const messagesContainer = chatBox.querySelector('.messages');
    if (!messagesContainer) {
        console.error(`Messages container for chatBox${chatBoxNumber} not found.`);
        return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', getMessageClass(user));

    const userElement = document.createElement('strong');
    userElement.textContent = `${user}:`;
    messageDiv.appendChild(userElement);

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

    if (timestamp || tokens) {
        const infoSpan = document.createElement('span');
        infoSpan.className = 'message-info';
        let infoText = '';
        if (timestamp) {
            infoText += `(${timestamp})`;
        }
        if (tokens) {
            infoText += ` [Tokens: ${tokens}]`;
        }
        infoSpan.textContent = infoText;
        messageDiv.appendChild(infoSpan);
    }

    // Insert the message at the top of the messages container
    messagesContainer.insertBefore(messageDiv, messagesContainer.firstChild);

    // Optionally, scroll to the latest message
    messagesContainer.scrollTop = 0;
}

/**
 * Determines the CSS class based on the user type.
 *
 * @param {string} user - The user identifier.
 * @returns {string} - The corresponding CSS class.
 */
function getMessageClass(user) {
    if (user === 'System') {
        return 'system-message';
    }
    return user.startsWith('You') ? 'user-message' : 'assistant-message';
}

/**
 * Sets the visibility of an element by its ID.
 *
 * @param {string} elementId - The ID of the element.
 * @param {boolean} visible - Whether the element should be visible.
 */
function setElementVisibility(elementId, visible) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.toggle('hidden', !visible);
    } else {
        console.warn(`Element with ID ${elementId} not found.`);
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
                    handleGetContext(chatBoxNumber);
                } else {
                    console.error('Unable to determine chatBoxNumber.');
                }
            });
        }
    });

    // Close all dropdowns when clicking outside
    window.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-content.show').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    });
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
 * Handles the "Get Context" button click event for a specific chatbox.
 *
 * @param {number} chatBoxNumber - The number of the chat box.
 */
function handleGetContext(chatBoxNumber) {
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

    // Show spinner
    showSpinner(chatBoxNumber);

    // Fetch context from selected chatboxes
    fetchContext(selectedChatBoxes)
        .then(contextData => {
            if (!Array.isArray(contextData)) {
                throw new Error('Invalid context data received.');
            }

            // Clear current messages
            const messagesContainer = chatBox.querySelector('.messages');
            messagesContainer.innerHTML = '';

            // Populate messages from selected chatboxes
            contextData.forEach(message => {
                displayMessage(
                    chatBoxNumber,
                    message.user,
                    message.message,
                    message.timestamp,
                    message.tokens,
                    isMarkdownUser(message.user)
                );
            });
        })
        .catch(error => {
            console.error('Error fetching context:', error);
            displayMessage(chatBoxNumber, 'System', 'Failed to retrieve context.', new Date().toLocaleTimeString());
        })
        .finally(() => {
            // Hide spinner
            hideSpinner(chatBoxNumber);
        });
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
 * @returns {Promise<Array>} - Promise resolving to an array of message objects.
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

        return data.context;
    } catch (error) {
        throw error;
    }
}

// Initialize UI on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initializeUI);
