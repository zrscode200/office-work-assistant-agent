#!/usr/bin/env node
'use strict';

// One storage contract for assistants and dashboard. No dependencies or background sync.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const VERSION = 2;
const slugPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;
const idPattern = /^[a-z0-9][a-z0-9-]{0,99}$/;
const placeholderPattern = /^\[.*\]$/;
const META_FIELDS = new Set(['schema_version', 'revision', 'created_at', 'created_by', 'updated_at', 'updated_by', 'history']);
// Fields that name what a record is; a merge never lets a choice change them.
const IDENTITY_FIELDS = { note: ['id', 'legacy_source'], work: ['id', 'provider', 'jira', 'legacy_source'], project: [] };
const HEALTH = ['unknown', 'on-track', 'at-risk', 'blocked'];
const PROJECT_STATUS = ['active', 'completed', 'archived'];
const NOTE_STATES = ['note', 'proposal', 'agreed'];
const WORK_STATUS = ['open', 'in-progress', 'done'];
const STALE_LOCK_MS = 10 * 60 * 1000;
const COMMANDS = ['overview', 'projects', 'project', 'project-save', 'project-adopt', 'notes', 'note', 'note-save', 'note-adopt', 'work', 'work-item', 'work-save', 'work-adopt', 'jira-refresh', 'search', 'brief', 'catch-up', 'sync-status', 'sync-fetch', 'sync-pull', 'sync-rebase', 'publish-preview', 'publish', 'sync-push'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
const text = (v, name, optional = false) => {
  if (typeof v !== 'string' || (!optional && !v.trim()) || v.length > 200000) fail(`Invalid ${name}`);
  return v;
};
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const now = () => new Date().toISOString();
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const validDue = due => typeof due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(due) && !Number.isNaN(Date.parse(due)) && new Date(due).toISOString().slice(0, 10) === due;
const fileId = file => path.basename(file).replace(/\.(md|json)$/, '');
// Git messages can carry remote URLs; never echo embedded credentials.
const redact = value => String(value || '').replace(/:\/\/[^/@\s]+@/g, '://***@').replace(/([?&](?:access_token|token|password|private_token)=)[^&\s]+/gi, '$1***').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 2).join(' ').slice(0, 300);

function safePath(root, ...parts) {
  const base = fs.realpathSync(root);
  const target = path.resolve(base, ...parts);
  if (target !== base && !target.startsWith(base + path.sep)) fail('Path leaves its storage scope');
  let current = base;
  for (const part of path.relative(base, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.existsSync(current) || (() => { try { fs.lstatSync(current); return true; } catch { return false; } })()) {
      if (fs.lstatSync(current).isSymbolicLink()) fail('Symlinks are not allowed in managed data paths');
    }
  }
  return target;
}

function readJSON(file) {
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!object(result)) fail(`Expected an object in ${path.basename(file)}`);
  return result;
}

function decodeText(file, content) {
  if (!file.endsWith('.md')) {
    const result = JSON.parse(content);
    if (!object(result)) fail(`Expected an object in ${path.basename(file)}`);
    return result;
  }
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) fail('Note metadata is missing');
  const meta = JSON.parse(match[1]);
  if (!object(meta)) fail('Invalid note metadata');
  return { ...meta, body: match[2] };
}

function decodeRecord(file) { return decodeText(file, fs.readFileSync(file, 'utf8')); }

function encodeRecord(file, data) {
  if (!file.endsWith('.md')) return JSON.stringify(data, null, 2) + '\n';
  const { body, ...meta } = data;
  return `---\n${JSON.stringify(meta, null, 2)}\n---\n${body}`;
}

function atomicWrite(file, content) {
  const tmp = file + '.' + crypto.randomUUID() + '.ddt-tmp';
  let fd;
  try {
    fd = fs.openSync(tmp, 'wx', 0o600);
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    fs.renameSync(tmp, file);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}

// Lock files record their owner so a crashed writer can be recognized; a live
// writer's lock is never removed.
function acquireLock(lock, busyMessage) {
  const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(lock, 'wx', 0o600);
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, at: now() }));
      return fd;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let owner = null, stale = false;
      try { owner = JSON.parse(fs.readFileSync(lock, 'utf8')); } catch { owner = null; }
      if (owner && Number.isInteger(owner.pid)) stale = owner.pid !== process.pid && !alive(owner.pid);
      else { try { stale = Date.now() - fs.statSync(lock).mtimeMs > STALE_LOCK_MS; } catch { stale = false; } } // Older versions wrote empty locks.
      if (attempt === 0 && stale) {
        // Move the inspected lock aside and unlink only that inode; a live lock
        // recreated by another writer in the meantime is put back untouched.
        const moved = lock + '.stale.' + crypto.randomUUID();
        try {
          const inspected = fs.statSync(lock).ino;
          fs.renameSync(lock, moved);
          if (fs.statSync(moved).ino === inspected) fs.unlinkSync(moved);
          else fs.renameSync(moved, lock);
        } catch {}
        continue;
      }
      const age = owner?.at && Number.isFinite(Date.parse(owner.at)) ? `${Math.max(0, Math.round((Date.now() - Date.parse(owner.at)) / 1000))}s old` : 'unknown age';
      fail(`${busyMessage} (lock ${lock} held by pid ${owner?.pid ?? 'unknown'}, ${age}). Do not remove a live writer's lock.`);
    }
  }
}

function releaseLock(fd, lock) {
  fs.closeSync(fd);
  try { fs.unlinkSync(lock); } catch {}
}

function mutate(file, expected, author, build) {
  if (!Number.isInteger(expected) || expected < 0) fail('expected must be the revision read, or 0 for creation');
  text(author, 'author');
  if (placeholderPattern.test(author.trim())) fail('Replace the placeholder author with a real name (owner in .ddt/config.md)');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = file + '.ddt-lock';
  const fd = acquireLock(lock, 'Record busy; retry after the other writer finishes');
  try {
    const old = fs.existsSync(file) ? decodeRecord(file) : null;
    if (old && (old.schema_version !== VERSION || !Number.isInteger(old.revision))) fail('Unsupported or invalid record; original retained');
    if ((old?.revision || 0) !== expected) fail('Stale revision; reread and reconcile before saving');
    const data = build(old);
    const at = now();
    data.schema_version = VERSION;
    data.revision = expected + 1;
    data.created_at = old?.created_at || at;
    data.created_by = old?.created_by || author;
    data.updated_at = at;
    data.updated_by = author;
    data.history = [...(old?.history || []), { revision: data.revision, at, author }];
    atomicWrite(file, encodeRecord(file, data));
    return data;
  } finally { releaseLock(fd, lock); }
}

function validateSources(sources, scope) {
  if (!Array.isArray(sources)) fail('sources must be an array');
  return sources.map(source => {
    if (!object(source)) fail('Invalid source');
    text(source.label, 'source label'); text(source.ref, 'source reference');
    if (scope !== 'personal' && (source.scope === 'personal' || /\.ddt[\\/]/.test(source.ref))) fail('Private source references cannot be written into shared records');
    return { label: source.label, ref: source.ref, ...(source.scope ? { scope: source.scope } : {}) };
  });
}

