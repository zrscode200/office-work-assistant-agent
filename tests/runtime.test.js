'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const {createWorkspace,decodeRecord} = require('../core/runtime/ddt');
const {createServer} = require('../core/runtime/server');
const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(),'office-v1-test-'));
const write = (file,data) => {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof data==='string'?data:JSON.stringify(data));};
const git = (dir,...args) => execFileSync('git',['-C',dir,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,GIT_AUTHOR_NAME:'Fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'Fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'}}).trim();
function fixture(t,options={}) {const root=scratch();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return {root,store:createWorkspace(root,options)};}
const project = (store,scope='personal',slug='atlas') => store.run('project-save',{scope,project:slug,expected:0,author:'Maya',fields:{title:'Atlas',context:'Research underway'}});
const note = (store,fields={},where={}) => store.run('note-save',{expected:0,author:'Maya',fields:{title:'Capture',body:'One thought',...fields},...where});
const work = (store,fields={},where={}) => store.run('work-save',{expected:0,author:'Maya',fields:{title:'Follow up',...fields},...where});

test('note develops in place and linked work remains one record through completion/undo', async t=>{
 const {store}=fixture(t);await project(store);
 const n=await note(store,{}, {project:'atlas'});
 const updated=await store.run('note-save',{project:'atlas',id:n.id,expected:1,author:'Theo',fields:{body:'Developed rationale',state:'agreed'}});
 assert.equal(updated.id,n.id);assert.equal(updated.revision,2);assert.equal(updated.history[1].author,'Theo');
 await assert.rejects(store.run('note-save',{project:'atlas',id:n.id,expected:1,author:'Other',fields:{body:'Stale'}}),/Stale/);
 const w=await work(store,{links:[{scope:'personal',project:'atlas'}]});
 let current=await store.run('work-save',{id:w.id,expected:1,author:'Maya',fields:{status:'done'}});
 current=await store.run('work-save',{id:w.id,expected:2,author:'Maya',fields:{status:'open'}});
 assert.equal(current.id,w.id);assert.equal(current.history.length,3);
 assert.equal((await store.run('work')).length,1);
 assert.equal((await store.run('project',{project:'atlas'})).work[0].id,w.id);
 const second=await work(store);assert.notEqual(second.id,w.id);
 assert.equal((await store.run('catch-up',{since:'2000-01-01'})).changes.length,4);
});

test('validation, lock conflicts, malformed records, and failed updates retain bytes', async t=>{
 const {root,store}=fixture(t);const w=await work(store);const file=path.join(root,'.ddt/personal/work',w.id+'.json');const before=fs.readFileSync(file);
 await assert.rejects(store.run('work-save',{id:w.id,expected:1,author:'Maya',fields:{due:'2026-02-30'}}),/Invalid due/);
 assert.deepEqual(fs.readFileSync(file),before);
 write(file+'.ddt-lock','busy');await assert.rejects(store.run('work-save',{id:w.id,expected:1,author:'Maya',fields:{status:'done'}}),/busy/);assert.deepEqual(fs.readFileSync(file),before);fs.unlinkSync(file+'.ddt-lock');
 write(file,'broken');await assert.rejects(store.run('work-save',{id:w.id,expected:1,author:'Maya',fields:{status:'done'}}));assert.equal(fs.readFileSync(file,'utf8'),'broken');
 assert.ok((await store.run('overview')).warnings.some(w=>w.kind==='work'));
});

test('private/team scopes reject symlinks including project.json leaves and dangling paths', async t=>{
 const {root,store}=fixture(t);const team=scratch();t.after(()=>fs.rmSync(team,{recursive:true,force:true}));
 write(path.join(root,'.ddt/config.md'),`## Team Repos\nteam: ${team}\n`);
 await project(store);const privateFile=path.join(root,'.ddt/projects/atlas/project.json');
 fs.mkdirSync(path.join(team,'projects/atlas'),{recursive:true});fs.symlinkSync(privateFile,path.join(team,'projects/atlas/project.json'));
 const list=await store.run('projects');assert.equal(list.projects.length,1);assert.match(list.warnings[0].error,/Symlinks/);
 await assert.rejects(store.run('project-save',{scope:'team',project:'atlas',expected:1,author:'Maya',fields:{title:'Leaked'}}),/Symlinks/);
 assert.equal(JSON.parse(fs.readFileSync(privateFile)).title,'Atlas');
 await assert.rejects(note(store,{}, {id:'../../escape'}),/ID/);
 fs.mkdirSync(path.join(root,'.ddt/personal/notes'),{recursive:true});fs.symlinkSync(path.join(team,'missing'),path.join(root,'.ddt/personal/notes/dangling.md'));
 await assert.rejects(note(store,{}, {id:'dangling'}),/Symlinks/);
});

test('private links do not publish content; shared sources/links cannot point to private storage',async t=>{
 const {root,store}=fixture(t);const team=scratch();t.after(()=>fs.rmSync(team,{recursive:true,force:true}));write(path.join(root,'.ddt/config.md'),`## Team Repos\nteam: ${team}\n`);await project(store,'team');
 const w=await work(store,{title:'Private thought',links:[{scope:'team',project:'atlas'}]});
 assert.ok(fs.existsSync(path.join(root,'.ddt/personal/work',w.id+'.json')));assert.ok(!fs.existsSync(path.join(team,'projects/atlas/work')));
 await assert.rejects(note(store,{sources:[{label:'Private',ref:'.ddt/projects/private/project.json'}]},{scope:'team',project:'atlas'}),/Private/);
 await assert.rejects(work(store,{links:[{scope:'personal',project:'atlas'}]},{scope:'team',project:'atlas'}),/Shared links/);
 git(team,'init');git(team,'add','.');git(team,'commit','-m','Fixture');
 const brief=await store.run('brief',{scope:'team',project:'atlas'});assert.equal(brief.work.length,0);assert.equal(JSON.stringify(brief).includes('Private thought'),false);
});

test('legacy adoption is explicit, idempotent, preserves originals and surfaces note drift',async t=>{
 const {root,store}=fixture(t);
 const source=path.join(root,'.ddt/personal/scratch/idea.md');write(source,'# Idea\nOriginal idea');
 const old=(await store.run('notes'))[0];const input={id:old.id,expected_source:old.revision,author:'Maya'};
 const adopted=await store.run('note-adopt',input);assert.equal((await store.run('note-adopt',input)).id,adopted.id);
 assert.equal(fs.readFileSync(source,'utf8'),'# Idea\nOriginal idea');assert.equal((await store.run('notes')).length,1);
 write(source,'# Idea\nChanged original');assert.ok((await store.run('notes')).find(n=>n.adoption_drift));
 const todo=path.join(root,'.ddt/personal/todo-complete.json');const bytes=JSON.stringify({items:[{id:1,what:'Call Sam',recurrence:'weekly',subtasks:[{what:'prepare'}]}]});write(todo,bytes);
 const legacy=(await store.run('work')).find(w=>w.legacy);const request={id:legacy.id,expected_source:legacy.revision,author:'Maya'};
 const adoptedWork=await store.run('work-adopt',request);assert.equal(adoptedWork.status,'done');assert.equal(adoptedWork.legacy_original.recurrence,'weekly');assert.equal((await store.run('work-adopt',request)).id,adoptedWork.id);assert.equal(fs.readFileSync(todo,'utf8'),bytes);
 write(path.join(root,'.ddt/projects/old/overview.md'),'# Old\nLegacy context');const preview=await store.run('project-adopt',{project:'old'});assert.equal(preview.preview.length,1);assert.ok(!fs.existsSync(path.join(root,'.ddt/projects/old/project.json')));
 await store.run('project-adopt',{project:'old',confirm:true,author:'Maya'});assert.equal((await store.run('project',{project:'old'})).notes.length,1);
});

function jiraFixture(t,fetcher){const f=fixture(t,{fetch:fetcher});write(path.join(f.root,'.ddt/personal/jira.json'),{sites:[{site:'https://example.atlassian.net',api_base:'https://api.atlassian.com/ex/jira/fixture',api_version:3,token_env:'OFFICE_V1_FIXTURE_TOKEN'}]});process.env.OFFICE_V1_FIXTURE_TOKEN='fixture-not-a-secret';t.after(()=>delete process.env.OFFICE_V1_FIXTURE_TOKEN);return f;}
const jiraResponse=(status='Open',updated='2026-09-08T12:00:00Z')=>({ok:true,json:async()=>({key:'ATLAS-1',fields:{summary:'Implement',status:{name:status},assignee:{displayName:'Sam'},updated}})});
const jiraWork=store=>work(store,{provider:'jira',jira:{site:'https://example.atlassian.net',key:'ATLAS-1'}});

test('Jira uses approved private origin, owned execution fields, validated snapshots, and retained cache on failure',async t=>{
 let fail=false,calls=[];const {root,store}=jiraFixture(t,async(url,options)=>{calls.push({url,options});return fail?{ok:false,status:401}:jiraResponse();});const w=await jiraWork(store);
 await assert.rejects(store.run('work-save',{id:w.id,expected:1,author:'Maya',fields:{status:'done'}}),/Jira owns/);
 const snap=await store.run('jira-refresh',{id:w.id});assert.equal(snap.status,'Open');assert.match(calls[0].url,/^https:\/\/api.atlassian.com\/ex\/jira\/fixture\/rest\/api\/3\/issue\/ATLAS-1/);assert.equal(calls[0].options.redirect,'error');
 fail=true;await assert.rejects(store.run('jira-refresh',{id:w.id}),/401/);assert.deepEqual((await store.run('work'))[0].snapshot,snap);
 const record=fs.readFileSync(path.join(root,'.ddt/personal/work',w.id+'.json'),'utf8');assert.equal(record.includes('fixture-not-a-secret'),false);assert.equal(record.includes('fetched_at'),false);
 const cache=path.join(root,'.ddt/personal/cache/jira',fs.readdirSync(path.join(root,'.ddt/personal/cache/jira'))[0]);write(cache,{...snap,key:'OTHER-1'});assert.equal((await store.run('work'))[0].snapshot,null);
 write(path.join(root,'.ddt/personal/jira.json'),{sites:[]});await assert.rejects(store.run('jira-refresh',{id:w.id}),/not approved/);assert.equal(calls.length,2);
});

test('Jira concurrent refresh is rejected and later stale server response cannot regress cache',async t=>{
 let resolve;const {store}=jiraFixture(t,()=>new Promise(r=>{resolve=r;}));const w=await jiraWork(store);
 const first=store.run('jira-refresh',{id:w.id});await assert.rejects(store.run('jira-refresh',{id:w.id}),/already in progress/);resolve(jiraResponse('Done','2026-09-08T14:00:00Z'));await first;
 const older=store.run('jira-refresh',{id:w.id});resolve(jiraResponse('Open','2026-09-08T13:00:00Z'));await assert.rejects(older,/older/);assert.equal((await store.run('work'))[0].snapshot.status,'Done');
});

async function teamFixture(t){const root=scratch();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const remote=path.join(root,'remote.git'),a=path.join(root,'a'),b=path.join(root,'b');fs.mkdirSync(remote);git(remote,'init','--bare');fs.mkdirSync(a);git(a,'init','-b','main');write(path.join(a,'README.md'),'Team fixture\n');git(a,'add','.');git(a,'commit','-m','Init');git(a,'remote','add','origin',remote);git(a,'push','-u','origin','main');git(remote,'symbolic-ref','HEAD','refs/heads/main');git(root,'clone',remote,b);
 const stores=[];for(const [i,team]of[a,b].entries()){const personal=path.join(root,'person'+i);fs.mkdirSync(personal);write(path.join(personal,'.ddt/config.md'),`## Team Repos\nteam: ${team}\n`);stores.push(createWorkspace(personal,{env:{GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'}}));git(team,'config','user.name','Fixture');git(team,'config','user.email',`fixture${i}@example.invalid`);}return {root,a,b,remote,one:stores[0],two:stores[1]};}
async function publishRequest(store,paths){const preview=await store.run('publish-preview',{scope:'team',paths});return {scope:'team',paths,expected_head:preview.head,destination:preview.destination,expected_files:Object.fromEntries(preview.files.map(f=>[f.path,f.digest])),confirm:true,message:'Share project context'};}

test('two clones share scoped project context; private/unrelated work is retained locally; stale content and staged work rejected',async t=>{
 const {a,b,one,two}=await teamFixture(t);await project(one,'team');const n=await note(one,{body:'Agreed launch context'},{scope:'team',project:'atlas'});await note(one,{body:'Private'});write(path.join(a,'unrelated.txt'),'keep');
 const paths=['projects/atlas/project.json',`projects/atlas/notes/${n.id}.md`];let request=await publishRequest(one,paths);
 await one.run('note-save',{scope:'team',project:'atlas',id:n.id,expected:1,author:'Sam',fields:{body:'Revised launch context'}});await assert.rejects(one.run('publish',request),/contents changed/);
 request=await publishRequest(one,paths);git(a,'add','unrelated.txt');await assert.rejects(one.run('publish',request),/staged/);assert.equal(git(a,'diff','--cached','--name-only'),'unrelated.txt');git(a,'reset','--','unrelated.txt');
 const result=await one.run('publish',request);assert.equal(result.published,true);assert.equal(fs.readFileSync(path.join(a,'unrelated.txt'),'utf8'),'keep');assert.equal(git(a,'diff','--cached','--name-only'),'');
 await two.run('sync-pull',{scope:'team'});const shared=await two.run('project',{scope:'team',project:'atlas'});assert.equal(shared.notes[0].body,'Revised launch context');assert.equal(shared.notes[0].updated_by,'Sam');assert.equal(shared.notes.length,1);assert.equal(fs.existsSync(path.join(b,'unrelated.txt')),false);
 assert.equal(git(b,'ls-tree','-r','--name-only','HEAD').includes('.ddt'),false);
 await assert.rejects(one.run('publish-preview',{scope:'team',paths:['../secret']}),/exact V1/);
});

test('publication rejects prior outgoing commits and explicit destination mismatch',async t=>{
 const {a,one}=await teamFixture(t);await project(one,'team');let request=await publishRequest(one,['projects/atlas/project.json']);await assert.rejects(one.run('publish',{...request,destination:{...request.destination,ref:'refs/heads/elsewhere'}}),/destination/);
 write(path.join(a,'unrelated.txt'),'unreviewed');git(a,'add','unrelated.txt');git(a,'commit','-m','Unrelated');request=await publishRequest(one,['projects/atlas/project.json']);await assert.rejects(one.run('publish',request),/outgoing/);
});

test('failed push reports durable local commit and exact retry preserves its identity',async t=>{
 const {remote,one}=await teamFixture(t);await project(one,'team');const hook=path.join(remote,'hooks/pre-receive');write(hook,'#!/bin/sh\nexit 1\n');fs.chmodSync(hook,0o755);
 const request=await publishRequest(one,['projects/atlas/project.json']);const failed=await one.run('publish',request);assert.equal(failed.published,false);assert.match(failed.committed,/^[0-9a-f]{40}$/);fs.unlinkSync(hook);
 const success=await one.run('sync-push',{scope:'team',expected_commit:failed.committed,destination:request.destination,confirm:true});assert.equal(success.published,true);assert.equal(success.committed,failed.committed);
});

test('dashboard request handlers keep reads inert and require same origin/session/revision for completion',async t=>{
 const {Readable}=require('node:stream');
 const {root,store}=fixture(t);const w=await work(store,{title:'<img src=x onerror=alert(1)>'});const server=createServer(root);
 // In-process HTTP request harness: exercises the actual handler without a socket.
 server.address=()=>({port:32123});
 const request=(url,{method='GET',headers={},body=''}={})=>new Promise(resolve=>{
   const req=Readable.from([body]);req.url=url;req.method=method;req.headers={host:'127.0.0.1:32123',...Object.fromEntries(Object.entries(headers).map(([k,v])=>[k.toLowerCase(),v]))};
   const res={writeHead(status,head){this.status=status;this.headers=head;},end(data){resolve({status:this.status,headers:this.headers,text:String(data),json:()=>JSON.parse(data)});}};
   server.emit('request',req,res);
 });
 const html=await request('/?view=work');assert.equal(html.status,200);assert.match(html.headers['Content-Security-Policy'],/script-src 'self'/);
 assert.equal((await request('/api/view?command=sync-pull')).status,400);assert.equal((await request('/api/view',{headers:{Origin:'https://evil.invalid'}})).status,403);assert.equal((await request('/api/view',{headers:{Host:'evil.invalid'}})).status,403);
 const {token}=(await request('/api/session')).json();const input={id:w.id,expected:1,author:'Maya',fields:{status:'done'}};const post=(value,headers={})=>request('/api/work',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(value)});
 assert.equal((await post(input)).status,403);assert.equal((await post(input,{'X-DDT-Token':token,Origin:'https://evil.invalid'})).status,403);
 assert.equal((await post(input,{'X-DDT-Token':token})).status,200);assert.equal((await post(input,{'X-DDT-Token':token})).status,400);assert.equal((await store.run('work'))[0].revision,2);
 const js=(await request('/app.js')).text;assert.equal(js.includes('innerHTML'),false);assert.ok(js.includes('textContent'));
});

test('successive scoped publications update tracking state and reach the second clone',async t=>{
 const {one,two}=await teamFixture(t);await project(one,'team');const paths=['projects/atlas/project.json'];
 assert.equal((await one.run('publish',await publishRequest(one,paths))).published,true);
 assert.equal((await one.run('sync-status',{scope:'team'})).ahead,0);
 await one.run('project-save',{scope:'team',project:'atlas',expected:1,author:'Maya',fields:{context:'Second update'}});
 assert.equal((await one.run('publish',await publishRequest(one,paths))).published,true);
 await two.run('sync-pull',{scope:'team'});assert.equal((await two.run('project',{scope:'team',project:'atlas'})).project.context,'Second update');
});

test('legacy adoption preserves in-progress state and its original recurs/subs payload',async t=>{
 const {root,store}=fixture(t);write(path.join(root,'.ddt/personal/todo.json'),{version:1,items:[{id:'t1',what:'Follow up',status:'in-progress',recurs:'weekly',subs:[{id:'t1.1',what:'Prepare',status:'done'}]}]});
 const source=(await store.run('work'))[0];const adopted=await store.run('work-adopt',{id:source.id,expected_source:source.revision,author:'Maya'});
 assert.equal(adopted.status,'in-progress');assert.equal(adopted.legacy_original.recurs,'weekly');assert.equal(adopted.legacy_original.subs[0].status,'done');
});

test('explicit Jira refresh recovers from an invalid cache even with a future update timestamp',async t=>{
 const {root,store}=jiraFixture(t,async()=>jiraResponse());const w=await jiraWork(store);const snapshot=await store.run('jira-refresh',{id:w.id});
 const dir=path.join(root,'.ddt/personal/cache/jira');write(path.join(dir,fs.readdirSync(dir)[0]),{...snapshot,key:'OTHER-99',jira_updated_at:'2099-01-01T00:00:00Z'});
 const recovered=await store.run('jira-refresh',{id:w.id});assert.equal(recovered.key,'ATLAS-1');
});

test('missing or personal synchronization scope never invokes Git',async t=>{
 const vm=require('node:vm');const {root}=fixture(t);let gitCalls=0;const sandbox={module:{exports:{}},exports:{},console,process,Buffer,URL,AbortSignal,require:name=>name==='node:child_process'?{execFileSync(){gitCalls++;throw Error('Unexpected Git');}}:require(name)};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../core/runtime/ddt.js'),'utf8'),sandbox);
 const store=sandbox.module.exports.createWorkspace(root);
 for(const scope of [undefined,'','personal','unknown'])for(const command of ['sync-status','sync-pull','publish-preview','publish','sync-push'])await assert.rejects(store.run(command,{scope,confirm:true}),/configured team scope/);
 assert.equal(gitCalls,0);
});

test('explicit scoped publication ignores configured default branch/tag push sets',async t=>{
 const {a,remote,one}=await teamFixture(t);git(a,'branch','unrelated');git(a,'config','remote.origin.push','refs/heads/unrelated:refs/heads/unrelated');git(a,'config','push.followTags','true');git(a,'tag','-a','private-tag','-m','Do not publish');
 await project(one,'team');const result=await one.run('publish',await publishRequest(one,['projects/atlas/project.json']));assert.equal(result.published,true);
 assert.equal(git(remote,'for-each-ref','--format=%(refname)'),'refs/heads/main');
});

test('two teammates making divergent changes retain both versions and reject the second push',async t=>{
 const {one,two}=await teamFixture(t);const paths=['projects/atlas/project.json'];await project(one,'team');await one.run('publish',await publishRequest(one,paths));await two.run('sync-pull',{scope:'team'});
 await one.run('project-save',{scope:'team',project:'atlas',expected:1,author:'Maya',fields:{context:'Maya decision'}});
 await two.run('project-save',{scope:'team',project:'atlas',expected:1,author:'Theo',fields:{context:'Theo proposal'}});
 assert.equal((await one.run('publish',await publishRequest(one,paths))).published,true);
 const second=await two.run('publish',await publishRequest(two,paths));assert.equal(second.published,false);assert.ok(second.committed);
 assert.equal((await one.run('project',{scope:'team',project:'atlas'})).project.context,'Maya decision');assert.equal((await two.run('project',{scope:'team',project:'atlas'})).project.context,'Theo proposal');
 await assert.rejects(two.run('sync-pull',{scope:'team'}),/Pull failed/);
});

test('author defaults to the configured owner and placeholders are rejected',async t=>{
 const {root,store}=fixture(t);
 await assert.rejects(store.run('note-save',{expected:0,fields:{title:'x',body:'y'}}),/author is required/);
 write(path.join(root,'.ddt/config.md'),'owner: [your name]\n');
 await assert.rejects(store.run('note-save',{expected:0,fields:{title:'x',body:'y'}}),/author is required/);
 await assert.rejects(store.run('note-save',{expected:0,author:'[your name]',fields:{title:'x',body:'y'}}),/placeholder/);
 write(path.join(root,'.ddt/config.md'),'owner: Maya Chen\n');
 const n=await store.run('note-save',{expected:0,fields:{title:'x',body:'y'}});assert.equal(n.created_by,'Maya Chen');
});

test('team-wide listing, linked private context, brief audiences, search and summary reads',async t=>{
 const {root,store}=fixture(t);const team=scratch();t.after(()=>fs.rmSync(team,{recursive:true,force:true}));
 write(path.join(root,'.ddt/config.md'),`owner: Maya\n## Team Repos\nteam: ${team}\n`);git(team,'init');
 await project(store,'team','atlas');await project(store,'team','beacon');
 const tn=await note(store,{title:'Launch plan',body:'Vendor contract ready'},{scope:'team',project:'atlas'});await note(store,{body:'Beacon note'},{scope:'team',project:'beacon'});
 const pn=await note(store,{title:'My Atlas worry',body:'Private thought about vendor',links:[{scope:'team',project:'atlas'}]});
 const pw=await work(store,{title:'Chase vendor',links:[{scope:'team',project:'atlas'}]});
 git(team,'add','.');git(team,'commit','-m','Fixture');
 assert.equal((await store.run('notes',{scope:'team'})).length,2);assert.equal((await store.run('work',{scope:'team'})).length,0);
 const view=await store.run('project',{scope:'team',project:'atlas'});
 assert.deepEqual(view.notes.map(n=>n.id),[tn.id]);assert.deepEqual(view.linked_private.notes.map(n=>n.id),[pn.id]);assert.deepEqual(view.linked_private.work.map(w=>w.id),[pw.id]);
 const teamBrief=await store.run('brief',{scope:'team',project:'atlas'});assert.equal(JSON.stringify(teamBrief).includes('Private thought'),false);assert.ok(teamBrief.linked_private_excluded);
 const mine=await store.run('brief',{scope:'team',project:'atlas',audience:'personal'});assert.equal(mine.linked_private.notes[0].id,pn.id);
 await assert.rejects(store.run('brief',{scope:'team',project:'atlas',audience:'public'}),/audience/);
 const found=await store.run('search',{query:'VENDOR'});assert.deepEqual(found.results.map(r=>r.id).sort(),[pn.id,tn.id,pw.id].sort());assert.ok(found.results.every(r=>!('body' in r)&&typeof r.snippet==='string'));
 assert.equal((await store.run('note',{scope:'team',project:'atlas',id:tn.id})).body,'Vendor contract ready');assert.equal((await store.run('work-item',{id:pw.id})).title,'Chase vendor');
 const summary=await store.run('project',{scope:'team',project:'atlas',summary:true});assert.equal(summary.notes[0].body,undefined);assert.equal(summary.notes[0].body_preview,'Vendor contract ready');
});

test('malformed records are isolated with warnings, file names own identity, and dead-writer locks recover',async t=>{
 const {root,store}=fixture(t);await project(store);const w=await work(store,{},{project:'atlas'});
 write(path.join(root,'.ddt/projects/atlas/notes/README.md'),'# Not a record');
 const view=await store.run('overview');assert.equal(view.work.filter(x=>x.id===w.id).length,1);
 const bad=view.notes.find(n=>n.malformed);assert.ok(bad);assert.ok(view.warnings.some(x=>x.storage===bad.storage));
 assert.equal((await store.run('project',{project:'atlas'})).work.length,1);
 const dir=path.join(root,'.ddt/projects/atlas/work');fs.copyFileSync(path.join(dir,w.id+'.json'),path.join(dir,'copy-of-work.json'));
 const copy=(await store.run('work',{project:'atlas'})).find(x=>x.id==='copy-of-work');assert.equal(copy.id_mismatch,w.id);
 const saved=await store.run('work-save',{project:'atlas',id:'copy-of-work',expected:1,author:'Maya',fields:{title:'Forked'}});assert.equal(saved.id,'copy-of-work');
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,w.id+'.json'),'utf8')).title,'Follow up');
 write(path.join(dir,w.id+'.json.ddt-lock'),JSON.stringify({pid:2147483000,at:'2000-01-01T00:00:00Z'}));
 assert.equal((await store.run('work-save',{project:'atlas',id:w.id,expected:1,author:'Maya',fields:{status:'done'}})).status,'done');
 write(path.join(dir,w.id+'.json.ddt-lock'),JSON.stringify({pid:process.pid,at:new Date().toISOString()}));
 await assert.rejects(store.run('work-save',{project:'atlas',id:w.id,expected:2,author:'Maya',fields:{status:'open'}}),/busy/);fs.unlinkSync(path.join(dir,w.id+'.json.ddt-lock'));
});

test('legacy adoption validates fields, keys todos by id, and drift can be acknowledged',async t=>{
 const {root,store}=fixture(t);const todo=path.join(root,'.ddt/personal/todo.json');write(todo,{items:[{id:'a',what:'First',due:'Friday'},{id:'b',what:'',status:'open'}]});
 let items=(await store.run('work')).filter(w=>w.legacy);const a=items.find(w=>w.original.id==='a'),b=items.find(w=>w.original.id==='b');
 const adoptedA=await store.run('work-adopt',{id:a.id,expected_source:a.revision,author:'Maya'});assert.equal(adoptedA.due,null);assert.equal(adoptedA.legacy_original.due,'Friday');
 const adoptedB=await store.run('work-adopt',{id:b.id,expected_source:b.revision,author:'Maya'});assert.match(adoptedB.title,/Legacy follow-up b/);
 assert.equal((await store.run('work-save',{id:adoptedA.id,expected:1,author:'Maya',fields:{status:'done'}})).status,'done');
 write(todo,{items:[{id:'b',what:'',status:'open'},{id:'a',what:'First',due:'Friday'},{id:'c',what:'Third'}]});
 items=(await store.run('work')).filter(w=>w.legacy);assert.deepEqual(items.map(w=>w.original.id),['c']);
 const source=path.join(root,'.ddt/personal/scratch/idea.md');write(source,'# Idea\nOriginal');
 const old=(await store.run('notes')).find(n=>n.legacy);const adopted=await store.run('note-adopt',{id:old.id,expected_source:old.revision,author:'Maya'});
 write(source,'# Idea\nChanged');const drifted=(await store.run('notes')).find(n=>n.adoption_drift);assert.ok(drifted);
 const ack=await store.run('note-adopt',{id:drifted.id,expected_source:drifted.revision,acknowledge_drift:true,expected:1,author:'Maya'});assert.equal(ack.id,adopted.id);assert.equal(ack.revision,2);
 assert.equal((await store.run('notes')).some(n=>n.adoption_drift),false);
});

test('catch-up reports pulled teammate changes; pull tolerates untracked files',async t=>{
 const {b,one,two}=await teamFixture(t);await project(one,'team');const paths=['projects/atlas/project.json'];
 await one.run('publish',await publishRequest(one,paths));await two.run('sync-pull',{scope:'team'});
 await one.run('project-save',{scope:'team',project:'atlas',expected:1,author:'Maya',fields:{context:'Authored earlier'}});await one.run('publish',await publishRequest(one,paths));
 await new Promise(r=>setTimeout(r,1100));const since=new Date().toISOString();await new Promise(r=>setTimeout(r,1100));
 assert.equal((await two.run('catch-up',{since})).changes.length,0);
 write(path.join(b,'unpublished.txt'),'draft');await two.run('sync-pull',{scope:'team'});
 const pulled=(await two.run('catch-up',{since})).changes;assert.equal(pulled.length,1);assert.deepEqual(pulled[0].change,{authored:false,arrived:true,jira_refreshed:false});
});

test('Jira refresh appears in catch-up; basic auth and default site are supported',async t=>{
 let seen;const {root,store}=jiraFixture(t,async(url,options)=>{seen=options.headers.Authorization;return jiraResponse('Done','2026-09-09T00:00:00Z');});
 write(path.join(root,'.ddt/personal/jira.json'),{default_site:'https://example.atlassian.net/',sites:[{site:'https://example.atlassian.net',auth:'basic',email:'maya@example.invalid',token_env:'OFFICE_V1_FIXTURE_TOKEN'}]});
 const w=await work(store,{provider:'jira',jira:{key:'ATLAS-1'}});assert.equal(w.jira.site,'https://example.atlassian.net');
 await new Promise(r=>setTimeout(r,20));const since=new Date().toISOString();await new Promise(r=>setTimeout(r,20));
 await store.run('jira-refresh',{id:w.id});assert.equal(seen,'Basic '+Buffer.from('maya@example.invalid:fixture-not-a-secret').toString('base64'));
 const changes=(await store.run('catch-up',{since})).changes;assert.equal(changes.length,1);assert.equal(changes[0].change.jira_refreshed,true);
 assert.equal((await store.run('work-save',{id:w.id,expected:1,author:'Maya',fields:{jira:{site:'https://example.atlassian.net/',key:'ATLAS-1'}}})).revision,2);
});

test('sync-fetch and sync-rebase recover from a rejected publish with record-level merging',async t=>{
 const {one,two}=await teamFixture(t);await project(one,'team');const n=await note(one,{title:'Shared',body:'Base'},{scope:'team',project:'atlas'});
 const notePath=`projects/atlas/notes/${n.id}.md`;await one.run('publish',await publishRequest(one,['projects/atlas/project.json',notePath]));await two.run('sync-pull',{scope:'team'});
 await one.run('project-save',{scope:'team',project:'atlas',expected:1,author:'Maya',fields:{context:'Maya context'}});await one.run('publish',await publishRequest(one,['projects/atlas/project.json']));
 await two.run('note-save',{scope:'team',project:'atlas',id:n.id,expected:1,author:'Theo',fields:{body:'Theo body'}});
 const rejected=await two.run('publish',await publishRequest(two,[notePath]));assert.equal(rejected.published,false);assert.match(rejected.error,/sync-fetch/);
 const fetched=await two.run('sync-fetch',{scope:'team'});assert.equal(fetched.ahead,1);assert.equal(fetched.behind,1);const destination=fetched.destination;
 const rebased=await two.run('sync-rebase',{scope:'team',expected_commit:rejected.committed,destination,confirm:true});assert.equal(rebased.rebased,true);assert.equal(rebased.behind,0);assert.equal(rebased.ahead,1);
 assert.equal((await two.run('sync-push',{scope:'team',expected_commit:rebased.head,destination,confirm:true})).published,true);
 await one.run('sync-pull',{scope:'team'});const merged=await one.run('project',{scope:'team',project:'atlas'});assert.equal(merged.project.context,'Maya context');assert.equal(merged.notes[0].body,'Theo body');
 await one.run('note-save',{scope:'team',project:'atlas',id:n.id,expected:2,author:'Maya',fields:{state:'agreed'}});await one.run('publish',await publishRequest(one,[notePath]));
 await two.run('note-save',{scope:'team',project:'atlas',id:n.id,expected:2,author:'Theo',fields:{body:'Theo again'}});
 const again=await two.run('publish',await publishRequest(two,[notePath]));assert.equal(again.published,false);await two.run('sync-fetch',{scope:'team'});
 const fieldMerge=await two.run('sync-rebase',{scope:'team',expected_commit:again.committed,destination,confirm:true});assert.equal(fieldMerge.rebased,true);
 const local=await two.run('note',{scope:'team',project:'atlas',id:n.id});assert.equal(local.state,'agreed');assert.equal(local.body,'Theo again');assert.equal(local.revision,4);assert.equal(local.history.length,4);
 await two.run('sync-push',{scope:'team',expected_commit:fieldMerge.head,destination,confirm:true});await one.run('sync-pull',{scope:'team'});
 await one.run('note-save',{scope:'team',project:'atlas',id:n.id,expected:4,author:'Maya',fields:{body:'Maya final'}});await one.run('publish',await publishRequest(one,[notePath]));
 await two.run('note-save',{scope:'team',project:'atlas',id:n.id,expected:4,author:'Theo',fields:{body:'Theo final'}});
 const third=await two.run('publish',await publishRequest(two,[notePath]));await two.run('sync-fetch',{scope:'team'});
 const conflict=await two.run('sync-rebase',{scope:'team',expected_commit:third.committed,destination,confirm:true});
 assert.equal(conflict.rebased,false);assert.deepEqual(conflict.unresolved[0].conflicts,['body']);assert.equal(conflict.unresolved[0].id,n.id);assert.equal(conflict.unresolved[0].upstream.body,'Maya final');assert.equal(conflict.unresolved[0].local.body,'Theo final');
 assert.equal((await two.run('sync-status',{scope:'team'})).head,third.committed);
 const resolved=await two.run('sync-rebase',{scope:'team',expected_commit:third.committed,destination,confirm:true,resolution:{[notePath]:{body:{value:'Agreed final'}}}});
 assert.equal(resolved.rebased,true);const final=await two.run('note',{scope:'team',project:'atlas',id:n.id});assert.equal(final.body,'Agreed final');assert.equal(final.revision,6);
 assert.equal((await two.run('sync-push',{scope:'team',expected_commit:resolved.head,destination,confirm:true})).published,true);
});

test('sync-rebase replays with plumbing: hooks bypassed, add/add needs choices, removals and invalid resolutions reported',async t=>{
 const {a,b,one,two}=await teamFixture(t);await project(one,'team');const n=await note(one,{title:'Shared',body:'Base',sources:[{label:'Base',ref:'https://example.invalid/base'}]},{scope:'team',project:'atlas'});
 const notePath=`projects/atlas/notes/${n.id}.md`;await one.run('publish',await publishRequest(one,['projects/atlas/project.json',notePath]));await two.run('sync-pull',{scope:'team'});
 for(const hook of ['pre-commit','prepare-commit-msg','commit-msg']){write(path.join(b,'.git/hooks',hook),'#!/bin/sh\nexit 1\n');fs.chmodSync(path.join(b,'.git/hooks',hook),0o755);}
 await one.run('project-save',{scope:'team',project:'atlas',expected:1,author:'Maya',fields:{context:'Maya'}});await one.run('publish',await publishRequest(one,['projects/atlas/project.json']));
 await two.run('note-save',{scope:'team',project:'atlas',id:n.id,expected:1,author:'Theo',fields:{body:'Theo'}});
 let rejected=await two.run('publish',await publishRequest(two,[notePath]));assert.equal(rejected.published,false);const {destination}=await two.run('sync-fetch',{scope:'team'});
 let result=await two.run('sync-rebase',{scope:'team',expected_commit:rejected.committed,destination,confirm:true});assert.equal(result.rebased,true);
 assert.equal(git(b,'status','--porcelain'),'');assert.equal(fs.existsSync(path.join(b,'.git/rebase-merge')),false);assert.equal(git(b,'log','-1','--format=%an'),'Fixture');assert.equal(git(b,'log','-1','--format=%B').trim(),'Share project context');
 assert.equal((await two.run('sync-push',{scope:'team',expected_commit:result.head,destination,confirm:true})).published,true);await one.run('sync-pull',{scope:'team'});
 await one.run('project-save',{scope:'team',project:'beacon',expected:0,author:'Maya',fields:{title:'Beacon',context:'Maya beacon'}});await one.run('publish',await publishRequest(one,['projects/beacon/project.json']));
 await two.run('project-save',{scope:'team',project:'beacon',expected:0,author:'Theo',fields:{title:'Beacon',context:'Theo beacon'}});
 rejected=await two.run('publish',await publishRequest(two,['projects/beacon/project.json']));await two.run('sync-fetch',{scope:'team'});
 result=await two.run('sync-rebase',{scope:'team',expected_commit:rejected.committed,destination,confirm:true});assert.equal(result.rebased,false);assert.deepEqual(result.unresolved[0].conflicts,['context']);
 result=await two.run('sync-rebase',{scope:'team',expected_commit:rejected.committed,destination,confirm:true,resolution:{'projects/beacon/project.json':{context:'upstream'}}});assert.equal(result.rebased,true);
 const beacon=await two.run('project',{scope:'team',project:'beacon'});assert.equal(beacon.project.context,'Maya beacon');assert.equal(beacon.project.revision,2);
 assert.equal((await two.run('sync-push',{scope:'team',expected_commit:result.head,destination,confirm:true})).published,true);await one.run('sync-pull',{scope:'team'});
 await one.run('note-save',{scope:'team',project:'atlas',id:n.id,expected:2,author:'Maya',fields:{sources:[{label:'Maya',ref:'https://example.invalid/maya'}],state:'agreed'}});await one.run('publish',await publishRequest(one,[notePath]));
 await two.run('note-save',{scope:'team',project:'atlas',id:n.id,expected:2,author:'Theo',fields:{sources:[{label:'Theo',ref:'https://example.invalid/theo'}],state:'proposal'}});
 rejected=await two.run('publish',await publishRequest(two,[notePath]));await two.run('sync-fetch',{scope:'team'});
 result=await two.run('sync-rebase',{scope:'team',expected_commit:rejected.committed,destination,confirm:true,resolution:{[notePath]:{sources:{value:[{label:'Leak',ref:'.ddt/personal/notes/secret.md'}]},state:{value:'bogus'}}}});
 assert.equal(result.rebased,false);assert.match(result.unresolved[0].conflicts[0],/invalid resolution/);assert.equal((await two.run('sync-status',{scope:'team'})).head,rejected.committed);assert.equal(git(b,'status','--porcelain'),'');
 result=await two.run('sync-rebase',{scope:'team',expected_commit:rejected.committed,destination,confirm:true,resolution:{[notePath]:{sources:'local',state:'upstream'}}});assert.equal(result.rebased,true);
 const merged=await two.run('note',{scope:'team',project:'atlas',id:n.id});assert.equal(merged.state,'agreed');assert.equal(merged.sources[0].label,'Theo');
 assert.equal((await two.run('sync-push',{scope:'team',expected_commit:result.head,destination,confirm:true})).published,true);await one.run('sync-pull',{scope:'team'});
 git(a,'mv',notePath,'projects/atlas/archived-note.md');git(a,'commit','-q','-m','Move');git(a,'push','-q','origin','HEAD');
 const current=await two.run('note',{scope:'team',project:'atlas',id:n.id});await two.run('note-save',{scope:'team',project:'atlas',id:n.id,expected:current.revision,author:'Theo',fields:{body:'After move'}});
 rejected=await two.run('publish',await publishRequest(two,[notePath]));await two.run('sync-fetch',{scope:'team'});
 result=await two.run('sync-rebase',{scope:'team',expected_commit:rejected.committed,destination,confirm:true});assert.equal(result.rebased,false);assert.match(result.unresolved[0].conflicts[0],/removed or moved/);assert.equal((await two.run('sync-status',{scope:'team'})).head,rejected.committed);
});

test('todos adopted by an older version stay adopted after the legacy file is reordered',async t=>{
 const {root,store}=fixture(t);const todo=path.join(root,'.ddt/personal/todo.json');write(todo,{items:[{id:'a',what:'First'},{id:'b',what:'Second'}]});
 const a=(await store.run('work')).find(w=>w.original?.id==='a');const adopted=await store.run('work-adopt',{id:a.id,expected_source:a.revision,author:'Maya'});
 const file=path.join(root,'.ddt/personal/work',adopted.id+'.json');const record=JSON.parse(fs.readFileSync(file,'utf8'));record.legacy_source='.ddt/personal/todo.json#0:a';fs.writeFileSync(file,JSON.stringify(record));
 write(todo,{items:[{id:'b',what:'Second'},{id:'a',what:'First'}]});
 assert.deepEqual((await store.run('work')).filter(w=>w.legacy).map(w=>w.original.id),['b']);
});

test("catch-up treats this clone's own publications as authored and rejects non-ISO since",async t=>{
 const {one}=await teamFixture(t);await project(one,'team');await new Promise(r=>setTimeout(r,1100));const since=new Date().toISOString();await new Promise(r=>setTimeout(r,1100));
 await one.run('project-save',{scope:'team',project:'atlas',expected:1,author:'Maya',fields:{context:'Mine'}});await one.run('publish',await publishRequest(one,['projects/atlas/project.json']));
 const changes=(await one.run('catch-up',{since})).changes;assert.equal(changes.length,1);assert.deepEqual(changes[0].change,{authored:true,arrived:false,jira_refreshed:false});
 for(const bad of ['1','2020','yesterday'])await assert.rejects(one.run('catch-up',{since:bad}),/ISO date/);
});

test('legacy empty locks age out; a fresh lock without an owner stays busy',async t=>{
 const {root,store}=fixture(t);const w=await work(store);const lock=path.join(root,'.ddt/personal/work',w.id+'.json.ddt-lock');
 write(lock,'');const old=new Date(Date.now()-11*60*1000);fs.utimesSync(lock,old,old);
 assert.equal((await store.run('work-save',{id:w.id,expected:1,author:'Maya',fields:{status:'done'}})).status,'done');assert.equal(fs.existsSync(lock),false);
 write(lock,'');await assert.rejects(store.run('work-save',{id:w.id,expected:2,author:'Maya',fields:{status:'open'}}),/busy/);fs.unlinkSync(lock);
});

test('Jira site config matches case-insensitively; malformed project.json warns; unknown scope errors; dashboard search reads',async t=>{
 let calls=0;const {root,store}=jiraFixture(t,async()=>{calls++;return jiraResponse();});
 write(path.join(root,'.ddt/personal/jira.json'),{sites:[{site:'https://EXAMPLE.atlassian.net/',token_env:'OFFICE_V1_FIXTURE_TOKEN'}]});
 const w=await jiraWork(store);assert.equal((await store.run('jira-refresh',{id:w.id})).status,'Open');assert.equal(calls,1);
 await project(store);write(path.join(root,'.ddt/projects/atlas/project.json'),'{broken');
 const view=await store.run('overview');assert.ok(view.projects.find(p=>p.project==='atlas'&&p.malformed));assert.ok(view.warnings.some(x=>x.project==='atlas'));
 assert.equal((await store.run('project',{project:'atlas'})).project.malformed,true);
 await assert.rejects(store.run('notes',{scope:'nowhere'}),/Unknown team scope/);
 const {Readable}=require('node:stream');const server=createServer(root);server.address=()=>({port:32124});
 const request=url=>new Promise(resolve=>{const req=Readable.from(['']);req.url=url;req.method='GET';req.headers={host:'127.0.0.1:32124'};const res={writeHead(s){this.status=s;},end(d){resolve({status:this.status,json:()=>JSON.parse(d)});}};server.emit('request',req,res);});
 const found=await request('/api/view?command=search&query=follow');assert.equal(found.status,200);assert.equal(found.json().result.results.length,1);
});

test('mergeRecords keeps the later updated_at, honors removed keys, and refuses identity choices; redact hides credentials',()=>{
 const {mergeRecords,redact}=require('../core/runtime/ddt');
 const base={id:'n',title:'T',body:'b',extra:'x',revision:1,updated_at:'2026-09-01T00:00:00Z',updated_by:'A',history:[{revision:1}]};
 const upstream={...base,title:'Up',revision:2,updated_at:'2026-09-09T00:00:00Z',updated_by:'B',history:[{revision:1},{revision:2}]};
 const local={...base,body:'mine',revision:2,updated_at:'2026-09-02T00:00:00Z',updated_by:'C',history:[{revision:1},{revision:2}]};delete local.extra;
 const merged=mergeRecords(base,upstream,local,{},['id']).record;assert.equal(merged.title,'Up');assert.equal(merged.body,'mine');assert.equal(merged.extra,undefined);assert.equal(merged.updated_at,'2026-09-09T00:00:00Z');assert.equal(merged.updated_by,'B');assert.equal(merged.revision,3);
 assert.deepEqual(mergeRecords(base,upstream,{...local,id:'other'},{id:'local'},['id']).conflicts,['id (identity; cannot be chosen)']);
 assert.equal(redact('fatal: https://user:secret@example.invalid/x?access_token=abc'),'fatal: https://***@example.invalid/x?access_token=***');
});

test('duplicate legacy ids stay index-keyed; a blocked HEAD update restores the working tree; search validates scope',async t=>{
 const {root,store}=fixture(t);const todo=path.join(root,'.ddt/personal/todo.json');write(todo,{items:[{id:'x',what:'One'},{id:'x',what:'Two'}]});
 const first=(await store.run('work')).find(w=>w.original?.what==='One');await store.run('work-adopt',{id:first.id,expected_source:first.revision,author:'Maya'});
 assert.deepEqual((await store.run('work')).filter(w=>w.legacy).map(w=>w.original.what),['Two']);
 await assert.rejects(store.run('search',{query:'x',scope:'nowhere'}),/Unknown team scope/);
 const {b,one,two}=await teamFixture(t);await project(one,'team');await one.run('publish',await publishRequest(one,['projects/atlas/project.json']));await two.run('sync-pull',{scope:'team'});
 const n=await note(one,{},{scope:'team',project:'atlas'});await one.run('publish',await publishRequest(one,[`projects/atlas/notes/${n.id}.md`]));
 await two.run('project-save',{scope:'team',project:'atlas',expected:1,author:'Theo',fields:{context:'Theo'}});
 const rejected=await two.run('publish',await publishRequest(two,['projects/atlas/project.json']));const {destination}=await two.run('sync-fetch',{scope:'team'});
 const branch=git(b,'branch','--show-current');write(path.join(b,'.git/refs/heads',branch+'.lock'),'');
 await assert.rejects(two.run('sync-rebase',{scope:'team',expected_commit:rejected.committed,destination,confirm:true}),/HEAD could not be updated; working tree restored/);
 fs.unlinkSync(path.join(b,'.git/refs/heads',branch+'.lock'));
 assert.equal(git(b,'status','--porcelain'),'');assert.equal((await two.run('sync-status',{scope:'team'})).head,rejected.committed);
 assert.equal((await two.run('sync-rebase',{scope:'team',expected_commit:rejected.committed,destination,confirm:true})).rebased,true);
});

test('team clones nested under teams/ publish and pull; containing, .ddt and non-repository locations are refused',async t=>{
 const base=scratch();t.after(()=>fs.rmSync(base,{recursive:true,force:true}));const remote=path.join(base,'remote.git');fs.mkdirSync(remote);git(remote,'init','--bare');git(remote,'symbolic-ref','HEAD','refs/heads/main');
 const seed=path.join(base,'seed');fs.mkdirSync(seed);git(seed,'init','-b','main');write(path.join(seed,'README.md'),'Team fixture\n');git(seed,'add','.');git(seed,'commit','-m','Init');git(seed,'remote','add','origin',remote);git(seed,'push','-u','origin','main');
 const stores=[];
 for(const who of ['maya','theo']){
  const ws=path.join(base,who);fs.mkdirSync(ws);git(ws,'init','-b','main');write(path.join(ws,'.gitignore'),'.ddt/personal/\n.ddt/projects/\nteams/\n');
  git(base,'clone',remote,path.join(ws,'teams/product'));git(path.join(ws,'teams/product'),'config','user.name','Fixture');git(path.join(ws,'teams/product'),'config','user.email',who+'@example.invalid');
  write(path.join(ws,'.ddt/config.md'),'owner: '+who+'\n## Team Repos\nproduct: teams/product\n');
  stores.push(createWorkspace(ws,{env:{GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'}}));
 }
 const [maya,theo]=stores;
 const status=await maya.run('sync-status',{scope:'product'});assert.equal(status.nested.path,'teams/product');assert.equal(status.nested.workspace_ignore,'ignored');
 await maya.run('project-save',{scope:'product',project:'atlas',expected:0,fields:{title:'Atlas',context:'Nested clone'}});
 const n=await maya.run('note-save',{expected:0,fields:{title:'Private',body:'Only mine',links:[{scope:'product',project:'atlas'}]}});
 const preview=await maya.run('publish-preview',{scope:'product',paths:['projects/atlas/project.json']});
 const result=await maya.run('publish',{scope:'product',paths:['projects/atlas/project.json'],expected_head:preview.head,destination:preview.destination,expected_files:{'projects/atlas/project.json':preview.files[0].digest},confirm:true,message:'Share atlas'});
 assert.equal(result.published,true);
 await theo.run('sync-pull',{scope:'product'});const view=await theo.run('project',{scope:'product',project:'atlas'});assert.equal(view.project.context,'Nested clone');assert.equal(view.notes.length,0);
 assert.equal(git(path.join(base,'maya/teams/product'),'ls-files').includes('.ddt'),false);assert.equal(git(path.join(base,'maya'),'status','--porcelain').includes('teams'),false);
 assert.equal(JSON.stringify(await maya.run('brief',{scope:'product',project:'atlas'})).includes('Only mine'),false);assert.equal((await maya.run('brief',{scope:'product',project:'atlas',audience:'personal'})).linked_private.notes[0].id,n.id);
 write(path.join(base,'maya/.gitignore'),'.ddt/personal/\n.ddt/projects/\n');assert.match((await maya.run('sync-status',{scope:'product'})).nested.workspace_ignore,/not ignored: add teams\//);
 // A clone recorded as a pointer in the workspace repository is pointed out, not reported as ignored.
 git(path.join(base,'maya'),'add','teams/product');assert.match((await maya.run('sync-status',{scope:'product'})).nested.workspace_ignore,/recorded in the workspace repository/);git(path.join(base,'maya'),'rm','--cached','-f','-q','teams/product');
 write(path.join(base,'maya/.gitignore'),'.ddt/personal/\n.ddt/projects/\nteams/\n');assert.equal((await maya.run('sync-status',{scope:'product'})).nested.workspace_ignore,'ignored');
 // Private storage cannot be referenced from a shared record in any spelling now that .ddt is a real relative path.
 for(const ref of ['../../.DDT/personal/notes/x.md','../../.ddt','%2E%64%64%74/personal/x','..\\..\\.ddt\\personal\\x'])await assert.rejects(maya.run('note-save',{scope:'product',project:'atlas',expected:0,fields:{title:'Leak',body:'x',sources:[{label:'Leak',ref}]}}),/Private source/,ref);
 // On a case-insensitive filesystem an aliased spelling of the workspace is still the workspace.
 const ws=path.join(base,'maya');const alias=path.join(base,'MAYA');let insensitive=false;try{insensitive=fs.realpathSync.native(alias)===fs.realpathSync.native(ws);}catch{}
 if(insensitive){
  write(path.join(ws,'.ddt/config.md'),'owner: maya\n## Team Repos\nselfalias: '+alias+'\naliased: '+path.join(alias,'teams/product')+'\n');
  const aliasWarnings=(await maya.run('projects')).warnings.map(w=>w.scope+': '+w.error);assert.match(aliasWarnings.find(w=>w.startsWith('selfalias')),/must not contain/);
  assert.equal((await maya.run('sync-status',{scope:'aliased'})).nested.path,'teams/product');
 }
 write(path.join(base,'maya/.ddt/config.md'),'owner: maya\n## Team Repos\nparent: '+base+'\nhidden: .ddt/team\nplain: teams/plain\nmissing: teams/none\n');
 git(base,'init','-b','main');fs.mkdirSync(path.join(base,'maya/.ddt/team'),{recursive:true});fs.mkdirSync(path.join(base,'maya/teams/plain'),{recursive:true});
 const warnings=(await maya.run('projects')).warnings.map(w=>w.scope+': '+w.error);
 assert.match(warnings.find(w=>w.startsWith('parent')),/must not contain the personal workspace/);assert.match(warnings.find(w=>w.startsWith('hidden')),/inside \.ddt/);
 assert.match(warnings.find(w=>w.startsWith('plain')),/own Git repository/);assert.match(warnings.find(w=>w.startsWith('missing')),/does not exist/);
});
