#!/usr/bin/env python3
"""
build-nav.py — Stamp _nav-template.html into every page.
EDIT: _nav-template.html only. Then run: python3 build-nav.py
"""
import re, os, glob

ROOT = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(ROOT, '_nav-template.html'), 'r') as f:
    NAV = f.read().strip()

PAGES = [f for f in glob.glob(os.path.join(ROOT, '*.html'))
         if os.path.basename(f) not in ['_nav-template.html']]

for path in PAGES:
    with open(path, 'r') as f: c = f.read()
    orig = c

    # Replace between sentinels if they exist
    if '<!-- @@NAV_START@@ -->' in c:
        c = re.sub(
            r'<!-- @@NAV_START@@ -->.*?<!-- @@NAV_END@@ -->',
            NAV, c, flags=re.DOTALL
        )
    else:
        # No sentinels — inject after <body>
        c = c.replace('<body>', '<body>\n\n' + NAV + '\n', 1)

    if c != orig:
        with open(path, 'w') as f: f.write(c)
        print(f"✅ {os.path.basename(path)}")
    else:
        print(f"–  {os.path.basename(path)} (no change)")

print("\nDone. Commit and push to deploy.")
