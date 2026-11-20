// Local API and static server for the setup page. Reads and writes only _ai/models.json and .ai-device.json;
// Apply runs `node _ai/sync.mjs` as a child process, one at a time.
//   node server.mjs   serves dist/ and /api on http://127.0.0.1:4319 (PORT to change)
import { createServer as httpServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 1024 * 1024;
const SYNC_TIMEOUT_MS = 60_000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' };

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const vscodeLink = (root, rel) => `vscode://file/${resolve(root, rel).replace(/\\/g, '/')}`;

// Everything the page shows, read from the source files under `root`.
export function readSetup(root, sync) {
  const text = (f) => readFileSync(join(root, f), 'utf8').replace(/\r\n/g, '\n');
  const agents = readdirSync(join(root, '_ai/agents')).filter((f) => f.endsWith('.md') && f !== '_core.md').sort().map((f) => {
    const { meta } = sync.parse(text(`_ai/agents/${f}`));
    return { name: meta.name, description: meta.description, tier: meta.model, link: vscodeLink(root, `_ai/agents/${f}`) };
  });
  const skills = readdirSync(join(root, '_ai/skills'), { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(join(root, '_ai/skills', e.name, 'SKILL.md'))).map((e) => e.name).sort().map((name) => {
    const { meta } = sync.parse(text(`_ai/skills/${name}/SKILL.md`));
    return { name, description: meta.description, link: vscodeLink(root, `_ai/skills/${name}/SKILL.md`) };
  });
  const rules = readdirSync(join(root, '_ai/rules')).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const { meta } = sync.parse(text(`_ai/rules/${f}`));
    return { name: f, applyTo: meta.applyTo, link: vscodeLink(root, `_ai/rules/${f}`) };
  });
  // a broken device file is shown on the page, so the page can still write a valid one;
  // an invalid object is still sent, so its other keys (models, perTool) are not lost
  let device = null, deviceError;
  const df = join(root, '.ai-device.json');
  if (existsSync(df)) {
    try { device = JSON.parse(readFileSync(df, 'utf8')); sync.checkDevice(device); }
    catch (e) {
      deviceError = e instanceof SyntaxError ? '.ai-device.json is not valid JSON' : e.message;
      if (typeof device !== 'object' || Array.isArray(device)) device = null;
    }
  }
  const mcp = Object.entries(sync.loadMcp()).map(([name, s]) => ({ name, description: s.description, target: s.url ?? s.command }));
  return {
    tools: sync.TOOL_NAMES, profiles: sync.PROFILES, hooks: sync.HOOKS, agents, skills, rules, mcp,
    models: JSON.parse(text('_ai/models.json')),
    device, ...(deviceError && { deviceError }),
  };
}

function readBody(req) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      // keep reading (and dropping) the rest, so the 413 reaches the client
      if (size > MAX_BODY) fail(new HttpError(413, 'body too large')); else chunks.push(c);
    });
    req.on('end', () => {
      if (size > MAX_BODY) return;
      try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')); }
      catch { fail(new HttpError(400, 'body is not valid JSON')); }
    });
    req.on('error', fail);
  });
}

// A path under dist/, or null when the URL tries to leave it (.., backslash, drive letter, UNC, NUL).
export function staticPath(dist, urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch { return null; }
  if (/[\\\0:]/.test(p) || p.startsWith('//') || p.split('/').includes('..')) return null;
  const f = resolve(dist, `.${p}`);
  return f === dist || f.startsWith(dist + sep) ? f : null;
}

export function createServer({ root = resolve(HERE, '..'), dist = join(HERE, 'dist'), syncScript = join(root, '_ai/sync.mjs') } = {}) {
  const token = randomBytes(24).toString('hex');
  const syncReady = import(pathToFileURL(join(root, '_ai/sync.mjs')).href);
  let applying = false;

  function runSync() {
    return new Promise((ok) => {
      const child = spawn(process.execPath, [syncScript], { cwd: root, timeout: SYNC_TIMEOUT_MS });
      let stdout = '', stderr = '';
      child.stdout.on('data', (d) => { stdout += d; });
      child.stderr.on('data', (d) => { stderr += d; });
      child.on('error', (e) => ok({ code: 1, stdout, stderr: stderr + e.message }));
      child.on('close', (code, signal) => ok({ code: code ?? 1, stdout, stderr: stderr + (signal ? `sync stopped by ${signal} after ${SYNC_TIMEOUT_MS / 1000}s
` : '') }));
    });
  }

  async function api(req, path) {
    if (path === '/api/session' && req.method === 'GET') return { token };
    if (req.headers['x-setup-token'] !== token) throw new HttpError(401, 'missing or wrong X-Setup-Token');
    if (req.method !== 'GET' && !/^application\/json\s*(;|$)/i.test(req.headers['content-type'] ?? '')) {
      throw new HttpError(415, 'Content-Type must be application/json');
    }
    const sync = await syncReady;
    if (path === '/api/setup' && req.method === 'GET') return readSetup(root, sync);
    // body first: an Apply that starts while it arrives still blocks the write
    const body = req.method === 'GET' ? undefined : await readBody(req);
    if (applying) throw new HttpError(409, 'an Apply is running');
    if (path === '/api/models' && req.method === 'PUT') {
      if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HttpError(400, 'models must be an object');
      try { sync.loadModels(undefined, body); } catch (e) { throw new HttpError(400, e.message); }
      writeFileSync(join(root, '_ai/models.json'), JSON.stringify(body, null, 2) + '\n');
      return { saved: '_ai/models.json' };
    }
    if (path === '/api/device' && req.method === 'PUT') {
      try { sync.checkDevice(body); } catch (e) { throw new HttpError(400, e.message); }
      writeFileSync(join(root, '.ai-device.json'), JSON.stringify(body, null, 2) + '\n');
      return { saved: '.ai-device.json' };
    }
    if (path === '/api/apply' && req.method === 'POST') {
      applying = true;
      try { return await runSync(); } finally { applying = false; }
    }
    throw new HttpError(404, 'no such API');
  }

  function serveStatic(req, res, path) {
    if (req.method !== 'GET') throw new HttpError(405, 'method not allowed');
    if (!existsSync(join(dist, 'index.html'))) throw new HttpError(503, 'dist/ is missing: run npm run build');
    let f = staticPath(dist, path);
    if (!f) throw new HttpError(400, 'bad path');
    if (!existsSync(f) || !statSync(f).isFile()) {
      if (extname(path)) throw new HttpError(404, 'not found');
      f = join(dist, 'index.html');
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(f)] ?? 'application/octet-stream',
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(readFileSync(f));
  }

  return httpServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(body));
    };
    try {
      // DNS rebinding: a hostile name resolving to 127.0.0.1 still sends its own Host
      const port = req.socket.localPort;
      if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) throw new HttpError(403, 'bad Host');
      // the raw path: new URL() would read `//host/x` as a host
      const path = req.url.split(/[?#]/)[0];
      if (!path.startsWith('/')) throw new HttpError(400, 'bad path');
      if (path.startsWith('/api/')) send(200, await api(req, path));
      else serveStatic(req, res, path);
    } catch (e) {
      if (!res.headersSent) send(e.status ?? 500, { error: e.message });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 4319);
  createServer().listen(port, '127.0.0.1', () => console.log(`setup UI: http://127.0.0.1:${port}`));
}
