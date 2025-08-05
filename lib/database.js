/**
 * Database Connection Utility for Judge0 IDE Authentication
 * Provides robust connection management with fallback strategies
 */

const mysql = require("mysql2/promise");
const DiagnosticsManager = require("./diagnostics");

class DatabaseManager {
  constructor(config) {
    this.config = config;
    this.pool = null;
    this.connectionAttempts = 0;
    this.maxRetries = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 5000;
    this.diagnostics = new DiagnosticsManager();
    this.connectionStrategy = "unknown";
    this.lastError = null;
  }

  /**
   * Initialize database connection with fallback strategies
   */
  async initialize() {
    console.log("Initializing database connection...");

    // Strategy 1: Try socket connection first (if enabled)
    if (this.config.useSocket) {
      console.log("Attempting socket connection...");
      try {
        await this._createSocketPool();
        this.connectionStrategy = "socket";
        console.log("✓ Socket connection successful");
        return true;
      } catch (error) {
        console.log("✗ Socket connection failed:", error.message);
        this.lastError = error;

        // Generate detailed diagnostics
        const diagnosis = await this.diagnostics.diagnoseConnectionError(
          error,
          this.config
        );
        console.log("\n🔍 Socket Connection Diagnosis:");
        diagnosis.suggestions.slice(0, 3).forEach((suggestion, index) => {
          console.log(`  ${index + 1}. ${suggestion}`);
        });

        console.log("Falling back to TCP connection...");
      }
    }

    // Strategy 2: TCP connection
    try {
      await this._createTcpPool();
      this.connectionStrategy = "tcp";
      console.log("✓ TCP connection successful");
      return true;
    } catch (error) {
      console.error("✗ TCP connection failed:", error.message);
      this.lastError = error;

      // Generate comprehensive diagnostics for TCP failure
      const diagnosis = await this.diagnostics.diagnoseConnectionError(
        error,
        this.config
      );
      console.log("\n🔍 TCP Connection Diagnosis:");
      console.log("Error Type:", diagnosis.type);
      console.log("Suggestions:");
      diagnosis.suggestions.forEach((suggestion, index) => {
        console.log(`  ${index + 1}. ${suggestion}`);
      });

      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Create socket-based connection pool
   */
  async _createSocketPool() {
    const socketConfig = {
      socketPath: this.config.socketPath,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      waitForConnections: true,
      connectionLimit: this.config.connectionLimit,
      queueLimit: 0,
      acquireTimeout: this.config.acquireTimeout,
      timeout: this.config.timeout,
      debug:
        this.config.debug === "true"
          ? ["ComQueryPacket", "RowDataPacket"]
          : false,
    };

    this.pool = mysql.createPool(socketConfig);
    await this._testConnection();
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
   * Get connection health status with detailed diagnostics
   */
  async getHealthStatus() {
    try {
      if (!this.pool) {
        return {
          status: "not_initialized",
          error: "Pool not created",
          lastError: this.lastError?.message,
          strategy: this.connectionStrategy,
          diagnostics: this.lastError
            ? await this.diagnostics.generateReport(this.lastError, this.config)
            : null,
        };
      }

      const connection = await this.pool.getConnection();
      try {
        const startTime = Date.now();
        await connection.execute("SELECT 1");
        const responseTime = Date.now() - startTime;

        // Get pool statistics
        const poolStats = {
          totalConnections: this.pool._allConnections?.length || 0,
          freeConnections: this.pool._freeConnections?.length || 0,
          usedConnections: this.pool._usedConnections?.length || 0,
          queuedRequests: this.pool._connectionQueue?.length || 0,
        };

        return {
          status: "healthy",
          strategy: this.connectionStrategy,
          responseTime: `${responseTime}ms`,
          pool: poolStats,
          config: {
            host: this.config.host,
            port: this.config.port,
            database: this.config.database,
            useSocket: this.config.useSocket,
            socketPath: this.config.useSocket
              ? this.config.socketPath
              : undefined,
          },
        };
      } finally {
        connection.release();
      }
    } catch (error) {
      const diagnosis = await this.diagnostics.generateReport(
        error,
        this.config
      );
      return {
        status: "unhealthy",
        error: error.message,
        code: error.code,
        strategy: this.connectionStrategy,
        diagnostics: diagnosis,
      };
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
        if (error.message.includes("mysqld.sock")) {
          diagnosis.suggestions = [
            "Socket file not found. Check if MySQL/MariaDB is running",
            "Verify socket path: ls -la /var/run/mysqld/mysqld.sock",
            "Try restarting MySQL: sudo systemctl restart mysql",
            "Consider using TCP connection instead",
            "Check if socket is in different location: find /var -name 'mysqld.sock' 2>/dev/null",
          ];
        }
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
