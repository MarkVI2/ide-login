/**
 * Database Connection Utility for Judge0 IDE Authentication
 * Provides robust connection management with fallback strategies
 */

const mysql = require("mysql2/promise");

class DatabaseManager {
  constructor(config) {
    this.config = config;
    this.pool = null;
    this.connectionAttempts = 0;
    this.maxRetries = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 5000;
  }

  /**
   * Initialize database connection using TCP only
   * Note: Socket connection support has been deprecated
   */
  async initialize() {
    console.log("Initializing database connection...");

    // TCP connection (only supported method)
    try {
      await this._createTcpPool();
      console.log("✓ TCP connection successful");
      return true;
    } catch (error) {
      console.error("✗ TCP connection failed:", error.message);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Create TCP-based connection pool
   */
  async _createTcpPool() {
    const tcpConfig = {
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      waitForConnections: true,
      connectionLimit: this.config.connectionLimit,
      queueLimit: 0,
      connectTimeout: this.config.connectTimeout,
      acquireTimeout: this.config.acquireTimeout,
      timeout: this.config.timeout,
      debug:
        this.config.debug === "true"
          ? ["ComQueryPacket", "RowDataPacket"]
          : false,
    };

    this.pool = mysql.createPool(tcpConfig);
    await this._testConnection();
  }

  /**
   * Test database connection
   */
  async _testConnection() {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute("SELECT 1");
      console.log("Database connection test successful");
    } finally {
      connection.release();
    }
  }

  /**
   * Get connection from pool
   */
  async getConnection() {
    if (!this.pool) {
      throw new Error("Database not initialized");
    }
    return await this.pool.getConnection();
  }

  /**
   * Execute query with connection management
   */
  async query(sql, params = []) {
    const connection = await this.getConnection();
    try {
      const [results] = await connection.execute(sql, params);
      return results;
    } finally {
      connection.release();
    }
  }

  /**
   * Close all connections
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log("Database connections closed");
    }
  }

  /**
   * Get connection health status
   */
  async getHealthStatus() {
    try {
      if (!this.pool) {
        return { status: "not_initialized", error: "Pool not created" };
      }

      const connection = await this.pool.getConnection();
      try {
        await connection.execute("SELECT 1");
        return {
          status: "healthy",
          connection_count: this.pool._allConnections.length,
        };
      } finally {
        connection.release();
      }
    } catch (error) {
      return { status: "unhealthy", error: error.message };
    }
  }

  /**
   * Diagnose connection issues and provide suggestions
   */
  static diagnoseConnectionError(error) {
    const diagnosis = {
      error: error.message,
      code: error.code,
      suggestions: [],
    };

    switch (error.code) {
      case "ENOENT":
        diagnosis.suggestions = [
          "File or directory not found",
          "Check file permissions and paths",
        ];
        break;

      case "ECONNREFUSED":
        diagnosis.suggestions = [
          "Connection refused. Check if database server is running",
          "Verify host and port configuration",
          "Check firewall settings",
          "Ensure MySQL is listening on the specified port: netstat -tlnp | grep 3306",
        ];
        break;

      case "ENOTFOUND":
        diagnosis.suggestions = [
          "Host not found. Check database host configuration",
          "Verify DNS resolution",
          "Try using IP address instead of hostname",
        ];
        break;

      case "ER_ACCESS_DENIED_ERROR":
        diagnosis.suggestions = [
          "Access denied. Check username and password",
          "Verify user has permission to access the database",
          "Check MySQL user privileges: SHOW GRANTS FOR 'user'@'host'",
        ];
        break;

      case "ER_BAD_DB_ERROR":
        diagnosis.suggestions = [
          "Database does not exist",
          "Check database name configuration",
          "Create the database: CREATE DATABASE moodle;",
        ];
        break;

      default:
        diagnosis.suggestions = [
          "Check database server status",
          "Verify all connection parameters",
          "Review database server logs",
        ];
    }

    return diagnosis;
  }
}

module.exports = DatabaseManager;
