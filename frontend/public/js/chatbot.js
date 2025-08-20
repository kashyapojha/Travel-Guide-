const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  // Show user message
  const userDiv = document.createElement('div');
  userDiv.className = 'user-message';
  userDiv.innerText = message;
  chatBox.appendChild(userDiv);

  try {
    const res = await fetch("/api/chat", {   // ✅ FIXED ENDPOINT
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: message })   // ✅ server expects {question}
    });

    const data = await res.json();

    const botDiv = document.createElement('div');
    botDiv.className = 'bot-message';
    botDiv.innerText = data.answer;
    chatBox.appendChild(botDiv);
  } catch (err) {
    console.error(err);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'bot-message';
    errorDiv.innerText = "❌ Error connecting to chatbot.";
    chatBox.appendChild(errorDiv);
  }

  userInput.value = '';
  chatBox.scrollTop = chatBox.scrollHeight;
}
