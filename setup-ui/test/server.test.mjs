import { test, expect, beforeAll, afterAll } from 'vitest';
import { request } from 'node:http';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer, staticPath, readSetup } from '../server.mjs';

const UI = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(UI, '..');

function start(opts) {
  const server = createServer(opts);
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port })));
}

// node:http, so the test can send any Host header (fetch cannot)
function call(port, { method = 'GET', path, headers = {}, body }) {
  return new Promise((ok, fail) => {
    const req = request({ host: '127.0.0.1', port, method, path, headers: { host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => ok({ status: res.statusCode, headers: res.headers, body: data, json: () => JSON.parse(data) }));
    });
    req.on('error', fail);
    req.end(body);
  });
}
const json = (token, body) => ({ headers: { 'x-setup-token': token, 'content-type': 'application/json' }, body: JSON.stringify(body) });

let s, token, dist;
beforeAll(async () => {
  dist = mkdtempSync(join(tmpdir(), 'dist-'));
  writeFileSync(join(dist, 'index.html'), '<p>page</p>');
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'assets/app.js'), 'x');
  const slow = join(dist, '..', `slow-${process.pid}.mjs`);
  writeFileSync(slow, 'setTimeout(() => console.log("done"), 400);');
  s = await start({ dist, syncScript: slow });
  token = (await call(s.port, { path: '/api/session' })).json().token;
});
afterAll(() => s.server.close());

test('a Host other than 127.0.0.1 or localhost on this port is refused', async () => {
  expect((await call(s.port, { path: '/api/session', headers: { host: 'evil.example:80' } })).status).toBe(403);
  expect((await call(s.port, { path: '/', headers: { host: `attacker.test:${s.port}` } })).status).toBe(403);
  expect((await call(s.port, { path: '/api/session', headers: { host: `localhost:${s.port}` } })).status).toBe(200);
});

test('the API needs the token and JSON bodies', async () => {
  expect((await call(s.port, { path: '/api/setup' })).status).toBe(401);
  expect((await call(s.port, { path: '/api/setup', headers: { 'x-setup-token': 'nope' } })).status).toBe(401);
  const form = await call(s.port, { method: 'POST', path: '/api/apply', headers: { 'x-setup-token': token, 'content-type': 'application/x-www-form-urlencoded' }, body: 'a=1' });
  expect(form.status).toBe(415);
  const bad = await call(s.port, { method: 'PUT', path: '/api/device', headers: { 'x-setup-token': token, 'content-type': 'application/json' }, body: '{' });
  expect(bad.status).toBe(400);
  const big = await call(s.port, { method: 'PUT', path: '/api/device', headers: { 'x-setup-token': token, 'content-type': 'application/json' }, body: 'x'.repeat(1024 * 1024 + 1) });
  expect(big.status).toBe(413);
});

test('GET /api/setup counts helpers, skills, rules and hooks from the source folders', async () => {
  const setup = (await call(s.port, { path: '/api/setup', headers: { 'x-setup-token': token } })).json();
  const dirs = readdirSync(join(ROOT, '_ai/skills'), { withFileTypes: true }).filter((e) => e.isDirectory());
  expect(setup.agents.length).toBe(readdirSync(join(ROOT, '_ai/agents')).filter((f) => f.endsWith('.md') && f !== '_core.md').length);
  expect(setup.skills.length).toBe(dirs.length);
  expect(setup.rules.length).toBe(readdirSync(join(ROOT, '_ai/rules')).filter((f) => f.endsWith('.md')).length);
  expect(setup.hooks).toEqual(['guard']);
  expect(setup.skills.find((k) => k.name === 'review').link).toBe(`vscode://file/${join(ROOT, '_ai/skills/review/SKILL.md').replace(/\\/g, '/')}`);
});

test('bad models or device values are rejected and not written', async () => {
  const before = readFileSync(join(ROOT, '_ai/models.json'), 'utf8');
  const r = await call(s.port, { method: 'PUT', path: '/api/models', ...json(token, { claude: { tiers: { fast: '' } } }) });
  expect(r.status).toBe(400);
  expect(r.json().error).toMatch(/must be a non-empty string/);
  const d = await call(s.port, { method: 'PUT', path: '/api/device', ...json(token, { profile: 'home', tools: ['kiro'], perTool: { kiro: { skillsOff: ['nope'] } } }) });
  expect(d.status).toBe(400);
  expect(d.json().error).toMatch(/unknown skill nope/);
  expect(readFileSync(join(ROOT, '_ai/models.json'), 'utf8')).toBe(before);
});

