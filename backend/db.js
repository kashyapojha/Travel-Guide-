const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');   // apna db.js import kiya

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// ✅ SIGNUP API
app.post('/api/signup', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "⚠️ All fields are required" });
  }

  // Check if email already exists
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length > 0) {
      return res.status(400).json({ message: "⚠️ Email already registered" });
    }

    // Insert user
    db.query(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, password],
      (err, result) => {
        if (err) return res.status(500).json({ message: "Error saving user" });
        res.json({ message: "✅ Signup successful! Please login." });
      }
    );
  });
});

// ✅ LOGIN API
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "⚠️ Email and password required" });
  }

  db.query(
    "SELECT * FROM users WHERE email = ? AND password = ?",
    [email, password],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });

      if (results.length === 0) {
        return res.status(401).json({ message: "❌ Invalid email or password" });
      }

      res.json({ message: "✅ Login successful", user: results[0] });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
