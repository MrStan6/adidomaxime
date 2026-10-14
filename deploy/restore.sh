#!/usr/bin/env bash
# =====================================================================
# Restauration d'une sauvegarde (base + photos).
#
#   ./deploy/restore.sh backups/db-20261014-020000.dump [backups/uploads-20261014-020000.tar.gz]
#
# ATTENTION : remplace INTÉGRALEMENT les données actuelles. Faire d'abord
# une sauvegarde de l'état présent (./deploy/backup.sh) si elles ont une
# valeur. Le site est arrêté pendant l'opération.
# =====================================================================
set -euo pipefail

DB_DUMP="${1:?Indiquez le fichier db-….dump à restaurer}"
UPLOADS_ARCHIVE="${2:-}"
DB_DUMP="$(realpath "$DB_DUMP")"
[ -n "$UPLOADS_ARCHIVE" ] && UPLOADS_ARCHIVE="$(realpath "$UPLOADS_ARCHIVE")"
cd "$(dirname "$0")"

read -r -p "Remplacer les données actuelles par $DB_DUMP ? Tapez RESTAURER pour confirmer : " answer
[ "$answer" = "RESTAURER" ] || { echo "Abandon."; exit 1; }

echo "→ Arrêt du site…"
docker compose stop app

echo "→ Restauration de la base…"
docker compose exec -T db psql -U hotel -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'hotel' AND pid <> pg_backend_pid();" \
  -c "DROP DATABASE IF EXISTS hotel;" -c "CREATE DATABASE hotel OWNER hotel;"
docker compose exec -T db pg_restore -U hotel -d hotel --no-owner --exit-on-error < "$DB_DUMP"

if [ -n "$UPLOADS_ARCHIVE" ]; then
  echo "→ Restauration des photos…"
  docker compose run --rm --no-deps -T --entrypoint sh app -c \
    "rm -rf /app/storage/uploads/* && tar xzf - -C /app/storage" < "$UPLOADS_ARCHIVE"
fi

echo "→ Redémarrage du site…"
docker compose up -d app
echo "✓ Restauration terminée. Vérifiez https://\$DOMAIN/api/health puis le tableau de bord."
