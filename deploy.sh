#!/bin/bash
# FordEngage deploy script — run this from the Mac mini
# Usage: bash ~/Projects/fordengage/deploy.sh

cd ~/Projects/fordengage

echo "🔍 Checking wrangler auth..."
if ! wrangler whoami 2>&1 | grep -q "logged in"; then
  echo "🔑 Not logged in — opening browser login..."
  wrangler login
fi

echo ""
echo "🚀 Deploying to fordengage.livecode.tech..."
# Build a clean public-only stage; build-public.py refuses to reuse stale output.
python3 build-public.py || exit 1
wrangler pages deploy release-public --project-name=ford-demo --branch=main || exit 1

echo ""
echo "✅ Done! Check https://fordengage.livecode.tech"
