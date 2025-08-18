import dotenv from "dotenv";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

// Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Track blocked state
let isBlocked = false;

/* ---------- Serve Static HTML Pages ---------- */
app.use(express.static(path.join(__dirname, ".."))); // serve style.css, script.js, etc.

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "about.html"));
});

app.get("/contact", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "contact.html"));
});

app.get("/chatbot", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "chatbot.html"));
});


/* ---------- Chatbot API ---------- */
app.post("/api/chat", async (req, res) => {
  const { question } = req.body;
  const lowerQ = question.toLowerCase();

  const abusiveWords = ["idiot", "stupid", "dumb", "nonsense", "fool"];

  // If blocked
  if (isBlocked) {
    if (lowerQ.includes("sorry")) {
      isBlocked = false;
      return res.json({
        answer: "✅ Thank you for apologizing. How can I help with your travel plans? ✈️"
      });
    }
    return res.json({
      answer: "⛔ I won't respond until you apologize by saying 'sorry'."
    });
  }

  // Detect abusive words
  if (abusiveWords.some(word => lowerQ.includes(word))) {
    isBlocked = true;
    return res.json({
      answer: "⛔ That language is not acceptable. Say 'sorry' to continue."
    });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
You are a friendly, expert travel guide chatbot.
You must ONLY answer questions related to travel (trips, destinations, itineraries, hotels, flights, food, sightseeing, budgets, tips, etc.).
If the question is NOT about travel, respond exactly with:
"❌ I can only help with travel-related queries. ✈️"

When the question IS about travel:
- Always provide a complete, structured, day-by-day itinerary without asking for more details.
- Include attractions, food recommendations, budget estimates, and tips.
- Minimum 3 days plan if duration is not specified.
- Use bullet points and clear headings.

User's question: "${question}"
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();

    res.json({ answer: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ answer: "Error occurred while generating response." });
  }
});

/* ---------- Start Server ---------- */
app.listen(3000, () => console.log("🚀 Server running on http://localhost:3000"));
