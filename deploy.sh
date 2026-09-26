#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
command -v wrangler >/dev/null
wrangler whoami
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Refusing deployment with uncommitted files.' >&2
  exit 1
fi
python3 tests.py
python3 build.py
wrangler pages deploy dist --project-name=ford-demo --branch=main --commit-hash="$(git rev-parse HEAD)"
python3 verify_production.py
