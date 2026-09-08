'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createWorkspace}=require('./ddt');
const root=process.argv[2]||process.cwd();
try {
  const config=fs.readFileSync(path.join(root,'.ddt/config.md'),'utf8');
  if(/^todo_surfacing:\s*proactive\s*$/m.test(config)) {
    const view=createWorkspace(root).overview();
    const open=view.work.filter(w=>w.provider!=='jira'&&w.status!=='done');
    const today=new Date().toISOString().slice(0,10);
    console.log(JSON.stringify({additionalContext:`Personal/team follow-ups in local view: ${open.length} open, ${open.filter(w=>w.due&&w.due<today).length} overdue. Team repositories and Jira were not refreshed.`}));
  }
}catch(e){console.log(JSON.stringify({additionalContext:`Workspace context unavailable: ${e.message}`}));}
