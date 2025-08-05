#!/usr/bin/env node
/**
 * API Demo Script - Judge0 Moodle Authentication
 * Demonstrates how to interact with the authentication API programmatically
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

class AuthAPIDemo {
  constructor(baseUrl = "http://localhost:3000", debugToken = "debug123") {
    this.baseUrl = baseUrl;
    this.debugToken = debugToken;
  }

  // Make HTTP request helper
  async makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      const isHttps = url.protocol === "https:";
      const client = isHttps ? https : http;

      const requestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "AuthAPIDemo/1.0",
          ...options.headers,
        },
      };

      const req = client.request(requestOptions, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const jsonData = JSON.parse(data);
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: jsonData,
            });
          } catch (error) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: data,
            });
          }
        });
      });

      req.on("error", reject);

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  // Check if server is running
  async checkHealth() {
    console.log("🏥 Checking server health...");
    try {
      const response = await this.makeRequest("/api/health");
      console.log(`Status: ${response.statusCode}`);
      console.log("Health Data:", JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.error("❌ Health check failed:", error.message);
      return null;
    }
  }

  // Get comprehensive diagnostics
  async getDiagnostics() {
    console.log("\n🔍 Getting system diagnostics...");
    try {
      const response = await this.makeRequest("/api/diagnostics");
      console.log(`Status: ${response.statusCode}`);
      console.log("Diagnostics:", JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.error("❌ Diagnostics failed:", error.message);
      return null;
    }
  }

  // Get troubleshooting information
  async getTroubleshooting() {
    console.log("\n🛠️ Getting troubleshooting information...");
    try {
      const response = await this.makeRequest("/api/troubleshoot", {
        headers: { Authorization: `Bearer ${this.debugToken}` },
      });
      console.log(`Status: ${response.statusCode}`);
      console.log("Troubleshoot Data:", JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.error("❌ Troubleshooting failed:", error.message);
      return null;
    }
  }

  // Attempt login
  async login(username, password) {
    console.log(`\n🔐 Attempting login for user: ${username}`);
    try {
      const response = await this.makeRequest("/api/moodle-login", {
        method: "POST",
        body: { username, password },
      });

      console.log(`Status: ${response.statusCode}`);

      if (response.data.success) {
        console.log("✅ Login successful!");
        console.log("User Info:", {
          userId: response.data.userId,
          username: response.data.username,
          fullName: response.data.fullName,
          email: response.data.email,
          isAdmin: response.data.isAdmin,
        });
      } else {
        console.log("❌ Login failed:", response.data.message);
        console.log("Error:", response.data.error);
      }

      return response.data;
    } catch (error) {
      console.error("❌ Login request failed:", error.message);
      return null;
    }
  }

  // Test various login scenarios
  async runLoginTests() {
    console.log("\n🧪 Running login tests...");

    const testCases = [
      {
        username: "admin",
        password: "muadmin2025",
        description: "Admin with default password",
      },
      {
        username: "admin",
        password: "wrongpassword",
        description: "Admin with wrong password",
      },
      {
        username: "testuser1",
        password: "password123",
        description: "Test user 1 (bcrypt)",
      },
      {
        username: "testuser2",
        password: "password123",
        description: "Test user 2 (MD5 crypt)",
      },
      {
        username: "testuser3",
        password: "hello",
        description: "Test user 3 (legacy MD5)",
      },
      {
        username: "nonexistent",
        password: "anypassword",
        description: "Non-existent user",
      },
      { username: "", password: "test", description: "Empty username" },
      { username: "test", password: "", description: "Empty password" },
    ];

    const results = [];

    for (const testCase of testCases) {
      console.log(`\n📝 Test: ${testCase.description}`);
      const result = await this.login(testCase.username, testCase.password);
      results.push({
        ...testCase,
        success: result?.success || false,
        error: result?.error,
      });

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  // Performance test
  async performanceTest(iterations = 10) {
    console.log(`\n⚡ Running performance test (${iterations} requests)...`);

    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < iterations; i++) {
      promises.push(this.makeRequest("/api/test"));
    }

    try {
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`✅ Performance test completed:`);
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Average time per request: ${avgTime.toFixed(2)}ms`);
      console.log(`   Requests per second: ${(1000 / avgTime).toFixed(2)}`);

      return { totalTime, avgTime, requestsPerSecond: 1000 / avgTime };
    } catch (error) {
      console.error("❌ Performance test failed:", error.message);
      return null;
    }
  }

  // Run full demo
  async runFullDemo() {
    console.log("🚀 Starting Judge0 Moodle Authentication API Demo");
    console.log(`🌐 Server: ${this.baseUrl}`);
    console.log(`🔑 Debug Token: ${this.debugToken}`);
    console.log("=".repeat(50));

    // Check health
    const health = await this.checkHealth();
    if (!health) {
      console.error(
        "❌ Server is not accessible. Please check if it's running."
      );
      return;
    }

    // Get diagnostics
    await this.getDiagnostics();

    // Get troubleshooting info
    await this.getTroubleshooting();

    // Run login tests
    const loginResults = await this.runLoginTests();

    // Performance test
    await this.performanceTest();

    // Summary
    console.log("\n📊 DEMO SUMMARY");
    console.log("=".repeat(50));
    console.log(
      `Server Status: ${health.success ? "✅ Healthy" : "❌ Degraded"}`
    );
    console.log(`Database Status: ${health.services?.database || "Unknown"}`);

    const successfulLogins = loginResults.filter((r) => r.success).length;
    const totalLogins = loginResults.length;
    console.log(`Login Tests: ${successfulLogins}/${totalLogins} successful`);

    console.log("\n🎯 NEXT STEPS:");
    console.log("1. Set up your Moodle database with test users");
    console.log(
      "2. Configure your .env file with correct database credentials"
    );
    console.log("3. Test with real Moodle users");
    console.log("4. Integrate with your frontend application");

    console.log("\n✨ Demo completed successfully!");
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || "http://localhost:3000";
  const debugToken = args[1] || "debug123";

  const demo = new AuthAPIDemo(baseUrl, debugToken);

  // Handle specific commands
  const command = args[2];

  switch (command) {
    case "health":
      demo.checkHealth();
      break;
    case "diagnostics":
      demo.getDiagnostics();
      break;
    case "troubleshoot":
      demo.getTroubleshooting();
      break;
    case "login":
      if (args[3] && args[4]) {
        demo.login(args[3], args[4]);
      } else {
        console.error(
          "Usage: node api-demo.js [BASE_URL] [DEBUG_TOKEN] login USERNAME PASSWORD"
        );
      }
      break;
    case "performance":
      const iterations = parseInt(args[3]) || 10;
      demo.performanceTest(iterations);
      break;
    default:
      demo.runFullDemo();
  }
}

module.exports = AuthAPIDemo;
