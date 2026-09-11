'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const installer=path.join(root,'bootstrap/init-workspace.sh');
const runtimes=['claude','codex','opencode','copilot','deepagents'];
const scratch=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'office-v1-install-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)).map(f=>e.name+'/'+f):[e.name]);
const write=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);};
const install=(dir,runtime='claude',update=false)=>execFileSync('sh',[installer,...(update?['--update']:[]),'--runtime',runtime,dir],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const userOwned=(rel,runtime)=>/^\.ddt\/(config\.md|profile\.md|norms\.md|registry\.md|projects\/|personal\/)/.test(rel)||['.claude/settings.json','.codex/config.toml','opencode.json','.github/copilot-instructions.md'].includes(rel)||(runtime==='deepagents'&&['AGENTS.md','.deepagents/skills.toml','.deepagents/hooks.json'].includes(rel));
for(const runtime of runtimes)test(`${runtime} fresh/repeat install and full upgrade preserve users and refresh all managed outputs`,t=>{
 const base=scratch(t),target=path.join(base,'workspace with spaces');fs.mkdirSync(target);const generated=path.join(root,'generated',runtime);install(target,runtime);
 for(const rel of files(generated)){assert.deepEqual(fs.readFileSync(path.join(target,rel)),fs.readFileSync(path.join(generated,rel)),rel);assert.equal(fs.statSync(path.join(target,rel)).mode&0o111,fs.statSync(path.join(generated,rel)).mode&0o111,rel+' mode');}
 const runtimeConfig=runtime==='claude'?'.claude/settings.json':runtime==='codex'?'.codex/config.toml':runtime==='copilot'?'.github/copilot-instructions.md':runtime==='deepagents'?'.deepagents/skills.toml':'opencode.json';
 const preserved=['.ddt/config.md','.ddt/profile.md','.ddt/norms.md','.ddt/registry.md','.ddt/personal/scratch/.index.md','.ddt/personal/scratch/idea.md','.ddt/personal/notebook/thought.md','.ddt/personal/todo.json','.ddt/personal/todo-complete.json','.ddt/personal/jira.json','.ddt/projects/old/status.md',runtimeConfig,...(runtime==='deepagents'?['AGENTS.md','.deepagents/hooks.json']:[])];
 for(const rel of preserved)write(path.join(target,rel),'USER SENTINEL '+rel+'\n');
 for(const rel of files(generated))if(!userOwned(rel,runtime)&&rel!=='.gitignore')write(path.join(target,rel),'STALE '+rel);
 write(path.join(target,'.gitignore'),'custom-rule\n.ddt/personal/notebook/\n');
 install(target,runtime);assert.equal(fs.readFileSync(path.join(target,'.ddt/runtime/ddt.js'),'utf8'), 'STALE .ddt/runtime/ddt.js');
 install(target,runtime,true);
 for(const rel of preserved)assert.equal(fs.readFileSync(path.join(target,rel),'utf8'),'USER SENTINEL '+rel+'\n',rel);
 for(const rel of files(generated))if(!userOwned(rel,runtime)&&rel!=='.gitignore')assert.deepEqual(fs.readFileSync(path.join(target,rel)),fs.readFileSync(path.join(generated,rel)),rel);
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
 // Claude Code only injects context from the documented hookSpecificOutput shape.
 const hook=JSON.parse(output);assert.equal(hook.hookSpecificOutput.hookEventName,'SessionStart');assert.match(hook.hookSpecificOutput.additionalContext,/1 open/);assert.equal('additionalContext' in hook,false);
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
 for(const rel of ['AGENTS.md','CLAUDE.md','.github/prompts','.github/hooks','.copilot','.claude','.codex','.opencode','.deepagents'])assert.equal(fs.existsSync(path.join(generated,rel)),false,rel);
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


test('Copilot native onboarding overrides reach fresh and upgraded workspaces with common fallbacks',t=>{
 const target=scratch(t);
 const tutorial='.github/skills/office-projects/references/self-tutorial.md';
 const skill='.github/skills/office-projects/SKILL.md';
 const expectedTutorial=fs.readFileSync(path.join(root,'adapters/copilot',tutorial),'utf8');
 const expectedSkill=fs.readFileSync(path.join(root,'adapters/copilot',skill),'utf8');
 install(target,'copilot');
 assert.equal(fs.readFileSync(path.join(target,tutorial),'utf8'),expectedTutorial);
 assert.ok(fs.readFileSync(path.join(target,skill),'utf8').startsWith(expectedSkill));
 // Simulate upgrading an older Copilot stamp with a personalized instruction seed.
 const instructions=path.join(target,'.github/copilot-instructions.md');write(instructions,'MY EXISTING INSTRUCTIONS');
 write(path.join(target,tutorial),fs.readFileSync(path.join(root,'core/commands/self-tutorial.md')));
 write(path.join(target,skill),'OLD SKILL');install(target,'copilot',true);
 assert.equal(fs.readFileSync(instructions,'utf8'),'MY EXISTING INSTRUCTIONS');
 assert.equal(fs.readFileSync(path.join(target,tutorial),'utf8'),expectedTutorial);
 assert.ok(fs.readFileSync(path.join(target,skill),'utf8').startsWith(expectedSkill));
 // Every other common reference still comes from core; the override is Copilot-only.
 for(const command of files(path.join(root,'core/commands')).filter(x=>x!=='self-tutorial.md')){
  const rel=files(path.join(target,'.github/skills')).find(x=>x.endsWith('/references/'+command));
  assert.equal(fs.readFileSync(path.join(target,'.github/skills',rel),'utf8'),fs.readFileSync(path.join(root,'core/commands',command),'utf8').replaceAll('{{MANUAL}}','`.ddt/runtime/ASSISTANT.md`'));
 }
 for(const runtime of runtimes.filter(x=>x!=='copilot')){
  const dir=path.join(root,'generated',runtime);const rel=files(dir).find(x=>x.endsWith('/self-tutorial.md'));const manual=runtime==='claude'?'CLAUDE.md':runtime==='deepagents'?'.deepagents/AGENTS.md':'AGENTS.md';
  assert.equal(fs.readFileSync(path.join(dir,rel),'utf8'),fs.readFileSync(path.join(root,'core/commands/self-tutorial.md'),'utf8').replaceAll('{{MANUAL}}','`'+manual+'`'));
 }
});

test('every runtime renders the manual token, Codex skills index their references, and no inert skills config ships',()=>{
 for(const runtime of runtimes){
  const generated=path.join(root,'generated',runtime);
  for(const rel of files(generated))if(rel.endsWith('.md'))assert.equal(fs.readFileSync(path.join(generated,rel),'utf8').includes('{{'),false,runtime+' '+rel);
  const manual=runtime==='claude'?'CLAUDE.md':runtime==='copilot'?'.ddt/runtime/ASSISTANT.md':runtime==='deepagents'?'.deepagents/AGENTS.md':'AGENTS.md';
  const skills=files(generated).filter(f=>f.endsWith('/SKILL.md'));assert.equal(skills.length,3,runtime);
  for(const rel of skills)assert.ok(fs.readFileSync(path.join(generated,rel),'utf8').includes('`'+manual+'`'),runtime+' '+rel);
 }
 const codex=path.join(root,'generated/codex');const references=[];
 for(const name of ['project-manager','think-partner','task-manager']){
  const dir=path.join(codex,'.codex/skills',name);const skill=fs.readFileSync(path.join(dir,'SKILL.md'),'utf8');
  const links=[...skill.matchAll(/\]\((references\/[^)]+)\)/g)];assert.ok(links.length,name);
  for(const [,link] of links){assert.ok(fs.statSync(path.join(dir,link)).isFile());references.push(path.basename(link));}
 }
 assert.deepEqual(references.sort(),files(path.join(root,'core/commands')).sort());
 assert.equal(fs.readFileSync(path.join(codex,'.codex/config.toml'),'utf8').includes('[[skills.config]]'),false);
});

test('update keeps pre-existing root files, backs up legacy ones, reports drift and orphans, and detects the runtime',t=>{
 const target=scratch(t);write(path.join(target,'README.md'),'MY README\n');write(path.join(target,'CLAUDE.md'),'MY RULES\n');write(path.join(target,'.claude/commands/todo.md'),'MINE\n');
 let out=install(target,'claude');assert.match(out,/kept: README.md/);assert.match(out,/kept: .claude\/commands\/todo.md/);assert.match(out,/initialized git repository/);
 write(path.join(target,'.ddt/config.md'),'owner: Maya\n');
 out=install(target,'claude',true);assert.match(out,/kept: README.md/);assert.equal(fs.readFileSync(path.join(target,'README.md'),'utf8'),'MY README\n');assert.equal(fs.readFileSync(path.join(target,'CLAUDE.md'),'utf8'),'MY RULES\n');assert.equal(fs.readFileSync(path.join(target,'.claude/commands/todo.md'),'utf8'),'MINE\n');
 assert.equal(/differs: .ddt\/config.md/.test(out),false);
 const manifest=fs.readFileSync(path.join(target,'.ddt/runtime/manifest.claude.txt'),'utf8');assert.match(manifest,/^kept README.md$/m);assert.match(manifest,/^managed .ddt\/runtime\/ddt.js$/m);assert.match(manifest,/^runtime claude$/m);assert.match(manifest,/^toolkit_version \d/m);
 assert.equal(fs.readdirSync(target).some(f=>f.includes('before-update')),false);
 const legacy=scratch(t);install(legacy,'claude');fs.unlinkSync(path.join(legacy,'.ddt/runtime/manifest.claude.txt'));
 write(path.join(legacy,'.ddt/runtime/ddt.js'),'STALE RUNTIME');out=install(legacy,'claude');assert.match(out,/notice: this workspace already has the toolkit runtime but no manifest/);assert.match(out,/skip: .ddt\/runtime\/ddt.js already exists \(toolkit-managed\)/);fs.unlinkSync(path.join(legacy,'.ddt/runtime/manifest.claude.txt'));
 write(path.join(legacy,'README.md'),'OLD TOOLKIT README\n');write(path.join(legacy,'.claude/dashboard/template.html'),'<old>');
 write(path.join(legacy,'.claude/settings.json'),JSON.stringify({hooks:{SessionStart:[{matcher:'',hooks:[{type:'command',command:'sh $CLAUDE_PROJECT_DIR/.claude/hooks/session-sync.sh'}]}]}}));
 out=install(legacy,'claude',true);
 assert.match(out,/backup: README.md/);assert.match(out,/orphan: .claude\/dashboard\/template.html/);assert.match(out,/differs: .claude\/settings.json/);assert.match(out,/unquoted path/);
 const backup=fs.readdirSync(legacy).find(f=>f.startsWith('README.md.before-update-'));assert.ok(backup);assert.equal(fs.readFileSync(path.join(legacy,backup),'utf8'),'OLD TOOLKIT README\n');
 assert.deepEqual(fs.readFileSync(path.join(legacy,'README.md')),fs.readFileSync(path.join(root,'generated/claude/README.md')));assert.ok(fs.existsSync(path.join(legacy,'.claude/dashboard/template.html')));
 out=execFileSync('sh',[installer,'--update',legacy],{encoding:'utf8',stdio:['ignore','pipe','pipe']});assert.match(out,/updating installed runtime 'claude'/);
 out=install(legacy,'copilot');assert.match(out,/shared: README.md is managed by the claude install/);assert.deepEqual(fs.readFileSync(path.join(legacy,'README.md')),fs.readFileSync(path.join(root,'generated/claude/README.md')));assert.equal(/^(managed|kept) README.md$/m.test(fs.readFileSync(path.join(legacy,'.ddt/runtime/manifest.copilot.txt'),'utf8')),false);
 assert.throws(()=>execFileSync('sh',[installer,'--update',legacy],{stdio:['ignore','pipe','pipe']}),/several runtimes/);
 const empty=scratch(t);assert.throws(()=>execFileSync('sh',[installer,'--update',empty],{stdio:['ignore','pipe','pipe']}),/no manifest/);
});

test('installer rejects unknown flags and extra targets, honors --no-git, guards the toolkit tree, and reconciles CRLF and negated ignore rules',t=>{
 const base=scratch(t);const target=path.join(base,'t');fs.mkdirSync(target);
 assert.throws(()=>execFileSync('sh',[installer,'--updat','--runtime','claude',target],{stdio:['ignore','pipe','pipe']}),/unknown option/);
 assert.throws(()=>execFileSync('sh',[installer,'--runtime','claude',target,base],{stdio:['ignore','pipe','pipe']}),/only one target/);
 assert.deepEqual(fs.readdirSync(target),[]);
 assert.throws(()=>install(path.join(root,'tests'),'claude'),/toolkit repository/);assert.equal(fs.existsSync(path.join(root,'tests/.ddt')),false);
 write(path.join(target,'.gitignore'),'custom\r\n.ddt/personal/\r\n!.ddt/projects/\r\n');
 const out=execFileSync('sh',[installer,'--no-git','--runtime','copilot',target],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 assert.equal(fs.existsSync(path.join(target,'.git')),false);assert.match(out,/negates '.ddt\/projects\/'/);
 const ignores=fs.readFileSync(path.join(target,'.gitignore'),'utf8');assert.equal(ignores.split(/\r?\n/).filter(l=>l==='.ddt/personal/').length,1);assert.equal(/^\.ddt\/projects\/$/m.test(ignores),false);assert.ok(ignores.split(/\r?\n/).includes('*.ddt-lock'));
 execFileSync('sh',[installer,'--no-git','--runtime','copilot',target],{stdio:['ignore','pipe','pipe']});assert.equal(fs.readFileSync(path.join(target,'.gitignore'),'utf8'),ignores);
});

test('deepagents distribution: managed manual beside user memory, project skill policy, session hook, and update preservation',t=>{
 const generated=path.join(root,'generated/deepagents');
 const manual=fs.readFileSync(path.join(generated,'.deepagents/AGENTS.md'),'utf8');
 assert.ok(manual.startsWith('Managed by the Office Work Assistant toolkit'));assert.ok(manual.includes(fs.readFileSync(path.join(root,'core/manual.md'),'utf8')));assert.match(manual,/## deepagents surface/);
 const seed=fs.readFileSync(path.join(generated,'AGENTS.md'),'utf8');assert.ok(seed.length<1200);assert.match(seed,/\.deepagents\/AGENTS\.md/);
 const policy=fs.readFileSync(path.join(generated,'.deepagents/skills.toml'),'utf8');assert.match(policy,/^\[skills\]$/m);assert.match(policy,/^mode = "project"$/m);assert.match(policy,/^sources = \[".deepagents\/skills"\]$/m);assert.match(policy,/^include_builtin = true$/m);
 const hooks=JSON.parse(fs.readFileSync(path.join(generated,'.deepagents/hooks.json'),'utf8'));const command=hooks.hooks.SessionStart[0].hooks[0].command;assert.match(command,/git rev-parse --show-toplevel/);assert.match(command,/node \.ddt\/runtime\/session\.js$/);
 const references=[];
 for(const name of ['office-projects','office-notes','office-work']){
  const dir=path.join(generated,'.deepagents/skills',name);const skill=fs.readFileSync(path.join(dir,'SKILL.md'),'utf8');
  assert.ok(skill.startsWith('---\n'));assert.match(skill,new RegExp('^name: '+name+'$','m'));assert.match(skill,/\.deepagents\/AGENTS\.md/);
  const links=[...skill.matchAll(/\]\((references\/[^)]+)\)/g)];assert.ok(links.length,name);
  for(const [,link] of links){assert.ok(fs.statSync(path.join(dir,link)).isFile());references.push(path.basename(link));}
 }
 assert.deepEqual(references.sort(),files(path.join(root,'core/commands')).sort());
 for(const rel of ['CLAUDE.md','.claude','.codex','.opencode','.github','.deepagents/dashboard'])assert.equal(fs.existsSync(path.join(generated,rel)),false,rel);
 const target=scratch(t);let out=install(target,'deepagents');assert.match(out,/run lc-code/);
 fs.appendFileSync(path.join(target,'AGENTS.md'),'\n- Maya prefers Friday summaries.\n');write(path.join(target,'.deepagents/AGENTS.md'),'STALE MANUAL');
 out=install(target,'deepagents',true);assert.match(out,/update: .deepagents\/AGENTS.md/);assert.equal(/differs: AGENTS.md/.test(out),false);
 assert.deepEqual(fs.readFileSync(path.join(target,'.deepagents/AGENTS.md')),fs.readFileSync(path.join(generated,'.deepagents/AGENTS.md')));
 assert.match(fs.readFileSync(path.join(target,'AGENTS.md'),'utf8'),/Maya prefers Friday summaries/);
 const manifest=fs.readFileSync(path.join(target,'.ddt/runtime/manifest.deepagents.txt'),'utf8');assert.match(manifest,/^managed .deepagents\/AGENTS.md$/m);assert.equal(/^(managed|kept) AGENTS.md$/m.test(manifest),false);
 write(path.join(target,'.ddt/config.md'),'owner: Maya\ntodo_surfacing: proactive\n');
 const {createWorkspace}=require('../core/runtime/ddt');return createWorkspace(target).run('work-save',{expected:0,fields:{title:'Personal task'}}).then(()=>{
  const hook=JSON.parse(execFileSync('sh',['-c',command],{cwd:target,encoding:'utf8'}));
  assert.equal(hook.hookSpecificOutput.hookEventName,'SessionStart');assert.match(hook.hookSpecificOutput.additionalContext,/1 open/);
 });
});

test('deepagents installer guards: own Git root, stamped alone, in-place manual edits backed up, hook works from a subfolder',t=>{
 const base=scratch(t);
 const bare=path.join(base,'bare');fs.mkdirSync(bare);assert.throws(()=>execFileSync('sh',[installer,'--no-git','--runtime','deepagents',bare],{stdio:['ignore','pipe','pipe']}),/Git root/);assert.deepEqual(fs.readdirSync(bare),[]);
 const outer=path.join(base,'outer');fs.mkdirSync(outer);execFileSync('git',['-C',outer,'init','-q']);const nested=path.join(outer,'ws');fs.mkdirSync(nested);
 let out=install(nested,'deepagents');assert.match(out,/own Git root/);assert.match(out,/notice: this workspace sits inside the repository/);assert.ok(fs.existsSync(path.join(nested,'.git')));
 assert.equal(fs.realpathSync(execFileSync('git',['-C',nested,'rev-parse','--show-toplevel'],{encoding:'utf8'}).trim()),fs.realpathSync(nested));
 const codexWs=path.join(base,'codex');fs.mkdirSync(codexWs);install(codexWs,'codex');assert.throws(()=>install(codexWs,'deepagents'),/stamped alone/);assert.equal(fs.existsSync(path.join(codexWs,'.deepagents')),false);
 assert.throws(()=>install(nested,'codex'),/stamped alone/);assert.equal(fs.existsSync(path.join(nested,'.codex')),false);
 fs.appendFileSync(path.join(nested,'.deepagents/AGENTS.md'),'\n- agent edit\n');fs.appendFileSync(path.join(nested,'.deepagents/skills.toml'),'# mine\n');
 out=install(nested,'deepagents',true);assert.match(out,/backup: .deepagents\/AGENTS.md/);assert.match(out,/differs: .deepagents\/skills.toml/);
 const backup=fs.readdirSync(path.join(nested,'.deepagents')).find(f=>f.startsWith('AGENTS.md.before-update-'));assert.ok(backup);assert.match(fs.readFileSync(path.join(nested,'.deepagents',backup),'utf8'),/agent edit/);
 assert.deepEqual(fs.readFileSync(path.join(nested,'.deepagents/AGENTS.md')),fs.readFileSync(path.join(root,'generated/deepagents/.deepagents/AGENTS.md')));assert.match(fs.readFileSync(path.join(nested,'.deepagents/skills.toml'),'utf8'),/# mine/);
 write(path.join(nested,'.ddt/config.md'),'owner: Maya\ntodo_surfacing: proactive\n');const sub=path.join(nested,'sub');fs.mkdirSync(sub);
 const command=JSON.parse(fs.readFileSync(path.join(nested,'.deepagents/hooks.json'),'utf8')).hooks.SessionStart[0].hooks[0].command;
 const {createWorkspace}=require('../core/runtime/ddt');return createWorkspace(nested).run('work-save',{expected:0,fields:{title:'Personal task'}}).then(()=>{
  const hook=JSON.parse(execFileSync('sh',['-c',command],{cwd:sub,encoding:'utf8'}));assert.equal(hook.hookSpecificOutput.hookEventName,'SessionStart');assert.match(hook.hookSpecificOutput.additionalContext,/1 open/);
 });
});

test('deepagents stamping guard also recognizes workspaces installed before manifests existed',t=>{
 const base=scratch(t);const a=path.join(base,'a');fs.mkdirSync(a);install(a,'codex');fs.unlinkSync(path.join(a,'.ddt/runtime/manifest.codex.txt'));
 assert.throws(()=>install(a,'deepagents'),/stamped alone/);assert.equal(fs.existsSync(path.join(a,'.deepagents')),false);
 const b=path.join(base,'b');fs.mkdirSync(b);install(b,'deepagents');fs.unlinkSync(path.join(b,'.ddt/runtime/manifest.deepagents.txt'));
 assert.throws(()=>install(b,'codex'),/stamped alone/);assert.equal(fs.existsSync(path.join(b,'.codex')),false);
 assert.match(install(b,'deepagents',true),/Update complete/);
});
