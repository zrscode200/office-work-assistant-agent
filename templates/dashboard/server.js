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

function parseFrontmatter(content) {
  if (!content || !content.startsWith('---')) return { meta: {}, body: content || '' };
  const end = content.indexOf('\n---', 3);
  if (end === -1) return { meta: {}, body: content };
  const yamlBlock = content.slice(4, end);
  const body = content.slice(end + 4).replace(/^\n/, '');
  const meta = {};
  let currentKey = null;

  for (const line of yamlBlock.split('\n')) {
    const trimmed = line.trimEnd();
    // Block list item: "  - value"
    if (/^\s+-\s/.test(trimmed) && currentKey) {
      const val = trimmed.replace(/^\s+-\s*/, '');
      if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
      meta[currentKey].push(val);
      continue;
    }
    // Top-level key: value
    const kv = trimmed.match(/^([a-z_][a-z0-9_]*)\s*:\s*(.*)$/);
    if (kv) {
      currentKey = kv[1];
      const val = kv[2].trim();
      if (val === '' || val === '~') {
        meta[currentKey] = '';
      } else if (val === '[]') {
        meta[currentKey] = [];
      } else if (val.startsWith('[') && val.endsWith(']')) {
        meta[currentKey] = val.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
      } else {
        meta[currentKey] = val;
      }
    }
  }
  return { meta, body };
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

function extractBlock(section, label) {
  const re = new RegExp('\\*\\*' + label + ':\\*\\*\\n([\\s\\S]*?)(?=\\n\\*\\*|$)');
  const m = section.match(re);
  if (!m) return [];
  return cleanLines(m[1]);
}

function parseStatusSection(section) {
  // Date may have extra text: "2026-03-20 (evening) — title"
  const dateMatch   = section.match(/^(\d{4}-\d{2}-\d{2})/);
  const titleMatch  = section.match(/^[\d-]+[^-\n]*?(?:\s*[—–-]\s*(.+))?$/m);
  const healthMatch = section.match(/\*\*Health:\*\*\s*(.+)/);
  return {
    date: dateMatch ? dateMatch[1] : null,
    title: titleMatch?.[1]?.trim() || null,
    health: healthMatch ? healthMatch[1].trim().toLowerCase() : null,
    progress: extractBlock(section, 'Progress'),
    blockers: extractBlock(section, 'Blockers?'),
    risks: extractBlock(section, 'Risks?'),
    next: extractBlock(section, 'Next')
  };
}

function splitStatusSections(content) {
  // Split on ## and keep only date-prefixed sections
  const all = content.split(/^## /m).filter(s => s.trim());
  return all.filter(s => /^\d{4}-\d{2}-\d{2}/.test(s));
}

function cleanLines(text) {
  return text.split('\n')
    .map(l => l.replace(/^[-*]\s*/, '').replace(/^\[[ x]]\s*/, '').trim())
    .filter(l => l && !l.startsWith('<!--') && !/^[_*]*(none|n\/a)[_*]*$/i.test(l));
}

function parseStatus(filePath) {
  const content = read(filePath);
  if (!content) return null;

  const { meta } = parseFrontmatter(content);
  return {
    lastUpdated: meta.last_updated || null,
    health: meta.health ? meta.health.toLowerCase() : null,
    progress: meta.summary ? [meta.summary] : (Array.isArray(meta.progress) ? meta.progress : []),
    blockers: Array.isArray(meta.blockers) ? meta.blockers : [],
    next: Array.isArray(meta.next) ? meta.next : []
  };
}

function parseFullStatus(filePath) {
  const content = read(filePath);
  if (!content) return [];

  const { meta, body } = parseFrontmatter(content);
  const topHealth = meta.health ? meta.health.toLowerCase() : null;
  const topBlockers = Array.isArray(meta.blockers) ? meta.blockers : [];
  const topNext = Array.isArray(meta.next) ? meta.next : [];
  const dated = splitStatusSections(body || content);

  const entries = dated.map(s => {
    const entry = parseStatusSection(s);
    // For entries without structured blocks, extract bullet points from body
    if (!entry.progress.length) {
      entry.progress = s.split('\n')
        .filter(l => l.startsWith('- '))
        .map(l => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);
    }
    if (!entry.health) entry.health = topHealth;
    return entry;
  });

  // Append top-level blockers/next as context on the latest entry
  if (entries.length && !entries[0].blockers.length && topBlockers.length) {
    entries[0].blockers = topBlockers;
  }
  if (entries.length && !entries[0].next.length && topNext.length) {
    entries[0].next = topNext;
  }

  return entries;
}

function parseOverview(filePath) {
  const content = read(filePath);
  if (!content) return null;

  const { meta, body } = parseFrontmatter(content);
  let objective = meta.objective || null;
  if (objective && objective.length > 150) objective = objective.slice(0, 147) + '...';
  return { objective, fullContent: body };
}

function parseTodos() {
  const f = path.join(WORKSPACE, '.ddt', 'personal', 'todo.json');
  const content = read(f);
  if (!content) return [];
  try {
    const t = JSON.parse(content);
    return (t.items || []).filter(i =>
      i.visibility === 'project' && i.status !== 'done' && i.project
    );
  } catch { return []; }
}

function readPlan(filePath) {
  const content = read(filePath);
  if (!content) return null;
  return parseFrontmatter(content).body;
}

function listMeetings(projectDir) {
  try {
    const dir = path.join(projectDir, 'meetings');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().reverse();
    return files.map(f => {
      const raw = read(path.join(dir, f));
      const { meta, body } = parseFrontmatter(raw);
      const fnMatch = f.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
      return {
        filename: f,
        date: meta.date || (fnMatch ? fnMatch[1] : null),
        topic: fnMatch ? fnMatch[2].replace(/-/g, ' ') : f.replace('.md', ''),
        attendees: Array.isArray(meta.attendees) ? meta.attendees : [],
        purpose: meta.purpose || null,
        content: body
      };
    });
  } catch { return []; }
}

function listDecisions(projectDir) {
  try {
    const dir = path.join(projectDir, 'decisions');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
    return files.map(f => {
      const raw = read(path.join(dir, f));
      const { meta, body } = parseFrontmatter(raw);
      return {
        filename: f,
        name: f.replace('.md', '').replace(/-/g, ' '),
        date: meta.date || null,
        status: meta.status || null,
        participants: Array.isArray(meta.participants) ? meta.participants : [],
        content: body
      };
    });
  } catch { return []; }
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
  const allTodos = parseTodos();

  const active    = [];
  const completed = [];
  const alerts    = { blocked: [], atRisk: [], stale: [], unregistered: [] };

  for (const proj of registry) {
    if (proj.status === 'archived') continue;

    const pPath = projectPath(proj, config.teamRepos);

    if (proj.status === 'completed') {
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
    const ov = pPath ? parseOverview(path.join(pPath, 'overview.md')) : null;
    const projTodos = allTodos.filter(t => t.project === proj.name)
      .map(t => ({ id: t.id, what: t.what, due: t.due, priority: t.priority, status: t.status }));
    const entry = {
      name: proj.name,
      location: proj.location,
      health: st?.health || 'on-track',
      summary: st?.progress?.slice(0, 2).join('. ') || null,
      blocker: st?.blockers?.[0] || null,
      nextMilestone: st?.next?.[0] || null,
      lastUpdated: st?.lastUpdated || proj.created,
      objective: ov?.objective || null,
      todos: projTodos
    };
    active.push(entry);

    if (entry.health === 'blocked') alerts.blocked.push(entry.name);
    if (entry.health === 'at-risk') alerts.atRisk.push(entry.name);
    if (isStale(entry.lastUpdated)) alerts.stale.push(entry.name);
  }

  alerts.unregistered = scanUnregistered(config.teamRepos, known);

  // Include unregistered team-repo projects as active cards
  for (const unreg of alerts.unregistered) {
    const repoPath = config.teamRepos[unreg.repo];
    if (!repoPath) continue;
    const pPath = path.join(repoPath, 'projects', unreg.name);
    const st = parseStatus(path.join(pPath, 'status.md'));
    const ov = parseOverview(path.join(pPath, 'overview.md'));
    const entry = {
      name: unreg.name,
      location: unreg.repo,
      health: st?.health || 'on-track',
      summary: st?.progress?.slice(0, 2).join('. ') || null,
      blocker: st?.blockers?.[0] || null,
      nextMilestone: st?.next?.[0] || null,
      lastUpdated: st?.lastUpdated || null,
      objective: ov?.objective || null
    };
    active.push(entry);
    if (entry.health === 'blocked') alerts.blocked.push(entry.name);
    if (entry.health === 'at-risk') alerts.atRisk.push(entry.name);
    if (isStale(entry.lastUpdated)) alerts.stale.push(entry.name);
  }

  // Build grouped structure
  const personal = active.filter(p => p.location === 'personal');
  const teamNames = [...new Set(active.filter(p => p.location !== 'personal').map(p => p.location))].sort();
  const teams = teamNames.map(repo => ({
    repo,
    label: 'Team: ' + repo,
    projects: active.filter(p => p.location === repo)
  }));

  const activities = buildActivities(config, registry, alerts.unregistered);

  return {
    generated: new Date().toISOString(),
    owner: config.owner,
    projects: {
      active,
      completed,
      grouped: {
        personal: { label: 'My Projects', projects: personal },
        teams
      }
    },
    alerts,
    activities
  };
}

// ── Build activity feed ──────────────────────────────────────

function buildActivities(config, registry, unregistered) {
  const items = [];
  const allProjects = [];

  for (const proj of registry) {
    if (proj.status === 'archived' || proj.status === 'completed') continue;
    const pPath = projectPath(proj, config.teamRepos);
    if (pPath) allProjects.push({ name: proj.name, pPath, created: proj.created });
  }
  for (const unreg of (unregistered || [])) {
    const repoPath = config.teamRepos[unreg.repo];
    if (!repoPath) continue;
    allProjects.push({ name: unreg.name, pPath: path.join(repoPath, 'projects', unreg.name), created: null });
  }

  for (const { name, pPath, created } of allProjects) {
    const history = parseFullStatus(path.join(pPath, 'status.md'));
    for (const entry of history) {
      if (entry.date) {
        items.push({ date: entry.date, type: 'status', project: name,
          summary: entry.title || (entry.progress.length ? entry.progress[0] : 'Status updated') });
      }
    }
    for (const m of listMeetings(pPath)) {
      if (m.date) {
        items.push({ date: m.date, type: 'meeting', project: name,
          summary: m.topic + (m.purpose ? ' — ' + m.purpose : '') });
      }
    }
    for (const d of listDecisions(pPath)) {
      if (d.date) {
        items.push({ date: d.date, type: 'decision', project: name,
          summary: d.name + (d.status ? ' (' + d.status + ')' : '') });
      }
    }
    if (created && !history.some(e => e.date === created)) {
      items.push({ date: created, type: 'created', project: name, summary: 'Project created' });
    }
  }

  items.sort((a, b) => b.date.localeCompare(a.date));
  return items.slice(0, 20);
}

// ── Build project detail ─────────────────────────────────────

function buildProjectDetail(projectName) {
  const config   = parseConfig();
  const registry = parseRegistry();
  let proj = registry.find(p => p.name === projectName);
  let pPath;

  if (proj) {
    pPath = projectPath(proj, config.teamRepos);
  } else {
    // Check unregistered team projects
    for (const [repo, repoPath] of Object.entries(config.teamRepos)) {
      const candidate = path.join(repoPath, 'projects', projectName);
      try {
        fs.statSync(candidate);
        proj = { name: projectName, location: repo, status: 'active', created: '' };
        pPath = candidate;
        break;
      } catch { /* not here */ }
    }
  }
  if (!proj || !pPath) return null;

  const ov = parseOverview(path.join(pPath, 'overview.md'));
  const allTodos = parseTodos();
  const projTodos = allTodos.filter(t => t.project === proj.name);

  return {
    name: proj.name,
    location: proj.location,
    status: proj.status,
    created: proj.created,
    overview: ov,
    statusHistory: parseFullStatus(path.join(pPath, 'status.md')),
    plan: readPlan(path.join(pPath, 'plan.md')),
    meetings: listMeetings(pPath),
    decisions: listDecisions(pPath),
    todos: projTodos
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

  const projectMatch = req.method === 'GET' && req.url.match(/^\/api\/project\/([a-z0-9_-]+)$/);
  if (projectMatch) {
    const detail = buildProjectDetail(decodeURIComponent(projectMatch[1]));
    if (!detail) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Project not found' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(detail));
    }
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

  const personal = path.join(WORKSPACE, '.ddt', 'personal');
  fs.mkdirSync(personal, { recursive: true });
  fs.writeFileSync(path.join(personal, '.dashboard.pid'), String(process.pid));
  fs.writeFileSync(path.join(personal, '.dashboard.port'), String(port));

  console.log(url);
  resetIdle(server);
});

process.on('SIGTERM', () => { cleanup(); server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { cleanup(); server.close(() => process.exit(0)); });
