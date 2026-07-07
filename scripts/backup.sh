#!/bin/sh
# scripts/backup.sh — Daily PostgreSQL backup with retention
set -e

BACKUP_DIR=${BACKUP_DIR:-/backups}
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-presupuesto}
DB_USER=${DB_USER:-presupuesto}
RETENTION_DAYS=${RETENTION_DAYS:-7}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${BACKUP_DIR}/presupuesto_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" | gzip > "$FILENAME"

find "$BACKUP_DIR" -name "presupuesto_*.sql.gz" -mtime +$RETENTION_DAYS -delete
