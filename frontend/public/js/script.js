const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

const abusiveWords = ["badword1", "badword2", "stupid", "idiot"];
const greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"];

let isSilentMode = false;

function containsAbuse(msg) {
    return abusiveWords.some(w => msg.toLowerCase().includes(w));
}

function isApology(msg) {
    return msg.toLowerCase().includes("sorry");
}

function isGreeting(msg) {
    const lower = msg.toLowerCase().trim();
    return greetings.some(greet => lower === greet || lower.startsWith(greet + " "));
}

// Format AI response for better display
function formatBotReply(text) {
    let formatted = text;

    // Convert **bold** to <strong>
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Convert headings like ## Day 1 into <h3> with emojis
    formatted = formatted.replace(/^##\s*(Day\s*\d+)/gim, "🌟 <h3>$1</h3>");
    formatted = formatted.replace(/^###\s*(.*)/gim, "📍 <h4>$1</h4>");

    // Convert bullet points into HTML lists
    formatted = formatted.replace(/^- (.*)/gim, "<li>$1</li>");
    if (formatted.includes("<li>")) {
        formatted = formatted.replace(/(<li>[\s\S]*?<\/li>)/gim, "<ul>$1</ul>");
    }

    // Add travel-related emojis to common words
    formatted = formatted.replace(/\bhotel\b/gi, "🏨 hotel");
    formatted = formatted.replace(/\brestaurant\b/gi, "🍽️ restaurant");
    formatted = formatted.replace(/\bfood\b/gi, "🍲 food");
    formatted = formatted.replace(/\btips?\b/gi, "💡 tips");

    return formatted;
}

function addMessage(msg, sender) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("message-wrapper", sender);

    const avatar = document.createElement("div");
    avatar.classList.add("avatar");
    avatar.style.backgroundImage = sender === "user"
        ? "url('https://i.ibb.co/6bQ3wLb/user.png')"
        : "url('https://i.ibb.co/3M0zj3P/bot.png')";

    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message");

    if (sender === "bot") {
        messageDiv.innerHTML = msg;
    } else {
        messageDiv.innerText = msg;
    }

    if (sender === "user") {
        wrapper.appendChild(messageDiv);
        wrapper.appendChild(avatar);
    } else {
        wrapper.appendChild(avatar);
        wrapper.appendChild(messageDiv);
    }

    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function showTyping() {
    const typingDiv = document.createElement("div");
    typingDiv.classList.add("typing");
    typingDiv.innerText = "Bot is typing...";
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return typingDiv;
}

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;
    addMessage(message, "user");
    userInput.value = "";

    const typingIndicator = showTyping();

    setTimeout(async () => {
        typingIndicator.remove();
        let botReply = "";

        // Handle silent mode
        if (isSilentMode) {
            if (isApology(message)) {
                botReply = "<p>✅ Thank you for apologizing. How can I help with your travel plans? ✈️</p>";
                isSilentMode = false;
            } else {
                botReply = "<p>⛔ I won't respond until you apologize by saying 'sorry'.</p>";
            }
            addMessage(botReply, "bot");
            return;
        }

        // Abusive words detection
        if (containsAbuse(message)) {
            botReply = "<p>⛔ That language is not acceptable. Say 'sorry' to continue.</p>";
            isSilentMode = true;
            addMessage(botReply, "bot");
            return;
        }

        // Greeting detection
        if (isGreeting(message)) {
            botReply = "<p>👋 Hello! How can I help you plan your next trip today?</p>";
            addMessage(botReply, "bot");
            return;
        }

        // Call backend
        try {
            const response = await fetch("http://localhost:3000/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: message }) // match backend param
            });

            const data = await response.json();
            botReply = data.answer || "❌ I can only help with travel-related queries. ✈️";

            // Format the bot reply for display
            botReply = formatBotReply(botReply);

        } catch (error) {
            console.error(error);
            botReply = "<p>⚠️ Oops! There was an error connecting to the server.</p>";
        }

        addMessage(botReply, "bot");
    }, 500);
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
});
