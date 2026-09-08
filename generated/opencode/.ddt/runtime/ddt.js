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
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
const text = (v, name, optional = false) => {
  if (typeof v !== 'string' || (!optional && !v.trim()) || v.length > 200000) fail(`Invalid ${name}`);
  return v;
};
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const now = () => new Date().toISOString();

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

function decodeRecord(file) {
  if (!file.endsWith('.md')) return readJSON(file);
  const content = fs.readFileSync(file, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) fail('Note metadata is missing');
  const meta = JSON.parse(match[1]);
  if (!object(meta)) fail('Invalid note metadata');
  return { ...meta, body: match[2] };
}

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

function mutate(file, expected, author, build) {
  if (!Number.isInteger(expected) || expected < 0) fail('expected must be the revision read, or 0 for creation');
  text(author, 'author');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = file + '.ddt-lock';
  let fd;
  try { fd = fs.openSync(lock, 'wx', 0o600); }
  catch (e) { if (e.code === 'EEXIST') fail('Record busy; retry after the other writer finishes. Do not remove its lock.'); throw e; }
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
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

function validateSources(sources, scope) {
  if (!Array.isArray(sources)) fail('sources must be an array');
  return sources.map(source => {
    if (!object(source)) fail('Invalid source');
    text(source.label, 'source label'); text(source.ref, 'source reference');
    if (scope !== 'personal' && (source.scope === 'personal' || source.ref.includes('.ddt/'))) fail('Private source references cannot be written into shared records');
    return { label: source.label, ref: source.ref, ...(source.scope ? { scope: source.scope } : {}) };
  });
}

function createWorkspace(workspace, options = {}) {
  const root = fs.realpathSync(workspace);
  const fetcher = options.fetch || globalThis.fetch;
  function config() {
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
  function scopeRoot(scope = 'personal') {
    if (scope === 'personal') return root;
    if (!slugPattern.test(scope)) fail('Invalid scope');
    const location = config().teams[scope];
    if (!location) fail('Unknown team scope');
    const resolved = fs.realpathSync(location);
    if (resolved === root || resolved.startsWith(root + path.sep) || root.startsWith(resolved + path.sep)) fail('Team storage must be separate from the personal workspace');
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
    const data = decodeRecord(file);
    if (data.schema_version !== VERSION || !Number.isInteger(data.revision)) fail(`Invalid ${kind} record`);
    return { ...data, kind, scope, project: project || null, storage: path.relative(scopeRoot(scope), file), digest: hash(fs.readFileSync(file)) };
  }
  function listRecords(kind, scope, project) {
    const base = project ? projectDir(scope, project) : safePath(root, '.ddt/personal');
    const dir = safePath(scopeRoot(scope), path.relative(scopeRoot(scope), base), kind === 'note' ? 'notes' : 'work');
    if (!fs.existsSync(dir)) return [];
    const suffix = kind === 'note' ? '.md' : '.json';
    return fs.readdirSync(dir).filter(f => f.endsWith(suffix)).sort().map(f => recordView(safePath(scopeRoot(scope), path.relative(scopeRoot(scope), dir), f), kind, scope, project));
  }
  function projects() {
    const result = [], warnings = [];
    for (const scope of ['personal', ...Object.keys(config().teams)]) {
      try {
        const dir = safePath(scopeRoot(scope), scope === 'personal' ? '.ddt/projects' : 'projects');
        if (!fs.existsSync(dir)) continue;
        for (const name of fs.readdirSync(dir)) {
          if (!slugPattern.test(name)) continue;
          const folder = projectDir(scope, name);
          if (!fs.statSync(folder).isDirectory()) continue;
          const file = projectFile(scope, name);
          result.push(fs.existsSync(file) ? recordView(file, 'project', scope, name) : { kind: 'project', id: name, title: name, scope, project: name, legacy: true });
        }
      } catch (e) { warnings.push({ scope, error: e.message }); }
    }
    return { projects: result, warnings };
  }
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
        result.push({ id: 'legacy-' + hash(storage).slice(0,24), kind: 'note', legacy: true, scope, project: project || null, storage, title: body.match(/^#\s+(.+)$/m)?.[1] || path.basename(f), body, revision: hash(body), updated_at: fs.statSync(f).mtime.toISOString() });
      }
    }
    return result;
  }
  function notes(input = {}) {
    const scope = input.scope || 'personal';
    const current = listRecords('note', scope, input.project);
    const adopted = new Map(current.filter(n => n.legacy_source).map(n => [n.legacy_source, n.legacy_revision]));
    return [...current, ...legacyNotes(scope, input.project).filter(n => !adopted.has(n.storage) || adopted.get(n.storage) !== n.revision).map(n => ({...n, adoption_drift: adopted.has(n.storage)}))];
  }
  function jiraCache(work) {
    const filename = hash(work.jira.site + '\n' + work.jira.key) + '.json';
    return safePath(root, '.ddt/personal/cache/jira', filename);
  }
  function workItems(input = {}) {
    return listRecords('work', input.scope || 'personal', input.project).map(w => {
      if (w.provider !== 'jira') return w;
      const cache = jiraCache(w);
      let snapshot = null, snapshot_error = null;
      if (fs.existsSync(cache)) {
        try { snapshot = readJSON(cache); validateSnapshot(snapshot, w); }
        catch { snapshot = null; snapshot_error = 'Invalid Jira snapshot; refresh explicitly'; }
      }
      return { ...w, snapshot, snapshot_error, execution_owner: 'jira' };
    });
  }
  function legacyWork(includeAdopted = false) {
    const current = listRecords('work', 'personal');
    const adopted = new Set(current.map(w => w.legacy_source));
    const result = [];
    for (const rel of ['.ddt/personal/todo.json', '.ddt/personal/todo-complete.json']) {
      const file = safePath(root, rel);
      if (!fs.existsSync(file)) continue;
      const data = readJSON(file);
      if (!Array.isArray(data.items)) fail('Invalid legacy todo file; repair before adopting');
      data.items.forEach((item, index) => {
        const source = `${rel}#${index}:${item.id}`;
        if (includeAdopted || !adopted.has(source)) result.push({ ...item, id: 'legacy-' + hash(source).slice(0,24), title: item.what, scope: 'personal', project: null, kind: 'work', legacy: true, legacy_source: source, revision: hash(JSON.stringify(item)), original: item });
      });
    }
    return result;
  }
  function projectView(input) {
    const scope = input.scope || 'personal';
    const file = projectFile(scope, input.project);
    const project = fs.existsSync(file) ? recordView(file, 'project', scope, input.project) : { id: input.project, title: input.project, legacy: true, scope };
    if (!fs.existsSync(projectDir(scope,input.project))) fail('Project not found');
    const view = overview();
    const linked = r => r.scope === scope && (r.project === input.project || r.links?.some(l => l.scope === scope && l.project === input.project));
    return { project, notes: view.notes.filter(linked), work: view.work.filter(linked), warnings:view.warnings.filter(w=>w.scope===scope), publication: scope === 'personal' ? 'personal' : gitStatus(scope) };
  }
  function overview() {
    const result = projects();
    const allNotes = [], allWork = [];
    for (const [kind, read] of [['notes', () => notes()], ['work', () => workItems()], ['legacy-work', () => legacyWork()]]) {
      try { (kind === 'notes' ? allNotes : allWork).push(...read()); }
      catch (e) { result.warnings.push({scope:'personal', kind, error:e.message}); }
    }
    for (const project of result.projects) {
      try { allNotes.push(...notes(project)); if (!project.legacy) allWork.push(...workItems(project)); }
      catch (e) { result.warnings.push({ scope: project.scope, project: project.project, error: e.message }); }
    }
    return { version: VERSION, ...result, notes: allNotes, work: allWork, generated_at: now() };
  }
  function saveProject(input) {
    const scope = input.scope || 'personal';
    const file = projectFile(scope, input.project);
    if (input.expected === 0 && fs.existsSync(path.dirname(file)) && fs.readdirSync(path.dirname(file)).some(f => f !== '.gitkeep')) fail('Project destination already exists; use project-adopt for legacy content');
    return mutate(file, input.expected, input.author, old => {
      const fields = input.fields;
      if (!object(fields)) fail('fields must be an object');
      const allowed = ['title','purpose','scope_description','context','health','status','sources'];
      for (const key of Object.keys(fields)) if (!allowed.includes(key)) fail(`Unsupported project field: ${key}`);
      const data = { id: old?.id || crypto.randomUUID(), title: input.project, purpose: '', scope_description: '', context: '', health: 'unknown', status: 'active', sources: [], ...old, ...fields };
      for (const key of ['title','purpose','scope_description','context']) text(data[key], key, key !== 'title');
      if (!['unknown','on-track','at-risk','blocked'].includes(data.health)) fail('Invalid health');
      if (!['active','completed','archived'].includes(data.status)) fail('Invalid project status');
      data.sources = validateSources(data.sources, scope);
      return data;
    });
  }
  function saveEntity(kind, input) {
    const scope = input.scope || 'personal';
    const id = input.id || crypto.randomUUID();
    const file = entityFile(kind, input, id);
    return mutate(file, input.expected, input.author, old => {
      const fields = input.fields;
      if (!object(fields)) fail('fields must be an object');
      const allowed = kind === 'note' ? ['title','body','links','sources','state'] : ['title','status','owner','due','sources','jira','provider','links'];
      for (const key of Object.keys(fields)) if (!allowed.includes(key)) fail(`Unsupported ${kind} field: ${key}`);
      const data = kind === 'note'
        ? { id, title: '', body: '', links: [], sources: [], state: 'note', ...old, ...fields }
        : { id, title: '', provider: 'local', status: 'open', owner: '', due: null, sources: [], links: [], ...old, ...fields };
      text(data.title, 'title');
      data.sources = validateSources(data.sources, scope);
      if (!Array.isArray(data.links) || data.links.some(l => !object(l) || !slugPattern.test(l.project || '') || !(l.scope === 'personal' || slugPattern.test(l.scope || '')))) fail('Invalid project links');
      if (scope !== 'personal' && data.links.some(l => l.scope !== scope)) fail('Shared links must stay in their team scope');
      data.links = data.links.map(l => ({scope:l.scope,project:l.project}));
      if (kind === 'note') {
        text(data.body, 'body', true);
        if (!['note','proposal','agreed'].includes(data.state)) fail('Invalid note state');
      } else {
        if (!['local','jira'].includes(data.provider)) fail('Invalid work provider');
        if (old && data.provider !== old.provider) fail('Provider identity cannot change; create a separate reference');
        if (data.provider === 'jira') {
          if (Object.keys(fields).some(k => ['status','owner','due'].includes(k))) fail('Jira owns status, assignee, and due date; change them in Jira');
          if (old && JSON.stringify(data.jira) !== JSON.stringify(old.jira)) fail('Jira reference identity cannot change');
          if (!object(data.jira) || !/^[A-Z][A-Z0-9_]*-\d+$/.test(data.jira.key || '')) fail('Invalid Jira reference');
          const url = new URL(data.jira.site);
          if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) fail('Jira site must be an HTTPS URL without credentials/query');
          data.jira = { site: url.href.replace(/\/$/, ''), key: data.jira.key };
          delete data.status; delete data.owner; delete data.due;
        } else {
          if (data.jira) fail('Local work cannot contain Jira execution data');
          if (!['open','in-progress','done'].includes(data.status)) fail('Invalid work status');
          text(data.owner, 'owner', true);
          if (data.due !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(data.due) || Number.isNaN(Date.parse(data.due)) || new Date(data.due).toISOString().slice(0,10) !== data.due)) fail('Invalid due date');
        }
      }
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
    return mutate(file, 0, input.author, () => ({ id: crypto.randomUUID(), title: input.project, purpose: '', scope_description: '', context: 'Legacy project adopted. Read the source notes and reconcile the current context before relying on a summary.', health: 'unknown', status: 'active', sources: legacy.map(n => ({ label: n.title, ref: n.storage, scope })) }));
  }
  function adoptNote(input) {
    const scope = input.scope || 'personal';
    const legacy = legacyNotes(scope, input.project).find(n => n.id === input.id);
    if (!legacy || legacy.revision !== input.expected_source) fail('Legacy source changed or missing; reread it');
    const id = 'adopted-' + hash(legacy.storage).slice(0,24);
    const file = entityFile('note', input, id);
    if (fs.existsSync(file)) return recordView(file, 'note', scope, input.project);
    return mutate(file, 0, input.author, () => ({ id, title: legacy.title, body: legacy.body, state: 'note', links: [], sources: [], legacy_source: legacy.storage, legacy_revision: legacy.revision }));
  }
  function adoptWork(input) {
    if ((input.scope || 'personal') !== 'personal' || input.project) fail('Legacy todos adopt into personal work only');
    const legacy = legacyWork(true).find(w => w.id === input.id);
    if (!legacy || legacy.revision !== input.expected_source) fail('Legacy source changed, missing, or already adopted; reread work list');
    const id = 'adopted-' + hash(legacy.legacy_source).slice(0,24);
    const file = entityFile('work', input, id);
    if (fs.existsSync(file)) return recordView(file, 'work', 'personal');
    return mutate(file, 0, input.author, () => ({ id, title: legacy.title, provider: 'local', status: legacy.legacy_source.includes('todo-complete.json') || ['done','completed'].includes(legacy.original.status) ? 'done' : 'open', owner: input.author, due: legacy.original.due || null, sources: [], links: [], legacy_source: legacy.legacy_source, legacy_revision: legacy.revision, legacy_original: legacy.original }));
  }
  function validateSnapshot(snapshot, item) {
    if (snapshot.site !== item.jira.site || snapshot.key !== item.jira.key || typeof snapshot.title !== 'string' || typeof snapshot.status !== 'string' || !Number.isFinite(Date.parse(snapshot.fetched_at))) fail('Invalid Jira snapshot provenance');
  }
  async function refreshJira(input) {
    const item = recordView(entityFile('work', input, input.id), 'work', input.scope || 'personal', input.project);
    if (item.provider !== 'jira') fail('Work item is not linked to Jira');
    const connectionFile = safePath(root, '.ddt/personal/jira.json');
    if (!fs.existsSync(connectionFile)) fail('Configure the Jira connection privately in .ddt/personal/jira.json');
    const connections = readJSON(connectionFile);
    const connection = connections.sites?.find(c => c.site?.replace(/\/$/,'') === item.jira.site);
    if (!connection) fail('Jira site is not approved in private connection configuration');
    const base = new URL(connection.api_base || connection.site);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) fail('Invalid private Jira API base');
    const version = connection.api_version || 3;
    if (![2,3].includes(version)) fail('Jira API version must be 2 or 3');
    if (!/^[A-Z][A-Z0-9_]*$/.test(connection.token_env || '')) fail('Connection must name a token environment variable');
    const token = process.env[connection.token_env];
    if (!token) fail('Jira token environment variable is not set');
    const url = base.href.replace(/\/$/,'') + `/rest/api/${version}/issue/${encodeURIComponent(item.jira.key)}?fields=summary,status,assignee,duedate,updated`;
    const file = jiraCache(item);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let fd;
    try { fd = fs.openSync(file + '.ddt-lock', 'wx', 0o600); }
    catch (e) { if (e.code === 'EEXIST') fail('Jira refresh already in progress; retry after it finishes'); throw e; }
    try {
    let response;
    try { response = await fetcher(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(15000) }); }
    catch { fail('Jira refresh failed; previous snapshot retained'); }
    if (!response.ok) fail(`Jira returned HTTP ${response.status}; previous snapshot retained`);
    let data;
    try { data = await response.json(); } catch { fail('Invalid Jira response; previous snapshot retained'); }
    if (data.key !== item.jira.key || !object(data.fields) || typeof data.fields.summary !== 'string' || typeof data.fields.status?.name !== 'string') fail('Unexpected Jira issue; previous snapshot retained');
    const snapshot = { site: item.jira.site, key: data.key, title: data.fields.summary, status: data.fields.status.name, owner: data.fields.assignee?.displayName || null, due: data.fields.duedate || null, jira_updated_at: data.fields.updated || null, fetched_at: now() };
    validateSnapshot(snapshot, item);
    if (fs.existsSync(file)) {
      let previous;
      try { previous = readJSON(file); validateSnapshot(previous,item); } catch {}
      if (previous && Date.parse(previous.jira_updated_at) > Date.parse(snapshot.jira_updated_at)) fail('Jira response is older than the saved snapshot; previous snapshot retained');
    }
    atomicWrite(file, JSON.stringify(snapshot, null, 2) + '\n');
    return snapshot;
    } finally { fs.closeSync(fd); fs.unlinkSync(file + '.ddt-lock'); }
  }
  function git(scope, args, opts = {}) {
    return execFileSync('git', ['-C', scopeRoot(scope), ...args], { encoding: 'utf8', timeout: 30000, stdio: ['pipe','pipe','pipe'], ...opts }).trim();
  }
  function gitStatus(scope) {
    if (scope === 'personal') fail('Select a team scope for synchronization');
    try {
      const head = git(scope, ['rev-parse','HEAD']);
      let upstream = null, ahead = null, behind = null;
      try { upstream = git(scope, ['rev-parse','--abbrev-ref','@{upstream}']); [ahead,behind] = git(scope,['rev-list','--left-right','--count','HEAD...@{upstream}']).split(/\s+/).map(Number); } catch {}
      return { head, destination: destination(scope), branch: git(scope,['branch','--show-current']), changes: git(scope,['status','--porcelain']), upstream, ahead, behind, freshness: 'Local Git view; remote changes are unknown until an explicit pull' };
    } catch { fail('Team location must be an initialized Git repository with a commit'); }
  }
  function pull(input) {
    const state = gitStatus(input.scope);
    if (state.changes) fail('Commit or resolve local team changes before pulling');
    try { git(input.scope,['pull','--ff-only']); } catch { fail('Pull failed; resolve remote access or divergence explicitly'); }
    return gitStatus(input.scope);
  }
  function destination(scope) {
    try {
      const branch = git(scope,['branch','--show-current']);
      const remote = git(scope,['config','--get',`branch.${branch}.remote`]);
      const ref = git(scope,['config','--get',`branch.${branch}.merge`]);
      const urls = git(scope,['remote','get-url','--push','--all',remote]).split('\n');
      if (!branch || remote === '.' || urls.length !== 1 || !ref.startsWith('refs/heads/')) return null;
      return {url:urls[0],ref};
    } catch { return null; }
  }
  const publicationPath = file => typeof file === 'string' && /^projects\/[a-z0-9][a-z0-9-]*\/(project\.json|notes\/[a-z0-9-]+\.md|work\/[a-z0-9-]+\.json)$/.test(file);
  function publicationFiles(input) {
    if (!Array.isArray(input.paths) || !input.paths.length) fail('Exact publication paths are required');
    return [...new Set(input.paths)].map(file => {
      if (!publicationPath(file)) fail('Publication accepts only exact V1 project record paths');
      const target = safePath(scopeRoot(input.scope), file);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) fail('Publication path must be a regular existing record');
      const data = decodeRecord(target);
      if (data.schema_version !== VERSION || !Number.isInteger(data.revision)) fail('Invalid publication record');
      const content = fs.readFileSync(target);
      return {path:file, target, content, digest:hash(content)};
    });
  }
  function previewPublication(input) {
    const state = gitStatus(input.scope);
    return {...state, files:publicationFiles(input).map(f => ({path:f.path,digest:f.digest,content:f.content.toString('utf8')})), diff:git(input.scope,['diff','HEAD','--',...input.paths])};
  }
  function checkDestination(input, state) {
    if (!state.destination || state.destination.url !== input.destination?.url || state.destination.ref !== input.destination?.ref) fail('Publication destination missing or changed; review the preview');
  }
  function pushCommit(input, commit) {
    try { git(input.scope,['push','--no-follow-tags','--porcelain','--',input.destination.url,`${commit}:${input.destination.ref}`]); }
    catch { return {committed:commit,published:false,error:'Push failed; local commit retained. Review it and retry with sync-push; never force push.'}; }
    return {committed:commit,published:true,destination:input.destination};
  }
  function retryPush(input) {
    if (!input.confirm) fail('Push needs explicit confirmation of the commit and destination');
    const state = gitStatus(input.scope);
    checkDestination(input,state);
    if (state.head !== input.expected_commit || ![0,1].includes(state.ahead) || state.behind !== 0) fail('Commit or upstream changed; review and reconcile before retrying');
    if (state.ahead === 1) {
      const files = git(input.scope,['diff-tree','--no-commit-id','--name-only','-r',state.head]).split('\n');
      if (!files.length || files.some(f => !publicationPath(f))) fail('Outgoing commit contains non-project paths');
    }
    return pushCommit(input,state.head);
  }
  function publish(input) {
    if (!input.confirm) fail('Publication needs explicit confirmation of contents, destination, and message');
    const state = gitStatus(input.scope);
    checkDestination(input,state);
    if (state.head !== input.expected_head) fail('Team HEAD changed; review the publication again');
    if (state.ahead !== 0 || state.behind !== 0) fail('Existing outgoing or behind commits must be reconciled before scoped publication');
    text(input.message,'commit message');
    const repo = scopeRoot(input.scope);
    const index = path.resolve(repo,git(input.scope,['rev-parse','--git-path','index']));
    const lock = index + '.lock';
    let fd;
    try { fd = fs.openSync(lock,'wx',0o600); }
    catch (e) { if (e.code === 'EEXIST') fail('Git index busy; retry after its owner finishes'); throw e; }
    const tempIndex = index + '.' + crypto.randomUUID() + '.ddt-tmp';
    const env = {...process.env,GIT_INDEX_FILE:tempIndex};
    let commit;
    try {
      if (git(input.scope,['diff','--cached','--name-only'])) fail('Existing staged work must be resolved before scoped publication');
      const files = publicationFiles(input);
      if (!object(input.expected_files) || Object.keys(input.expected_files).length !== files.length || files.some(f => input.expected_files[f.path] !== f.digest)) fail('Publication contents changed or digests missing; review again');
      git(input.scope,['read-tree',state.head],{env});
      for (const file of files) {
        const blob = git(input.scope,['hash-object','-w','--stdin'],{input:file.content});
        git(input.scope,['update-index','--add','--cacheinfo','100644',blob,file.path],{env});
      }
      const tree = git(input.scope,['write-tree'],{env});
      if (tree === git(input.scope,['rev-parse',state.head + '^{tree}'])) fail('No changes in selected records');
      // Commit the reviewed bytes, even if a direct editor changes working files.
      // Plumbing avoids hooks staging extra files; normal repository CI still applies.
      commit = git(input.scope,['commit-tree',tree,'-p',state.head],{input:input.message + '\n'});
      git(input.scope,['update-ref','HEAD',commit,state.head]);
      fs.closeSync(fd); fd = undefined;
      fs.renameSync(tempIndex,lock);
      fs.renameSync(lock,index);
    } catch (e) {
      if (commit && git(input.scope,['rev-parse','HEAD']) === commit) return {committed:commit,published:false,error:'Local commit created but index finalization failed; inspect Git before retrying'};
      throw e;
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      if (fs.existsSync(tempIndex)) fs.unlinkSync(tempIndex);
      if (fs.existsSync(lock)) fs.unlinkSync(lock);
    }
    return pushCommit(input,commit);
  }
  async function run(command, input = {}) {
    switch (command) {
      case 'overview': return overview();
      case 'projects': return projects();
      case 'project': return projectView(input);
      case 'project-save': return saveProject(input);
      case 'project-adopt': return adoptProject(input);
      case 'notes': return notes(input);
      case 'note-save': return saveEntity('note', input);
      case 'note-adopt': return adoptNote(input);
      case 'work': return input.project ? workItems(input) : [...workItems(input), ...((input.scope || 'personal') === 'personal' ? legacyWork() : [])];
      case 'work-save': return saveEntity('work', input);
      case 'work-adopt': return adoptWork(input);
      case 'jira-refresh': return refreshJira(input);
      case 'sync-status': return gitStatus(input.scope);
      case 'sync-pull': return pull(input);
      case 'publish-preview': return previewPublication(input);
      case 'publish': return publish(input);
      case 'sync-push': return retryPush(input);
      case 'brief': {
        const view = projectView(input);
        return { ...view, audience: input.audience || 'team', instruction: 'Synthesize this current context with linked notes and work. Distinguish proposals from agreements, cite sources and Jira fetch times, and do not persist another maintained status document.' };
      }
      case 'catch-up': {
        if (typeof input.since !== 'string' || Number.isNaN(Date.parse(input.since))) fail('since must be an ISO date or timestamp');
        const view = overview();
        return { since: input.since, warnings: view.warnings, changes: [...view.projects,...view.notes,...view.work].filter(r => r.updated_at && Date.parse(r.updated_at) > Date.parse(input.since)).sort((a,b) => a.updated_at.localeCompare(b.updated_at)) };
      }
      default: fail('Unknown command. Use overview, projects, project, project-save, project-adopt, notes, note-save, note-adopt, work, work-save, work-adopt, jira-refresh, brief, catch-up, sync-status, sync-pull, publish.');
    }
  }
  return { run, overview, projectView, config, scopeRoot };
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const command = args.shift();
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

module.exports = { createWorkspace, safePath, decodeRecord, atomicWrite, VERSION };