// Three-way merge of one record: fields changed only locally win, fields changed
// only upstream win, fields changed on both sides need an explicit choice.
function mergeRecords(base, upstream, local, choices = {}, identity = []) {
  if (!upstream || !local) return { ok: false, conflicts: ['record exists on only one side'] };
  const common = base || {}; // Both sides created the record: every differing field needs a choice.
  const keys = new Set([...Object.keys(common), ...Object.keys(upstream), ...Object.keys(local)].filter(k => !META_FIELDS.has(k)));
  const merged = { ...upstream }, conflicts = [];
  for (const key of keys) {
    if (identity.includes(key)) {
      if (!same(local[key], upstream[key])) conflicts.push(`${key} (identity; cannot be chosen)`);
      continue;
    }
    const localChanged = !same(local[key], common[key]), upstreamChanged = !same(upstream[key], common[key]);
    if (localChanged && upstreamChanged && !same(local[key], upstream[key])) {
      const choice = choices[key];
      if (choice === 'local') merged[key] = local[key];
      else if (choice === 'upstream') merged[key] = upstream[key];
      else if (object(choice) && 'value' in choice) merged[key] = choice.value;
      else conflicts.push(key);
    } else if (localChanged) merged[key] = local[key];
  }
  if (conflicts.length) return { ok: false, conflicts };
  const added = (local.history || []).slice((common.history || []).length);
  const entries = added.length ? added : [{ revision: 0, at: local.updated_at || now(), author: local.updated_by || 'unknown' }];
  merged.history = [...(upstream.history || []), ...entries.map((h, i) => ({ ...h, revision: upstream.revision + i + 1 }))];
  merged.revision = upstream.revision + entries.length;
  const later = (local.updated_at || '') >= (upstream.updated_at || '') ? local : upstream;
  merged.updated_at = later.updated_at || now();
  merged.updated_by = later.updated_by || upstream.updated_by || local.updated_by;
  return { ok: true, record: merged };
}

