// ui.js

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
 * Initializes dropdown handlers for chat box selection.
 */
function setupDropdownHandlers() {
    const dropdownContainers = document.querySelectorAll('.dropdown-container');

    dropdownContainers.forEach(dropdown => {
        const dropdownButton = dropdown.querySelector('.dropdown-button');
        const dropdownContent = dropdown.querySelector('.dropdown-content');

        // Toggle dropdown visibility on button click
        dropdownButton.addEventListener('click', (event) => {
            event.stopPropagation();
            dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
        });

        // Close dropdown when clicking outside
        window.addEventListener('click', (event) => {
            if (!dropdown.contains(event.target)) {
                dropdownContent.style.display = 'none';
            }
        });

        const selectAllCheckbox = dropdownContent.querySelector('.selectAllChatBoxes');
        const chatBoxCheckboxes = dropdownContent.querySelectorAll('.selectChatBox');

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
                const allChecked = Array.from(chatBoxCheckboxes).every(cb => cb.checked);
                selectAllCheckbox.checked = allChecked;
            });
        });
    });
}

// Attach functions to the global window object for accessibility
window.displayMessage = displayMessage;
window.setElementVisibility = setElementVisibility;
window.showSpinner = showSpinner;
window.hideSpinner = hideSpinner;
window.showStopButton = showStopButton;
window.hideStopButton = hideStopButton;
window.setupDropdownHandlers = setupDropdownHandlers;
