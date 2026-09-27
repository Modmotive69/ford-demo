#!/usr/bin/env python3
"""Rendered menu regression; no enrollment submissions or external transactions."""
import json, sys
from urllib.parse import urlparse
from pathlib import Path
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8769'
results = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in [320, 390, 768, 1440]:
        page = browser.new_page(viewport={'width': width, 'height': 720}, reduced_motion='reduce')
        for name in ['index.html', 'enroll.html']:
            page.goto(base + '/' + name, wait_until='networkidle')
            page.evaluate('document.fonts.ready')
            menu = page.locator('.hamburger-btn')
            drawer = page.locator('#sidebar')
            for scroll in [0, 500]:
                page.evaluate('(y)=>scrollTo(0,y)', scroll)
                page.wait_for_timeout(150)
                box = menu.bounding_box()
                assert box and box['x'] >= 0 and box['x'] + box['width'] <= width
                assert menu.evaluate("e=>getComputedStyle(e).color") == ('rgb(255, 255, 255)' if scroll == 0 else 'rgb(0, 52, 120)')
                assert page.locator('.hamburger-icon').evaluate("e=>['', '::before','::after'].every(p=>{const s=getComputedStyle(e,p||null);return s.backgroundColor!=='rgba(0, 0, 0, 0)'&&parseFloat(s.height)>=2})")
                menu.click()
                page.wait_for_timeout(250)
                assert menu.get_attribute('aria-expanded') == 'true'
                assert drawer.evaluate("e=>!e.inert && e.contains(document.activeElement) && getComputedStyle(e).backgroundColor==='rgb(255, 255, 255)'")
                assert drawer.evaluate('e=>e.scrollWidth<=e.clientWidth')
                assert page.evaluate("document.body.style.overflow==='hidden'")
                links = drawer.locator('a[href]')
                assert links.all_text_contents() == [' Home', ' Enroll Now']
                for link in links.all():
                    assert link.is_visible()
                    assert link.evaluate("e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}")
                assert drawer.locator('[aria-disabled=true]').count() == 6
                brand = drawer.locator('.sidebar-header > span')
                assert brand.evaluate('e=>e.getBoundingClientRect().height<35')
                page.keyboard.press('Shift+Tab')
                assert links.last.evaluate('e=>e===document.activeElement')
                page.keyboard.press('Tab')
                assert drawer.locator('.sidebar-close').evaluate('e=>e===document.activeElement')
                Path('test-results').mkdir(exist_ok=True)
                page.screenshot(path=f'test-results/menu-{width}-{name}-{scroll}.png')
                page.keyboard.press('Escape')
                page.wait_for_timeout(50)
                assert drawer.evaluate('e=>e.inert')
                assert menu.evaluate('e=>e===document.activeElement')
                assert page.evaluate("document.body.style.overflow==='' && !document.querySelector('.site-header').inert")
                menu.click()
                drawer.locator('.sidebar-close').click()
                page.wait_for_timeout(50)
                assert menu.evaluate('e=>e===document.activeElement')
                menu.click()
                page.locator('#sidebar-overlay').click(position={'x':width-8,'y':350})
                page.wait_for_timeout(50)
                assert drawer.evaluate('e=>e.inert')
                assert page.evaluate("document.body.style.overflow===''")
            if name == 'enroll.html':
                assert page.locator('#enroll-form input:enabled:not([type=hidden])').count() == 0
            menu.click()
            destination = 'enroll.html' if name == 'index.html' else 'index.html'
            drawer.locator(f'a[href="{destination}"]').click()
            # Cloudflare Pages canonicalizes /enroll.html to /enroll and /index.html to /.
            paths = ['/index.html', '/'] if destination == 'index.html' else ['/enroll.html', '/enroll']
            page.wait_for_url(lambda url: urlparse(url).path in paths)
            assert page.locator('#enroll-form' if destination == 'enroll.html' else '.hero').count() == 1
            results.append({'page': name, 'width': width, 'visibleBarsAndLinks': True, 'escapeCloseOverlayFocusTrapScroll': True, 'navigation': destination})
        page.close()
    browser.close()
print(json.dumps(results, indent=2))
