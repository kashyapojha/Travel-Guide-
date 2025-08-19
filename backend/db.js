const mysql = require('mysql2');

// connection create kar rahe hai
const db = mysql.createConnection({
  host: 'localhost',   // tumhara MySQL host
  user: 'root',        // apna MySQL username
  password: 'nbh05@',        // yaha apna password daalo (agar set kiya ho)
  database: 'user_auth'
});

// check connection
db.connect((err) => {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }
  console.log('✅ Connected to MySQL Database');
});

module.exports = db;