test('the Obsidian vault is checked before it is saved, and its state is sent to the page', async () => {
  // a copy of the sources, so this device's own file is never written
  const tmp = mkdtempSync(join(tmpdir(), 'setup-vault-'));
  cpSync(join(ROOT, '_ai'), join(tmp, '_ai'), { recursive: true, filter: (f) => !/[\/](node_modules|__pycache__)$/.test(f) });
  for (const f of ['AGENTS.md', 'README.md']) cpSync(join(ROOT, f), join(tmp, f));
  const file = join(tmp, '.ai-device.json');
  const vault = mkdtempSync(join(tmpdir(), 'vault-'));
  mkdirSync(join(vault, '.obsidian'));
  const plain = mkdtempSync(join(tmpdir(), 'plain-'));
  const { server, port } = await start({ root: tmp, dist });
  try {
    const t = (await call(port, { path: '/api/session' })).json().token;
    const put = (v) => call(port, { method: 'PUT', path: '/api/device', ...json(t, { profile: 'work', tools: ['claude'], obsidian: { vault: v } }) });
    for (const [v, msg] of [[join(plain, 'gone'), /does not exist/], [plain, /no .obsidian folder/], [tmp, /outside the workspace/], ['notes', /full path/]]) {
      const r = await put(v);
      expect(r.status, v).toBe(400);
      expect(r.json().error).toMatch(msg);
    }
    expect(existsSync(file)).toBe(false);
    expect((await put(vault)).status).toBe(200);
    expect(JSON.parse(readFileSync(file, 'utf8')).obsidian).toEqual({ vault });
  } finally { server.close(); }
  const mod = await import(pathToFileURL(join(tmp, '_ai/sync.mjs')).href);
  expect(readSetup(tmp, mod).vaultError).toBeUndefined();
  writeFileSync(file, JSON.stringify({ profile: 'work', tools: ['claude'], obsidian: { vault: join(vault, 'gone') } }));
  expect(readSetup(tmp, mod).vaultError).toMatch(/does not exist/);
});

test('a second Apply while one runs gets 409', async () => {
  const first = call(s.port, { method: 'POST', path: '/api/apply', ...json(token, {}) });
  await new Promise((r) => setTimeout(r, 100));
  expect((await call(s.port, { method: 'POST', path: '/api/apply', ...json(token, {}) })).status).toBe(409);
  expect((await call(s.port, { method: 'PUT', path: '/api/models', ...json(token, {}) })).status).toBe(409);
  const done = await first;
  expect(done.status).toBe(200);
  expect(done.json()).toMatchObject({ code: 0, stdout: 'done\n' });
});

test('a PUT whose body arrives after an Apply started gets 409', async () => {
  // the body is invalid, so nothing is written even if the lock were missed (that would answer 400)
  let put;
  const answer = new Promise((ok) => {
    put = request({ host: '127.0.0.1', port: s.port, method: 'PUT', path: '/api/device', headers: { host: `127.0.0.1:${s.port}`, 'x-setup-token': token, 'content-type': 'application/json' } },
      (res) => { res.resume(); ok(res.statusCode); });
    put.flushHeaders();
  });
  await new Promise((r) => setTimeout(r, 50));
  const apply = call(s.port, { method: 'POST', path: '/api/apply', ...json(token, {}) });
  await new Promise((r) => setTimeout(r, 100));
  put.end('{}');
  expect(await answer).toBe(409);
  expect((await apply).status).toBe(200);
});

test('static files stay inside dist/ and unknown routes fall back to index.html', async () => {
  for (const p of ['/..%2f..%2fAGENTS.md', '/%5c..%5cAGENTS.md', '/C:/Windows/win.ini', '//server/share/x', '/a/%00.js', '/%E0%A4%A']) {
    expect((await call(s.port, { path: p })).status, p).toBe(400);
  }
  expect(staticPath(dist, '/assets/../../x')).toBeNull();
  expect(staticPath(dist, '/assets/app.js')).toBe(join(dist, 'assets', 'app.js'));
  expect(staticPath(dist, '/')).toBe(dist);
  const page = await call(s.port, { path: '/some/route' });
  expect(page.body).toBe('<p>page</p>');
  expect(page.headers['content-security-policy']).toMatch(/frame-ancestors 'none'/);
  expect((await call(s.port, { path: '/assets/app.js' })).headers['content-type']).toBe('text/javascript');
  expect((await call(s.port, { path: '/missing.js' })).status).toBe(404);
  expect((await call(s.port, { method: 'POST', path: '/' })).status).toBe(405);
});

