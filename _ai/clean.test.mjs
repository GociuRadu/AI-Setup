import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clean, scanJunk } from './clean.mjs';

const DAY = 86_400_000;

function put(path, ageDays, now) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, 'x'.repeat(100));
  const t = new Date(now - ageDays * DAY);
  utimesSync(path, t, t);
  utimesSync(join(path, '..'), t, t); // the parent folder's own mtime counts too
}

function build() {
  const base = mkdtempSync(join(tmpdir(), 'clean-'));
  const now = Date.now();
  const root = join(base, 'root');
  const home = join(base, 'home');
  const appData = join(base, 'appData');
  const ws = join(appData, 'Code', 'User', 'workspaceStorage', 'abc');
  const dbg = join(ws, 'GitHub.copilot-chat', 'debug-logs');
  const active = '11111111-aaaa-bbbb-cccc-000000000000';
  put(join(dbg, 'old-1', 'a.log'), 20, now);
  put(join(dbg, active, 'a.log'), 20, now);
  put(join(dbg, 'recent-1', 'a.log'), 0, now);
  mkdirSync(join(dbg, 'empty-fresh'), { recursive: true });
  // folder created long ago but with a recent write inside
  put(join(dbg, 'busy', 'a.log'), 20, now);
  put(join(dbg, 'busy', 'b.log'), 0, now);
  put(join(ws, 'GitHub.copilot-chat', 'transcripts', 'old.jsonl'), 20, now);
  put(join(ws, 'GitHub.copilot-chat', 'transcripts', 'new.jsonl'), 0, now);
  put(join(ws, 'chatSessions', 'old.json'), 20, now);
  put(join(ws, 'chatSessions', 'new.json'), 0, now);
  put(join(home, '.kiro', 'sessions', 'w1', 'old.json'), 20, now);
  put(join(home, '.kiro', 'sessions', 'w1', 'recent.json'), 0, now);
  put(join(home, '.kiro', 'sessions', 'w1', '.index'), 20, now);
  for (const [n, age] of [['20260101T000000', 30], ['20260102T000000', 29], ['20260103T000000', 28]]) {
    put(join(appData, 'Code', 'logs', n, 'main.log'), age, now);
  }
  put(join(appData, 'Code', 'CachedExtensionVSIXs', 'x.vsix'), 0, now);
  put(join(root, '.tmp', 'scratch.py'), 0, now);
  put(join(root, 'personal', 'secret.txt'), 90, now);
  put(join(root, 'docs', 'ai', 'reports', 'linked.html'), 90, now);
  put(join(root, 'docs', 'ai', 'reports', 'stale.html'), 90, now);
  put(join(root, 'docs', 'ai', 'reports', 'fresh.html'), 0, now);
  put(join(root, 'MCDT', 'docs', 'ai', 'reports', 'project.html'), 90, now);
  writeFileSync(join(root, 'README.md'), 'see docs/ai/reports/linked.html');
  return { base, now, root, home, appData, active, dbg, ws, opts: { root, home, appData, now, activeSession: join(dbg, active) } };
}

const names = (items) => items.map((i) => i.path.slice(i.path.lastIndexOf('clean-') + 6)).sort();

test('scanJunk lists only stale, unprotected items', () => {
  const t = build();
  try {
    const { items, byCategory } = scanJunk({ ...t.opts, reports: true });
    const paths = items.map((i) => i.path);
    const has = (p) => paths.includes(p);
    assert.ok(has(join(t.dbg, 'old-1')));
    assert.ok(!has(join(t.dbg, t.active)), 'active session');
    assert.ok(!has(join(t.dbg, 'recent-1')));
    assert.ok(!has(join(t.dbg, 'busy')), 'recent write inside folder');
    assert.ok(!has(join(t.dbg, 'empty-fresh')), 'empty fresh folder');
    assert.ok(!has(join(t.root, 'docs', 'ai', 'reports', 'fresh.html')), 'fresh report');
    assert.ok(has(join(t.ws, 'GitHub.copilot-chat', 'transcripts', 'old.jsonl')));
    assert.ok(has(join(t.ws, 'chatSessions', 'old.json')));
    assert.ok(!has(join(t.ws, 'chatSessions', 'new.json')));
    assert.ok(has(join(t.home, '.kiro', 'sessions', 'w1', 'old.json')));
    assert.ok(!has(join(t.home, '.kiro', 'sessions', 'w1', 'recent.json')));
    assert.ok(!has(join(t.home, '.kiro', 'sessions', 'w1', '.index')));
    assert.ok(has(join(t.appData, 'Code', 'logs', '20260101T000000')));
    assert.ok(has(join(t.appData, 'Code', 'logs', '20260102T000000')));
    assert.ok(!has(join(t.appData, 'Code', 'logs', '20260103T000000')), 'newest log');
    assert.ok(has(join(t.appData, 'Code', 'CachedExtensionVSIXs', 'x.vsix')));
    assert.ok(has(join(t.root, '.tmp', 'scratch.py')));
    assert.ok(has(join(t.root, 'docs', 'ai', 'reports', 'stale.html')));
    assert.ok(!has(join(t.root, 'docs', 'ai', 'reports', 'linked.html')));
    assert.ok(!paths.some((p) => p.includes('personal') || p.includes('project.html')));
    assert.equal(byCategory['editor-logs'].count, 2);
    assert.equal(byCategory['vsix-cache'].bytes, 100);
  } finally {
    rmSync(t.base, { recursive: true, force: true });
  }
});

test('reports are skipped unless requested', () => {
  const t = build();
  try {
    assert.ok(!scanJunk(t.opts).items.some((i) => i.category === 'old-setup-reports'));
  } finally {
    rmSync(t.base, { recursive: true, force: true });
  }
});

test('clean dry run deletes nothing, --apply deletes only junk', () => {
  const t = build();
  const log = console.log;
  console.log = () => {};
  try {
    const stale = join(t.dbg, 'old-1');
    assert.equal(clean(['--reports'], t.opts), 0);
    assert.ok(existsSync(stale));
    assert.equal(clean(['--reports', '--apply'], t.opts), 0);
    assert.ok(!existsSync(stale));
    assert.ok(!existsSync(join(t.root, 'docs', 'ai', 'reports', 'stale.html')));
    for (const keep of [
      join(t.dbg, t.active), join(t.dbg, 'recent-1'), join(t.dbg, 'busy'), join(t.dbg, 'empty-fresh'),
      join(t.root, 'docs', 'ai', 'reports', 'fresh.html'),
      join(t.home, '.kiro', 'sessions', 'w1', 'recent.json'),
      join(t.appData, 'Code', 'logs', '20260103T000000'),
      join(t.root, 'docs', 'ai', 'reports', 'linked.html'),
      join(t.root, 'personal', 'secret.txt'),
      join(t.root, 'MCDT', 'docs', 'ai', 'reports', 'project.html'),
    ]) assert.ok(existsSync(keep), keep);
  } finally {
    console.log = log;
    rmSync(t.base, { recursive: true, force: true });
  }
});

test('clean rejects a bad --days', () => {
  const err = console.error;
  console.error = () => {};
  try {
    assert.equal(clean(['--days', '-1']), 1);
    assert.equal(clean(['--days', 'abc']), 1);
    assert.equal(clean(['--days', '0']), 1);
  } finally {
    console.error = err;
  }
});
