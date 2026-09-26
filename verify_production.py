#!/usr/bin/env python3
"""Verify edge provenance via Chromium, matching the supported public browser path."""
import json,subprocess,sys
from playwright.sync_api import sync_playwright
base=sys.argv[1] if len(sys.argv)>1 else 'https://fordengage.livecode.tech'
expected=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True);page=browser.new_page()
 page.goto(base,wait_until='domcontentloaded')
 results=page.evaluate('''async()=>{const out={};for(const path of ['/build.json','/robots.txt','/sitemap.xml','/deploy.sh']){const r=await fetch(path+'?verify='+Date.now(),{cache:'no-store'});out[path]={status:r.status,type:r.headers.get('content-type'),text:await r.text(),csp:r.headers.get('content-security-policy')};}return out;}''')
 build=results['/build.json'];assert build['status']==200
 data=json.loads(build['text']);assert data['sha']==expected and data['dirty'] is False,(data.get('sha'),expected)
 assert results['/deploy.sh']['status']==404, 'Operational deployment file still public'
 assert 'text/plain' in results['/robots.txt']['type']
 assert 'xml' in results['/sitemap.xml']['type']
 assert "form-action 'none'" in build['csp']
 print(json.dumps({'verified':base,'sha':expected,'operationalFileStatus':404,'robots':'text/plain','sitemap':'application/xml','securityPolicy':'present'},indent=2))
 browser.close()