test('changing a helper model and applying changes only _ai/models.json among sources and leaves the tree in sync', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'setup-root-'));
  cpSync(join(ROOT, '_ai'), join(tmp, '_ai'), { recursive: true, filter: (f) => !/[\\/](node_modules|__pycache__)$/.test(f) });
  for (const f of ['AGENTS.md', 'README.md']) cpSync(join(ROOT, f), join(tmp, f));
  // claude only: Kiro would also write ~/.kiro for the temp folder
  writeFileSync(join(tmp, '.ai-device.json'), JSON.stringify({ profile: 'work', tools: ['claude'] }));
  const sync = (args) => spawnSync(process.execPath, [join(tmp, '_ai/sync.mjs'), ...args], { cwd: tmp, encoding: 'utf8' });
  expect(sync([]).status).toBe(0);

  const sources = () => {
    const files = ['AGENTS.md', 'README.md', '.ai-device.json'];
    const walk = (d) => readdirSync(join(tmp, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
    return Object.fromEntries([...files, ...walk('_ai')].map((f) => [f, createHash('sha256').update(readFileSync(join(tmp, f))).digest('hex')]));
  };
  const before = sources();
  const { server, port } = await start({ root: tmp, dist });
  try {
    const t = (await call(port, { path: '/api/session' })).json().token;
    const setup = (await call(port, { path: '/api/setup', headers: { 'x-setup-token': t } })).json();
    setup.models.claude.agents.scout = 'sonnet';
    expect((await call(port, { method: 'PUT', path: '/api/models', ...json(t, setup.models) })).status).toBe(200);
    const applied = (await call(port, { method: 'POST', path: '/api/apply', ...json(t, {}) })).json();
    expect(applied.code, applied.stderr).toBe(0);
  } finally { server.close(); }

  const after = sources();
  expect(Object.keys(after).filter((f) => after[f] !== before[f])).toEqual(['_ai/models.json']);
  expect(readFileSync(join(tmp, '.claude/agents/scout.md'), 'utf8')).toMatch(/^model: sonnet$/m);
  expect(sync(['--check']).stdout.trim()).toBe('in sync');

  // a broken device file still loads the page, with the reason
  const mod = await import(pathToFileURL(join(tmp, '_ai/sync.mjs')).href);
  writeFileSync(join(tmp, '.ai-device.json'), '{');
  expect(readSetup(tmp, mod)).toMatchObject({ device: null, deviceError: '.ai-device.json is not valid JSON' });
  writeFileSync(join(tmp, '.ai-device.json'), JSON.stringify({ profile: 'home', tools: ['vim'] }));
  expect(readSetup(tmp, mod).deviceError).toMatch(/tools a list of claude, kiro, copilot/);
  // an invalid but parsed device is still sent, so the page keeps its other keys
  const stale = { profile: 'home', tools: ['claude'], models: { claude: { agents: { scout: 'opus' } } }, perTool: { claude: { skillsOff: ['gone'] } } };
  writeFileSync(join(tmp, '.ai-device.json'), JSON.stringify(stale));
  expect(readSetup(tmp, mod)).toMatchObject({ device: stale, deviceError: expect.stringMatching(/unknown skill gone/) });
  writeFileSync(join(tmp, '.ai-device.json'), '[1]');
  expect(readSetup(tmp, mod).device).toBe(null);
});

test('setup-ui holds no AGENTS.md, CLAUDE.md or .github/ that a chat would load', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = join(d, e.name);
    return e.isDirectory() ? [p + sep, ...walk(p)] : [p];
  });
  const bad = walk(UI).filter((p) => /(^|[\\/])(AGENTS\.md|CLAUDE\.md|CLAUDE\.local\.md|\.github[\\/])$/i.test(p));
  expect(bad).toEqual([]);
  expect(existsSync(join(UI, '.claude'))).toBe(false);
});
