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
const ACCU_KEY = process.env.ACCU_KEY;
const RAPID_KEY = process.env.RAPIDAPI_KEY;

let isBlocked = false;

// ---------- Serve Frontend ----------
app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.static(path.join(__dirname, "..", "frontend", "public")));

// ---------- HTML Routes ----------
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "public", "index.html")));
app.get("/about", (req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "public", "about.html")));
app.get("/contact", (req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "public", "contact.html")));
app.get("/chatbot", (req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "public", "chatbot.html")));

// ---------- Signup API ----------
app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ message: "All fields are required" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, hashedPassword], (err) => {
      if (err) return res.status(500).json({ message: "Error creating user" });
      res.json({ message: "✅ User registered successfully!" });
    });
  } catch (err) {
    res.status(500).json({ message: "Error hashing password" });
  }
});

// ---------- Login API ----------
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

// ---------- Weather Helper ----------
async function getLocationKey(city) {
  const res = await fetch(`https://dataservice.accuweather.com/locations/v1/cities/search?apikey=${ACCU_KEY}&q=${encodeURIComponent(city)}`);
  const data = await res.json();
  if (!data[0]) throw new Error("City not found");
  return data[0].Key;
}

async function get3DayForecast(locationKey) {
  const res = await fetch(`https://dataservice.accuweather.com/forecasts/v1/daily/3day/${locationKey}?apikey=${ACCU_KEY}&metric=true`);
  const data = await res.json();
  if (!data.DailyForecasts) throw new Error("Weather data not found");

  return data.DailyForecasts.map(day => ({
    date: day.Date.split("T")[0],
    min_temp: day.Temperature.Minimum.Value,
    max_temp: day.Temperature.Maximum.Value,
    description: day.Day.IconPhrase
  }));
}

// ---------- Weather API ----------
app.get("/api/weather/:city", async (req, res) => {
  const { city } = req.params;
  try {
    const locationKey = await getLocationKey(city);
    const forecast = await get3DayForecast(locationKey);
    res.json({ city, forecast });
  } catch (err) {
    console.error("Weather API Error:", err.message);
    res.status(500).json({ message: "Error fetching weather" });
  }
});

// ---------- Hotels API ----------
app.get("/api/hotels/:city", async (req, res) => {
  const city = req.params.city;
  try {
    const response = await fetch(`https://booking-com15.p.rapidapi.com/api/v1/hotels/search?name=${encodeURIComponent(city)}&checkin_date=2025-08-22&checkout_date=2025-08-25&adults_number=1&currency=USD&order_by=popularity&locale=en-us`, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": RAPID_KEY,
        "X-RapidAPI-Host": "booking-com15.p.rapidapi.com"
      }
    });
    const data = await response.json();
    res.json(data.result || []);
  } catch (err) {
    console.error("Hotels API Error:", err.message);
    res.status(500).json([]);
  }
});

// ---------- Car Rentals API ----------
app.get("/api/cars", async (req, res) => {
  const { pickUpLat, pickUpLng, dropOffLat, dropOffLng, pickUpTime, dropOffTime, driverAge } = req.query;
  try {
    const response = await fetch(`https://booking-com15.p.rapidapi.com/api/v1/cars/searchCarRentals?pick_up_latitude=${pickUpLat}&pick_up_longitude=${pickUpLng}&drop_off_latitude=${dropOffLat}&drop_off_longitude=${dropOffLng}&pick_up_time=${pickUpTime}&drop_off_time=${dropOffTime}&driver_age=${driverAge}&currency_code=USD`, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": RAPID_KEY,
        "X-RapidAPI-Host": "booking-com15.p.rapidapi.com"
      }
    });
    const data = await response.json();
    res.json(data.result || []);
  } catch (err) {
    console.error("Cars API Error:", err.message);
    res.status(500).json([]);
  }
});

// ---------- Chatbot API ----------
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
    // --- Weather Query ---
    if (lowerQ.includes("weather")) {
      const match = lowerQ.match(/weather(?: in)? ([a-zA-Z\s]+)/);
      if (match) {
        const city = match[1].trim();
        const weatherRes = await fetch(`http://localhost:3000/api/weather/${encodeURIComponent(city)}`);
        const weatherData = await weatherRes.json();
        return res.json({ answer: `🌤️ Weather forecast for ${city}:\n${JSON.stringify(weatherData.forecast, null, 2)}` });
      }
    }

    // --- Hotels Query ---
    if (lowerQ.includes("hotel") || lowerQ.includes("stay")) {
      const match = lowerQ.match(/hotels? in ([a-zA-Z\s]+)/);
      if (match) {
        const city = match[1].trim();
        const hotelsRes = await fetch(`http://localhost:3000/api/hotels/${encodeURIComponent(city)}`);
        const hotelsData = await hotelsRes.json();
        return res.json({ answer: `🏨 Top hotels in ${city}:\n${JSON.stringify(hotelsData, null, 2)}` });
      }
    }

    // --- Car Rentals Query ---
    if (lowerQ.includes("car") || lowerQ.includes("rent")) {
      const match = lowerQ.match(/cars? in ([a-zA-Z\s]+)/);
      if (match) {
        const city = match[1].trim();
        const carsRes = await fetch(`http://localhost:3000/api/cars?pickUpLat=24.5854&pickUpLng=73.7125&dropOffLat=24.5854&dropOffLng=73.7125&pickUpTime=10:00&dropOffTime=18:00&driverAge=30`);
        const carsData = await carsRes.json();
        return res.json({ answer: `🚗 Available car rentals in ${city}:\n${JSON.stringify(carsData, null, 2)}` });
      }
    }

    // --- General Travel Queries → Gemini AI ---
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
You are a friendly travel guide chatbot.
Provide structured, day-by-day itineraries, attractions, food, tips, and include emojis.
Only answer travel-related questions.

User asked: "${question}"
    `;
    const result = await model.generateContent(prompt);
    const text = await (result.response.text ? result.response.text() : result.toString());
    return res.json({ answer: text });

  } catch (err) {
    console.error("❌ Chatbot Error:", err.message);
    return res.status(500).json({ answer: "Error occurred while generating response." });
  }
});

// ---------- Start Server ----------
app.listen(3000, () => console.log("🚀 Server running on http://localhost:3000"));
