#!/bin/bash
# setup-ide-environment.sh
# Interactive setup script for Judge0 IDE login server

echo "=========================================================="
echo "Judge0 IDE Login Server Setup"
echo "=========================================================="
echo
echo "This script will help you set up the Judge0 IDE login server"
echo "with connections to your Moodle database."
echo

# Create .env file
ENV_FILE="$(pwd)/.env"
echo "Creating environment file at $ENV_FILE"
> $ENV_FILE

# Function to prompt for variable
prompt_var() {
  local var_name=$1
  local var_desc=$2
  local default_val=$3
  local current_val=${!var_name}
  
  # If variable is already set, use it as default
  if [ -n "$current_val" ]; then
    default_val=$current_val
  fi
  
  # If default is provided, show it in the prompt
  if [ -n "$default_val" ]; then
    read -p "$var_desc [$default_val]: " user_input
    # If user didn't enter anything, use default
    if [ -z "$user_input" ]; then
      user_input=$default_val
    fi
  else
    # No default, require input
    while [ -z "$user_input" ]; do
      read -p "$var_desc (required): " user_input
    done
  fi
  
  # Set variable and add to .env file
  export $var_name="$user_input"
  echo "$var_name=$user_input" >> $ENV_FILE
  echo "Set $var_name=$user_input"
}

# Prompt for required variables
echo
echo "=== Database Configuration ==="
prompt_var "DB_HOST" "Database host" "localhost"
prompt_var "DB_PORT" "Database port" "3306"
prompt_var "DB_USER" "Database username" "moodle_user"
prompt_var "DB_PASSWORD" "Database password" "moodle_password"
prompt_var "DB_NAME" "Database name" "moodle"
prompt_var "DB_SOCKET" "Database socket path (for local connections)" "/var/run/mysqld/mysqld.sock"

echo
echo "=== Application Configuration ==="
prompt_var "APP_PORT" "Application port" "3000"

echo
echo "=== Database Sync Configuration ==="
prompt_var "MOODLE_DB_PATH" "Path to the Moodle database files" "/euclidms/euclid-db"
prompt_var "TEMP_SYNC_DIR" "Temporary directory for database sync" "/tmp/moodle-db-sync"
prompt_var "MOODLE_DB_MOUNT" "Path to mount Moodle DB in container" "/mnt/moodle-db"

# Create temporary sync directory
mkdir -p $TEMP_SYNC_DIR
echo "Created temporary sync directory: $TEMP_SYNC_DIR"

# Make scripts executable
chmod +x sync-db-to-ide.sh
echo "Made sync script executable"

# Set up cron job for syncing
echo
echo "=== Setting up cron job for database sync ==="
read -p "How often should the database be synced? (e.g., '*/30 * * * *' for every 30 minutes): " CRON_SCHEDULE
if [ -z "$CRON_SCHEDULE" ]; then
  CRON_SCHEDULE="*/30 * * * *"
  echo "Using default schedule: every 30 minutes"
fi

CRON_JOB="$CRON_SCHEDULE MOODLE_DB_PATH=$MOODLE_DB_PATH TEMP_SYNC_DIR=$TEMP_SYNC_DIR $(pwd)/sync-db-to-ide.sh > /dev/null 2>&1"
CRON_TMP=$(mktemp)

# Add to crontab if not already present
crontab -l > $CRON_TMP 2>/dev/null || echo "" > $CRON_TMP
if ! grep -q "sync-db-to-ide.sh" $CRON_TMP; then
  echo "$CRON_JOB" >> $CRON_TMP
  crontab $CRON_TMP
  echo "Cron job added to sync database $CRON_SCHEDULE"
else
  echo "Cron job already exists for database sync"
fi
rm $CRON_TMP

echo
echo "=== Building and starting Docker container ==="
read -p "Would you like to build and start the Docker container now? (y/n): " START_DOCKER
if [[ $START_DOCKER == [Yy]* ]]; then
  echo "Building Docker container..."
  docker-compose build
  
  echo "Starting Docker container..."
  docker-compose up -d
  
  echo "Docker container started!"
  docker ps | grep judge0-ide-app
else
  echo "You can start the Docker container later with 'docker-compose up -d'"
fi

echo
echo "=========================================================="
echo "Setup completed successfully!"
echo "=========================================================="
echo
echo "You can now access your IDE login server at: http://localhost:$APP_PORT"
echo "To check the logs: docker-compose logs -f"
echo "To stop the container: docker-compose down"
echo