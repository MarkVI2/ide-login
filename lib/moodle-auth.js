/**
 * Moodle Authentication Utility
 * Handles various Moodle password formats and user validation
 */

const bcrypt = require("bcrypt");
const crypto = require("crypto");
const apacheMd5 = require("apache-md5");

class MoodleAuth {
  constructor(databaseManager, config = {}) {
    this.db = databaseManager;
    this.tablePrefix = config.tablePrefix || "mdl_";
    this.userTable = `${this.tablePrefix}user`;
  }

  /**
   * Authenticate user against Moodle database
   */
  async authenticateUser(username, password) {
    try {
      // Sanitize username
      const sanitizedUsername = username.toString().trim();
      if (!sanitizedUsername || sanitizedUsername.length > 100) {
        throw new Error("Invalid username format");
      }

      // Query user from database
      const user = await this.getUserByUsername(sanitizedUsername);
      if (!user) {
        throw new Error("User not found");
      }

      // Check if user account is active
      if (user.deleted === 1) {
        throw new Error("User account is deleted");
      }

      if (user.suspended === 1) {
        throw new Error("User account is suspended");
      }

      if (user.confirmed === 0) {
        throw new Error("User account is not confirmed");
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(password, user.password);
      if (!isPasswordValid) {
        throw new Error("Invalid password");
      }

      // Return user information (without password)
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        fullname: `${user.firstname} ${user.lastname}`.trim(),
        auth: user.auth,
        timecreated: user.timecreated,
        timemodified: user.timemodified,
        lastlogin: user.lastlogin,
      };
    } catch (error) {
      console.error("Moodle authentication error:", error.message);
      throw error;
    }
  }

  /**
   * Get user by username from Moodle database
   */
  async getUserByUsername(username) {
    const query = `
      SELECT 
        id, username, password, email, firstname, lastname, auth,
        confirmed, deleted, suspended, timecreated, timemodified, lastlogin
      FROM ${this.userTable} 
      WHERE username = ? AND deleted = 0
      LIMIT 1
    `;

    const results = await this.db.query(query, [username]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Verify Moodle password against stored hash
   * Supports multiple Moodle password formats
   */
  async verifyPassword(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) {
      return false;
    }

    try {
      // 1. bcrypt format ($2y$ or $2a$)
      if (hashedPassword.startsWith("$2y$") || hashedPassword.startsWith("$2a$")) {
        return await bcrypt.compare(plainPassword, hashedPassword);
      }

      // 2. MD5 crypt format ($1$...)
      if (hashedPassword.startsWith("$1$")) {
        const cryptResult = apacheMd5(plainPassword, hashedPassword);
        return cryptResult === hashedPassword;
      }

      // 3. Legacy plain MD5 (32 character hex)
      if (hashedPassword.length === 32 && /^[a-f0-9]+$/i.test(hashedPassword)) {
        const md5Hash = crypto.createHash("md5").update(plainPassword).digest("hex");
        return md5Hash.toLowerCase() === hashedPassword.toLowerCase();
      }

      // 4. Salted MD5 format (hash:salt)
      if (hashedPassword.includes(":")) {
        const [hash, salt] = hashedPassword.split(":");
        if (hash.length === 32 && salt) {
          const saltedHash = crypto.createHash("md5").update(plainPassword + salt).digest("hex");
          return saltedHash.toLowerCase() === hash.toLowerCase();
        }
      }

      // 5. SHA1 format (40 character hex)
      if (hashedPassword.length === 40 && /^[a-f0-9]+$/i.test(hashedPassword)) {
        const sha1Hash = crypto.createHash("sha1").update(plainPassword).digest("hex");
        return sha1Hash.toLowerCase() === hashedPassword.toLowerCase();
      }

      console.warn(`Unsupported password hash format: ${hashedPassword.substring(0, 10)}...`);
      return false;
    } catch (error) {
      console.error("Password verification error:", error);
      return false;
    }
  }

  /**
   * Get Moodle database statistics
   */
  async getDatabaseStats() {
    try {
      const queries = {
        totalUsers: `SELECT COUNT(*) as count FROM ${this.userTable} WHERE deleted = 0`,
        activeUsers: `SELECT COUNT(*) as count FROM ${this.userTable} WHERE deleted = 0 AND suspended = 0 AND confirmed = 1`,
        adminUsers: `SELECT COUNT(*) as count FROM ${this.userTable} WHERE deleted = 0 AND username IN ('admin', 'administrator')`,
        recentLogins: `SELECT COUNT(*) as count FROM ${this.userTable} WHERE deleted = 0 AND lastlogin > UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 30 DAY))`,
      };

      const results = {};
      for (const [key, query] of Object.entries(queries)) {
        const result = await this.db.query(query);
        results[key] = result[0].count;
      }

      return results;
    } catch (error) {
      console.error("Error getting database stats:", error);
      throw error;
    }
  }

  /**
   * Test database connection and verify Moodle schema
   */
  async testMoodleConnection() {
    try {
      // Check if user table exists
      const tableQuery = `SHOW TABLES LIKE '${this.userTable}'`;
      const tables = await this.db.query(tableQuery);
      
      if (tables.length === 0) {
        throw new Error(`Moodle user table '${this.userTable}' not found`);
      }

      // Check table structure
      const structureQuery = `DESCRIBE ${this.userTable}`;
      const structure = await this.db.query(structureQuery);
      
      const requiredFields = ["id", "username", "password", "email", "firstname", "lastname"];
      const existingFields = structure.map(field => field.Field);
      const missingFields = requiredFields.filter(field => !existingFields.includes(field));
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
      }

      // Get basic stats
      const stats = await this.getDatabaseStats();
      
      return {
        success: true,
        message: "Moodle database connection verified",
        table: this.userTable,
        fields: existingFields.length,
        stats
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error.code || "UNKNOWN"
      };
    }
  }

  /**
   * Update user's last login time
   */
  async updateLastLogin(userId) {
    try {
      const query = `UPDATE ${this.userTable} SET lastlogin = UNIX_TIMESTAMP() WHERE id = ?`;
      await this.db.query(query, [userId]);
      return true;
    } catch (error) {
      console.error("Error updating last login:", error);
      return false;
    }
  }
}

module.exports = MoodleAuth;
