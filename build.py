#!/usr/bin/env python3
"""Publish only HTML and its explicitly referenced local assets, never the repo root."""
import hashlib,json,re,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'dist'
PAGES=['index.html','enroll.html','product.html','dealer-agreement.html']
if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir()
queue=PAGES+['shared.css','shared.js','_headers','robots.txt','sitemap.xml','404.html']
seen=set()
while queue:
 name=queue.pop(0)
 if name in seen: continue
 path=ROOT/name
 if not path.is_file() or not path.resolve().is_relative_to(ROOT): raise RuntimeError('Invalid public asset: '+name)
 if name not in PAGES+['shared.css','shared.js','_headers','robots.txt','sitemap.xml','404.html'] and (Path(name).parts[0] not in ['images','fonts','js','models'] or path.suffix.lower() not in ['.jpg','.jpeg','.png','.webp','.svg','.mp4','.otf','.woff2','.js','.glb']): raise RuntimeError('Not allowlisted: '+name)
 seen.add(name); dest=OUT/name; dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,dest)
 if path.suffix in ['.html','.css','.js'] and name!='js/model-viewer.min.js':
  text=path.read_text()
  queue.extend(re.findall(r'''(?:["'(])((?:images|fonts|js|models)/[^"'()\s<>]+)''',text))
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
dirty=bool(subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=ROOT,text=True).strip())
(OUT/'build.json').write_text(json.dumps({'sha':sha,'dirty':dirty,'files':{p:hashlib.sha256((OUT/p).read_bytes()).hexdigest() for p in sorted(seen)}},indent=2)+'\n')
print(f'Built {len(seen)} allowlisted files at {sha}; dirty={dirty}')
