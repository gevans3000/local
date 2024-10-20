// api.js

async function sendQuestion(question, model) {
    try {
        const response = await fetch('/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question: question, model: model }),
        });
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}
