#!/bin/sh
set -e

# Apply any pending schema migrations, then bootstrap the org + superadmin.
# Both steps are idempotent (migrate deploy skips already-applied migrations;
# seed.ts upserts), so this is safe on every container start.
echo "→ Applying database migrations..."
node_modules/.bin/prisma migrate deploy

echo "→ Seeding org + superadmin (idempotent)..."
if node_modules/.bin/tsx prisma/seed.ts; then
  echo "✓ Seed complete."
else
  echo "⚠ Seed step failed — continuing startup. Check SUPERADMIN_EMAIL/PASSWORD."
fi

echo "→ Starting app..."
exec "$@"
