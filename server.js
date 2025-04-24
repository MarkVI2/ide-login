const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const path = require("path");
const { Pool } = require("pg");
const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// CORS middleware - Add before other middleware
app.use((req, res, next) => {
  // Allow requests from any origin
  res.header("Access-Control-Allow-Origin", "*");

  // Allow specific methods
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  // Allow specific headers
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).send("Something went wrong!");
});

// Middleware - Apply before route handlers
app.use(express.json()); // Using express's built-in JSON parser
app.use(bodyParser.json()); // For backward compatibility
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Test endpoint to verify server is working
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working!" });
});

// Admin credentials - Change these to your preferred admin username and password
const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "muadmin2025", // You should change this to a secure password
  userId: "admin-1",
  firstname: "Admin",
  lastname: "User",
};

// Database configuration - Update with your Moodle PostgreSQL database details
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432, // PostgreSQL default port
  user: process.env.DB_USER || "moodle_user",
  password: process.env.DB_PASSWORD || "moodle_password",
  database: process.env.DB_NAME || "moodle",
};

// Create connection pool
let pool;
try {
  pool = new Pool(dbConfig);
  console.log("PostgreSQL database pool created successfully");
} catch (error) {
  console.error("Failed to create database pool:", error);
}

// API endpoint for Moodle login
app.post("/api/moodle-login", async (req, res) => {
  console.log("Login attempt received:", req.body);

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Username and password are required",
    });
  }

  // Check for admin credentials first
  if (
    username === ADMIN_CREDENTIALS.username &&
    password === ADMIN_CREDENTIALS.password
  ) {
    console.log("Admin login successful");
    return res.json({
      success: true,
      userId: ADMIN_CREDENTIALS.userId,
      username: ADMIN_CREDENTIALS.username,
      fullName: `${ADMIN_CREDENTIALS.firstname} ${ADMIN_CREDENTIALS.lastname}`,
      isAdmin: true,
    });
  }

  // If database connection is not available, return error
  if (!pool) {
    console.error("Database connection not available");
    return res.status(500).json({
      success: false,
      message: "Database connection not available",
    });
  }

  try {
    // Get connection from pool
    const connection = await pool.connect();

    try {
      // Query to get user from Moodle database
      // Note: Moodle typically stores passwords using various hash methods including bcrypt
      // This SQL query gets the necessary user data for authentication
      const result = await pool.query(
        `SELECT id, username, password, firstname, lastname 
         FROM mdl_user 
         WHERE username = $1 AND deleted = 0 AND suspended = 0`,
        [username]
      );

      const rows = result.rows;

      if (rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      const user = rows[0];

      // Verify password - Moodle uses different hashing methods
      // This is a simplified version - might need adjustment based on your Moodle configuration
      const isValidPassword = await verifyMoodlePassword(
        password,
        user.password
      );

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: "Invalid password",
        });
      }

      // Return success with user data
      console.log("User login successful:", user.username);
      return res.json({
        success: true,
        userId: user.id,
        username: user.username,
        fullName: `${user.firstname} ${user.lastname}`,
        isAdmin: false,
      });
    } finally {
      // Release connection back to pool
      connection.release();
    }
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during authentication",
    });
  }
});

/**
 * Verify password against Moodle's hashing method
 * Note: Moodle uses different password hashing algorithms depending on version
 * You may need to adjust this function to match your specific Moodle configuration
 */
async function verifyMoodlePassword(plainPassword, hashedPassword) {
  // This is a simplified implementation
  // Moodle stores password hash with algorithm info

  // Common Moodle password formats:
  // 1. password is stored as: $2y$10$HashedPasswordString (bcrypt)
  // 2. password is stored as: $1$salt$HashedPasswordString (md5)
  // 3. password is stored as: md5(plainPassword)

  if (hashedPassword.startsWith("$2y$") || hashedPassword.startsWith("$2a$")) {
    // bcrypt format
    return await bcrypt.compare(plainPassword, hashedPassword);
  } else if (hashedPassword.startsWith("$1$")) {
    // md5 with salt format (you would need a md5crypt implementation)
    console.warn("MD5 with salt format detected - implementation needed");
    return false;
  } else {
    // legacy format (plain md5)
    const crypto = require("crypto");
    const md5Hash = crypto
      .createHash("md5")
      .update(plainPassword)
      .digest("hex");
    return md5Hash === hashedPassword;
  }
}

// Redirect to login page if not authenticated
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} in your browser`);
});

// Export app for testing
module.exports = app;
