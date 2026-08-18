#!/bin/bash
# MongoDB backup utility script

MONGO_URI_VAL=${MONGO_URI:-"mongodb://localhost:27017/lyvo"}
BACKUP_TIME=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="./backups/backup-$BACKUP_TIME"

mkdir -p "$BACKUP_DIR"
echo "💾 Starting database backup to $BACKUP_DIR..."

if mongodump --uri="$MONGO_URI_VAL" --out="$BACKUP_DIR"; then
  echo "✅ Database backup created successfully"
else
  echo "❌ Error: database backup failed"
  exit 1
fi
