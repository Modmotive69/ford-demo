"""Stage only public website assets; never deploy the repository root."""
from pathlib import Path
import subprocess, shutil, hashlib, json
root = Path(__file__).resolve().parent
out = root / 'release-public'
if out.exists():
    raise SystemExit('release-public already exists; choose/archive the previous stage before building')
public_roots = {'css','fonts','images','js','models','videos'}
public_top = {'index.html','enroll.html','dealer-agreement.html','dealer-agreement.docx','engage360-viewer.html','how-it-works.html','product.html','zip-lookup.js','dealer-suggest.js','price-lookup.js','enrollment-draft.js','price-config.json','.cache-bust'}
asset_suffixes = {'.css','.otf','.ttf','.woff','.woff2','.jpg','.jpeg','.png','.webp','.svg','.gif','.ico','.js','.glb','.gltf','.mp4','.webm','.bin','.json'}
def permitted(rel):
    return str(rel) in public_top or (len(rel.parts)>1 and rel.parts[0] in public_roots and rel.suffix.lower() in asset_suffixes and not any(p.startswith('.') for p in rel.parts))
files = {}
# Preserve previously staged public-only assets/documents, then override from source.
old = root / 'dist'
if old.exists():
    for src in old.rglob('*'):
        if src.is_file() and not src.is_symlink() and permitted(src.relative_to(old)):
            files[str(src.relative_to(old))] = src
for name in subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines():
    src=root/name
    if src.is_file() and not src.is_symlink() and permitted(Path(name)):
        files[name]=src
manifest=[]
for name,src in sorted(files.items()):
    if src.stat().st_size > 25*1024*1024:
        raise SystemExit('Asset exceeds Pages limit: '+name)
    dest=out/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest)
    manifest.append({'path':name,'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
(out/'_headers').write_text(
'/enroll\n  Cache-Control: no-store\n'
'/enroll.html\n  Cache-Control: no-store\n'
'/enrollment-draft.js\n  Cache-Control: no-cache\n'
'/dealer-agreement\n  Cache-Control: no-cache\n'
'/images/ford-showroom-render.webp\n  Content-Type: image/webp\n  X-Content-Type-Options: nosniff\n'
)
report=root/'test-results/submission-release-manifest.json';report.parent.mkdir(exist_ok=True);report.write_text(json.dumps(manifest,indent=2))
print('Staged',len(manifest),'public files; no functions/server/tests/config/secrets in asset directory.')
