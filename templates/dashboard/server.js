#!/usr/bin/env node
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const WORKSPACE    = process.cwd();
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 min
const TEMPLATE     = path.join(WORKSPACE, '.claude', 'dashboard', 'template.html');

let idleTimer;

function resetIdle(server) {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.log('Idle 30 min — shutting down.');
    cleanup();
    server.close(() => process.exit(0));
  }, IDLE_TIMEOUT);
}

// ── Parsers ──────────────────────────────────────────────────

function read(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); }
  catch { return null; }
}

function parseRegistry() {
  const content = read(path.join(WORKSPACE, '.ddt', 'registry.md'));
  if (!content) return [];
  const projects = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|$/);
    if (!m) continue;
    const [, name, location, status, created] = m;
    if (name === 'Name' || name.startsWith('-')) continue;
    projects.push({
      name: name.trim(),
      location: location.trim(),
      status: status.trim(),
      created: created.trim()
    });
  }
  return projects;
}

function parseConfig() {
  const content = read(path.join(WORKSPACE, '.ddt', 'config.md'));
  if (!content) return { owner: '', teamRepos: {} };

  const ownerMatch = content.match(/^owner:\s*(.+)$/m);
  const owner = ownerMatch ? ownerMatch[1].trim() : '';

  const teamRepos = {};
  const teamSection = content.split('## Team Repos')[1];
  if (teamSection) {
    for (const line of teamSection.split('\n')) {
      const m = line.match(/^([a-z0-9_-]+):\s*(\/.+)$/);
      if (m) teamRepos[m[1].trim()] = m[2].trim();
    }
  }
  return { owner, teamRepos };
}

function parseStatus(filePath) {
  const content = read(filePath);
  if (!content) return null;

  // Split on dated sections: ## YYYY-MM-DD
  const sections = content.split(/^## /m).filter(s => s.trim());
  if (!sections.length) return null;

  const latest = sections[0];
  const dateMatch   = latest.match(/^(\d{4}-\d{2}-\d{2})/);
  const healthMatch = latest.match(/\*\*Health:\*\*\s*(.+)/);

  const extractBlock = (label) => {
    const re = new RegExp('\\*\\*' + label + ':\\*\\*\\n([\\s\\S]*?)(?=\\n\\*\\*|$)');
    const m = latest.match(re);
    if (!m) return [];
    return m[1].split('\n').map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
  };

  return {
    lastUpdated: dateMatch ? dateMatch[1] : null,
    health: healthMatch ? healthMatch[1].trim().toLowerCase() : null,
    progress: extractBlock('Progress'),
    blockers: extractBlock('Blockers?'),
    next: extractBlock('Next')
  };
}

function projectPath(project, teamRepos) {
  if (project.location === 'personal') {
    return path.join(WORKSPACE, '.ddt', 'projects', project.name);
  }
  const repo = teamRepos[project.location];
  return repo ? path.join(repo, 'projects', project.name) : null;
}

function scanUnregistered(teamRepos, known) {
  const out = [];
  for (const [repo, repoPath] of Object.entries(teamRepos)) {
    try {
      const entries = fs.readdirSync(path.join(repoPath, 'projects'), { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith('.') && !known.has(e.name)) {
          out.push({ name: e.name, repo });
        }
      }
    } catch { /* skip */ }
  }
  return out;
}

function isStale(dateStr) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  return d < cutoff;
}

// ── Build dashboard data ─────────────────────────────────────

function buildData() {
  const config   = parseConfig();
  const registry = parseRegistry();
  const known    = new Set(registry.map(p => p.name));

  const active    = [];
  const completed = [];
  const alerts    = { blocked: [], atRisk: [], stale: [], unregistered: [] };

  for (const proj of registry) {
    if (proj.status === 'archived') continue;

    const pPath = projectPath(proj, config.teamRepos);

    if (proj.status === 'completed') {
      // Try to find completion date from status.md
      const st = pPath ? parseStatus(path.join(pPath, 'status.md')) : null;
      completed.push({
        name: proj.name,
        location: proj.location,
        completedDate: st?.lastUpdated || proj.created
      });
      continue;
    }

    // Active
    const st = pPath ? parseStatus(path.join(pPath, 'status.md')) : null;
    const entry = {
      name: proj.name,
      location: proj.location,
      health: st?.health || 'on-track',
      summary: st?.progress?.slice(0, 2).join('. ') || null,
      blocker: st?.blockers?.[0] || null,
      nextMilestone: st?.next?.[0] || null,
      lastUpdated: st?.lastUpdated || proj.created
    };
    active.push(entry);

    if (entry.health === 'blocked') alerts.blocked.push(entry.name);
    if (entry.health === 'at-risk') alerts.atRisk.push(entry.name);
    if (isStale(entry.lastUpdated)) alerts.stale.push(entry.name);
  }

  alerts.unregistered = scanUnregistered(config.teamRepos, known);

  return {
    generated: new Date().toISOString(),
    owner: config.owner,
    projects: { active, completed },
    alerts
  };
}

// ── HTTP server ──────────────────────────────────────────────

const server = http.createServer((req, res) => {
  resetIdle(server);

  if (req.method === 'GET' && req.url === '/api/data') {
    const data = buildData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    try {
      const html = fs.readFileSync(TEMPLATE, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(500);
      res.end('Dashboard template not found.');
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

function cleanup() {
  try { fs.unlinkSync(path.join(WORKSPACE, '.ddt', 'personal', '.dashboard.pid')); } catch {}
  try { fs.unlinkSync(path.join(WORKSPACE, '.ddt', 'personal', '.dashboard.port')); } catch {}
}

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const url  = `http://127.0.0.1:${port}`;

  // Write PID/port for lifecycle management
  const personal = path.join(WORKSPACE, '.ddt', 'personal');
  fs.mkdirSync(personal, { recursive: true });
  fs.writeFileSync(path.join(personal, '.dashboard.pid'), String(process.pid));
  fs.writeFileSync(path.join(personal, '.dashboard.port'), String(port));

  console.log(url);
  resetIdle(server);
});

process.on('SIGTERM', () => { cleanup(); server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { cleanup(); server.close(() => process.exit(0)); });
