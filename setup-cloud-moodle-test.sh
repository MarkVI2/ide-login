#!/bin/bash
# setup-cloud-moodle-test.sh
# Automated script to set up a test Moodle database on a cloud VM

echo "=========================================================="
echo "Moodle Test Database Setup for Cloud VM"
echo "=========================================================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Configuration
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD:-"$(openssl rand -base64 32)"}
MOODLE_DB_NAME=${MOODLE_DB_NAME:-"moodle_test"}
MOODLE_DB_USER=${MOODLE_DB_USER:-"moodle_user"}
MOODLE_DB_PASSWORD=${MOODLE_DB_PASSWORD:-"$(openssl rand -base64 24)"}

print_status $BLUE "Installing MariaDB and required packages..."

# Update system packages
sudo apt-get update -y

# Install MariaDB server
sudo apt-get install -y mariadb-server mariadb-client

# Secure MariaDB installation
print_status $YELLOW "Securing MariaDB installation..."
sudo mysql_secure_installation << EOF

y
${MYSQL_ROOT_PASSWORD}
${MYSQL_ROOT_PASSWORD}
y
y
y
y
EOF

print_status $GREEN "MariaDB installed and secured"

# Create Moodle database and user
print_status $BLUE "Creating Moodle test database..."

sudo mysql -u root -p${MYSQL_ROOT_PASSWORD} << EOF
-- Create database
CREATE DATABASE IF NOT EXISTS ${MOODLE_DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER IF NOT EXISTS '${MOODLE_DB_USER}'@'localhost' IDENTIFIED BY '${MOODLE_DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${MOODLE_DB_USER}'@'%' IDENTIFIED BY '${MOODLE_DB_PASSWORD}';

-- Grant privileges
GRANT ALL PRIVILEGES ON ${MOODLE_DB_NAME}.* TO '${MOODLE_DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON ${MOODLE_DB_NAME}.* TO '${MOODLE_DB_USER}'@'%';

-- Flush privileges
FLUSH PRIVILEGES;

-- Show grants
SHOW GRANTS FOR '${MOODLE_DB_USER}'@'localhost';
EOF

print_status $GREEN "Database and user created successfully"

# Create Moodle user table with sample data
print_status $BLUE "Creating Moodle user table with test data..."

sudo mysql -u root -p${MYSQL_ROOT_PASSWORD} ${MOODLE_DB_NAME} << 'EOF'
-- Create mdl_user table (simplified Moodle user table)
CREATE TABLE IF NOT EXISTS mdl_user (
    id BIGINT(10) NOT NULL AUTO_INCREMENT,
    auth VARCHAR(20) NOT NULL DEFAULT 'manual',
    confirmed TINYINT(1) NOT NULL DEFAULT 0,
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    suspended TINYINT(1) NOT NULL DEFAULT 0,
    username VARCHAR(100) NOT NULL DEFAULT '',
    password VARCHAR(255) NOT NULL DEFAULT '',
    email VARCHAR(100) NOT NULL DEFAULT '',
    firstname VARCHAR(100) NOT NULL DEFAULT '',
    lastname VARCHAR(100) NOT NULL DEFAULT '',
    timecreated BIGINT(10) NOT NULL DEFAULT 0,
    timemodified BIGINT(10) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY mdl_user_username_ix (username),
    KEY mdl_user_email_ix (email),
    KEY mdl_user_confirmed_ix (confirmed),
    KEY mdl_user_deleted_ix (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert test users with different password formats
-- User 1: bcrypt password (modern Moodle)
INSERT INTO mdl_user (auth, confirmed, deleted, suspended, username, password, email, firstname, lastname, timecreated, timemodified) VALUES
('manual', 1, 0, 0, 'testuser1', '$2y$10$abcdefghijklmnopqrstuvwxyz123456789ABCDEFG', 'test1@example.com', 'Test', 'User1', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- User 2: MD5 crypt password (older Moodle)
INSERT INTO mdl_user (auth, confirmed, deleted, suspended, username, password, email, firstname, lastname, timecreated, timemodified) VALUES
('manual', 1, 0, 0, 'testuser2', '$1$salt123$hashedpassword123456789', 'test2@example.com', 'Test', 'User2', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- User 3: Legacy MD5 password
INSERT INTO mdl_user (auth, confirmed, deleted, suspended, username, password, email, firstname, lastname, timecreated, timemodified) VALUES
('manual', 1, 0, 0, 'testuser3', '5d41402abc4b2a76b9719d911017c592', 'test3@example.com', 'Test', 'User3', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- User 4: Admin user with bcrypt password for "admin123"
INSERT INTO mdl_user (auth, confirmed, deleted, suspended, username, password, email, firstname, lastname, timecreated, timemodified) VALUES
('manual', 1, 0, 0, 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@example.com', 'Admin', 'User', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- User 5: Inactive user (for testing account validation)
INSERT INTO mdl_user (auth, confirmed, deleted, suspended, username, password, email, firstname, lastname, timecreated, timemodified) VALUES
('manual', 0, 0, 0, 'inactive', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'inactive@example.com', 'Inactive', 'User', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- User 6: Deleted user (for testing)
INSERT INTO mdl_user (auth, confirmed, deleted, suspended, username, password, email, firstname, lastname, timecreated, timemodified) VALUES
('manual', 1, 1, 0, 'deleted', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'deleted@example.com', 'Deleted', 'User', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- Show created users
SELECT id, username, email, firstname, lastname, confirmed, deleted, suspended FROM mdl_user ORDER BY id;
EOF

print_status $GREEN "Test users created successfully"

# Configure MariaDB for remote connections
print_status $BLUE "Configuring MariaDB for remote connections..."

# Backup original config
sudo cp /etc/mysql/mariadb.conf.d/50-server.cnf /etc/mysql/mariadb.conf.d/50-server.cnf.backup

# Update bind address
sudo sed -i 's/^bind-address\s*=.*/bind-address = 0.0.0.0/' /etc/mysql/mariadb.conf.d/50-server.cnf

# Restart MariaDB
sudo systemctl restart mariadb

print_status $GREEN "MariaDB configured for remote connections"

# Create .env file for the authentication server
print_status $BLUE "Creating .env configuration file..."

cat > .env << EOF
# Generated Moodle Test Database Configuration
# Created: $(date)

# Application Settings
NODE_ENV=development
APP_PORT=3000

# Database Configuration - TCP
DB_HOST=localhost
DB_PORT=3306
DB_USER=${MOODLE_DB_USER}
DB_PASSWORD=${MOODLE_DB_PASSWORD}
DB_NAME=${MOODLE_DB_NAME}
DB_DEBUG=false

# Database Configuration - Socket (alternative)
DB_SOCKET=/var/run/mysqld/mysqld.sock
DB_USE_SOCKET=false

# Connection Pool Settings
DB_CONNECTION_LIMIT=10
DB_TIMEOUT=60000
DB_RETRY_ATTEMPTS=3
DB_RETRY_DELAY=5000

# Moodle Configuration
MOODLE_TABLE_PREFIX=mdl_

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_USER_ID=admin-1
ADMIN_FIRSTNAME=Admin
ADMIN_LASTNAME=User

# Security
DEBUG_TOKEN=$(openssl rand -hex 16)
EOF

print_status $GREEN ".env file created"

# Save credentials to a secure file
cat > moodle_credentials.txt << EOF
========================================================
MOODLE TEST DATABASE CREDENTIALS
========================================================

MySQL Root Password: ${MYSQL_ROOT_PASSWORD}
Database Name: ${MOODLE_DB_NAME}
Database User: ${MOODLE_DB_USER}
Database Password: ${MOODLE_DB_PASSWORD}

Test Users:
- Username: testuser1, Password: password123 (bcrypt)
- Username: testuser2, Password: password123 (MD5 crypt)
- Username: testuser3, Password: hello (legacy MD5)
- Username: admin, Password: admin123 (bcrypt)
- Username: inactive, Password: admin123 (unconfirmed)
- Username: deleted, Password: admin123 (deleted)

Connection String: mysql://${MOODLE_DB_USER}:${MOODLE_DB_PASSWORD}@localhost:3306/${MOODLE_DB_NAME}

========================================================
EOF

chmod 600 moodle_credentials.txt

print_status $GREEN "Setup completed successfully!"
print_status $YELLOW "Credentials saved to: moodle_credentials.txt"
print_status $YELLOW "Environment config saved to: .env"

echo
print_status $BLUE "Next steps:"
echo "1. Clone your authentication server repository"
echo "2. Copy the .env file to your project directory"
echo "3. Install dependencies: npm install"
echo "4. Start the server: npm start"
echo "5. Test the authentication endpoints"

echo
print_status $BLUE "Test the database connection:"
echo "mysql -u ${MOODLE_DB_USER} -p${MOODLE_DB_PASSWORD} -h localhost ${MOODLE_DB_NAME}"

echo
print_status $BLUE "Firewall configuration (if needed):"
echo "sudo ufw allow 3306/tcp  # Allow MySQL connections"
echo "sudo ufw allow 3000/tcp  # Allow Node.js server"

print_status $GREEN "Setup script completed!"
