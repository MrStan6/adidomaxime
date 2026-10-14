#!/usr/bin/env bash
# =====================================================================
# Sauvegarde complète : base de données + photos envoyées.
#
#   ./deploy/backup.sh                 # depuis la racine du projet
#   BACKUP_DIR=/srv/sauvegardes RETENTION_DAYS=30 ./deploy/backup.sh
#
# Produit deux fichiers horodatés :
#   db-AAAAMMJJ-HHMMSS.dump        (format personnalisé pg_dump, compressé)
#   uploads-AAAAMMJJ-HHMMSS.tar.gz (photos)
# À planifier chaque nuit (cron) ET à copier hors du serveur
# (voir docs/EXPLOITATION.md, « Copie hors site »).
# =====================================================================
set -euo pipefail

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-../backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "→ Sauvegarde de la base…"
docker compose exec -T db pg_dump -U hotel -d hotel --format=custom --no-owner \
  > "$BACKUP_DIR/db-$STAMP.dump.partial"
mv "$BACKUP_DIR/db-$STAMP.dump.partial" "$BACKUP_DIR/db-$STAMP.dump"

echo "→ Sauvegarde des photos…"
docker compose exec -T app tar czf - -C /app/storage uploads \
  > "$BACKUP_DIR/uploads-$STAMP.tar.gz.partial"
mv "$BACKUP_DIR/uploads-$STAMP.tar.gz.partial" "$BACKUP_DIR/uploads-$STAMP.tar.gz"

# Contrôle minimal : le fichier de base doit être lisible par pg_restore.
docker compose exec -T db pg_restore --list < "$BACKUP_DIR/db-$STAMP.dump" > /dev/null

echo "→ Suppression des sauvegardes de plus de $RETENTION_DAYS jours…"
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime +"$RETENTION_DAYS" -delete

echo "✓ Sauvegarde terminée : $BACKUP_DIR/db-$STAMP.dump et uploads-$STAMP.tar.gz"
