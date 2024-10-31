// api.js

const DEFAULT_API_ENDPOINT = '/ask';
const DEFAULT_CONTEXT_ENDPOINT = '/get-context';

/**
 * Configuration for API endpoints.
 * These can be overridden by environment variables if needed.
 */
const config = {
    API_ENDPOINT: DEFAULT_API_ENDPOINT,
    CONTEXT_ENDPOINT: DEFAULT_CONTEXT_ENDPOINT,
};

/**
 * Sets the API endpoints dynamically.
 *
 * @param {object} endpoints - An object containing API_ENDPOINT and/or CONTEXT_ENDPOINT.
 */
function setApiEndpoints(endpoints) {
    if (endpoints.API_ENDPOINT) {
        config.API_ENDPOINT = endpoints.API_ENDPOINT;
    }
    if (endpoints.CONTEXT_ENDPOINT) {
        config.CONTEXT_ENDPOINT = endpoints.CONTEXT_ENDPOINT;
    }
}

/**
 * Sends a question to the server and returns the response data.
 *
 * @param {string} question - The question to send.
 * @param {string} model - The model to use for the response.
 * @param {number} chatBoxNumber - The identifier for the chat box.
 * @param {Array} context - The context history for the chat.
 * @param {object} [additionalHeaders={}] - Optional additional headers.
 * @returns {Promise<object>} - The response data from the server.
 * @throws {Error} - Throws an error if the request fails.
 */
async function sendQuestion(question, model, chatBoxNumber, context, additionalHeaders = {}) {
    try {
        const response = await fetch(config.API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...additionalHeaders,
            },
            body: JSON.stringify({ 
                question, 
                model, 
                chatBoxNumber, 
                context 
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send question.');
        }

        return await response.json();
    } catch (error) {
        console.error(`sendQuestion failed: ${error.message}`);
        throw error;
    }
}

/**
 * Retrieves the context for specified chat boxes from the server.
 *
 * @param {number[]} chatBoxNumbers - Array of chat box numbers to retrieve context for.
 * @param {object} [additionalHeaders={}] - Optional additional headers.
 * @returns {Promise<object>} - The context data from the server.
 * @throws {Error} - Throws an error if the request fails.
 */
async function getContext(chatBoxNumbers, additionalHeaders = {}) {
    try {
        const response = await fetch(config.CONTEXT_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...additionalHeaders,
            },
            body: JSON.stringify({ chatBoxNumbers }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to retrieve context.');
        }

        return await response.json();
    } catch (error) {
        console.error(`getContext failed: ${error.message}`);
        throw error;
    }
}

// Attach functions to the global window object for accessibility
window.sendQuestion = sendQuestion;
window.getContext = getContext;
window.setApiEndpoints = setApiEndpoints;
