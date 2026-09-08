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
 const stores=[];for(const [i,team]of[a,b].entries()){const personal=path.join(root,'person'+i);fs.mkdirSync(personal);write(path.join(personal,'.ddt/config.md'),`## Team Repos\nteam: ${team}\n`);stores.push(createWorkspace(personal));git(team,'config','user.name','Fixture');git(team,'config','user.email','fixture@example.invalid');}return {root,a,b,remote,one:stores[0],two:stores[1]};}
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
