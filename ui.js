// ui.js

/**
 * Toggles the visibility of the system prompt text area for a specific chat box.
 *
 * @param {number} chatBoxNumber - The number of the chat box.
 */
function toggleSystemPrompt(chatBoxNumber) {
    const container = document.getElementById(`systemPromptContainer${chatBoxNumber}`);
    if (container) {
        container.classList.toggle('visible');
    }
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

    // Hide all system prompt containers initially
    document.querySelectorAll('.system-prompt-container').forEach(container => {
        container.classList.remove('visible');
    });
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

    // Check if msg count input already exists
    const existingMsgCount = dropdownContent.querySelector('.msg-count-container');
    if (existingMsgCount) {
        // Msg count input already exists, no need to add another one
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

    // Append elements in the correct order
    msgCountContainer.appendChild(msgCountLabel);
    msgCountContainer.appendChild(msgCountInput);
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

// Initialize UI on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initializeUI);
