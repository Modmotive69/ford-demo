#!/usr/bin/env python3
"""
sync-nav-footer.py
Source of truth: index.html
Copies nav HTML, footer HTML, and nav/footer CSS into every other page.
Run after ANY nav/footer change.
"""
import re, os

ROOT = os.path.dirname(os.path.abspath(__file__))
def read(f): return open(os.path.join(ROOT,f),encoding='utf-8').read()
def write(f,c): open(os.path.join(ROOT,f),'w',encoding='utf-8').write(c)

src = read('index.html')

# --- Extract nav HTML ---
nav_s = src.find('<!-- @@NAV_START@@ -->')
nav_e = src.find('<!-- @@NAV_END@@ -->') + len('<!-- @@NAV_END@@ -->')
NAV_HTML = src[nav_s:nav_e].strip()

# --- Extract footer HTML ---
foot_s = src.find('<!-- @@FOOTER_START@@ -->')
foot_e = src.find('<!-- @@FOOTER_END@@ -->') + len('<!-- @@FOOTER_END@@ -->')
FOOTER_HTML = src[foot_s:foot_e].strip()

# --- Extract nav+btn+footer CSS rules from index.html <style> block ---
style_content = re.search(r'<style>(.*?)</style>', src, re.DOTALL)
if style_content:
    css = style_content.group(1)
    # Grab every rule whose selector starts with nav, .nav-, .btn, .hamburger, .sidebar, .site-footer
    rules = re.findall(
        r'(?:^|\n)( {0,8}(?:nav|\.nav-|\.btn|\.hamburger|\.sidebar|\.site-footer)[^\n{]*\{[^{}]+\})',
        css, re.MULTILINE
    )
    # Also grab @media blocks that contain nav rules
    media = re.findall(
        r'(@media[^{]+\{[^{}]*(?:nav|\.nav-|\.btn|\.hamburger|\.footer)[^{}]*\{[^{}]+\}[^{}]*\})',
        css, re.DOTALL
    )
    NAV_CSS = '\n'.join(r.strip() for r in rules) + '\n' + '\n'.join(media)
else:
    NAV_CSS = ''

NAV_CSS_BLOCK = f'/* @@NAV_CSS_START@@ */\n{NAV_CSS}\n/* @@NAV_CSS_END@@ */'

PAGES = [f for f in os.listdir(ROOT) if f.endswith('.html') and f != 'index.html']

for page in PAGES:
    c = read(page)

    # Sync nav HTML
    c = re.sub(
        r'<!-- @@NAV_START@@ -->.*?<!-- @@NAV_END@@ -->',
        NAV_HTML, c, flags=re.DOTALL
    )
    # Sync footer HTML
    c = re.sub(
        r'<!-- @@FOOTER_START@@ -->.*?<!-- @@FOOTER_END@@ -->',
        FOOTER_HTML, c, flags=re.DOTALL
    )
    # Sync nav CSS
    c = re.sub(
        r'/\* @@NAV_CSS_START@@ \*/.*?/\* @@NAV_CSS_END@@ \*/',
        NAV_CSS_BLOCK, c, flags=re.DOTALL
    )

    write(page, c)
    print(f"Synced: {page}")

print("Done.")
