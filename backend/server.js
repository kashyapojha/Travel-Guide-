import dotenv from "dotenv";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2";
import bcrypt from "bcrypt"; // for password hashing

const app = express();
app.use(cors());
app.use(express.json());

// Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- MySQL Connection ----------
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

db.connect(err => {
  if (err) {
    console.error("❌ MySQL connection failed:", err);
  } else {
    console.log("✅ Connected to MySQL Database");
  }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Track blocked state
let isBlocked = false;

/* ---------- Serve Static Frontend ---------- */
// Serve CSS, JS, Images, etc.
app.use(express.static(path.join(__dirname, "../frontend")));

/* ---------- Serve Static HTML Pages ---------- */
// Serve CSS, JS, images from public folder
app.use(express.static(path.join(__dirname, "..", "frontend", "public")));

// HTML Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "public", "index.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "public", "about.html"));
});

app.get("/contact", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "public", "contact.html"));
});

app.get("/chatbot", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "public", "chatbot.html"));
});

/* ---------- Signup API ---------- */
app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
    [username, email, hashedPassword],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Error creating user" });
      }
      res.json({ message: "✅ User registered successfully!" });
    }
  );
});

/* ---------- Login API ---------- */
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }
    if (results.length === 0) {
      return res.status(400).json({ message: "❌ User not found" });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "❌ Invalid credentials" });
    }

    res.json({ message: "✅ Login successful!" });
  });
});

/* ---------- Chatbot API ---------- */
app.post("/api/chat", async (req, res) => {
  const { question } = req.body;
  const lowerQ = question.toLowerCase();

  const abusiveWords = ["idiot", "stupid", "dumb", "nonsense", "fool"];

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
You must ONLY answer questions related to travel.
If not travel related: respond with "❌ I can only help with travel-related queries. ✈️"

When travel related:
- Provide structured, day-by-day itinerary
- Attractions, food, budget, tips
- Minimum 3 days if duration not mentioned
- Use bullet points & headings

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
