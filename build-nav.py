#!/usr/bin/env python3
"""
build-nav.py — Stamp _nav-template.html + _nav-styles.css into every page.
EDIT those two files only. Then run: python3 build-nav.py && git push
"""
import re, os, glob

ROOT = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(ROOT, '_nav-template.html'), 'r') as f:
    NAV_HTML = f.read().strip()

with open(os.path.join(ROOT, '_nav-styles.css'), 'r') as f:
    NAV_CSS = f.read().strip()

NAV_CSS_BLOCK = f'/* @@NAV_CSS_START@@ */\n{NAV_CSS}\n/* @@NAV_CSS_END@@ */'

SKIP = {'_nav-template.html'}
PAGES = [f for f in glob.glob(os.path.join(ROOT, '*.html')) if os.path.basename(f) not in SKIP]

for path in PAGES:
    with open(path, 'r') as f: c = f.read()
    orig = c

    # 1. Stamp nav HTML
    if '<!-- @@NAV_START@@ -->' in c:
        c = re.sub(r'<!-- @@NAV_START@@ -->.*?<!-- @@NAV_END@@ -->', NAV_HTML, c, flags=re.DOTALL)
    else:
        c = c.replace('<body>', '<body>\n\n' + NAV_HTML + '\n', 1)

    # 2. Stamp nav CSS — replace sentinel block or inject before </style>
    if '@@NAV_CSS_START@@' in c:
        c = re.sub(r'/\* @@NAV_CSS_START@@ \*/.*?/\* @@NAV_CSS_END@@ \*/', NAV_CSS_BLOCK, c, flags=re.DOTALL)
    else:
        c = c.replace('</style>', NAV_CSS_BLOCK + '\n  </style>', 1)

    if c != orig:
        with open(path, 'w') as f: f.write(c)
        print(f"✅ {os.path.basename(path)}")
    else:
        print(f"–  {os.path.basename(path)} (no change)")

print("\nDone. Run: git add -A && git commit -m 'chore: sync nav' && git push")
