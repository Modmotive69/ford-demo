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
python3 - <<'PY'
import json, subprocess, urllib.request
expected=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
req=urllib.request.Request('https://fordengage.livecode.tech/build.json?sha='+expected,headers={'User-Agent':'Mozilla/5.0'})
with urllib.request.urlopen(req,timeout=30) as r: actual=json.load(r)
assert actual['sha']==expected and actual['dirty'] is False, actual
print('Production build SHA verified:',expected)
PY
