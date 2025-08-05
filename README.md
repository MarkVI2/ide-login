# Judge0 IDE - Moodle Authentication System

A robust Node.js authentication server that integrates Judge0 IDE with Moodle
user accounts, supporting multiple password hash formats, comprehensive error
diagnostics, and production-ready deployment.

## Features

- **Multi-format password support**: bcrypt, MD5 crypt, legacy MD5
- **Moodle database integration** with proper user validation
- **Environment-based configuration** for secure deployments
- **Cross-origin support** for frontend integration
- **Comprehensive error handling** and intelligent diagnostics
- **Docker-ready** with automated deployment scripts
- **Health monitoring** and debugging endpoints
- **Comprehensive testing** suite with cloud VM setup
- **Auto-resolution** for common database connection issues

## Quick Start

### Option 1: Local Development

```bash
# Clone the repository
git clone https://github.com/MarkVI2/ide-login.git
cd ide-login

# Install dependencies
npm install

# Setup environment (interactive)
./setup-ide-environment.sh

# Start the server
npm start

# Test the API
./comprehensive-api-test.sh
```

### Option 2: Cloud VM with Test Database

```bash
# On a fresh Ubuntu/Debian cloud VM
wget https://raw.githubusercontent.com/MarkVI2/ide-login/main/setup-cloud-moodle-test.sh
chmod +x setup-cloud-moodle-test.sh
sudo ./setup-cloud-moodle-test.sh

# Clone and start the authentication server
git clone https://github.com/MarkVI2/ide-login.git
cd ide-login
npm install
npm start
```

### Option 3: Docker Deployment

```bash
# Build and start with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f

# Test deployment
./test-auth-system.sh
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file (copy from `.env.example`):

| Variable              | Description                       | Default                       | Required |
| --------------------- | --------------------------------- | ----------------------------- | -------- |
| `DB_HOST`             | Database hostname                 | `localhost`                   | Yes      |
| `DB_PORT`             | Database port                     | `3306`                        | Yes      |
| `DB_USER`             | Database username                 | `moodle_user`                 | Yes      |
| `DB_PASSWORD`         | Database password                 | `moodle_password`             | Yes      |
| `DB_NAME`             | Database name                     | `moodle`                      | Yes      |
| `DB_SOCKET`           | Socket path for local connections | `/var/run/mysqld/mysqld.sock` | No       |
| `DB_USE_SOCKET`       | Use socket instead of TCP         | `false`                       | No       |
| `MOODLE_TABLE_PREFIX` | Moodle table prefix               | `mdl_`                        | No       |
| `ADMIN_USERNAME`      | Admin account username            | `admin`                       | No       |
| `ADMIN_PASSWORD`      | Admin account password            | `muadmin2025`                 | No       |
| `DEBUG_TOKEN`         | Token for debug endpoints         | `debug123`                    | No       |

### Database Connection Strategies

The system automatically tries multiple connection strategies:

1. **Socket Connection** (if `DB_USE_SOCKET=true`)

   - Fastest for local databases
   - Falls back to TCP if socket fails

2. **TCP Connection** (default)
   - Works for local and remote databases
   - More compatible across environments

## 🎓 Moodle Integration

### Database Requirements

The system connects to your Moodle database and validates users with these
constraints:

- `deleted = 0` (not deleted)
- `suspended = 0` (not suspended)
- `confirmed = 1` (email confirmed)
- Valid password hash format

### Supported Password Formats

| Format         | Example               | Description              |
| -------------- | --------------------- | ------------------------ |
| **bcrypt**     | `$2y$10$abcdefg...`   | Modern Moodle (3.5+)     |
| **MD5 crypt**  | `$1$salt$hash...`     | Older Moodle with salt   |
| **Legacy MD5** | `5d41402abc4b2a76...` | Plain MD5 (32 hex chars) |

### Example Password Hashes

```javascript
// bcrypt (recommended): password = "password123"
$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi

// MD5 crypt: password = "password123"
$1$salt123$hashedpassword123456789

