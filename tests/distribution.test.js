'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const installer=path.join(root,'bootstrap/init-workspace.sh');
const scratch=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'office-v1-install-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)).map(f=>e.name+'/'+f):[e.name]);
const write=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);};
const install=(dir,runtime='claude',update=false)=>execFileSync('sh',[installer,...(update?['--update']:[]),'--runtime',runtime,dir],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const userOwned=rel=>/^\.ddt\/(config\.md|profile\.md|norms\.md|registry\.md|projects\/|personal\/)/.test(rel)||['.claude/settings.json','.codex/config.toml','opencode.json'].includes(rel);
for(const runtime of ['claude','codex','opencode'])test(`${runtime} fresh/repeat install and full upgrade preserve users and refresh all managed outputs`,t=>{
 const base=scratch(t),target=path.join(base,'workspace with spaces');fs.mkdirSync(target);const generated=path.join(root,'generated',runtime);install(target,runtime);
 for(const rel of files(generated)){assert.deepEqual(fs.readFileSync(path.join(target,rel)),fs.readFileSync(path.join(generated,rel)),rel);assert.equal(fs.statSync(path.join(target,rel)).mode&0o111,fs.statSync(path.join(generated,rel)).mode&0o111,rel+' mode');}
 const runtimeConfig=runtime==='claude'?'.claude/settings.json':runtime==='codex'?'.codex/config.toml':'opencode.json';
 const preserved=['.ddt/config.md','.ddt/profile.md','.ddt/norms.md','.ddt/registry.md','.ddt/personal/scratch/.index.md','.ddt/personal/scratch/idea.md','.ddt/personal/notebook/thought.md','.ddt/personal/todo.json','.ddt/personal/todo-complete.json','.ddt/personal/jira.json','.ddt/projects/old/status.md',runtimeConfig];
 for(const rel of preserved)write(path.join(target,rel),'USER SENTINEL '+rel+'\n');
 for(const rel of files(generated))if(!userOwned(rel)&&rel!=='.gitignore')write(path.join(target,rel),'STALE '+rel);
 write(path.join(target,'.gitignore'),'custom-rule\n.ddt/personal/notebook/\n');
 install(target,runtime);assert.equal(fs.readFileSync(path.join(target,'.ddt/runtime/ddt.js'),'utf8'), 'STALE .ddt/runtime/ddt.js');
 install(target,runtime,true);
 for(const rel of preserved)assert.equal(fs.readFileSync(path.join(target,rel),'utf8'),'USER SENTINEL '+rel+'\n',rel);
 for(const rel of files(generated))if(!userOwned(rel)&&rel!=='.gitignore')assert.deepEqual(fs.readFileSync(path.join(target,rel)),fs.readFileSync(path.join(generated,rel)),rel);
 const ignores=fs.readFileSync(path.join(target,'.gitignore'),'utf8');assert.match(ignores,/custom-rule/);assert.ok(ignores.split('\n').includes('.ddt/personal/'));assert.ok(ignores.split('\n').includes('.ddt/projects/'));install(target,runtime,true);assert.equal(fs.readFileSync(path.join(target,'.gitignore'),'utf8'),ignores);
 const ignored=execFileSync('git',['-C',target,'check-ignore','.ddt/personal/todo.json','.ddt/personal/jira.json','.ddt/projects/old/status.md'],{encoding:'utf8'});assert.equal(ignored.trim().split('\n').length,3);
 assert.equal(fs.existsSync(path.join(target,'.ddt/personal/work/.gitkeep')),true);
 for(const other of ['claude','codex','opencode'].filter(x=>x!==runtime))assert.equal(fs.existsSync(path.join(target,'.'+other)),false);
});
test('installer rejects unsupported runtime, toolkit target, and symlink destinations before mutation',t=>{
 const base=scratch(t);assert.throws(()=>install(base,'unsupported'));assert.deepEqual(fs.readdirSync(base),[]);assert.throws(()=>install(root,'claude'));
 const target=path.join(base,'target'),outside=path.join(base,'outside');fs.mkdirSync(target);fs.mkdirSync(outside);fs.symlinkSync(outside,path.join(target,'.ddt'));assert.throws(()=>install(target,'claude'));assert.deepEqual(fs.readdirSync(target),['.ddt']);assert.deepEqual(fs.readdirSync(outside),[]);
});
test('all runtimes install byte-identical common helper and all intent shortcuts',()=>{
 for(const runtime of ['claude','codex','opencode']){const generated=path.join(root,'generated',runtime);for(const rel of files(path.join(root,'core/runtime')))assert.deepEqual(fs.readFileSync(path.join(generated,'.ddt/runtime',rel)),fs.readFileSync(path.join(root,'core/runtime',rel)));
 const installed=files(generated);for(const command of files(path.join(root,'core/commands')))assert.ok(installed.some(f=>f.endsWith('/'+command)),runtime+' '+command);
 assert.equal(fs.existsSync(path.join(generated,'.ddt/personal/todo.json')),false);assert.equal(fs.existsSync(path.join(generated,'.ddt/personal/scratch')),false);
 }
});
test('Claude hook runs read-only without teams, including shell metacharacters in workspace path',t=>{
 const base=scratch(t);const target=path.join(base,'space $literal `literal`');fs.mkdirSync(target);install(target);write(path.join(target,'.ddt/config.md'),'todo_surfacing: proactive\n');
 const {createWorkspace}=require('../core/runtime/ddt');return createWorkspace(target).run('work-save',{expected:0,author:'Maya',fields:{title:'Personal task'}}).then(()=>{
 const config=JSON.parse(fs.readFileSync(path.join(target,'.claude/settings.json')));const cmd=config.hooks.SessionStart[0].hooks[0].command;const output=execFileSync('sh',['-c',cmd],{encoding:'utf8',env:{...process.env,CLAUDE_PROJECT_DIR:target}});assert.match(output,/1 open/);assert.match(output,/not refreshed/);
 assert.equal(fs.statSync(path.join(target,'.claude/hooks/session-sync.sh')).mode&0o111,0o111);
 });
});