function createWorkspace(workspace, options = {}) {
  const root = fs.realpathSync(workspace);
  const fetcher = options.fetch || globalThis.fetch;
  const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0', ...(options.env || {}) };
  let cache = null; // Per-run memo for configuration and scope roots.
  function readConfig() {
    const file = safePath(root, '.ddt/config.md');
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const teamSection = content.split(/^## Team Repos\s*$/m)[1]?.split(/^## /m)[0] || '';
    const teams = {};
    for (const line of teamSection.split('\n')) {
      const m = line.match(/^([a-z0-9][a-z0-9-]*):\s*(\/[^\r\n]+)$/);
      if (m) teams[m[1]] = m[2].trim();
    }
    return { owner: content.match(/^owner:\s*(.*)$/m)?.[1]?.trim() || '', teams };
  }
  function config() {
    if (cache?.config) return cache.config;
    const value = readConfig();
    if (cache) cache.config = value;
    return value;
  }
  function author(input) {
    if (input.author !== undefined) return input.author;
    const owner = config().owner;
    if (!owner || placeholderPattern.test(owner)) fail('author is required: set owner in .ddt/config.md or pass author');
    return owner;
  }
  function scopeRoot(scope = 'personal') {
    if (scope === 'personal') return root;
    if (cache?.roots.has(scope)) return cache.roots.get(scope);
    if (!slugPattern.test(scope)) fail('Invalid scope');
    const location = config().teams[scope];
    if (!location) fail('Unknown team scope');
    const resolved = fs.realpathSync(location);
    if (resolved === root || resolved.startsWith(root + path.sep) || root.startsWith(resolved + path.sep)) fail('Team storage must be separate from the personal workspace');
    if (cache) cache.roots.set(scope, resolved);
    return resolved;
  }
  function projectDir(scope, project) {
    if (!slugPattern.test(project || '')) fail('A lowercase project slug is required');
    return safePath(scopeRoot(scope), scope === 'personal' ? '.ddt/projects' : 'projects', project);
  }
  function projectFile(scope, project) { return safePath(scopeRoot(scope), path.relative(scopeRoot(scope), projectDir(scope, project)), 'project.json'); }
  function entityFile(kind, input, id) {
    if (!idPattern.test(id || '')) fail('Invalid record ID');
    const scope = input.scope || 'personal';
    if (scope !== 'personal' && !input.project) fail('Shared records require a project');
    const folder = input.project ? projectDir(scope, input.project) : safePath(root, '.ddt/personal');
    if (input.project && !fs.existsSync(projectFile(scope, input.project))) fail('Create or adopt the project first');
    return safePath(scopeRoot(scope), path.relative(scopeRoot(scope), folder), kind === 'note' ? 'notes' : 'work', id + (kind === 'note' ? '.md' : '.json'));
  }
  function recordView(file, kind, scope, project) {
    const raw = fs.readFileSync(file);
    const data = decodeText(file, raw.toString('utf8'));
    if (data.schema_version !== VERSION || !Number.isInteger(data.revision)) fail(`Invalid ${kind} record`);
    const view = { ...data, kind, scope, project: project || null, storage: path.relative(scopeRoot(scope), file), digest: hash(raw) };
    if (kind !== 'project') {
      // The file name is the identity; a copied file must not alias its source.
      if (data.id !== fileId(file)) view.id_mismatch = data.id ?? null;
      view.id = fileId(file);
    }
    return view;
  }
  function tolerantView(file, kind, scope, project) {
    try { return recordView(file, kind, scope, project); }
    catch (e) { return { kind, scope, project: project || null, id: fileId(file), title: path.basename(file), storage: path.relative(scopeRoot(scope), file), malformed: true, error: e.message }; }
  }
  function listRecords(kind, scope, project) {
    const base = project ? projectDir(scope, project) : safePath(root, '.ddt/personal');
    const dir = safePath(scopeRoot(scope), path.relative(scopeRoot(scope), base), kind === 'note' ? 'notes' : 'work');
    if (!fs.existsSync(dir)) return [];
    const suffix = kind === 'note' ? '.md' : '.json';
    return fs.readdirSync(dir).filter(f => f.endsWith(suffix)).sort().map(f => tolerantView(safePath(scopeRoot(scope), path.relative(scopeRoot(scope), dir), f), kind, scope, project));
  }
  function projects() {
    const result = [], warnings = [];
    for (const scope of ['personal', ...Object.keys(config().teams)]) {
      let dir;
      try { dir = safePath(scopeRoot(scope), scope === 'personal' ? '.ddt/projects' : 'projects'); }
      catch (e) { warnings.push({ scope, error: e.message }); continue; }
      if (!fs.existsSync(dir)) continue;
      for (const name of fs.readdirSync(dir).sort()) {
        if (!slugPattern.test(name)) continue;
        try {
          const folder = projectDir(scope, name);
          if (!fs.statSync(folder).isDirectory()) continue;
          const file = projectFile(scope, name);
          result.push(fs.existsSync(file) ? projectRecord(file, scope, name, warnings) : { kind: 'project', id: name, title: name, scope, project: name, legacy: true });
        } catch (e) { warnings.push({ scope, project: name, error: e.message }); }
      }
    }
    return { projects: result, warnings };
  }
  function projectRecord(file, scope, name, warnings) {
    try { return recordView(file, 'project', scope, name); }
    catch (e) {
      const storage = path.relative(scopeRoot(scope), file);
      if (warnings) warnings.push({ scope, project: name, kind: 'project', storage, error: e.message });
      return { kind: 'project', id: name, title: name, scope, project: name, storage, malformed: true, error: e.message };
    }
  }
  function teamProjects(scope) { scopeRoot(scope); return projects().projects.filter(p => p.scope === scope); }
  function legacyNotes(scope, project) {
    const sources = project ? ['overview.md', 'status.md', 'plan.md', 'comments.md', 'meetings', 'decisions', 'updates'] : ['.ddt/personal/scratch', '.ddt/personal/notebook'];
    const base = project ? projectDir(scope, project) : root;
    const result = [];
    for (const rel of sources) {
      const file = safePath(scopeRoot(scope), path.relative(scopeRoot(scope), base), rel);
      if (!fs.existsSync(file)) continue;
      const files = fs.statSync(file).isDirectory() ? fs.readdirSync(file).filter(f => f.endsWith('.md') && !f.startsWith('.')).map(f => safePath(scopeRoot(scope), path.relative(scopeRoot(scope), file), f)) : [file];
      for (const f of files) {
        const storage = path.relative(scopeRoot(scope), f);
        const body = fs.readFileSync(f, 'utf8');
        result.push({ id: 'legacy-' + hash(storage).slice(0, 24), kind: 'note', legacy: true, scope, project: project || null, storage, title: body.match(/^#\s+(.+)$/m)?.[1] || path.basename(f), body, revision: hash(body), updated_at: fs.statSync(f).mtime.toISOString() });
      }
    }
    return result;
  }
  function notes(input = {}) {
    const scope = input.scope || 'personal';
    if (scope !== 'personal' && !input.project) return teamProjects(scope).flatMap(p => notes({ scope, project: p.project }));
    const current = listRecords('note', scope, input.project);
    const adopted = new Map(current.filter(n => n.legacy_source).map(n => [n.legacy_source, n.legacy_revision]));
    return [...current, ...legacyNotes(scope, input.project).filter(n => !adopted.has(n.storage) || adopted.get(n.storage) !== n.revision).map(n => ({ ...n, adoption_drift: adopted.has(n.storage) }))];
  }
  function jiraCache(work) {
    const filename = hash(work.jira.site + '\n' + work.jira.key) + '.json';
    return safePath(root, '.ddt/personal/cache/jira', filename);
  }
  function jiraConnections() {
    const file = safePath(root, '.ddt/personal/jira.json');
    return fs.existsSync(file) ? readJSON(file) : null;
  }
  function workItems(input = {}) {
    const scope = input.scope || 'personal';
    if (scope !== 'personal' && !input.project) return teamProjects(scope).filter(p => !p.legacy).flatMap(p => workItems({ scope, project: p.project }));
    return listRecords('work', scope, input.project).map(w => {
      if (w.malformed || w.provider !== 'jira' || !object(w.jira)) return w;
      const cache = jiraCache(w);
      let snapshot = null, snapshot_error = null;
      if (fs.existsSync(cache)) {
        try { snapshot = readJSON(cache); validateSnapshot(snapshot, w); }
        catch { snapshot = null; snapshot_error = 'Invalid Jira snapshot; refresh explicitly'; }
      }
      return { ...w, snapshot, snapshot_error, execution_owner: 'jira' };
    });
  }
  function legacyWork(includeAdopted = false, current = listRecords('work', 'personal')) {
    const adopted = new Set(), adoptedIds = new Set();
    for (const w of current) {
      if (!w.legacy_source) continue;
      adopted.add(w.legacy_source);
      // Records adopted by an older version carry index keys; the id still identifies the todo.
      const m = String(w.legacy_source).match(/^(.*)#(?:\d+|id):(.+)$/);
      if (m && m[2] !== 'undefined' && m[2] !== 'null') adoptedIds.add(`${m[1]}|${m[2]}`);
    }
    const result = [];
    for (const rel of ['.ddt/personal/todo.json', '.ddt/personal/todo-complete.json']) {
      const file = safePath(root, rel);
      if (!fs.existsSync(file)) continue;
      const data = readJSON(file);
      if (!Array.isArray(data.items)) fail('Invalid legacy todo file; repair before adopting');
      const counts = new Map();
      for (const item of data.items) if (object(item) && item.id !== undefined && item.id !== null) counts.set(String(item.id), (counts.get(String(item.id)) || 0) + 1);
      data.items.forEach((item, index) => {
        if (!object(item)) return;
        // Key by the item's own id when it is unique so reordering the old file
        // does not re-key adopted items; older index keys still count as adopted.
        const indexed = `${rel}#${index}:${item.id}`;
        const source = item.id !== undefined && item.id !== null && counts.get(String(item.id)) === 1 ? `${rel}#id:${item.id}` : indexed;
        const byId = item.id !== undefined && item.id !== null && counts.get(String(item.id)) === 1 && adoptedIds.has(`${rel}|${item.id}`);
        if (includeAdopted || !(adopted.has(source) || adopted.has(indexed) || byId)) result.push({ ...item, id: 'legacy-' + hash(source).slice(0, 24), title: item.what, scope: 'personal', project: null, kind: 'work', legacy: true, legacy_source: source, revision: hash(JSON.stringify(item)), original: item });
      });
    }
    return result;
  }
  function overview(options = {}) {
    const result = projects();
    const include = scope => !options.scopes || options.scopes.includes(scope);
    const allNotes = [], allWork = [];
    if (include('personal')) {
      let personalWork = [];
      for (const [kind, read] of [['notes', () => notes()], ['work', () => (personalWork = workItems())], ['legacy-work', () => legacyWork(false, personalWork)]]) {
        try { (kind === 'notes' ? allNotes : allWork).push(...read()); }
        catch (e) { result.warnings.push({ scope: 'personal', kind, error: e.message }); }
      }
    }
    for (const project of result.projects) {
      if (!include(project.scope)) continue;
      try { allNotes.push(...notes(project)); if (!project.legacy) allWork.push(...workItems(project)); }
      catch (e) { result.warnings.push({ scope: project.scope, project: project.project, error: e.message }); }
    }
    for (const r of [...allNotes, ...allWork]) if (r.malformed) result.warnings.push({ scope: r.scope, project: r.project, kind: r.kind, storage: r.storage, error: r.error });
    if (options.scopes) result.projects = result.projects.filter(p => include(p.scope));
    return { version: VERSION, ...result, notes: allNotes, work: allWork, generated_at: now() };
  }
  const summarize = r => {
    const { body, history, ...rest } = r;
    return { ...rest, ...(typeof body === 'string' ? { body_preview: body.slice(0, 160) } : {}) };
  };
  const maybeSummary = (input, records) => input.summary ? records.map(summarize) : records;
  // Invariants every stored record must satisfy, whether it comes from a save or a merge.
  function checkProject(scope, data) {
    for (const key of ['title', 'purpose', 'scope_description', 'context']) text(data[key], key, key !== 'title');
    if (!HEALTH.includes(data.health)) fail('Invalid health');
    if (!PROJECT_STATUS.includes(data.status)) fail('Invalid project status');
    data.sources = validateSources(data.sources, scope);
    return data;
  }
  function checkEntity(kind, scope, data) {
    text(data.title, 'title');
    data.sources = validateSources(data.sources, scope);
    if (!Array.isArray(data.links) || data.links.some(l => !object(l) || !slugPattern.test(l.project || '') || !(l.scope === 'personal' || slugPattern.test(l.scope || '')))) fail('Invalid project links');
    if (scope !== 'personal' && data.links.some(l => l.scope !== scope)) fail('Shared links must stay in their team scope');
    data.links = data.links.map(l => ({ scope: l.scope, project: l.project }));
    if (kind === 'note') {
      text(data.body, 'body', true);
      if (!NOTE_STATES.includes(data.state)) fail('Invalid note state');
      return data;
    }
    if (!['local', 'jira'].includes(data.provider)) fail('Invalid work provider');
    if (data.provider === 'jira') {
      if (!object(data.jira)) fail('Invalid Jira reference');
      const site = data.jira.site || jiraConnections()?.default_site;
      if (!site) fail('Jira site required: pass jira.site or set default_site in .ddt/personal/jira.json');
      if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(data.jira.key || '')) fail('Invalid Jira reference');
      let url;
      try { url = new URL(site); } catch { fail('Jira site must be an HTTPS URL without credentials/query'); }
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) fail('Jira site must be an HTTPS URL without credentials/query');
      data.jira = { site: url.href.replace(/\/$/, ''), key: data.jira.key };
      delete data.status; delete data.owner; delete data.due;
    } else {
      if (data.jira) fail('Local work cannot contain Jira execution data');
      if (!WORK_STATUS.includes(data.status)) fail('Invalid work status');
      text(data.owner, 'owner', true);
      if (data.due !== null && !validDue(data.due)) fail('Invalid due date');
    }
    return data;
  }
  function checkRecord(kind, scope, data) { return kind === 'project' ? checkProject(scope, data) : checkEntity(kind, scope, data); }
  function saveProject(input) {
    const scope = input.scope || 'personal';
    const file = projectFile(scope, input.project);
    if (input.expected === 0 && fs.existsSync(path.dirname(file)) && fs.readdirSync(path.dirname(file)).some(f => !['.gitkeep', 'notes', 'work'].includes(f))) fail('Project destination already exists; use project-adopt for legacy content');
    return mutate(file, input.expected, author(input), old => {
      const fields = input.fields;
      if (!object(fields)) fail('fields must be an object');
      const allowed = ['title', 'purpose', 'scope_description', 'context', 'health', 'status', 'sources'];
      for (const key of Object.keys(fields)) if (!allowed.includes(key)) fail(`Unsupported project field: ${key}`);
      return checkProject(scope, { id: old?.id || crypto.randomUUID(), title: input.project, purpose: '', scope_description: '', context: '', health: 'unknown', status: 'active', sources: [], ...old, ...fields });
    });
  }
  function saveEntity(kind, input) {
    const scope = input.scope || 'personal';
    const id = input.id || crypto.randomUUID();
    const file = entityFile(kind, input, id);
    return mutate(file, input.expected, author(input), old => {
      const fields = input.fields;
      if (!object(fields)) fail('fields must be an object');
      const allowed = kind === 'note' ? ['title', 'body', 'links', 'sources', 'state'] : ['title', 'status', 'owner', 'due', 'sources', 'jira', 'provider', 'links'];
      for (const key of Object.keys(fields)) if (!allowed.includes(key)) fail(`Unsupported ${kind} field: ${key}`);
      const data = kind === 'note'
        ? { title: '', body: '', links: [], sources: [], state: 'note', ...old, ...fields, id }
        : { title: '', provider: 'local', status: 'open', owner: '', due: null, sources: [], links: [], ...old, ...fields, id };
      if (kind === 'work') {
        if (old && data.provider !== old.provider) fail('Provider identity cannot change; create a separate reference');
        if (data.provider === 'jira' && Object.keys(fields).some(k => ['status', 'owner', 'due'].includes(k))) fail('Jira owns status, assignee, and due date; change them in Jira');
      }
      checkEntity(kind, scope, data);
      if (kind === 'work' && data.provider === 'jira' && old && !same(data.jira, old.jira)) fail('Jira reference identity cannot change');
      return data;
    });
  }
  function adoptProject(input) {
    const scope = input.scope || 'personal';
    const file = projectFile(scope, input.project);
    if (fs.existsSync(file)) return recordView(file, 'project', scope, input.project);
    const legacy = legacyNotes(scope, input.project);
    if (!legacy.length) fail('No legacy project documents found');
    if (!input.confirm) return { preview: legacy.map(n => ({ storage: n.storage, revision: n.revision })), action: 'Creates project.json; legacy documents are retained and readable as notes' };
    return mutate(file, 0, author(input), () => ({ id: crypto.randomUUID(), title: input.project, purpose: '', scope_description: '', context: 'Legacy project adopted. Read the source notes and reconcile the current context before relying on a summary.', health: 'unknown', status: 'active', sources: legacy.map(n => ({ label: n.title, ref: n.storage, scope })) }));
  }
  function adoptNote(input) {
    const scope = input.scope || 'personal';
    const legacy = legacyNotes(scope, input.project).find(n => n.id === input.id);
    if (!legacy || legacy.revision !== input.expected_source) fail('Legacy source changed or missing; reread it');
    const id = 'adopted-' + hash(legacy.storage).slice(0, 24);
    const file = entityFile('note', input, id);
    if (fs.existsSync(file)) {
      const current = recordView(file, 'note', scope, input.project);
      if (!input.acknowledge_drift || current.legacy_revision === legacy.revision) return current;
      // Acknowledge a changed original after reconciling it by hand.
      return mutate(file, input.expected ?? -1, author(input), old => ({ ...old, legacy_revision: legacy.revision }));
    }
    return mutate(file, 0, author(input), () => ({ id, title: legacy.title, body: legacy.body, state: 'note', links: [], sources: [], legacy_source: legacy.storage, legacy_revision: legacy.revision }));
  }
  function adoptWork(input) {
    if ((input.scope || 'personal') !== 'personal' || input.project) fail('Legacy todos adopt into personal work only');
    const legacy = legacyWork(true).find(w => w.id === input.id);
    if (!legacy || legacy.revision !== input.expected_source) fail('Legacy source changed, missing, or already adopted; reread work list');
    const id = 'adopted-' + hash(legacy.legacy_source).slice(0, 24);
    const file = entityFile('work', input, id);
    if (fs.existsSync(file)) return recordView(file, 'work', 'personal');
    const who = author(input);
    const original = legacy.original;
    // Adopted records must satisfy V1 validation or they can never be completed;
    // unparseable original values stay in legacy_original.
    const title = typeof legacy.title === 'string' && legacy.title.trim() ? legacy.title : `Legacy follow-up ${original.id ?? ''}`.trim();
    const status = legacy.legacy_source.includes('todo-complete.json') || ['done', 'completed'].includes(original.status) ? 'done' : original.status === 'in-progress' ? 'in-progress' : 'open';
    return mutate(file, 0, who, () => ({ id, title, provider: 'local', status, owner: who, due: validDue(original.due) ? original.due : null, sources: [], links: [], legacy_source: legacy.legacy_source, legacy_revision: legacy.revision, legacy_original: original }));
  }
  function validateSnapshot(snapshot, item) {
    if (snapshot.site !== item.jira.site || snapshot.key !== item.jira.key || typeof snapshot.title !== 'string' || typeof snapshot.status !== 'string' || !Number.isFinite(Date.parse(snapshot.fetched_at))) fail('Invalid Jira snapshot provenance');
  }
  async function refreshJira(input) {
    const item = recordView(entityFile('work', input, input.id), 'work', input.scope || 'personal', input.project);
    if (item.provider !== 'jira') fail('Work item is not linked to Jira');
    const connections = jiraConnections();
    if (!connections) fail('Configure the Jira connection privately in .ddt/personal/jira.json');
    const normalizedSite = value => { try { return new URL(value).href.replace(/\/$/, ''); } catch { return null; } };
    const connection = connections.sites?.find(c => normalizedSite(c.site) === item.jira.site);
    if (!connection) fail('Jira site is not approved in private connection configuration');
    const base = new URL(connection.api_base || connection.site);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) fail('Invalid private Jira API base');
    const version = connection.api_version || 3;
    if (![2, 3].includes(version)) fail('Jira API version must be 2 or 3');
    const auth = connection.auth || 'bearer';
    if (!['bearer', 'basic'].includes(auth)) fail('Jira auth must be bearer or basic');
    if (!/^[A-Z][A-Z0-9_]*$/.test(connection.token_env || '')) fail('Connection must name a token environment variable');
    const token = process.env[connection.token_env];
    if (!token) fail('Jira token environment variable is not set');
    let authorization = `Bearer ${token}`;
    if (auth === 'basic') {
      // Jira Cloud API tokens use HTTP basic auth with the account email.
      const user = connection.user_env ? process.env[connection.user_env] : connection.email;
      if (!user) fail('Basic Jira auth needs email (or user_env) in the private connection');
      authorization = 'Basic ' + Buffer.from(`${user}:${token}`).toString('base64');
    }
    const url = base.href.replace(/\/$/, '') + `/rest/api/${version}/issue/${encodeURIComponent(item.jira.key)}?fields=summary,status,assignee,duedate,updated`;
    const file = jiraCache(item);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const lock = file + '.ddt-lock';
    const fd = acquireLock(lock, 'Jira refresh already in progress; retry after it finishes');
    try {
      let response;
      try { response = await fetcher(url, { headers: { Accept: 'application/json', Authorization: authorization }, redirect: 'error', signal: AbortSignal.timeout(15000) }); }
      catch { fail('Jira refresh failed; previous snapshot retained'); }
      if (!response.ok) fail(`Jira returned HTTP ${response.status}; previous snapshot retained`);
      let data;
      try { data = await response.json(); } catch { fail('Invalid Jira response; previous snapshot retained'); }
      if (!object(data) || !object(data.fields) || typeof data.fields.summary !== 'string' || typeof data.fields.status?.name !== 'string') fail('Unexpected Jira issue; previous snapshot retained');
      if (data.key !== item.jira.key) fail(`Jira returned key ${data.key} for ${item.jira.key}; the issue may have moved. Create a new reference; previous snapshot retained`);
      const snapshot = { site: item.jira.site, key: data.key, title: data.fields.summary, status: data.fields.status.name, owner: data.fields.assignee?.displayName || null, due: data.fields.duedate || null, jira_updated_at: data.fields.updated || null, fetched_at: now() };
      validateSnapshot(snapshot, item);
      if (fs.existsSync(file)) {
        let previous;
        try { previous = readJSON(file); validateSnapshot(previous, item); } catch { previous = null; }
        if (previous && Date.parse(previous.jira_updated_at) > Date.parse(snapshot.jira_updated_at)) fail('Jira response is older than the saved snapshot; previous snapshot retained');
      }
      atomicWrite(file, JSON.stringify(snapshot, null, 2) + '\n');
      return snapshot;
    } finally { releaseLock(fd, lock); }
  }
  function requireTeamScope(scope) {
    if (typeof scope !== 'string' || scope === 'personal' || !Object.hasOwn(config().teams, scope)) fail('Select a configured team scope for synchronization');
  }
  function git(scope, args, opts = {}) {
    requireTeamScope(scope);
    try {
      return execFileSync('git', ['-C', scopeRoot(scope), ...args], { encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'], ...opts, env: { ...gitEnv, ...(opts.env || {}) } }).trim();
    } catch (e) {
      const error = new Error(`git ${args[0]} failed: ${redact(e.stderr) || redact(e.message)}`);
      error.stderr = e.stderr;
      throw error;
    }
  }
  function remoteName(scope, branch) {
    try { return git(scope, ['config', '--get', `branch.${branch}.remote`]); } catch { return null; }
  }
  function gitStatus(scope) {
    requireTeamScope(scope);
    try {
      const head = git(scope, ['rev-parse', 'HEAD']);
      let upstream = null, ahead = null, behind = null;
      try { upstream = git(scope, ['rev-parse', '--abbrev-ref', '@{upstream}']); [ahead, behind] = git(scope, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']).split(/\s+/).map(Number); } catch {}
      return { head, destination: destination(scope), branch: git(scope, ['branch', '--show-current']), changes: git(scope, ['status', '--porcelain']), upstream, ahead, behind, freshness: 'Local Git view; remote changes are unknown until an explicit fetch or pull' };
    } catch (e) { fail(`Team location must be an initialized Git repository with a commit (${redact(e.message)})`); }
  }
  function trackedChanges(scope) { return git(scope, ['status', '--porcelain', '--untracked-files=no']); }
  function fetch(input) {
    const state = gitStatus(input.scope);
    const remote = remoteName(input.scope, state.branch);
    if (!remote || remote === '.') fail('Configure an upstream branch with a remote before fetching');
    try { git(input.scope, ['fetch', '--prune', '--', remote]); } catch (e) { fail(`Fetch failed; check remote access (${redact(e.message)})`); }
    return { ...gitStatus(input.scope), fetched_at: now(), freshness: 'Fetched now; ahead/behind reflect the remote at fetch time' };
  }
  function pull(input) {
    gitStatus(input.scope);
    if (trackedChanges(input.scope)) fail('Commit or resolve local team changes before pulling');
    try { git(input.scope, ['pull', '--ff-only']); } catch (e) { fail(`Pull failed; resolve remote access or divergence explicitly (${redact(e.message)}). If one local publication is outgoing, use sync-fetch then sync-rebase`); }
    return gitStatus(input.scope);
  }
  function destination(scope) {
    try {
      const branch = git(scope, ['branch', '--show-current']);
      const remote = git(scope, ['config', '--get', `branch.${branch}.remote`]);
      const ref = git(scope, ['config', '--get', `branch.${branch}.merge`]);
      const urls = git(scope, ['remote', 'get-url', '--push', '--all', remote]).split('\n');
      if (!branch || remote === '.' || urls.length !== 1 || !ref.startsWith('refs/heads/')) return null;
      // The outgoing range must describe the same repository being published to.
      if (git(scope, ['remote', 'get-url', remote]) !== urls[0]) return null;
      return { url: urls[0], ref };
    } catch { return null; }
  }
  const publicationPath = file => typeof file === 'string' && /^projects\/[a-z0-9][a-z0-9-]*\/(project\.json|notes\/[a-z0-9-]+\.md|work\/[a-z0-9-]+\.json)$/.test(file);
  const recordIdentity = file => {
    const m = file.match(/^projects\/([^/]+)\/(?:(notes|work)\/([^/]+)\.(?:md|json)|project\.json)$/);
    return { project: m?.[1] || null, kind: m ? (m[2] === 'notes' ? 'note' : m[2] === 'work' ? 'work' : 'project') : null, id: m?.[3] || null };
  };
  function publicationFiles(input) {
    if (!Array.isArray(input.paths) || !input.paths.length) fail('Exact publication paths are required');
    return [...new Set(input.paths)].map(file => {
      if (!publicationPath(file)) fail('Publication accepts only exact V1 project record paths');
      const target = safePath(scopeRoot(input.scope), file);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) fail('Publication path must be a regular existing record');
      const data = decodeRecord(target);
      if (data.schema_version !== VERSION || !Number.isInteger(data.revision)) fail('Invalid publication record');
      const content = fs.readFileSync(target);
      return { path: file, target, content, digest: hash(content) };
    });
  }
  function previewPublication(input) {
    const state = gitStatus(input.scope);
    const status = file => git(input.scope, ['ls-files', '--', file]) ? (git(input.scope, ['diff', '--name-only', 'HEAD', '--', file]) ? 'modified' : 'unchanged') : 'new';
    return { ...state, files: publicationFiles(input).map(f => ({ path: f.path, digest: f.digest, status: status(f.path), content: f.content.toString('utf8') })), diff: git(input.scope, ['diff', 'HEAD', '--', ...input.paths]) };
  }
  function checkDestination(input, state) {
    if (!state.destination || state.destination.url !== input.destination?.url || state.destination.ref !== input.destination?.ref) fail('Publication destination missing or changed; review the preview');
  }
  function pushCommit(input, commit) {
    // Revalidate the configured endpoint, then use the named remote so Git also
    // updates its tracking ref. The explicit refspec overrides default push sets.
    const state = gitStatus(input.scope);
    checkDestination(input, state);
    const remote = git(input.scope, ['config', '--get', `branch.${state.branch}.remote`]);
    try { git(input.scope, ['push', '--no-follow-tags', '--porcelain', '--', remote, `${commit}:${input.destination.ref}`]); }
    catch (e) {
      const rejected = /rejected|non-fast-forward|fetch first/i.test(e.stderr || '');
      return { committed: commit, published: false, cause: redact(e.stderr), error: rejected ? 'Push rejected because the remote moved; local commit retained. Run sync-fetch, then sync-rebase, then sync-push; never force push.' : `Push failed; local commit retained. Review the cause and retry with sync-push; never force push.` };
    }
    return { committed: commit, published: true, destination: input.destination };
  }
  function outgoingFiles(scope, head) {
    const files = git(scope, ['diff-tree', '--no-commit-id', '--name-only', '-r', head]).split('\n').filter(Boolean);
    if (!files.length || files.some(f => !publicationPath(f))) fail('Outgoing commit contains non-project paths');
    return files;
  }
  function retryPush(input) {
    if (!input.confirm) fail('Push needs explicit confirmation of the commit and destination');
    const state = gitStatus(input.scope);
    checkDestination(input, state);
    if (state.head !== input.expected_commit || ![0, 1].includes(state.ahead) || state.behind !== 0) fail('Commit or upstream changed; review and reconcile before retrying (sync-fetch, then sync-rebase if behind)');
    if (state.ahead === 1) outgoingFiles(input.scope, state.head);
    return pushCommit(input, state.head);
  }
  function readRecordAt(scope, ref, file) {
    let content;
    try { content = git(scope, ['show', `${ref}:${file}`]); } catch { return null; }
    try { return decodeText(file, content); } catch (e) { return { malformed: e.message }; }
  }
  function rebase(input) {
    if (!input.confirm) fail('Rebase needs explicit confirmation of the commit and destination');
    const scope = input.scope;
    const state = gitStatus(scope);
    checkDestination(input, state);
    if (state.head !== input.expected_commit) fail('Commit changed; review sync-status again');
    if (state.ahead !== 1 || !(state.behind >= 1)) fail('Rebase applies to exactly one outgoing commit behind a fetched upstream; run sync-fetch first');
    if (trackedChanges(scope)) fail('Commit or resolve local team changes before rebasing');
    const files = outgoingFiles(scope, state.head);
    const upstream = git(scope, ['rev-parse', '@{upstream}']);
    const base = git(scope, ['merge-base', state.head, upstream]);
    const choices = object(input.resolution) ? input.resolution : {};
    const unresolved = [], entries = [];
    for (const file of files) {
      const identity = { path: file, ...recordIdentity(file) };
      let local = readRecordAt(scope, state.head, file);
      const theirs = readRecordAt(scope, upstream, file), common = readRecordAt(scope, base, file);
      const broken = [local, theirs, common].find(r => r?.malformed);
      if (broken) { unresolved.push({ ...identity, conflicts: [`a version of this record cannot be parsed; repair it first (${broken.malformed})`] }); continue; }
      if (local && theirs && identity.kind === 'project') local = { ...local, id: theirs.id }; // Project ids are informational.
      if (!local) { unresolved.push({ ...identity, conflicts: ['the outgoing commit removed this record; removals cannot be replayed'] }); continue; }
      if (common && !theirs) { unresolved.push({ ...identity, conflicts: ['upstream removed or moved this record'], local, upstream: null }); continue; }
      if (!theirs || same(theirs, common)) { entries.push({ file, blob: git(scope, ['rev-parse', `${state.head}:${file}`]) }); continue; } // Upstream did not touch it: replay the reviewed bytes.
      const result = mergeRecords(common, theirs, local, object(choices[file]) ? choices[file] : {}, IDENTITY_FIELDS[identity.kind] || []);
      if (!result.ok) { unresolved.push({ ...identity, conflicts: result.conflicts, local, upstream: theirs }); continue; }
      try { checkRecord(identity.kind, scope, result.record); }
      catch (e) { unresolved.push({ ...identity, conflicts: [`invalid resolution: ${e.message}`], local, upstream: theirs }); continue; }
      entries.push({ file, content: encodeRecord(file, result.record) });
    }
    if (unresolved.length) return { rebased: false, head: state.head, unresolved, guidance: 'Compare local and upstream, agree the merged meaning with the user, then rerun sync-rebase with resolution: { "<path>": { "<field>": "local" | "upstream" | { "value": ... } } } for the listed fields. Identity fields and removed records cannot be chosen; re-save on top of upstream instead. No history was rewritten.' };
    // Replay with plumbing on the upstream tree, like publish: no hooks, editors or
    // half-finished rebase state. Plumbing commits are not GPG-signed.
    const repo = scopeRoot(scope);
    const index = path.resolve(repo, git(scope, ['rev-parse', '--git-path', 'index']));
    const tempIndex = index + '.' + crypto.randomUUID() + '.ddt-tmp';
    const env = { GIT_INDEX_FILE: tempIndex };
    let commit;
    try {
      git(scope, ['read-tree', upstream], { env });
      for (const entry of entries) {
        const blob = entry.blob || git(scope, ['hash-object', '-w', '--stdin'], { input: entry.content });
        git(scope, ['update-index', '--add', '--cacheinfo', '100644', blob, entry.file], { env });
      }
      const tree = git(scope, ['write-tree'], { env });
      if (tree === git(scope, ['rev-parse', upstream + '^{tree}'])) commit = upstream; // Upstream already holds these changes.
      else {
        const [name, email, date] = git(scope, ['log', '-1', '--format=%an%x00%ae%x00%aI', state.head]).split('\0');
        const message = git(scope, ['log', '-1', '--format=%B', state.head]);
        commit = git(scope, ['commit-tree', tree, '-p', upstream], { input: message + '\n', env: { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_AUTHOR_DATE: date } });
      }
    } finally { if (fs.existsSync(tempIndex)) fs.unlinkSync(tempIndex); }
    // Move index and working tree first; Git refuses to overwrite untracked files, and nothing has changed if it does.
    try { git(scope, ['read-tree', '-m', '-u', state.head, commit]); }
    catch (e) { fail(`Rebase computed but the working tree could not be updated; nothing changed (${redact(e.message)})`); }
    try { git(scope, ['update-ref', 'HEAD', commit, state.head]); }
    catch (e) {
      // HEAD did not move: put index and working tree back so nothing is left half done.
      try { git(scope, ['read-tree', '-m', '-u', commit, state.head]); } catch {}
      fail(`Rebase computed but HEAD could not be updated; working tree restored (${redact(e.message)})`);
    }
    const after = gitStatus(scope);
    return { rebased: true, previous_commit: state.head, head: after.head, ahead: after.ahead, behind: after.behind, records: files, next: after.ahead ? 'Review the replayed records, then sync-push with expected_commit set to head' : 'Upstream already contained these changes; nothing to push' };
  }
  function publish(input) {
    if (!input.confirm) fail('Publication needs explicit confirmation of contents, destination, and message');
    const state = gitStatus(input.scope);
    checkDestination(input, state);
    if (state.head !== input.expected_head) fail('Team HEAD changed; review the publication again');
    if (state.ahead !== 0 || state.behind !== 0) fail('Existing outgoing or behind commits must be reconciled before scoped publication (sync-fetch, sync-rebase, sync-push)');
    text(input.message, 'commit message');
    const repo = scopeRoot(input.scope);
    const index = path.resolve(repo, git(input.scope, ['rev-parse', '--git-path', 'index']));
    const lock = index + '.lock';
    let fd;
    try { fd = fs.openSync(lock, 'wx', 0o600); }
    catch (e) { if (e.code === 'EEXIST') fail('Git index busy; retry after its owner finishes'); throw e; }
    const tempIndex = index + '.' + crypto.randomUUID() + '.ddt-tmp';
    const env = { GIT_INDEX_FILE: tempIndex };
    let commit;
    try {
      if (git(input.scope, ['diff', '--cached', '--name-only'])) fail('Existing staged work must be resolved before scoped publication');
      const files = publicationFiles(input);
      if (!object(input.expected_files) || Object.keys(input.expected_files).length !== files.length || files.some(f => input.expected_files[f.path] !== f.digest)) fail('Publication contents changed or digests missing; review again');
      git(input.scope, ['read-tree', state.head], { env });
      for (const file of files) {
        const blob = git(input.scope, ['hash-object', '-w', '--stdin'], { input: file.content });
        git(input.scope, ['update-index', '--add', '--cacheinfo', '100644', blob, file.path], { env });
      }
      const tree = git(input.scope, ['write-tree'], { env });
      if (tree === git(input.scope, ['rev-parse', state.head + '^{tree}'])) fail('No changes in selected records');
      // Commit the reviewed bytes, even if a direct editor changes working files.
      // Plumbing avoids hooks staging extra files; normal repository CI still applies.
      commit = git(input.scope, ['commit-tree', tree, '-p', state.head], { input: input.message + '\n' });
      git(input.scope, ['update-ref', 'HEAD', commit, state.head]);
      fs.closeSync(fd); fd = undefined;
      fs.renameSync(tempIndex, lock);
      fs.renameSync(lock, index);
    } catch (e) {
      if (commit && git(input.scope, ['rev-parse', 'HEAD']) === commit) return { committed: commit, published: false, error: 'Local commit created but index finalization failed; inspect Git before retrying' };
      throw e;
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      if (fs.existsSync(tempIndex)) fs.unlinkSync(tempIndex);
      if (fs.existsSync(lock)) fs.unlinkSync(lock);
    }
    return pushCommit(input, commit);
  }
  function arrivals(since, warnings) {
    // The local reflog records when content reached this clone; commits made under
    // this clone's own Git identity are the user's publications, reported as authored.
    const arrived = new Set();
    for (const scope of Object.keys(config().teams)) {
      try {
        let me = '';
        try { me = git(scope, ['config', '--get', 'user.email']); } catch {}
        for (const line of git(scope, ['log', '--format=%H %ce', `HEAD@{${since}}..HEAD`, '--', 'projects/']).split('\n').filter(Boolean)) {
          const [sha, email = ''] = line.split(' ');
          if (me && email === me) continue;
          for (const file of git(scope, ['diff-tree', '--no-commit-id', '--name-only', '-r', sha, '--', 'projects/']).split('\n').filter(Boolean)) arrived.add(`${scope}:${file}`);
        }
      } catch (e) { warnings.push({ scope, error: `Arrival history unavailable; showing author times only (${redact(e.message)})` }); }
    }
    return arrived;
  }
  async function dispatch(command, input) {
    switch (command) {
      case 'overview': { const view = overview(); return input.summary ? { ...view, notes: view.notes.map(summarize), work: view.work.map(summarize) } : view; }
      case 'projects': return projects();
      case 'project': { const view = projectView(input); return input.summary ? { ...view, notes: view.notes.map(summarize), work: view.work.map(summarize), linked_private: { notes: view.linked_private.notes.map(summarize), work: view.linked_private.work.map(summarize) } } : view; }
      case 'project-save': return saveProject(input);
      case 'project-adopt': return adoptProject(input);
      case 'notes': return maybeSummary(input, notes(input));
      case 'note': {
        if (!input.id) fail('note requires id');
        const found = notes(input).find(n => n.id === input.id);
        return found || fail('Note not found');
      }
      case 'note-save': return saveEntity('note', input);
      case 'note-adopt': return adoptNote(input);
      case 'work': {
        const items = workItems(input);
        return maybeSummary(input, input.project || (input.scope || 'personal') !== 'personal' ? items : [...items, ...legacyWork(false, items)]);
      }
      case 'work-item': {
        if (!input.id) fail('work-item requires id');
        const items = workItems(input);
        const found = [...items, ...(!input.project && (input.scope || 'personal') === 'personal' ? legacyWork(false, items) : [])].find(w => w.id === input.id);
        return found || fail('Work item not found');
      }
      case 'work-save': return saveEntity('work', input);
      case 'work-adopt': return adoptWork(input);
      case 'jira-refresh': return refreshJira(input);
      case 'search': {
        const query = text(input.query, 'query').toLowerCase();
        if (input.scope) scopeRoot(input.scope);
        const view = overview(input.scope ? { scopes: [input.scope] } : {});
        const fieldsOf = r => [r.title, r.body, r.context, r.purpose, r.scope_description, r.id].filter(v => typeof v === 'string');
        const snippet = r => {
          const field = [r.body, r.context, r.purpose].find(v => typeof v === 'string' && v.toLowerCase().includes(query)) || '';
          const at = Math.max(0, field.toLowerCase().indexOf(query) - 60);
          return field.slice(at, at + 160);
        };
        const results = [...view.projects, ...view.notes, ...view.work].filter(r => (!input.project || r.project === input.project) && fieldsOf(r).some(v => v.toLowerCase().includes(query))).map(r => ({ ...summarize(r), snippet: snippet(r) }));
        return { query: input.query, results, warnings: view.warnings };
      }
      case 'sync-status': return gitStatus(input.scope);
      case 'sync-fetch': return fetch(input);
      case 'sync-pull': return pull(input);
      case 'sync-rebase': return rebase(input);
      case 'publish-preview': return previewPublication(input);
      case 'publish': return publish(input);
      case 'sync-push': return retryPush(input);
      case 'brief': {
        const audience = input.audience || 'team';
        if (!['team', 'personal'].includes(audience)) fail('audience must be team or personal');
        const view = projectView(input);
        if (audience === 'team') {
          delete view.linked_private;
          view.linked_private_excluded = 'Private records linked to this project are omitted for a team audience; use audience personal to include them.';
        }
        return { ...view, audience, instruction: `Synthesize this current context with linked notes and work for a ${audience} audience. Distinguish proposals from agreements, cite sources and Jira fetch times, ${audience === 'personal' ? 'keep linked private material out of anything shared with the team, ' : ''}and do not persist another maintained status document.` };
      }
      case 'catch-up': {
        if (typeof input.since !== 'string' || !/^\d{4}-\d{2}-\d{2}(T|$)/.test(input.since) || Number.isNaN(Date.parse(input.since))) fail('since must be an ISO date (YYYY-MM-DD) or timestamp');
        const sinceMs = Date.parse(input.since);
        const view = overview();
        const arrived = arrivals(new Date(sinceMs).toISOString(), view.warnings);
        const change = r => {
          const authored = Boolean(r.updated_at && Date.parse(r.updated_at) > sinceMs);
          const pulled = r.scope !== 'personal' && arrived.has(`${r.scope}:${r.storage}`);
          const refreshed = Boolean(r.snapshot?.fetched_at && Date.parse(r.snapshot.fetched_at) > sinceMs);
          return authored || pulled || refreshed ? { authored, arrived: pulled, jira_refreshed: refreshed } : null;
        };
        const changes = [];
        for (const r of [...view.projects, ...view.notes, ...view.work]) { const c = change(r); if (c) changes.push({ ...r, change: c }); }
        changes.sort((a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''));
        return { since: input.since, warnings: view.warnings, changes: input.summary ? changes.map(summarize) : changes };
      }
      default: fail(`Unknown command. Use one of: ${COMMANDS.join(', ')}.`);
    }
  }
  async function run(command, input = {}) {
    cache = { config: null, roots: new Map() };
    try { return await dispatch(command, object(input) ? input : {}); }
    finally { cache = null; }
  }
  function projectView(input) {
    const scope = input.scope || 'personal';
    const file = projectFile(scope, input.project);
    if (!fs.existsSync(projectDir(scope, input.project))) fail('Project not found');
    const project = fs.existsSync(file) ? projectRecord(file, scope, input.project) : { id: input.project, title: input.project, legacy: true, scope };
    const view = overview({ scopes: scope === 'personal' ? ['personal'] : [scope, 'personal'] });
    const linksHere = r => r.links?.some(l => l.scope === scope && l.project === input.project);
    const own = r => r.scope === scope && (r.project === input.project || linksHere(r));
    // The user's private records linked here are theirs to see; briefs decide
    // whether an audience may.
    const linkedPrivate = r => scope !== 'personal' && r.scope === 'personal' && linksHere(r);
    return { project, notes: view.notes.filter(own), work: view.work.filter(own), linked_private: { notes: view.notes.filter(linkedPrivate), work: view.work.filter(linkedPrivate) }, warnings: view.warnings.filter(w => w.scope === scope), publication: scope === 'personal' ? 'personal' : gitStatus(scope) };
  }
  return { run, overview, projectView, config, scopeRoot };
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const command = args.shift();
    if (!command || command === '--help' || command === '-h') {
      console.log(`Usage: node ddt.js <command> [--workspace /absolute/path] [--input /private/path/request.json]\nCommands: ${COMMANDS.join(', ')}\nSee .ddt/runtime/WORKFLOWS.md for request shapes.`);
      return;
    }
    let workspace = process.cwd(), input = {};
    while (args.length) {
      const key = args.shift(), value = args.shift();
      if (!value) fail(`Missing value for ${key}`);
      if (key === '--workspace') workspace = value;
      else if (key === '--input') input = readJSON(value);
      else fail(`Unknown option ${key}`);
    }
    console.log(JSON.stringify({ ok: true, result: await createWorkspace(workspace).run(command, input) }, null, 2));
  })().catch(e => { console.error(JSON.stringify({ ok: false, error: e.message })); process.exitCode = 1; });
}

module.exports = { createWorkspace, safePath, decodeRecord, atomicWrite, mergeRecords, redact, VERSION, COMMANDS };
