#!/bin/sh
set -e

# nextjs system user has no home dir; give npm/npx a writable cache location
export HOME=/tmp
export NPM_CONFIG_CACHE=/tmp/.npm-cache

echo "🚀 Starting TalentFlow AI..."

if [ -n "$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d 2>/dev/null)" ]; then
  echo "⏳ Running database migrations..."
  if ! npx prisma migrate deploy; then
    echo "Migration deploy failed; checking for existing unbaselined database..."
    if node node_modules/prisma/build/index.js migrate status 2>&1 | grep -q "P3005"; then
      echo "Existing schema detected without Prisma migration history."
      echo "Syncing current Prisma schema without destructive changes..."
      node node_modules/prisma/build/index.js db push --skip-generate

      echo "Baselining existing migration folders..."
      for migration in prisma/migrations/*; do
        if [ -d "$migration" ]; then
          node node_modules/prisma/build/index.js migrate resolve --applied "$(basename "$migration")" || true
        fi
      done
    else
      exit 1
    fi
  fi
else
  echo "⏳ No migrations found; syncing database schema..."
  npx prisma db push --accept-data-loss
fi

echo "🌱 Applying seed data (idempotent)..."
node node_modules/prisma/build/index.js db execute --file prisma/seed.sql --schema prisma/schema.prisma || echo "⚠️  Seed step failed (non-fatal)."

echo "✅ Starting Next.js server..."
exec node server.js
