const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

const abusiveWords = ["idiot", "stupid", "dumb", "fool"];
const greetings = ["hi", "hello", "hey", "good morning", "good evening"];

let isSilentMode = false;

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
  messageDiv.innerHTML = msg;

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

function formatReply(text) {
  if (!text) return "";
  let formatted = text;

  formatted = formatted.replace(/\n/g, "<br>");
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/^##\s*(Day\s*\d+)/gim, "🌟 <h3>$1</h3>");
  formatted = formatted.replace(/^###\s*(.*)/gim, "📍 <h4>$1</h4>");
  formatted = formatted.replace(/^- (.*)/gim, "<li>$1</li>");
  if (formatted.includes("<li>")) {
    formatted = formatted.replace(/(<li>[\s\S]*?<\/li>)/gim, "<ul>$1</ul>");
  }

  return formatted;
}

async function fetchHotels(city) {
  try {
    const res = await fetch(`/api/hotels/${encodeURIComponent(city)}`);
    const data = await res.json();
    if (!data || !data.length) return "🏨 No hotels found or API limit reached.";
    let text = "🏨 Top hotels:<br>";
    data.slice(0, 5).forEach((hotel, i) => {
      text += `${i + 1}. ${hotel.hotel_name || hotel.name} - ${hotel.address || ""}<br>`;
    });
    return text;
  } catch (err) {
    console.error("Hotels fetch error:", err);
    return "🏨 Error fetching hotels.";
  }
}

async function fetchCars(city) {
  try {
    // You can hardcode Jaipur/Udaipur lat-lng or fetch dynamically
    const coords = {
      Jaipur: { lat: 26.9124, lng: 75.7873 },
      Udaipur: { lat: 24.5854, lng: 73.7125 }
    };
    const { lat, lng } = coords[city] || coords["Jaipur"];
    const res = await fetch(`/api/cars?pickUpLat=${lat}&pickUpLng=${lng}&dropOffLat=${lat}&dropOffLng=${lng}&pickUpTime=10:00&dropOffTime=10:00&driverAge=30`);
    const data = await res.json();
    if (!data || !data.length) return "🚗 No cars found or API limit reached.";
    let text = "🚗 Top car rentals:<br>";
    data.slice(0, 5).forEach((car, i) => {
      text += `${i + 1}. ${car.car_name || car.model || "Car"} - ${car.company || ""}<br>`;
    });
    return text;
  } catch (err) {
    console.error("Cars fetch error:", err);
    return "🚗 Error fetching cars.";
  }
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

    if (isSilentMode) {
      if (message.toLowerCase().includes("sorry")) {
        botReply = "✅ Thanks for apologizing! How can I help with your travel plans? ✈️";
        isSilentMode = false;
      } else {
        botReply = "⛔ I won’t respond until you apologize by saying 'sorry'.";
      }
      addMessage(botReply, "bot");
      return;
    }

    if (abusiveWords.some(w => message.toLowerCase().includes(w))) {
      isSilentMode = true;
      addMessage("⛔ That language is not acceptable. Say 'sorry' to continue.", "bot");
      return;
    }

    if (greetings.includes(message.toLowerCase())) {
      addMessage("👋 Hello traveler! How can I assist with your next trip?", "bot");
      return;
    }

    // --- Check for hotels/cars keywords ---
    if (/hotels?/i.test(message)) {
      const cityMatch = message.match(/hotels? in ([a-zA-Z\s]+)/i);
      const city = cityMatch ? cityMatch[1].trim() : "Jaipur";
      botReply = await fetchHotels(city);
      addMessage(botReply, "bot");
      return;
    }

    if (/cars?|rentals?/i.test(message)) {
      const cityMatch = message.match(/in ([a-zA-Z\s]+)/i);
      const city = cityMatch ? cityMatch[1].trim() : "Jaipur";
      botReply = await fetchCars(city);
      addMessage(botReply, "bot");
      return;
    }

    // --- Travel queries via /api/chat ---
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: message })
      });
      const data = await res.json();
      botReply = formatReply(data.answer || data.message || "❌ I can only help with travel-related queries. ✈️");
    } catch (err) {
      console.error(err);
      botReply = "⚠️ Oops! Couldn’t reach server.";
    }

    addMessage(botReply, "bot");
  }, 500);
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });

// Auto-greeting when page loads
window.onload = () => {
  addMessage("👋 Hello! I'm your Travel Guide Bot. Ask me anything about travel, weather, hotels, or cars!", "bot");
};
