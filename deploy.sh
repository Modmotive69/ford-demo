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
wrangler pages deploy . --project-name=ford-demo --branch=main

echo ""
echo "✅ Done! Check https://fordengage.livecode.tech"
