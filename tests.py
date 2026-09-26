#!/usr/bin/env python3
import re,subprocess,tempfile
from pathlib import Path
from html.parser import HTMLParser
class Audit(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.scripts=[];self.current=None;self.skip=0;self.text=[]
 def handle_starttag(self,tag,attrs):
  names=[k for k,v in attrs];assert len(names)==len(set(names)),('duplicate attribute',tag,names)
  d=dict(attrs)
  if 'id' in d:self.ids.append(d['id'])
  if tag=='script' and 'src' not in d:self.current=''
  if tag in ('script','style'):self.skip+=1
 def handle_data(self,data):
  if self.current is not None:self.current+=data
  if not self.skip:self.text.append(data)
 def handle_endtag(self,tag):
  if tag=='script' and self.current is not None:self.scripts.append(self.current);self.current=None
  if tag in ('script','style'):self.skip-=1
for name in ['index.html','enroll.html','product.html','dealer-agreement.html']:
 s=Path(name).read_text();p=Audit();p.feed(s);assert len(p.ids)==len(set(p.ids)),(name,'duplicate ID');assert '—' not in ''.join(p.text),(name,'visible em dash')
 for script in p.scripts:
  with tempfile.NamedTemporaryFile(suffix='.js',mode='w') as f:f.write(script);f.flush();subprocess.run(['node','--check',f.name],check=True,capture_output=True)
 print('PASS HTML attributes, IDs, visible copy and JavaScript syntax:',name)
s=Path('index.html').read_text();script=s[s.index('    var ratesAvg = 805;'):s.index('  </script>',s.index('    var ratesAvg = 805;'))]
js="""const assert=require('node:assert/strict');const els={};global.document={getElementById(id){return els[id]??={value:'100',style:{},addEventListener(){},textContent:''};}};\n"""+script+"""
for(let v=100;v<=800;v+=50){roiInput.value=String(v);calcROI();for(const [rate,key] of [[805,'avg'],[1200,'top']]){const actual=Number(els['ann-'+key+'-profit-val'].textContent.replace(/[^0-9]/g,''));assert.equal(actual,Math.round(v*rate*12*.31));assert.ok(els['chart-'+key+'-profit'].textContent);}}console.log('PASS all 15 calculator steps, exact annual profit, monthly profit outputs');
"""
subprocess.run(['node','-e',js],check=True)
e=Path('enroll.html').read_text();assert '<fieldset disabled' in e and 'new FormData' not in e and 'console.log' not in e and "You're enrolled" not in e;assert 'novalidate' not in e
assert 'brandFordEngage' not in s+e
assert 'wrangler pages deploy dist' in Path('deploy.sh').read_text()
subprocess.run(['node','--check','shared.js'],check=True)
print('PASS enrollment fail-closed, safe branding and isolated deployment assertions')
