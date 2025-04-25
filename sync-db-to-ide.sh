#!/bin/bash
# sync-db-to-ide.sh
# Database sync script for Judge0 IDE

# Log file for tracking sync operations
LOG_FILE="/var/log/db-sync.log"

# Ensure log directory exists
mkdir -p "$(dirname $LOG_FILE)"
touch $LOG_FILE

# Get container ID of the ide-login container
CONTAINER_ID=$(docker ps | grep judge0-ide-app | awk '{print $1}')

if [ -z "$CONTAINER_ID" ]; then
  echo "$(date): Error - IDE container not found" >> $LOG_FILE
  exit 1
fi

echo "$(date): Starting database sync to container $CONTAINER_ID" >> $LOG_FILE

# Rsync the database files to a temporary directory
rsync -avz --delete $MOODLE_DB_PATH/ $TEMP_SYNC_DIR/ >> $LOG_FILE 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "$(date): Error - Failed to rsync database files to temp dir. Exit code: $EXIT_CODE" >> $LOG_FILE
  exit $EXIT_CODE
fi

# Copy the synced files into the container
docker cp $TEMP_SYNC_DIR/. $CONTAINER_ID:/var/lib/mysql/ >> $LOG_FILE 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "$(date): Error - Failed to copy files to container. Exit code: $EXIT_CODE" >> $LOG_FILE
  exit $EXIT_CODE
fi

echo "$(date): Database sync completed successfully" >> $LOG_FILE