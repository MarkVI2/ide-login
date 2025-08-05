/**
 * Diagnostics and Error Resolution Utility
 * Provides intelligent error diagnosis and resolution suggestions
 */

const fs = require("fs").promises;
const path = require("path");
const { spawn } = require("child_process");

class DiagnosticsManager {
  constructor() {
    this.commonErrors = new Map([
      ["ENOENT", "Socket file not found"],
      ["ECONNREFUSED", "Connection refused by database"],
      ["EACCES", "Permission denied"],
      ["ETIMEDOUT", "Connection timeout"],
      ["ER_ACCESS_DENIED_ERROR", "Database authentication failed"],
      ["ENOTFOUND", "Database host not found"],
      ["ER_BAD_DB_ERROR", "Database does not exist"],
      ["PROTOCOL_CONNECTION_LOST", "Database connection lost"],
    ]);
  }

  /**
   * Diagnose database connection errors and provide solutions
   */
  async diagnoseConnectionError(error, config) {
    const diagnosis = {
      error: error.message,
      code: error.code || "UNKNOWN",
      type: this.classifyError(error),
      suggestions: [],
      systemInfo: await this.getSystemInfo(),
      databaseInfo: await this.getDatabaseInfo(config),
    };

    // Add specific suggestions based on error type
    switch (error.code) {
      case "ENOENT":
        diagnosis.suggestions = await this.diagnoseMissingSocket(config);
        break;
      case "ECONNREFUSED":
        diagnosis.suggestions = await this.diagnoseConnectionRefused(config);
        break;
      case "EACCES":
        diagnosis.suggestions = await this.diagnosePermissionDenied(config);
        break;
      case "ETIMEDOUT":
        diagnosis.suggestions = await this.diagnoseTimeout(config);
        break;
      case "ER_ACCESS_DENIED_ERROR":
        diagnosis.suggestions = await this.diagnoseAuthFailure(config);
        break;
      case "ENOTFOUND":
        diagnosis.suggestions = await this.diagnoseHostNotFound(config);
        break;
      default:
        diagnosis.suggestions = await this.getGenericSuggestions(error, config);
    }

    return diagnosis;
  }

  /**
   * Classify error type for better handling
   */
  classifyError(error) {
    if (error.code?.startsWith("ER_")) return "database";
    if (["ENOENT", "EACCES"].includes(error.code)) return "filesystem";
    if (["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"].includes(error.code))
      return "network";
    return "unknown";
  }

  /**
   * Get system information for diagnostics
   */
  async getSystemInfo() {
    const info = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    try {
      // Check if running in Docker
      await fs.access("/.dockerenv");
      info.environment = "docker";
    } catch {
      info.environment = "native";
    }

    return info;
  }

  /**
   * Get database-specific diagnostic information
   */
  async getDatabaseInfo(config) {
    const info = {
      host: config.host,
      port: config.port,
      database: config.database,
      socketPath: config.socketPath,
      useSocket: config.useSocket,
    };

    // Check if socket file exists
    if (config.socketPath) {
      try {
        await fs.access(config.socketPath);
        info.socketExists = true;
      } catch {
        info.socketExists = false;
      }
    }

    // Check if host is reachable (basic ping)
    info.hostReachable = await this.checkHostReachability(
      config.host,
      config.port
    );

    return info;
  }

