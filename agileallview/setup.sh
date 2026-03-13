#!/bin/bash
# AgileAllView — Setup script
# Run this once after cloning: bash setup.sh

set -e

echo "🔧 AgileAllView Setup"
echo "─────────────────────"

# 1. Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo "✓ Created .env.local"
else
  echo "✓ .env.local already exists"
fi

# 2. Create database directory
mkdir -p database
echo "✓ database/ directory ready"

# 3. Install dependencies
echo "→ Installing npm dependencies..."
npm install

# 4. Initialize database
echo "→ Initializing SQLite database..."
npx tsx scripts/initDb.ts

echo ""
echo "✅ Setup complete! Run: npm run dev"
echo "   Then open: http://localhost:3000"
