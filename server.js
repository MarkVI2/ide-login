const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const path = require("path");
const mysql = require("mysql2/promise");
const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// CORS middleware - Add before other middleware
app.use((req, res, next) => {
  // Be more specific with allowed origins for security
  const allowedOrigins = ["https://code.euclid-mu.in", "http://localhost:3000"];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  // Allow credentials
  res.header("Access-Control-Allow-Credentials", "true");

  // Rest of your CORS setup
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

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

// Database configuration for a local MySQL/MariaDB file
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "moodle_user",
  password: process.env.DB_PASSWORD || "moodle_password",
  database: process.env.DB_NAME || "moodle",
  socketPath: process.env.DB_SOCKET || "/var/run/mysqld/mysqld.sock", // For local file access
  connectTimeout: 60000, // Increase timeout for better reliability
};

// Create connection pool with enhanced error handling
let pool;
try {
  pool = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    socketPath: dbConfig.socketPath,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: dbConfig.connectTimeout,
    debug:
      process.env.DB_DEBUG === "true"
        ? ["ComQueryPacket", "RowDataPacket"]
        : false,
  });

  // Test connection immediately
  pool
    .getConnection()
    .then((connection) => {
      console.log("MySQL/MariaDB database connection test successful");
      connection.release();
    })
    .catch((err) => {
      console.error("Database connection test failed:", err);
    });

  console.log("MySQL/MariaDB database pool created successfully");
} catch (error) {
  console.error("Failed to create database pool:", error);
}

// Enhanced API endpoint with better logging
app.post("/api/moodle-login", async (req, res) => {
  console.log("Login attempt received:", { username: req.body.username });

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Username and password are required",
    });
  }

  // Admin check remains the same
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

  // Database check
  if (!pool) {
    console.error("Database connection not available");
    return res.status(500).json({
      success: false,
      message: "Database connection not available",
    });
  }

  try {
    const connection = await pool.getConnection();
    try {
      // Get user from database
      const [users] = await connection.query(
        `SELECT id, username, password, firstname, lastname, email
         FROM mdl_user
         WHERE username = ? AND deleted = 0 AND suspended = 0`,
        [username]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      const user = users[0];

      // Log the password format to help debugging
      console.log(
        `Password format for ${username}: ${user.password.substring(0, 8)}...`
      );

      // Verify password using your existing function
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
        email: user.email,
        isAdmin: false,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during authentication",
      error: error.toString(),
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

// Add this endpoint to test database connection
app.get("/api/db-info", async (req, res) => {
  try {
    // Get connection from pool
    const connection = await pool.getConnection();
    try {
      // Get version and file path info
      const [versionRows] = await connection.query(
        "SELECT VERSION() as version"
      );
      const [variablesRows] = await connection.query(
        "SHOW VARIABLES LIKE 'datadir'"
      );
      const [tablesRows] = await connection.query("SHOW TABLES");

      // Return information about the database
      return res.json({
        success: true,
        version: versionRows[0].version,
        dataDirectory: variablesRows[0]?.Value,
        tables: tablesRows.map((row) => Object.values(row)[0]),
        connectionConfig: {
          host: dbConfig.host,
          port: dbConfig.port,
          database: dbConfig.database,
          socketPath: dbConfig.socketPath || "Not configured",
        },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error querying database information",
      error: error.toString(),
    });
  }
});

// Redirect to login page if not authenticated
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Bound to all network interfaces`);
});

// Export app for testing
module.exports = app;
