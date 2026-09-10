'use strict';
const $ = id => document.getElementById(id);
const views = new Set(['projects','notes','work','changes']);
let snapshot, token;
function node(tag,text,cls) { const el=document.createElement(tag); if(text!==undefined)el.textContent=text; if(cls)el.className=cls; return el; }
function details(label,text) { const el=node('details');el.append(node('summary',label),node('div',text,'body'));return el; }
function projectKey(item) { return `${item.scope}/${item.project}`; }
function matches(item) { return !$('project').value || projectKey(item)===$('project').value || (item.links||[]).some(link=>projectKey(link)===$('project').value); }
function sourceList(record) {
  const el=node('div');
  for(const source of record.sources||[]) {
    const row=node('div',source.label+': ','meta');
    let url;try{url=new URL(source.ref);}catch{}
    if(url&&url.protocol==='https:'){const a=node('a',source.ref);a.href=url.href;a.target='_blank';a.rel='noreferrer noopener';row.append(a);}else row.append(node('span',source.ref));
    el.append(row);
  }
  return el;
}
function card(record) {
  const el=node('article',undefined,'record');
  if(record.malformed){el.append(node('h2',record.title||record.id),node('p',`Malformed record at ${record.storage}: ${record.error}. Other records are unaffected; repair or remove it with your assistant.`,'error'));return el;}
  const row=node('div',undefined,'row');row.append(node('h2',record.title||record.id));
  row.append(node('span',record.legacy?'Legacy source':record.provider==='jira'?'Jira':record.state||record.health||record.status||record.kind,'badge'));el.append(row);
  el.append(node('div',`${record.scope}${record.project?' / '+record.project:''} · ${record.updated_by||record.created_by||'Original source'} · ${record.updated_at||''}${record.legacy?'':' · revision '+record.revision}`,'meta'));
  if(record.kind==='project') {
    if(record.purpose)el.append(node('h3','Purpose'),node('div',record.purpose,'body'));
    if(record.scope_description)el.append(details('Scope',record.scope_description));
    if(record.context)el.append(node('h3','Current understanding'),node('div',record.context,'body'));
    const notes=snapshot.notes.filter(n=>projectKey(n)===projectKey(record));
    const work=snapshot.work.filter(w=>projectKey(w)===projectKey(record));
    const openWork=w=>w.provider==='jira'?!/^(done|closed|resolved)$/i.test(w.snapshot?.status||''):w.status!=='done';
    el.append(node('p',`${notes.length} notes · ${work.filter(openWork).length} open work items`,'meta'));
    const open=node('button','Read project notes');open.addEventListener('click',()=>{$('project').value=projectKey(record);$('view').value='notes';render();});el.append(open);
  }
  if(record.kind==='note')el.append(details('Read note',record.body||''));
  if(record.kind==='work') {
    if(record.provider==='jira') {
      const a=node('a',record.jira.key);
      try{const url=new URL(record.jira.site);if(url.protocol==='https:'&&!url.username&&!url.password)a.href=url.href.replace(/\/$/,'')+'/browse/'+encodeURIComponent(record.jira.key);}catch{}
      a.target='_blank';a.rel='noreferrer noopener';el.append(a);
      const s=record.snapshot;el.append(node('p',s?`${s.status} · ${s.owner||'Unassigned'} · due ${s.due||'unset'}\nFetched ${s.fetched_at}. Jira remains authoritative.`:'No local Jira snapshot. Ask the assistant to refresh this reference.','body meta'));
    } else if(!record.legacy) {
      el.append(node('p',`${record.owner||'Unassigned'} · due ${record.due||'unset'}`,'meta'));
      const button=node('button',record.status==='done'?'Reopen follow-up':'Mark complete');
      button.addEventListener('click',async()=>{
        if(!$('author').value.trim()){$('status').textContent='Enter your name for attribution.';$('author').focus();return;}
        button.disabled=true;
        try{
          const response=await fetch('/api/work',{method:'POST',headers:{'Content-Type':'application/json','X-DDT-Token':token},body:JSON.stringify({scope:record.scope,project:record.project,id:record.id,expected:record.revision,author:$('author').value.trim(),fields:{status:record.status==='done'?'open':'done'}})});
          const data=await response.json();if(!response.ok)throw Error(data.error);await load();$('status').textContent=record.scope==='personal'?'Follow-up updated.':'Updated in local team checkout. Publish through the assistant to share.';
        }catch(e){$('status').textContent=e.message;button.disabled=false;}
      });el.append(button);
    }
  }
  el.append(sourceList(record));
  if(record.history?.length)el.append(details('Change history',record.history.map(h=>`${h.at} · ${h.author} · revision ${h.revision}`).join('\n')));
  if(record.legacy)el.append(node('p',record.adoption_drift?'Original changed after adoption. Reconcile it with the adopted note before relying on either.':'Retained original. Ask the assistant to adopt it before editing.','meta'));
  if(record.snapshot_error)el.append(node('p',record.snapshot_error,'error'));
  return el;
}
function render() {
  const view=$('view').value;
  $('since-label').hidden=view!=='changes';
  const selected=view==='changes'?[...snapshot.projects,...snapshot.notes,...snapshot.work].filter(r=>r.updated_at&&r.updated_at>=$('since').value):snapshot[view];
  const records=selected.filter(matches);
  $('content').replaceChildren(...records.map(card));
  if(!records.length)$('content').append(node('p','No records in this view. Capture a note or create a project with your assistant.'));
  const url=new URL(location.href);url.searchParams.set('view',view);history.replaceState(null,'',url);
}
async function load(){
  $('status').textContent='Reading local context…';
  const response=await fetch('/api/view');const data=await response.json();if(!response.ok)throw Error(data.error);snapshot=data.result;
  const old=$('project').value;
  $('project').replaceChildren(new Option('All projects and personal work',''),...snapshot.projects.map(p=>new Option(`${p.scope} / ${p.title}`,projectKey(p))));
  if([...$('project').options].some(o=>o.value===old))$('project').value=old;
  $('warnings').replaceChildren(...snapshot.warnings.map(w=>node('p',`${w.scope}: ${w.error}`,'error')));
  $('status').textContent=`Local view read ${new Date(snapshot.generated_at).toLocaleString()}`;render();
}
const initial=new URL(location.href).searchParams.get('view');if(views.has(initial))$('view').value=initial;
$('since').value=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
try{const saved=localStorage.getItem('ddt-author');if(saved)$('author').value=saved;$('author').addEventListener('change',()=>{try{localStorage.setItem('ddt-author',$('author').value.trim());}catch{}});}catch{}
for(const id of ['view','project','since'])$(id).addEventListener('change',render);
$('refresh').addEventListener('click',()=>load().catch(e=>{$('status').textContent=e.message;}));
(async()=>{token=(await(await fetch('/api/session')).json()).token;await load();})().catch(e=>{$('status').textContent=e.message;});
