#!/usr/bin/env node
// usage: node _ai/clean.mjs [--days <N>] [--reports] [--apply]
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DAY = 86_400_000;
const MB = 1024 * 1024;

function entries(dir) {
  try { return readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}

// Recursive size and newest mtime; unreadable entries count as zero.
function measure(path) {
  let st;
  try { st = statSync(path); } catch { return { bytes: 0, mtime: 0 }; }
  if (!st.isDirectory()) return { bytes: st.size, mtime: st.mtimeMs };
  let bytes = 0;
  let mtime = st.mtimeMs; // an empty or fresh directory keeps its own mtime; files inside can only raise it
  for (const e of entries(path)) {
    const m = measure(join(path, e.name));
    bytes += m.bytes;
    mtime = Math.max(mtime, m.mtime);
  }
  return { bytes, mtime };
}

function isProtected(path) {
  const parts = path.split(/[\\/]/);
  return parts.includes('personal') || parts.includes('.git') || parts.some((p) => /^\.env/.test(p));
}

export function scanJunk({
  root = ROOT,
  home = homedir(),
  appData = process.env.APPDATA ?? join(home, 'AppData', 'Roaming'),
  days = 7,
  now = Date.now(),
  activeSession = process.env.VSCODE_TARGET_SESSION_LOG ?? '',
  reports = false,
} = {}) {
  const cutoff = now - days * DAY;
  const activeId = activeSession ? basename(activeSession.replace(/[\\/]+$/, '')) : '';
  const items = [];

  const add = (category, path, { stale = true } = {}) => {
    if (isProtected(path) || (activeId && path.includes(activeId))) return;
    const { bytes, mtime } = measure(path);
    if (stale && mtime > cutoff) return;
    items.push({ category, path, bytes });
  };
  // the single newest entry of a session folder is never listed, even when old
  const addAllButNewest = (category, dir, keep = () => true) => {
    const list = entries(dir).filter((e) => keep(e)).map((e) => ({ path: join(dir, e.name), mtime: measure(join(dir, e.name)).mtime }));
    const newest = list.reduce((a, b) => (b.mtime > (a?.mtime ?? -1) ? b : a), null);
    for (const e of list) if (e !== newest) add(category, e.path);
  };

  for (const app of ['Code', 'Kiro']) {
    const dir = join(appData, app, 'CachedExtensionVSIXs');
    for (const e of entries(dir)) add('vsix-cache', join(dir, e.name), { stale: false });
  }

  const wsRoot = join(appData, 'Code', 'User', 'workspaceStorage');
  for (const ws of entries(wsRoot)) {
    if (!ws.isDirectory()) continue;
    for (const sub of [
      ['copilot-debug-logs', join(wsRoot, ws.name, 'GitHub.copilot-chat', 'debug-logs')],
      ['copilot-transcripts', join(wsRoot, ws.name, 'GitHub.copilot-chat', 'transcripts')],
      ['copilot-transcripts', join(wsRoot, ws.name, 'chatSessions')],
    ]) {
      addAllButNewest(sub[0], sub[1]);
    }
  }

  // .kiro/sessions/<workspace hash>/<session>; hidden entries (.index) are Kiro's own state.
  const kiroRoot = join(home, '.kiro', 'sessions');
  for (const ws of entries(kiroRoot)) {
    if (!ws.isDirectory()) continue;
    addAllButNewest('kiro-sessions', join(kiroRoot, ws.name), (e) => !e.name.startsWith('.'));
  }

  for (const app of ['Code', 'Kiro']) {
    const dir = join(appData, app, 'logs');
    const stamps = entries(dir).filter((e) => e.isDirectory() && /^\d{8}T\d{6}/.test(e.name)).map((e) => e.name).sort();
    for (const name of stamps.slice(0, -1)) add('editor-logs', join(dir, name));
  }

  const tmp = join(root, '.tmp');
  for (const e of entries(tmp)) {
    if (e.name !== '.gitkeep') add('workspace-tmp', join(tmp, e.name), { stale: false });
  }

  if (reports) {
    const refs = ['README.md', 'AGENTS.md']
      .map((f) => join(root, f))
      .concat(entries(join(root, 'docs', 'ai', 'plans')).filter((e) => e.name.endsWith('.md')).map((e) => join(root, 'docs', 'ai', 'plans', e.name)))
      .map((f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } })
      .join('\n');
    const dir = join(root, 'docs', 'ai', 'reports');
    for (const e of entries(dir)) {
      if (e.isFile() && e.name.endsWith('.html') && !refs.includes(e.name)) {
        add('old-setup-reports', join(dir, e.name));
      }
    }
  }

  const byCategory = {};
  for (const it of items) {
    byCategory[it.category] ??= { count: 0, bytes: 0 };
    byCategory[it.category].count++;
    byCategory[it.category].bytes += it.bytes;
  }
  return { items, byCategory };
}

const mb = (b) => (b / MB).toFixed(1);

export function clean(args = [], opts = {}) {
  let days = 7;
  const i = args.indexOf('--days');
  if (i >= 0) days = Number(args[i + 1]);
  if (!Number.isFinite(days) || days < 1 || args[i + 1] === undefined || args[i + 1] === '') {
    console.error('--days needs a number >= 1');
    return 1;
  }
  const apply = args.includes('--apply');
  const { items, byCategory } = scanJunk({ days, reports: args.includes('--reports'), ...opts });

  console.log('category'.padEnd(22) + 'count'.padStart(6) + 'MB'.padStart(10));
  for (const [cat, v] of Object.entries(byCategory)) {
    console.log(cat.padEnd(22) + String(v.count).padStart(6) + mb(v.bytes).padStart(10));
  }
  const total = items.reduce((s, it) => s + it.bytes, 0);
  console.log(`total: ${items.length} items, ${mb(total)} MB`);

  if (!apply) {
    console.log('Dry run: pass --apply to delete.');
    return 0;
  }
  let deleted = 0;
  let freed = 0;
  let skipped = 0;
  for (const it of items) {
    try {
      rmSync(it.path, { recursive: true, force: true });
      deleted++;
      freed += it.bytes;
    } catch (err) {
      if (err.code !== 'EBUSY' && err.code !== 'EPERM') throw err;
      skipped++;
    }
  }
  console.log(`Deleted ${deleted} items (${mb(freed)} MB)${skipped ? `, skipped ${skipped} locked` : ''}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = clean(process.argv.slice(2));
}
