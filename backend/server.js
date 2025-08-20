import dotenv from "dotenv";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2";
import bcrypt from "bcrypt";
import fetch from "node-fetch";

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
  if (err) console.error("❌ MySQL connection failed:", err);
  else console.log("✅ Connected to MySQL Database");
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const API_KEY = process.env.WEATHER_API_KEY;

// Track blocked state
let isBlocked = false;

/* ---------- Serve Static Frontend ---------- */
app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.static(path.join(__dirname, "..", "frontend", "public")));

/* ---------- HTML Routes ---------- */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "public", "index.html")));
app.get("/about", (req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "public", "about.html")));
app.get("/contact", (req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "public", "contact.html")));
app.get("/chatbot", (req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "public", "chatbot.html")));

/* ---------- Signup API ---------- */
app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ message: "All fields are required" });

  const hashedPassword = await bcrypt.hash(password, 10);
  db.query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, hashedPassword], (err) => {
    if (err) return res.status(500).json({ message: "Error creating user" });
    res.json({ message: "✅ User registered successfully!" });
  });
});

/* ---------- Login API ---------- */
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0) return res.status(400).json({ message: "❌ User not found" });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "❌ Invalid credentials" });

    res.json({ message: "✅ Login successful!" });
  });
});

/* ---------- Weather API (Next 3 Days) ---------- */
app.get("/api/weather/:city", async (req, res) => {
  const { city } = req.params;

  try {
    // 1. Geocode the city
    const geoRes = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${API_KEY}`);
    const geoData = await geoRes.json();

    if (!geoData || !geoData[0]) return res.status(404).json({ message: "City not found" });

    const { lat, lon } = geoData[0];

    // 2. Fetch 3-day daily forecast using One Call API
    const forecastRes = await fetch(`https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts&units=metric&appid=${API_KEY}`);
    const forecastData = await forecastRes.json();

    if (!forecastData || !forecastData.daily) return res.status(500).json({ message: "Weather data not found" });

    const forecast = forecastData.daily.slice(0, 3).map(day => {
      return {
        date: new Date(day.dt * 1000).toLocaleDateString(),
        day_temp: day.temp.day,
        min_temp: day.temp.min,
        max_temp: day.temp.max,
        description: day.weather[0].description
      };
    });

    res.json({ city, forecast });

  } catch (err) {
    console.error("Weather API Error:", err);
    res.status(500).json({ message: "Error fetching weather" });
  }
});

/* ---------- Chatbot API ---------- */
app.post("/api/chat", async (req, res) => {
  const { question } = req.body;
  const lowerQ = question.toLowerCase();
  const abusiveWords = ["idiot", "stupid", "dumb", "nonsense", "fool"];

  if (isBlocked) {
    if (lowerQ.includes("sorry")) {
      isBlocked = false;
      return res.json({ answer: "✅ Thank you for apologizing. How can I help with your travel plans? ✈️" });
    }
    return res.json({ answer: "⛔ I won't respond until you apologize by saying 'sorry'." });
  }

  if (abusiveWords.some(word => lowerQ.includes(word))) {
    isBlocked = true;
    return res.json({ answer: "⛔ That language is not acceptable. Say 'sorry' to continue." });
  }

  try {
    // Weather-related queries
    if (lowerQ.includes("weather") || lowerQ.includes("temperature") || lowerQ.includes("climate")) {
      let city = "Udaipur";
      const match = lowerQ.match(/in (\w+)/);
      if (match) city = match[1];

      const weatherRes = await fetch(`http://localhost:3000/api/weather/${city}`);
      const weatherData = await weatherRes.json();

      let text = `🌦️ Weather forecast for ${city}:\n`;
      if (weatherData.forecast && weatherData.forecast.length > 0) {
        weatherData.forecast.forEach(day => {
          text += `📅 ${day.date}: ${day.day_temp}°C (Min: ${day.min_temp}°C, Max: ${day.max_temp}°C), ${day.description}\n`;
        });
      } else {
        text += "No forecast available.";
      }

      return res.json({ answer: text });
    }

    // Travel-related queries handled by Gemini
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
- Use emojis to make it engaging
- Greet user well like it's hello, thank you etc. 

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
