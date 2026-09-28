'use strict';
(() => {
 const form=document.getElementById('agreement-form');
 const $=id=>document.getElementById(id);
 const canonical=JSON.parse(document.getElementById('draft-agreement-data').textContent);
 const version=canonical.version;
 const consentText='I certify I am authorized to submit this information on behalf of the dealership and have read and agree to the terms.';
 const fields=['dealer','signature','title','phone','email'];
 const labels={dealer:'Dealership legal name',signature:'Name (Signature)',title:'Title',phone:'Phone',email:'Email'};
 const products=()=>Array.from(form.querySelectorAll('[name=products]:checked'),x=>x.value);
 const values=()=>Object.fromEntries(fields.map(id=>[id,$(id).value.trim()]));
 function summary(){
  const v=values();
  $('summary').textContent=`Agreement version: ${version}\nSelected products: ${products().join(' + ') || 'None — choose at least one'}\nConfiguration: ${$('configuration').value.trim() || 'Not specified'}\nDealership: ${v.dealer || 'Not entered'}\nName (Signature): ${v.signature || 'Not entered'}\nTitle: ${v.title || 'Not entered'}\nPhone: ${v.phone || 'Not entered'}\nEmail: ${v.email || 'Not entered'}\nConsent: ${$('consent').checked ? 'Checked in this local draft only' : 'Not checked'}\nPricing: unresolved — no amount assigned\nStatus: REVIEW DRAFT — not submitted or executed`;
 }
 function validate(){
  const errors=[];const v=values();
  for(const id of ['products',...fields,'consent']){$(id).removeAttribute('aria-invalid');$(id+'-error').textContent='';}
  const fail=(id,text)=>{errors.push(text);$(id).setAttribute('aria-invalid','true');$(id+'-error').textContent=text;};
  if(!products().length)fail('products','Choose at least one product.');
  for(const id of fields){
   if(!v[id])fail(id,`${labels[id]} is required.`);
   else if(id==='email' && !$('email').validity.valid)fail(id,'Enter a valid email address.');
   else if(id==='phone' && !/^(?:\+1[ .-]?)?(?:\([0-9]{3}\)|[0-9]{3})[ .-]?[0-9]{3}[ .-]?[0-9]{4}$/.test(v[id]))fail(id,'Enter a valid 10-digit phone number, for example 555-555-0100.');
  }
  if(!$('consent').checked)fail('consent','Read the terms and check the authorization and agreement checkbox.');
  $('errors').textContent=errors.length ? 'Please correct the following: '+errors.join(' ') : '';
  if(errors.length)$('errors').focus();
  return !errors.length;
 }
 form.addEventListener('input',()=>{summary();$('status').textContent='';});
 form.addEventListener('change',summary);
 form.addEventListener('submit',event=>{
  event.preventDefault();$('status').textContent='';if(!validate())return;
  const copy={recordType:'UNSUBMITTED_REVIEW_DRAFT',agreementVersion:version,selectedProducts:products(),configuration:$('configuration').value.trim(),signer:values(),consent:{checked:true,text:consentText,capturedAtClient:new Date().toISOString()},agreementText:canonical.terms.join('\n'),agreementSha256:canonical.sha256,serverAcknowledgment:null,executed:false};
  const blob=new Blob([JSON.stringify(copy,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='FordEngage-UNSUBMITTED-review-copy.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('status').textContent='Local draft download requested. This agreement has NOT been submitted, saved to a server, or executed.';
 });
 summary();
})();
