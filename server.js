const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const path = require("path");
const mysql = require("mysql2/promise");
const crypto = require("crypto");
const apacheMd5 = require("apache-md5");

// Import our custom utilities
const DatabaseManager = require("./lib/database");
const MoodleAuth = require("./lib/moodle-auth");

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url}`);

  // Log request body for debugging (but sanitize sensitive data)
  if (req.method === "POST" && req.url.includes("/api/moodle-login")) {
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) {
      sanitizedBody.password = "[REDACTED]";
    }
    console.log(`${timestamp} - Request body:`, sanitizedBody);
  }

  next();
});

// CORS middleware - Enhanced for production cross-origin support
app.use((req, res, next) => {
  const allowedOrigins = [
    "https://code.euclid-mu.in",
    "https://ide-login.euclid-mu.in",
    "http://localhost:3000",
    "http://localhost:8080",
  ];

  const origin = req.headers.origin;

  // Allow requests from allowed origins or same-origin requests
  if (allowedOrigins.includes(origin) || !origin) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  }

  // Enhanced CORS headers for cross-origin requests
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token, Cache-Control"
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Max-Age", "86400"); // Cache preflight for 24 hours
    return res.status(200).end();
  }

  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`${timestamp} - Server error:`, err);

  // Don't expose internal error details in production
  const errorResponse = {
    success: false,
    message: "Internal server error",
    timestamp,
  };

  // In development, include more error details
  if (process.env.NODE_ENV !== "production") {
    errorResponse.error = err.message;
    errorResponse.stack = err.stack;
  }

  res.status(500).json(errorResponse);
});

// Middleware - Apply before route handlers
app.use(express.json()); // Using express's built-in JSON parser
app.use(bodyParser.json()); // For backward compatibility
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Test endpoint to verify server is working
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API is working!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  const healthStatus = {
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database: "unknown",
      server: "running",
    },
  };

  // Check database connection
  if (dbManager) {
    const dbHealth = await dbManager.getHealthStatus();
    healthStatus.services.database = dbHealth.status;
    if (dbHealth.status !== "healthy") {
      healthStatus.success = false;
      healthStatus.status = "degraded";
      healthStatus.services.databaseError = dbHealth.error;
    }
  } else {
    healthStatus.services.database = "not_initialized";
    healthStatus.success = false;
    healthStatus.status = "degraded";
  }

  const statusCode = healthStatus.success ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// Environment-based admin credentials - More secure approach
const getAdminCredentials = () => {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "muadmin2025",
    userId: process.env.ADMIN_USER_ID || "admin-1",
    firstname: process.env.ADMIN_FIRSTNAME || "Admin",
    lastname: process.env.ADMIN_LASTNAME || "User",
  };
};

// Enhanced database configuration with fallback strategies
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "moodle_user",
  password: process.env.DB_PASSWORD || "moodle_password",
  database: process.env.DB_NAME || "moodle",
  connectTimeout: parseInt(process.env.DB_TIMEOUT) || 60000,
  acquireTimeout: 60000,
  timeout: 60000,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS) || 3,
  retryDelay: parseInt(process.env.DB_RETRY_DELAY) || 5000,
  // Note: Socket support has been deprecated - TCP-only connections are now used
};

// Initialize database and authentication
let dbManager;
let moodleAuth;

async function initializeDatabase() {
  try {
    console.log("Initializing database connection...");
    dbManager = new DatabaseManager(dbConfig);
    await dbManager.initialize();
    
    // Initialize Moodle authentication
    moodleAuth = new MoodleAuth(dbManager, {
      tablePrefix: process.env.MOODLE_TABLE_PREFIX || "mdl_"
    });
    
    // Test Moodle connection
    const testResult = await moodleAuth.testMoodleConnection();
    if (testResult.success) {
      console.log("✓ Moodle database verified:", testResult.message);
      console.log("  - User table:", testResult.table);
      console.log("  - Total users:", testResult.stats.totalUsers);
      console.log("  - Active users:", testResult.stats.activeUsers);
    } else {
      console.warn("⚠ Moodle verification failed:", testResult.message);
    }
    
    return true;
  } catch (error) {
    console.error("Database initialization failed:", error.message);
    
    // Provide diagnosis
    const diagnosis = DatabaseManager.diagnoseConnectionError(error);
    console.log("\n🔍 Connection Diagnosis:");
    console.log("Error Code:", diagnosis.code);
    console.log("Suggestions:");
    diagnosis.suggestions.forEach((suggestion, index) => {
      console.log(`  ${index + 1}. ${suggestion}`);
    });
    
    return false;
  }
}

// Initialize database on startup
initializeDatabase().then((success) => {
  if (!success) {
    console.error("❌ Database initialization failed. Server will continue with limited functionality.");
  }
});

// Enhanced API endpoint with comprehensive Moodle authentication
app.post("/api/moodle-login", async (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress;

  try {
    // Validate request body
    if (!req.body) {
      console.log(
        `${timestamp} - Login attempt failed: Missing request body from ${clientIP}`
      );
      return res.status(400).json({
        success: false,
        message: "Request body is required",
        error: "MISSING_BODY",
      });
    }

    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      console.log(
        `${timestamp} - Login attempt failed: Missing credentials from ${clientIP}`
      );
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
        error: "MISSING_CREDENTIALS",
      });
    }

    // Sanitize username (basic validation)
    const sanitizedUsername = username.toString().trim();
    if (sanitizedUsername.length === 0 || sanitizedUsername.length > 100) {
      console.log(
        `${timestamp} - Login attempt failed: Invalid username format from ${clientIP}`
      );
      return res.status(400).json({
        success: false,
        message: "Invalid username format",
        error: "INVALID_USERNAME",
      });
    }

    console.log(
      `${timestamp} - Login attempt for user: ${sanitizedUsername} from ${clientIP}`
    );

    // Check admin credentials first
    const adminCreds = getAdminCredentials();
    if (
      sanitizedUsername === adminCreds.username &&
      password === adminCreds.password
    ) {
      console.log(
        `${timestamp} - Admin login successful for ${sanitizedUsername}`
      );
      return res.json({
        success: true,
        userId: adminCreds.userId,
        username: adminCreds.username,
        fullName: `${adminCreds.firstname} ${adminCreds.lastname}`,
        email: "admin@euclid-mu.in",
        isAdmin: true,
        loginTime: timestamp,
      });
    }

    // Database authentication using MoodleAuth
    if (!dbManager || !moodleAuth) {
      console.error(`${timestamp} - Database connection not available`);
      return res.status(503).json({
        success: false,
        message: "Authentication service temporarily unavailable",
        error: "DATABASE_UNAVAILABLE",
        timestamp,
      });
    }

    try {
      // Authenticate using MoodleAuth utility
      const user = await moodleAuth.authenticateUser(sanitizedUsername, password);
      
      // Update last login time
      await moodleAuth.updateLastLogin(user.id);
      
      console.log(
        `${timestamp} - Moodle login successful for user: ${user.username} (ID: ${user.id})`
      );

      return res.json({
        success: true,
        userId: user.id,
        username: user.username,
        fullName: user.fullname,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        isAdmin: false,
        authMethod: user.auth,
        loginTime: timestamp,
        message: "Authentication successful",
      });
    } catch (authError) {
      console.log(
        `${timestamp} - Moodle authentication failed for ${sanitizedUsername}: ${authError.message}`
      );

      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
        error: authError.message.includes("not found") ? "USER_NOT_FOUND" : "INVALID_CREDENTIALS",
        timestamp,
      });
    }
  } catch (error) {
    console.error(`${timestamp} - Authentication error:`, {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      clientIP,
    });

    // Handle specific database errors
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      return res.status(503).json({
        success: false,
        message: "Authentication service temporarily unavailable",
        error: "DATABASE_CONNECTION_FAILED",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication service error",
      error: "INTERNAL_ERROR",
      timestamp,
    });
  }
});

/**
      timestamp,
    });
  }

/**
 * Enhanced Moodle password verification function
 * Supports multiple Moodle password hashing formats:
 * - bcrypt ($2y$, $2a$)
 * - MD5 crypt with salt ($1$...)
 * - Legacy plain MD5 hashes
 */
async function verifyMoodlePassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) {
    console.error("verifyMoodlePassword: Missing password or hash");
    return false;
  }

  try {
    // 1. bcrypt format ($2y$ or $2a$)
    if (
      hashedPassword.startsWith("$2y$") ||
      hashedPassword.startsWith("$2a$")
    ) {
      console.log("Using bcrypt verification");
      return await bcrypt.compare(plainPassword, hashedPassword);
    }

    // 2. MD5 crypt with salt format ($1$salt$hash)
    else if (hashedPassword.startsWith("$1$")) {
      console.log("Using MD5 crypt verification");
      try {
        const verifiedHash = apacheMd5(plainPassword, hashedPassword);
        return verifiedHash === hashedPassword;
      } catch (error) {
        console.error("MD5 crypt verification error:", error);
        return false;
      }
    }

    // 3. Legacy plain MD5 format (32-character hex string)
    else if (/^[a-f0-9]{32}$/i.test(hashedPassword)) {
      console.log("Using legacy MD5 verification");
      const md5Hash = crypto
        .createHash("md5")
        .update(plainPassword)
        .digest("hex");
      return md5Hash.toLowerCase() === hashedPassword.toLowerCase();
    }

    // 4. Unknown format - log for debugging
    else {
      console.warn("Unknown password hash format:", {
        format: hashedPassword.substring(0, 10) + "...",
        length: hashedPassword.length,
      });
      return false;
    }
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}

// Enhanced database info endpoint
app.get("/api/db-info", async (req, res) => {
  // Check if user has permission (simple check for now)
  const authHeader = req.headers.authorization;
  if (
    !authHeader ||
    authHeader !== `Bearer ${process.env.DEBUG_TOKEN || "debug123"}`
  ) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized access to database info",
    });
  }

  try {
    if (!pool) {
      return res.status(503).json({
        success: false,
        message: "Database pool not available",
        error: "DATABASE_NOT_CONFIGURED",
      });
    }

    const connection = await pool.getConnection();
    try {
      // Get comprehensive database information
      const [versionRows] = await connection.query(
        "SELECT VERSION() as version"
      );
      const [variablesRows] = await connection.query(
        "SHOW VARIABLES LIKE 'datadir'"
      );
      const [tablesRows] = await connection.query("SHOW TABLES");

      // Check if mdl_user table exists and get sample structure
      const [userTableInfo] = await connection.query(`
        SELECT COUNT(*) as user_count 
        FROM mdl_user 
        WHERE deleted = 0 AND suspended = 0 AND confirmed = 1 AND auth = 'manual'
      `);

      // Get password hash samples for debugging (first 10 chars only)
      const [passwordSamples] = await connection.query(`
        SELECT username, 
               SUBSTRING(password, 1, 10) as password_prefix,
               LENGTH(password) as password_length
        FROM mdl_user 
        WHERE deleted = 0 AND suspended = 0 AND confirmed = 1 AND auth = 'manual'
        LIMIT 5
      `);

      return res.json({
        success: true,
        database: {
          version: versionRows[0].version,
          dataDirectory: variablesRows[0]?.Value || "Unknown",
          tableCount: tablesRows.length,
          eligibleUsers: userTableInfo[0].user_count,
        },
        connectionConfig: {
          host: dbConfig.host,
          port: dbConfig.port,
          database: dbConfig.database,
          // Note: Socket support has been deprecated - TCP-only connections are used
        },
        passwordSamples: passwordSamples.map((sample) => ({
          username: sample.username,
          passwordPrefix: sample.password_prefix,
          passwordLength: sample.password_length,
        })),
        timestamp: new Date().toISOString(),
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Database info error:", error);
    return res.status(500).json({
      success: false,
      message: "Error querying database information",
      error: error.code || error.message,
      timestamp: new Date().toISOString(),
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
