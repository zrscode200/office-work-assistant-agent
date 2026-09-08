'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const installer=path.join(root,'bootstrap/init-workspace.sh');
const runtimes=['claude','codex','opencode','copilot'];
const scratch=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'office-v1-install-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)).map(f=>e.name+'/'+f):[e.name]);
const write=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);};
const install=(dir,runtime='claude',update=false)=>execFileSync('sh',[installer,...(update?['--update']:[]),'--runtime',runtime,dir],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const userOwned=rel=>/^\.ddt\/(config\.md|profile\.md|norms\.md|registry\.md|projects\/|personal\/)/.test(rel)||['.claude/settings.json','.codex/config.toml','opencode.json','.github/copilot-instructions.md'].includes(rel);
for(const runtime of runtimes)test(`${runtime} fresh/repeat install and full upgrade preserve users and refresh all managed outputs`,t=>{
 const base=scratch(t),target=path.join(base,'workspace with spaces');fs.mkdirSync(target);const generated=path.join(root,'generated',runtime);install(target,runtime);
 for(const rel of files(generated)){assert.deepEqual(fs.readFileSync(path.join(target,rel)),fs.readFileSync(path.join(generated,rel)),rel);assert.equal(fs.statSync(path.join(target,rel)).mode&0o111,fs.statSync(path.join(generated,rel)).mode&0o111,rel+' mode');}
 const runtimeConfig=runtime==='claude'?'.claude/settings.json':runtime==='codex'?'.codex/config.toml':runtime==='copilot'?'.github/copilot-instructions.md':'opencode.json';
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
 for(const other of runtimes.filter(x=>x!==runtime))assert.equal(fs.existsSync(path.join(target,'.'+other)),false);
});
test('installer rejects unsupported runtime, toolkit target, and symlink destinations before mutation',t=>{
 const base=scratch(t);assert.throws(()=>install(base,'unsupported'));assert.deepEqual(fs.readdirSync(base),[]);assert.throws(()=>install(root,'claude'));
 const target=path.join(base,'target'),outside=path.join(base,'outside');fs.mkdirSync(target);fs.mkdirSync(outside);fs.symlinkSync(outside,path.join(target,'.ddt'));assert.throws(()=>install(target,'claude'));assert.deepEqual(fs.readdirSync(target),['.ddt']);assert.deepEqual(fs.readdirSync(outside),[]);
});
test('all runtimes install byte-identical common helper and all intent shortcuts',()=>{
 for(const runtime of runtimes){const generated=path.join(root,'generated',runtime);for(const rel of files(path.join(root,'core/runtime')))assert.deepEqual(fs.readFileSync(path.join(generated,'.ddt/runtime',rel)),fs.readFileSync(path.join(root,'core/runtime',rel)));
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

test('Copilot uses discoverable native skills with resolvable references and a small entry point',()=>{
 const generated=path.join(root,'generated/copilot');
 const instructions=fs.readFileSync(path.join(generated,'.github/copilot-instructions.md'),'utf8');
 assert.ok(instructions.length<2000);assert.match(instructions,/\.ddt\/runtime\/ASSISTANT\.md/);
 assert.deepEqual(fs.readFileSync(path.join(generated,'.ddt/runtime/ASSISTANT.md')),fs.readFileSync(path.join(root,'core/manual.md')));
 const mapping={'project-manager':'office-projects','think-partner':'office-notes','task-manager':'office-work'};
 const references=[];
 for(const name of Object.values(mapping)){
  const dir=path.join(generated,'.github/skills',name);const skill=fs.readFileSync(path.join(dir,'SKILL.md'),'utf8');
  assert.ok(skill.startsWith('---\n'));assert.match(skill,new RegExp('^name: '+name+'$','m'));assert.match(skill,/^description: "[^\n]+"$/m);assert.match(skill,/\.ddt\/runtime\/ASSISTANT\.md/);
  assert.equal(/^allowed-tools:/m.test(skill),false);
  const links=[...skill.matchAll(/\]\((references\/[^)]+)\)/g)];assert.ok(links.length);
  for(const [,link] of links){assert.ok(fs.statSync(path.join(dir,link)).isFile());references.push(path.basename(link));}
 }
 assert.deepEqual(references.sort(),files(path.join(root,'core/commands')).sort());
 const agent=fs.readFileSync(path.join(generated,'.github/agents/office-work-assistant.agent.md'),'utf8');assert.match(agent,/^name: office-work-assistant$/m);assert.match(agent,/^description: "[^\n]+"$/m);assert.match(agent,/\.ddt\/runtime\/ASSISTANT\.md/);assert.match(agent,/\.ddt\/runtime\/WORKFLOWS\.md/);
 assert.equal(/^(model|mcp-servers|handoffs|tools):/m.test(agent),false);
 for(const rel of ['AGENTS.md','CLAUDE.md','.github/prompts','.github/hooks','.copilot','.claude','.codex','.opencode'])assert.equal(fs.existsSync(path.join(generated,rel)),false,rel);
});

test('Copilot install/update retains existing instruction files and unrelated customizations',t=>{
 const target=scratch(t);const preserved=['AGENTS.md','CLAUDE.md','.github/copilot-instructions.md','.github/instructions/team.instructions.md','.github/hooks/team.json','.github/agents/reviewer.agent.md','.github/skills/team-skill/SKILL.md','.copilot/config.json','.copilot/mcp-config.json','.ddt/personal/notes/my-note.md'];
 for(const rel of preserved)write(path.join(target,rel),'EXISTING '+rel+'\n');
 for(const update of [false,true]){install(target,'copilot',update);for(const rel of preserved)assert.equal(fs.readFileSync(path.join(target,rel),'utf8'),'EXISTING '+rel+'\n',rel);}
 // The named agent and skills can load the manual even with a preserved custom entry file.
 assert.ok(fs.existsSync(path.join(target,'.github/agents/office-work-assistant.agent.md')));assert.ok(fs.existsSync(path.join(target,'.ddt/runtime/ASSISTANT.md')));
});

test('installed Copilot distribution runs the shared CLI for capture, development, work, and briefing',t=>{
 const target=scratch(t);install(target,'copilot');const helper=path.join(target,'.ddt/runtime/ddt.js');
 const run=(command,input={})=>{
  const request=path.join(target,'.ddt/personal/request.json');write(request,JSON.stringify(input));
  return JSON.parse(execFileSync('node',[helper,command,'--workspace',target,'--input',request],{encoding:'utf8'})).result;
 };
 run('project-save',{project:'atlas',expected:0,author:'Fixture',fields:{title:'Atlas'}});
 const note=run('note-save',{project:'atlas',expected:0,author:'Fixture',fields:{title:'Thinking',body:'Original'}});
 const developed=run('note-save',{project:'atlas',id:note.id,expected:1,author:'Fixture',fields:{body:'Developed'}});assert.equal(developed.id,note.id);
 const work=run('work-save',{expected:0,author:'Fixture',fields:{title:'Follow up',links:[{scope:'personal',project:'atlas'}]}});
 run('work-save',{id:work.id,expected:1,author:'Fixture',fields:{status:'done'}});
 const brief=run('brief',{project:'atlas'});assert.equal(brief.notes.length,1);assert.equal(brief.notes[0].body,'Developed');assert.equal(brief.work[0].id,work.id);assert.equal(brief.work[0].status,'done');
});