  /**
   * Check if host is reachable
   */
  async checkHostReachability(host, port) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000);

      const net = require("net");
      const socket = new net.Socket();

      socket.on("connect", () => {
        socket.destroy();
        clearTimeout(timeout);
        resolve(true);
      });

      socket.on("error", () => {
        clearTimeout(timeout);
        resolve(false);
      });

      socket.connect(port, host);
    });
  }

  /**
   * Diagnose missing socket file
   */
  async diagnoseMissingSocket(config) {
    const suggestions = [
      `Socket file not found at ${config.socketPath}`,
      "Switch to TCP connection by setting DB_USE_SOCKET=false",
      "Verify MySQL/MariaDB is running: sudo systemctl status mysql",
      "Check MySQL socket configuration in /etc/mysql/my.cnf",
      "Common socket locations: /var/run/mysqld/mysqld.sock, /tmp/mysql.sock",
    ];

    // Check common socket locations
    const commonSockets = [
      "/var/run/mysqld/mysqld.sock",
      "/var/lib/mysql/mysql.sock",
      "/tmp/mysql.sock",
      "/opt/lampp/var/mysql/mysql.sock",
    ];

    for (const socketPath of commonSockets) {
      try {
        await fs.access(socketPath);
        suggestions.push(`Found socket at alternative location: ${socketPath}`);
        break;
      } catch {
        // Socket not found at this location
      }
    }

    return suggestions;
  }

  /**
   * Diagnose connection refused errors
   */
  async diagnoseConnectionRefused(config) {
    return [
      "Database server is not running or not accepting connections",
      "Start MySQL/MariaDB: sudo systemctl start mysql",
      "Check if database is listening on the correct port",
      "Verify firewall settings are not blocking the connection",
      "Check if bind-address in MySQL config allows connections",
      `Test connection manually: mysql -h ${config.host} -P ${config.port} -u ${config.user} -p`,
    ];
  }

  /**
   * Diagnose permission denied errors
   */
  async diagnosePermissionDenied(config) {
    return [
      "Permission denied accessing socket file or database",
      "Check socket file permissions: ls -la " + config.socketPath,
      "Add application user to mysql group: sudo usermod -a -G mysql $USER",
      "Verify database user has necessary privileges",
      "Check MySQL user permissions: SHOW GRANTS FOR 'user'@'host';",
    ];
  }

  /**
   * Diagnose timeout errors
   */
  async diagnoseTimeout(config) {
    return [
      "Connection timeout - database may be overloaded or slow",
      "Increase timeout values in configuration",
      "Check database performance and load",
      "Verify network connectivity is stable",
      "Consider using connection pooling with appropriate limits",
      "Monitor database slow query log for bottlenecks",
    ];
  }

  /**
   * Diagnose authentication failures
   */
  async diagnoseAuthFailure(config) {
    return [
      "Database authentication failed - check credentials",
      "Verify username and password are correct",
      "Check if user exists: SELECT User, Host FROM mysql.user;",
      "Verify user has access to the database",
      "Grant necessary permissions: GRANT ALL ON moodle.* TO 'user'@'host';",
      "Flush privileges after changes: FLUSH PRIVILEGES;",
    ];
  }

  /**
   * Diagnose host not found errors
   */
  async diagnoseHostNotFound(config) {
    return [
      `Database host '${config.host}' not found`,
      "Check if hostname is correct",
      "Verify DNS resolution: nslookup " + config.host,
      "Try using IP address instead of hostname",
      "Check /etc/hosts file for local hostname mappings",
      "If using localhost, try 127.0.0.1 instead",
    ];
  }

  /**
   * Get generic suggestions for unknown errors
   */
  async getGenericSuggestions(error, config) {
    return [
      "Unknown database error occurred",
      "Check database server logs for more details",
      "Verify all configuration parameters are correct",
      "Test database connection manually",
      "Check network connectivity",
      "Restart database service if necessary",
      "Contact system administrator if problem persists",
    ];
  }

  /**
   * Generate a comprehensive diagnostic report
   */
  async generateReport(error, config) {
    const diagnosis = await this.diagnoseConnectionError(error, config);

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        error: diagnosis.error,
        code: diagnosis.code,
        type: diagnosis.type,
      },
      environment: diagnosis.systemInfo,
      database: diagnosis.databaseInfo,
      resolution: {
        suggestions: diagnosis.suggestions,
        priority: this.prioritizeSuggestions(diagnosis.suggestions),
      },
    };

    return report;
  }

  /**
   * Prioritize suggestions based on likely success
   */
  prioritizeSuggestions(suggestions) {
    const priorities = {
      high: suggestions.filter(
        (s) =>
          s.includes("Switch to TCP") ||
          s.includes("systemctl start") ||
          s.includes("Found socket at")
      ),
      medium: suggestions.filter(
        (s) =>
          s.includes("Check") ||
          s.includes("Verify") ||
          s.includes("Test connection")
      ),
      low: suggestions.filter(
        (s) =>
          !s.includes("Switch to TCP") &&
          !s.includes("systemctl") &&
          !s.includes("Found socket") &&
          !s.includes("Check") &&
          !s.includes("Verify") &&
          !s.includes("Test connection")
      ),
    };

    return priorities;
  }

  /**
   * Auto-resolve common issues where possible
   */
  async autoResolve(error, config) {
    const results = {
      attempted: [],
      successful: [],
      failed: [],
    };

    // Attempt to switch to TCP if socket fails
    if (error.code === "ENOENT" && config.useSocket) {
      results.attempted.push("Switch from socket to TCP connection");
      try {
        // This would be handled by the DatabaseManager
        results.successful.push("Suggested TCP fallback");
      } catch (err) {
        results.failed.push(`TCP fallback failed: ${err.message}`);
      }
    }

    return results;
  }
}

module.exports = DiagnosticsManager;
