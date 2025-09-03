import dotenv from "dotenv";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2";
import bcrypt from "bcrypt";
import session from "express-session";

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- PATHS ----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- MYSQL CONNECTION ----------------
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "user_auth",
  port: process.env.DB_PORT || 3306,
});

db.connect((err) => {
  if (err) console.error("❌ MySQL connection failed:", err);
  else console.log("✅ Connected to MySQL Database");
});

// ---------------- SESSION ----------------
app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // true if using https
  })
);

// ---------------- GEMINI API ----------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ---------------- SERVE FRONTEND ----------------
app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.static(path.join(__dirname, "..", "frontend", "public")));

// ---------------- HTML ROUTES ----------------
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "..", "frontend", "public", "index.html"))
);
app.get("/about", (req, res) =>
  res.sendFile(path.join(__dirname, "..", "frontend", "public", "about.html"))
);
app.get("/contact", (req, res) =>
  res.sendFile(path.join(__dirname, "..", "frontend", "public", "contact.html"))
);
app.get("/chatbot", (req, res) =>
  res.sendFile(path.join(__dirname, "..", "frontend", "public", "chatbot.html"))
);
app.get("/auth", (req, res) =>
  res.sendFile(path.join(__dirname, "..", "frontend", "public", "auth.html"))
);
app.get("/logout", (req, res) =>
  res.sendFile(path.join(__dirname, "..", "frontend", "public", "logout.html"))
);

// ---------------- AUTH ROUTES ----------------

// SIGNUP
app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword],
      (err, result) => {
        if (err) {
          console.error("❌ Insert Error:", err);
          return res.status(500).json({ message: "Error creating user" });
        }
        res.json({ message: "✅ User registered successfully!" });
      }
    );
  } catch (err) {
    console.error("❌ Hashing Error:", err);
    res.status(500).json({ message: "Error hashing password" });
  }
});

// LOGIN
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0) return res.status(400).json({ message: "❌ User not found" });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "❌ Invalid credentials" });

    req.session.user = { id: user.id, username: user.username, email: user.email };
    res.json({ message: "✅ Login successful!", user: req.session.user });
  });
});

// LOGOUT
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("❌ Error destroying session:", err);
      return res.status(500).json({ success: false, message: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.json({ success: true, message: "✅ Logged out successfully" });
  });
});

// ---------------- CHATBOT ROUTE ----------------
app.post("/chat", async (req, res) => {
  try {
    if (!req.session.user) {
      return res
        .status(401)
        .json({ success: false, reply: "Please login to use chatbot." });
    }

    const { message } = req.body;
    const lowerMsg = message.toLowerCase();

    // ✅ Handle "thank you" messages politely
    if (lowerMsg.includes("thank you") || lowerMsg.includes("thanks") || lowerMsg.includes("thx")) {
      return res.json({
        success: true,
        reply: "You're most welcome! 😊 Glad I could help with your trip.",
      });
    }

    // ✅ Restrict to only trip-related queries
    const allowedTopics = ["trip", "travel", "hotel", "car", "weather", "hello", "hi", "hey"];
    const isAllowed = allowedTopics.some((topic) => lowerMsg.includes(topic));

    if (!isAllowed) {
      return res.json({
        success: true,
        reply: "❌ I can only help with trips, travel, hotels, cars, weather, and greetings.",
      });
    }

    const prompt = `You are a helpful travel assistant. Only answer questions related to trips, travel, hotels, cars, or greetings.
User: ${message}
Assistant:`;

    const result = await model.generateContent(prompt);
    const reply = result.response.text();

    res.json({ success: true, reply });
  } catch (error) {
    console.error("❌ Chatbot error:", error);
    res.status(500).json({
      success: false,
      reply: "⚠️ Couldn’t reach server. Check backend logs for details.",
    });
  }
});

// ---------------- START SERVER ----------------
app.listen(3000, () => console.log("🚀 Server running on http://localhost:3000"));