// Legacy MD5: password = "hello"
5d41402abc4b2a76b9719d911017c592
```

## 🌐 API Documentation

### Authentication Endpoint

**POST** `/api/moodle-login`

```json
{
  "username": "student123",
  "password": "userpassword"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "userId": "12345",
  "username": "student123",
  "fullName": "John Doe",
  "firstname": "John",
  "lastname": "Doe",
  "email": "john.doe@university.edu",
  "isAdmin": false,
  "authMethod": "manual",
  "loginTime": "2025-01-20T10:30:00.000Z",
  "message": "Authentication successful"
}
```

**Error Response (401):**

```json
{
  "success": false,
  "message": "Invalid username or password",
  "error": "INVALID_CREDENTIALS",
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

### Monitoring Endpoints

#### Health Check

**GET** `/api/health`

Returns system health status including database connectivity.

#### Diagnostics

**GET** `/api/diagnostics`

Comprehensive system diagnostics including:

- Environment information
- Database status and performance
- Moodle connection validation

#### Troubleshooting

**GET** `/api/troubleshoot`

Requires: `Authorization: Bearer YOUR_DEBUG_TOKEN`

Detailed troubleshooting information with:

- Configuration validation
- Connection error diagnosis
- Resolution suggestions

### Frontend Integration

```javascript
// Login function for frontend
async function authenticateUser(username, password) {
  try {
    const response = await fetch("/api/moodle-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (data.success) {
      // Store user info and redirect to IDE
      localStorage.setItem("user", JSON.stringify(data));
      window.location.href = "https://code.euclid-mu.in";
    } else {
      // Show error message
      showError(data.message);
    }
  } catch (error) {
    showError("Authentication service unavailable");
  }
}
```

## 🚨 Error Handling & Diagnostics

### Common Database Connection Errors

| Error Code               | Description           | Auto-Resolution           |
| ------------------------ | --------------------- | ------------------------- |
| `ENOENT`                 | Socket file not found | ✅ Falls back to TCP      |
| `ECONNREFUSED`           | Connection refused    | ❌ Check DB status        |
| `EACCES`                 | Permission denied     | ❌ Check file permissions |
| `ER_ACCESS_DENIED_ERROR` | Auth failed           | ❌ Check credentials      |

### Diagnostic Tools

1. **Health Check**: Monitor real-time system status
2. **Auto-diagnosis**: Intelligent error analysis with suggestions
3. **Troubleshoot Endpoint**: Detailed system information for debugging
4. **Comprehensive Logging**: Structured logs with sanitized sensitive data

### Resolution Suggestions

The system provides intelligent suggestions for common issues:

```bash
# Socket connection failed example
curl http://localhost:3000/api/health
# Response includes:
# "suggestions": [
#   "Switch to TCP connection by setting DB_USE_SOCKET=false",
#   "Verify MySQL is running: sudo systemctl status mysql",
#   "Check socket path: ls -la /var/run/mysqld/mysqld.sock"
# ]
```

## 🧪 Testing

### Comprehensive Test Suite

```bash
# Run all tests
./comprehensive-api-test.sh

# Verbose output
VERBOSE=true ./comprehensive-api-test.sh

# Test against different server
BASE_URL=https://your-domain.com ./comprehensive-api-test.sh
```

### Test Categories

1. **Basic Health Tests** - Server availability and health endpoints
2. **Performance Tests** - Response time validation
3. **Authentication Logic** - Login flow validation
4. **Security Tests** - SQL injection, XSS protection
5. **Error Handling** - Malformed requests and edge cases
6. **CORS Tests** - Cross-origin request handling
7. **Database Tests** - Connection and query validation
8. **Load Tests** - Basic concurrent request handling

### Setting Up Test Data

The `setup-cloud-moodle-test.sh` script creates sample users:

| Username    | Password      | Format     | Status       |
| ----------- | ------------- | ---------- | ------------ |
| `admin`     | `admin123`    | bcrypt     | Active admin |
| `testuser1` | `password123` | bcrypt     | Active user  |
| `testuser2` | `password123` | MD5 crypt  | Active user  |
| `testuser3` | `hello`       | Legacy MD5 | Active user  |
| `inactive`  | `admin123`    | bcrypt     | Unconfirmed  |
| `deleted`   | `admin123`    | bcrypt     | Deleted      |

## 🐳 Docker Support

### Docker Compose Setup

```yaml
version: "3.8"
services:
  auth-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=mariadb
      - DB_USER=moodle_user
      - DB_PASSWORD=secure_password
      - DB_NAME=moodle
    depends_on:
      - mariadb

  mariadb:
    image: mariadb:10.6
    environment:
      - MYSQL_ROOT_PASSWORD=root_password
      - MYSQL_DATABASE=moodle
      - MYSQL_USER=moodle_user
      - MYSQL_PASSWORD=secure_password
```

### Production Deployment

```bash
# Build production image
docker build -t judge0-auth-server .

# Run with production config
docker run -d \
  --name auth-server \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DB_HOST=your-db-host \
  -e DB_PASSWORD=your-secure-password \
  judge0-auth-server
```

## 🔒 Security Considerations

### Production Checklist

- [ ] Change default admin credentials
- [ ] Use strong database passwords
- [ ] Generate secure debug token: `openssl rand -hex 16`
- [ ] Set `NODE_ENV=production`
- [ ] Configure firewall rules
- [ ] Enable HTTPS/TLS
- [ ] Restrict database access to necessary hosts
- [ ] Regularly rotate credentials
- [ ] Monitor authentication logs
- [ ] Keep dependencies updated

### Security Headers

The server automatically sets security headers:

- CORS configuration for allowed origins
- Request sanitization and validation
- SQL injection prevention
- XSS protection through input validation

## 📊 Monitoring & Logging

### Log Structure

```json
{
  "timestamp": "2025-01-20T10:30:00.000Z",
  "level": "info",
  "message": "Moodle login successful",
  "username": "student123",
  "userId": "12345",
  "clientIP": "192.168.1.100",
  "authMethod": "moodle"
}
```

### Performance Metrics

Monitor these endpoints for system health:

- `/api/health` - Overall system status
- `/api/diagnostics` - Detailed performance metrics
- Database connection pool statistics
- Response time monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add your feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Submit a Pull Request

### Development Setup

```bash
# Clone and setup
git clone https://github.com/MarkVI2/ide-login.git
cd ide-login
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

## 📞 Support

- **Documentation**: [GitHub Wiki](https://github.com/MarkVI2/ide-login/wiki)
- **Issues**: [GitHub Issues](https://github.com/MarkVI2/ide-login/issues)
- **Discussions**:
  [GitHub Discussions](https://github.com/MarkVI2/ide-login/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.

## 🙏 Acknowledgments

- Judge0 API for the online code execution platform
- Moodle community for the learning management system
- MariaDB/MySQL for reliable database support | `ADMIN_PASSWORD` | Admin account
  password | `muadmin2025` | | `DEBUG_TOKEN` | Token for accessing debug
  endpoints | `debug123` | | `NODE_ENV` | Environment mode | `development` |

### CORS Configuration

The server is configured to allow cross-origin requests from:

- `https://code.euclid-mu.in` (Judge0 IDE)
- `https://ide-login.euclid-mu.in` (This auth server)
- `http://localhost:3000` (Development)
- `http://localhost:8080` (Development)

## API Endpoints

### Authentication

#### `POST /api/moodle-login`

Authenticate user against Moodle database.

**Request:**

```json
{
  "username": "student123",
  "password": "userpassword"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "userId": "12345",
  "username": "student123",
  "fullName": "John Doe",
  "email": "john@example.com",
  "isAdmin": false,
  "loginTime": "2025-08-05T10:30:00.000Z"
}
```

**Error Response (401):**

```json
{
  "success": false,
  "message": "Invalid username or password",
  "error": "INVALID_PASSWORD"
}
```

### Monitoring

#### `GET /api/health`

Check system health and database connectivity.

#### `GET /api/test`

Basic API test endpoint.

#### `GET /api/db-info`

Database information (requires `Authorization: Bearer <DEBUG_TOKEN>`).

## Deployment

### Production Deployment

1. **Secure your environment variables:**

   ```bash
   # Generate secure admin password
   ADMIN_PASSWORD=$(openssl rand -base64 32)

   # Generate secure debug token
   DEBUG_TOKEN=$(openssl rand -hex 16)
   ```

2. **Configure database access:**

   ```bash
   # For remote database
   DB_HOST=your-moodle-db-server.com
   DB_PORT=3306

   # For local database file
   DB_SOCKET=/path/to/mysql.sock
   ```

3. **Start with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

### Database Sync (Optional)

For environments where Moodle database files need to be synced:

```bash
# The sync script runs automatically via cron
# Check sync logs
tail -f /var/log/db-sync.log

# Manual sync
./sync-db-to-ide.sh
```

## Troubleshooting

### Common Issues

#### 1. 500 Internal Server Error

**Symptoms:** Login attempts return 500 status **Debugging:**

```bash
# Check server logs
docker-compose logs judge0-ide-app

# Test database connection
curl -H "Authorization: Bearer your_debug_token" \
  http://localhost:3000/api/db-info

# Verify environment variables
docker exec judge0-ide-app env | grep DB_
```

**Common causes:**

- Database connection failed
- Wrong database credentials
- Database not accessible from container
- Malformed request body

#### 2. CORS Issues

**Symptoms:** Browser console shows CORS errors **Solution:**

- Verify origin is in allowed list
- Check that credentials are included in requests
- Ensure preflight requests are handled

#### 3. Password Verification Fails

**Symptoms:** Valid users can't login **Debugging:**

```bash
# Check password formats in database
curl -H "Authorization: Bearer your_debug_token" \
  http://localhost:3000/api/db-info
```

**Check user constraints:**

```sql
SELECT username, auth, confirmed, suspended, deleted,
       SUBSTRING(password, 1, 10) as password_prefix
FROM mdl_user
WHERE username = 'problem_user';
```

#### 4. Database Connection Issues

**For socket connections:**

```bash
# Verify socket exists and is accessible
ls -la /var/run/mysqld/mysqld.sock
docker exec judge0-ide-app ls -la /var/run/mysqld/
```

**For TCP connections:**

```bash
# Test connection from container
docker exec judge0-ide-app nc -zv your-db-host 3306
```

### Debug Mode

Enable verbose logging:

```bash
DB_DEBUG=true docker-compose up
```

### Testing

Run the comprehensive test suite:

```bash
./test-auth-system.sh
```

## Security Considerations

1. **Change default passwords** in production
2. **Use strong database credentials**
3. **Restrict database access** to necessary hosts only
4. **Enable HTTPS** in production
5. **Regularly rotate** debug tokens
6. **Monitor logs** for suspicious activity
7. **Keep dependencies updated**

## Development

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run tests
./test-auth-system.sh
```

### Password Hash Testing

To test different password formats, create test users:

```sql
-- bcrypt user
INSERT INTO mdl_user (username, password, firstname, lastname, email, auth, confirmed)
VALUES ('test_bcrypt', '$2y$10$abcdefghijk...', 'Test', 'Bcrypt', 'test@example.com', 'manual', 1);

-- MD5 crypt user
INSERT INTO mdl_user (username, password, firstname, lastname, email, auth, confirmed)
VALUES ('test_md5crypt', '$1$salt$hash...', 'Test', 'MD5Crypt', 'test2@example.com', 'manual', 1);

-- Legacy MD5 user
INSERT INTO mdl_user (username, password, firstname, lastname, email, auth, confirmed)
VALUES ('test_md5', '5d41402abc4b2a76b9719d911017c592', 'Test', 'MD5', 'test3@example.com', 'manual', 1);
```

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review server logs: `docker-compose logs`
3. Test with the provided test script
4. Verify database connectivity and user constraints Project

## Overview

This project is a Node.js application that serves as a backend for the Judge0
IDE. It utilizes Express to handle HTTP requests and connects to a MySQL
database for user authentication.

## Project Structure

```
judge0-ide
├── server.js          # Main application logic
├── package.json       # npm configuration and dependencies
├── Dockerfile         # Docker configuration for containerization
├── .dockerignore      # Files to ignore when building the Docker image
└── README.md          # Project documentation
```

## Setup Instructions

### Prerequisites

- Node.js (version 14 or higher)
- npm (Node package manager)
- MySQL database

### Installation

1. Clone the repository:

   ```
   git clone <repository-url>
   cd judge0-ide
   ```

2. Install dependencies:
   ```
   npm install
   ```

### Running the Application

To start the server, run:

```
npm start
```

The server will be available at `http://localhost:3000`.

### Docker Setup

To build and run the application using Docker, follow these steps:

1. Build the Docker image:

   ```
   docker build -t judge0-ide .
   ```

2. Run the Docker container:
   ```
   docker run -p 3000:3000 judge0-ide
   ```

The application will be accessible at `http://localhost:3000`.

## API Endpoints

- **GET /api/test**: A test endpoint to verify that the server is running.
- **POST /api/moodle-login**: Endpoint for user authentication against the
  Moodle database.

## Notes

- Ensure to update the database configuration in `server.js` with your MySQL
  credentials.
- For production use, consider securing the admin credentials and using
  environment variables for sensitive information.
