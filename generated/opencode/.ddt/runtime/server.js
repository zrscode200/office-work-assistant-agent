#!/usr/bin/env node
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createWorkspace } = require('./ddt');

function createServer(workspace = process.cwd()) {
  const store = createWorkspace(workspace);
  const token = crypto.randomBytes(32).toString('hex');
  const readCommands = new Set(['overview','projects','project','notes','work','brief','catch-up','sync-status']);
  const server = http.createServer(async (req,res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const headers = {
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    };
    const send = (status, data, type = 'application/json') => { res.writeHead(status,{...headers,'Content-Type':type}); res.end(type === 'application/json' ? JSON.stringify(data) : data); };
    if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') return send(403,{error:'This dashboard only accepts its own origin'});
    try {
      const url = new URL(req.url,origin);
      if (req.method === 'GET' && ['/', '/index.html','/app.js','/style.css'].includes(url.pathname)) {
        const file = url.pathname === '/' || url.pathname === '/index.html' ? 'dashboard.html' : url.pathname.slice(1);
        const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
        return send(200,fs.readFileSync(path.join(__dirname,file),'utf8'),type);
      }
      if (req.method === 'GET' && url.pathname === '/api/session') return send(200,{token});
      if (req.method === 'GET' && url.pathname === '/api/view') {
        const command = url.searchParams.get('command') || 'overview';
        if (!readCommands.has(command)) return send(400,{error:'Read command required'});
        const input = Object.fromEntries(url.searchParams); delete input.command;
        return send(200,{ok:true,result:await store.run(command,input)});
      }
      if (req.method === 'POST' && url.pathname === '/api/work') {
        if (req.headers['x-ddt-token'] !== token || req.headers['content-type'] !== 'application/json') return send(403,{error:'Session token and JSON required'});
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 65536) return send(413,{error:'Request too large'}); }
        const input = JSON.parse(body);
        // The dashboard can only change local completion state. Capture/edit/publish stay in the assistant workflow.
        if (!input.fields || Object.keys(input.fields).length !== 1 || !['open','done'].includes(input.fields.status)) return send(400,{error:'Only completion/undo is available here'});
        const existing = (await store.run('work',input)).find(item => item.id === input.id);
        if (!existing || existing.provider !== 'local' || existing.legacy) return send(400,{error:'Only V1 local work can be completed here'});
        return send(200,{ok:true,result:await store.run('work-save',input)});
      }
      send(404,{error:'Not found'});
    } catch (e) { send(400,{ok:false,error:e.message}); }
  });
  return server;
}

function start(workspace = process.cwd()) {
  const server = createServer(workspace);
  server.listen(0,'127.0.0.1',() => console.log(`http://127.0.0.1:${server.address().port}`));
  for (const signal of ['SIGTERM','SIGINT']) process.once(signal,() => server.close());
  return server;
}
if (require.main === module) start(process.argv[2] || process.cwd());
module.exports = { createServer, start };
