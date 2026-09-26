"""Allowlisted distribution builder. Operational files never enter public output."""
from pathlib import Path
import subprocess, shutil, json
ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/'dist'
if DIST.exists(): shutil.rmtree(DIST)
DIST.mkdir()
for name in ('index.html','enroll.html','product.html','dealer-agreement.html'):
    shutil.copy2(ROOT/name,DIST/name)
for directory, extensions in {'images':{'.jpg','.jpeg','.png','.webp','.svg'},'fonts':{'.woff','.woff2','.otf'},'js':{'.js'},'models':{'.glb'},'videos':{'.mp4','.webm'}}.items():
    for source in (ROOT/directory).glob('*'):
        if source.is_file() and source.suffix.lower() in extensions:
            target=DIST/directory/source.name
            target.parent.mkdir(exist_ok=True)
            shutil.copy2(source,target)
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
(DIST/'build.json').write_text(json.dumps({'commit':sha})+'\n')
# Demo intake and unapproved commercial claims: keep entire preview unindexed.
(DIST/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
(DIST/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n')
(DIST/'_headers').write_text('''/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  X-Robots-Tag: noindex, nofollow
  Permissions-Policy: microphone=(), geolocation=(), payment=()
  Content-Security-Policy-Report-Only: default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; upgrade-insecure-requests
''')
print('Built allowlisted dist for',sha)
