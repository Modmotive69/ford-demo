#!/usr/bin/env python3
"""
sync-nav-footer.py
Source of truth: index.html
Run after ANY nav or footer change — stamps both into every page automatically.
Called by GitHub Actions on every push.
"""
import re, os

ROOT = os.path.dirname(os.path.abspath(__file__))
def read(f): return open(os.path.join(ROOT,f),encoding='utf-8').read()
def write(f,c): open(os.path.join(ROOT,f),'w',encoding='utf-8').write(c)

idx = read('index.html')

nav_s = idx.find('<!-- ═══ NAV ═══ -->')
nav_e = idx.find('\n\n  <!-- ═══ HERO', nav_s)
NAV_HTML = idx[nav_s:nav_e].strip()

foot_s = idx.find('<footer class="site-footer">')
foot_e = idx.find('</footer>', foot_s) + len('</footer>')
FOOTER_HTML = idx[foot_s:foot_e].strip()

PAGES = [f for f in os.listdir(ROOT) if f.endswith('.html') and f != 'index.html']

for page in PAGES:
    c = read(page)
    orig = c

    c = re.sub(
        r'<!-- @@NAV_START@@ -->.*?<!-- @@NAV_END@@ -->',
        f'<!-- @@NAV_START@@ -->\n  {NAV_HTML}\n  <!-- @@NAV_END@@ -->',
        c, flags=re.DOTALL
    )
    c = re.sub(
        r'<!-- @@FOOTER_START@@ -->.*?<!-- @@FOOTER_END@@ -->',
        f'<!-- @@FOOTER_START@@ -->\n  {FOOTER_HTML}\n  <!-- @@FOOTER_END@@ -->',
        c, flags=re.DOTALL
    )

    if c != orig:
        write(page, c)
        print(f"Synced: {page}")

print("Nav/footer sync complete.")
