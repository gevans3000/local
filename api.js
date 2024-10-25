// api.js

const API_ENDPOINT = '/ask';

/**
 * Sends a question to the server and returns the response data.
 *
 * @param {string} question - The question to send.
 * @param {string} model - The model to use for the response.
 * @param {object} [additionalHeaders={}] - Optional additional headers.
 * @returns {Promise<object>} - The response data from the server.
 * @throws {Error} - Throws an error if the request fails.
 */
async function sendQuestion(question, model, additionalHeaders = {}) {
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...additionalHeaders,
            },
            body: JSON.stringify({ question, model }),
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
