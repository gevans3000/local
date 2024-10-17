// api.js

async function sendQuestion(question) {
    try {
        const response = await fetch('/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question: question }),
            signal: controller ? controller.signal : undefined
        });
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}