#!/bin/bash
# MongoDB restore utility script

if [ -z "$1" ]; then
  echo "⚠️ Usage: ./restore.sh <path_to_backup_directory>"
  exit 1
fi

MONGO_URI_VAL=${MONGO_URI:-"mongodb://localhost:27017/lyvo"}
echo "🔄 Restoring database state from: $1..."

if mongorestore --uri="$MONGO_URI_VAL" "$1"; then
  echo "✅ Database restored successfully"
else
  echo "❌ Error: database restore failed"
  exit 1
fi
