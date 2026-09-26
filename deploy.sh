#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo 'Refusing deployment from uncommitted tracked changes.' >&2
  exit 1
fi
python3 -m unittest discover -s tests -v
python3 scripts/build.py
wrangler whoami >/dev/null
wrangler pages deploy dist --project-name=ford-demo --branch=main
# A successful upload is not proof the custom domain has updated.
python3 - <<'PY'
import json, subprocess, urllib.request
sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
request=urllib.request.Request('https://fordengage.livecode.tech/build.json?sha='+sha,headers={'Cache-Control':'no-cache'})
with urllib.request.urlopen(request,timeout=30) as response:
    actual=json.load(response)['commit']
if actual != sha:
    raise SystemExit('Upload finished, but custom-domain build SHA does not match. Deployment is NOT verified.')
print('Verified custom-domain build SHA:',sha)
PY
