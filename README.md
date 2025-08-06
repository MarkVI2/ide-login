# Judge0 IDE - Moodle Authentication System

A robust Node.js authentication server that integrates Judge0 IDE with Moodle
user accounts, supporting multiple password hash formats and production-ready
deployment.

## Features

- **Multi-format password support**: bcrypt, MD5 crypt, legacy MD5
- **Moodle database integration** with proper user validation
- **Environment-based configuration** for secure deployments
- **Cross-origin support** for https://code.euclid-mu.in
- **Comprehensive error handling** and logging
- **Docker-ready** with automated deployment scripts
- **Health monitoring** and debugging endpoints

## Quick Start

### 1. Setup Environment

```bash
# Run the interactive setup script
./setup-ide-environment.sh

# Or manually create .env file with:
DB_HOST=localhost
DB_PORT=3306
DB_USER=moodle_user
DB_PASSWORD=moodle_password
DB_NAME=moodle
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
```

### 2. Deploy with Docker

```bash
# Build and start the container
docker-compose up -d

# Check logs
docker-compose logs -f

# Test the deployment
./test-auth-system.sh
```

### 3. Test Authentication

Visit `http://localhost:3000/login.html` or test the API directly:

```bash
# Test admin login
curl -X POST http://localhost:3000/api/moodle-login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_admin_password"}'

# Test health check
curl http://localhost:3000/api/health
```

## Moodle Integration

### Database Requirements

The system connects to your Moodle database and validates users with these
constraints:

- `deleted = 0` (not deleted)
- `suspended = 0` (not suspended)
- `confirmed = 1` (email confirmed)
- `auth = 'manual'` (manual authentication)

### Supported Password Formats

1. **bcrypt** (`$2y$` or `$2a$`) - Modern Moodle installations
2. **MD5 crypt** (`$1$salt$hash`) - Older installations with salt
3. **Legacy MD5** - Plain MD5 hashes (32 hex characters)

Example password verification:

```javascript
// bcrypt: $2y$10$abcdefghijklmnopqrstuvwxyz...
// MD5 crypt: $1$salt123$hashedpassword
// Legacy MD5: 5d41402abc4b2a76b9719d911017c592
```

## Configuration

### Environment Variables

| Variable         | Description                         | Default           |
| ---------------- | ----------------------------------- | ----------------- |
| `DB_HOST`        | Database hostname                   | `localhost`       |
| `DB_PORT`        | Database port                       | `3306`            |
| `DB_USER`        | Database username                   | `moodle_user`     |
| `DB_PASSWORD`    | Database password                   | `moodle_password` |
| `DB_NAME`        | Database name                       | `moodle`          |
| `ADMIN_USERNAME` | Admin account username              | `admin`           |
| `ADMIN_PASSWORD` | Admin account password              | `muadmin2025`     |
| `DEBUG_TOKEN`    | Token for accessing debug endpoints | `debug123`        |
| `NODE_ENV`       | Environment mode                    | `development`     |

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
