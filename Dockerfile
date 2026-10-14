# =====================================================================
# Image de production du site (Next.js « standalone »).
#
# Cibles :
#   runner (par défaut) : serveur web léger, utilisateur non-root.
#   tools               : dépendances complètes + scripts, pour exécuter
#                         migrations, création de comptes, données de démo.
#
# Construction : docker compose -f deploy/docker-compose.yml build
# =====================================================================
ARG NODE_IMAGE=node:22-bookworm-slim

# --- Dépendances -------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- Construction ------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Valeurs factices uniquement pour la compilation : aucune requête n'est
# faite à la base pendant le build, les vraies valeurs sont lues au démarrage.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    APP_SECRET=build-time-placeholder-not-used-at-runtime-000000 \
    npm run build

# --- Outils (migrations, comptes, maintenance) --------------------------
FROM ${NODE_IMAGE} AS tools
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY db ./db
COPY scripts ./scripts
COPY src ./src
CMD ["npm", "run", "db:migrate"]

# --- Exécution -------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app \
 && mkdir -p /app/storage/uploads && chown -R app:app /app/storage
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
