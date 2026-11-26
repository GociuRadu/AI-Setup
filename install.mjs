// Installs this repo's AI setup into the work folder for Claude Code, GitHub Copilot (VS Code) and Kiro, from setup.json.
//   node install.mjs [--work <folder>] [--vault <folder>] [--dry-run]
// Writes each tool's own format inside <work> (.claude/, .github/, .kiro/, .ai/, AGENTS.md, CLAUDE.md), merges managed keys
// into the few user-level files a tool requires (~/.claude/settings.json, VS Code User settings.json,
// ~/.kiro/settings/permissions.yaml; a copy of each goes to <work>/.ai/backup/ before it changes), and records what it wrote in <work>/.ai-device.json. It deletes only files it wrote
// itself; a file of someone else's at a path it needs is moved to <work>/.ai/backup/ first. A second run changes nothing.
// No npm packages: Node 22+ only.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, renameSync, cpSync, realpathSync, readlinkSync, unlinkSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute, sep, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// one spelling per path, the one on disk: a shell started in c:\users\x and one in C:\Users\x must write the same files
const drive = (p) => { try { return realpathSync.native(p); } catch { return p.replace(/^[a-z]:/, (d) => d.toUpperCase()); } };
// the same for a path that may not exist (a broken link's target): the real spelling of its nearest existing folder, plus
// the rest, so an 8.3 short name (C:\Users\RUNNER~1) and the long one compare equal
const realOf = (p) => { try { return realpathSync.native(p); } catch { const up = dirname(p); return up === p ? drive(p) : join(realOf(up), basename(p)); } };
export const REPO = drive(dirname(fileURLToPath(import.meta.url)));
export const TOOLS = ['claude', 'copilot', 'kiro'];
const TIERS = ['fast', 'balanced', 'deep'];
const AGENT_TOOLS = {
  claude: { read: ['Read'], search: ['Grep', 'Glob'], web: ['WebSearch', 'WebFetch'], edit: ['Edit', 'Write'], execute: ['Bash', 'PowerShell'] },
  copilot: { read: ['read'], search: ['search'], web: ['web'], edit: ['edit'], execute: ['execute'] },
  kiro: { read: ['read'], search: ['glob', 'grep'], web: ['web_search', 'web_fetch'], edit: ['write'], execute: ['shell'] },
};
const SKILL_DIR = { claude: '.claude/skills', copilot: '.github/skills', kiro: '.kiro/skills' };
const SKIP = /(^|\/)(__pycache__|node_modules)(\/|$)|\.pyc$|\.test\.mjs$/;
// the hook entry in ~/.claude/settings.json is ours when it runs this script
const CLAUDE_HOOK = '.ai/hooks/claude/hook.mjs';
// .claude/settings.local.json keys the old setup wrote: bypassPermissions and blanket allows would skip auto mode's checks
const OLD_LOCAL_ALLOW = ['Edit', 'Write', 'NotebookEdit', 'Bash', 'PowerShell', 'WebFetch', 'WebSearch'];
// the old vault .claude/ folder, removed on every device (Obsidian Sync does not carry dot folders)
const OLD_VAULT_CLAUDE = ['CLAUDE.md', 'settings.json', 'hooks/block-private.mjs', 'hooks/block-private.test.mjs'];
const EXAMPLES = ['**/*.example', '**/*.sample', '**/*.template', '**/*.dist'];

const posix = (p) => p.split(sep).join('/');
const readText = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const walk = (dir, base = dir) => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = join(dir, e.name);
  return e.isDirectory() ? walk(full, base) : [posix(relative(base, full))];
}) : [];
// JSON text, indented like `like` (the file it replaces) when that has an indent
const json = (v, like = '') => JSON.stringify(v, null, /^\{\s*\n(\t|[ ]+)\S/.exec(like)?.[1] ?? 2) + '\n';
const textOf = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// frontmatter: `key: value`, "quoted" strings and [a, b] lists only
export function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const v = kv[2].trim();
    meta[kv[1]] = v.startsWith('[') ? v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean) : v.startsWith('"') ? JSON.parse(v) : v;
  }
  return { meta, body: text.slice(m[0].length) };
}
const yaml = (meta) => `---\n${Object.entries(meta).map(([k, v]) => `${k}: ${Array.isArray(v) || !/^[\w.-]+$/.test(String(v)) ? JSON.stringify(v) : v}`).join('\n')}\n---\n`;

// setup.json, checked against the repo: every folder has an entry and every entry a folder
export function loadSetup(repo = REPO) {
  const s = JSON.parse(readText(join(repo, 'setup.json')));
  const names = (d, ext) => existsSync(join(repo, d)) ? readdirSync(join(repo, d), { withFileTypes: true })
    .filter((e) => (ext ? e.isFile() && e.name.endsWith(ext) : e.isDirectory())).map((e) => (ext ? e.name.slice(0, -ext.length) : e.name)) : [];
  const same = (kind, listed, found) => {
    const a = [...listed].sort().join(','), b = [...found].sort().join(',');
    if (a !== b) throw new Error(`setup.json ${kind}: lists [${a}] but the repo has [${b}]`);
  };
  for (const k of ['tools', 'rules', 'skills', 'agents', 'models', 'hooks', 'mcp', 'off']) if (!isObj(s[k])) throw new Error(`setup.json: ${k} must be an object`);
  same('tools', Object.keys(s.tools), TOOLS);
  same('rules', Object.keys(s.rules), names('rules', '.md'));
  same('skills', Object.keys(s.skills), names('skills'));
  same('agents', Object.keys(s.agents), names('agents', '.md'));
  same('mcp', Object.keys(s.mcp), names('mcp', '.json'));
  same('hooks', Object.keys(s.hooks), ['guard']);
  for (const t of TIERS) for (const tool of TOOLS) if (typeof s.models[t]?.[tool] !== 'string' || !s.models[t][tool]) throw new Error(`setup.json: models.${t}.${tool} must be a model id`);
  for (const [n, a] of Object.entries(s.agents)) {
    if (!isObj(a) || typeof a.on !== 'boolean' || !TIERS.includes(a.tier)) throw new Error(`setup.json: agents.${n} needs on (true/false) and tier (${TIERS.join(', ')})`);
  }
  if (s.main && !TIERS.includes(s.main.tier)) throw new Error(`setup.json: main.tier must be one of ${TIERS.join(', ')}`);
  for (const group of ['tools', 'rules', 'skills', 'hooks', 'mcp']) for (const [n, v] of Object.entries(s[group])) if (typeof v !== 'boolean') throw new Error(`setup.json: ${group}.${n} must be true or false`);
  return s;
}

const which = (cmd) => spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' }).status === 0;
export function vscodeUserDir(home = homedir()) {
  if (process.platform === 'win32') return join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Code', 'User');
  if (process.platform === 'darwin') return join(home, 'Library', 'Application Support', 'Code', 'User');
  return join(home, '.config', 'Code', 'User');
}

// The files the setup puts inside <work>, as { relative path: text or Buffer }.
export function workFiles({ repo, setup, tools, work, vault }) {
  const out = {};
  const on = (t) => tools.includes(t);
  const header = (src) => `<!-- Generated from AI-Setup/${src} by node install.mjs; edit the source and rerun. -->\n`;
  if (setup.rules.always) {
    out['AGENTS.md'] = header('rules/always.md') + readText(join(repo, 'rules/always.md'));
    if (on('claude')) out['CLAUDE.md'] = '@AGENTS.md\n';
  }
  for (const name of Object.keys(setup.rules).filter((r) => r !== 'always' && setup.rules[r])) {
    const { meta, body } = frontmatter(readText(join(repo, 'rules', `${name}.md`)));
    if (on('claude')) out[`.claude/rules/${name}.md`] = `---\npaths:\n  - ${JSON.stringify(meta.applyTo)}\n---\n${header(`rules/${name}.md`)}${body}`;
    if (on('copilot')) out[`.github/instructions/${name}.instructions.md`] = `---\napplyTo: ${JSON.stringify(meta.applyTo)}\n---\n${header(`rules/${name}.md`)}${body}`;
    if (on('kiro')) out[`.kiro/steering/${name}.md`] = `---\ninclusion: fileMatch\nfileMatchPattern: ${JSON.stringify(meta.applyTo)}\n---\n${header(`rules/${name}.md`)}${body}`;
  }
  for (const skill of Object.keys(setup.skills).filter((s) => setup.skills[s])) {
    for (const rel of walk(join(repo, 'skills', skill)).filter((f) => !SKIP.test(f))) {
      const src = join(repo, 'skills', skill, rel);
      for (const tool of tools) {
        const dest = `${SKILL_DIR[tool]}/${skill}/${rel}`;
        if (rel !== 'SKILL.md') { out[dest] = readFileSync(src); continue; }
        const { meta, body } = frontmatter(readText(src));
        if (meta.name !== skill) throw new Error(`skills/${skill}/SKILL.md: name must be ${skill}`);
        const hint = meta['argument-hint'];
        // Kiro reads only name and description; the expected input goes into the body
        out[dest] = tool === 'kiro'
          ? yaml({ name: meta.name, description: meta.description }) + body + (hint ? `\nExpected input after the slash command: ${hint}\n` : '')
          : readText(src);
      }
    }
  }
  for (const [name, cfg] of Object.entries(setup.agents).filter(([, a]) => a.on)) {
    const { meta, body } = frontmatter(readText(join(repo, 'agents', `${name}.md`)));
    if (meta.name !== name) throw new Error(`agents/${name}.md: name must be ${name}`);
    const model = (tool) => setup.deviceModels?.[name]?.[tool] ?? setup.models[cfg.tier][tool];
    const list = (tool) => [...new Set((meta.tools ?? []).flatMap((t) => {
      if (!AGENT_TOOLS[tool][t]) throw new Error(`agents/${name}.md: unknown tool ${t}`);
      return AGENT_TOOLS[tool][t];
    }))];
    if (on('claude')) out[`.claude/agents/${name}.md`] = yaml({ name, description: meta.description, model: model('claude'), ...(cfg.effort && { effort: cfg.effort }), tools: list('claude').join(', ') }) + header(`agents/${name}.md`) + body;
    if (on('copilot')) out[`.github/agents/${name}.agent.md`] = yaml({ name, description: meta.description, tools: list('copilot'), model: model('copilot'), ...(cfg.effort && { 'reasoning-effort': cfg.effort }) }) + header(`agents/${name}.md`) + body;
    if (on('kiro')) {
      out[`.kiro/agents/${name}.json`] = json({
        name, description: meta.description, model: model('kiro'), tools: list('kiro'), prompt: body.trim(),
        // a custom Kiro agent does not get the workspace hooks, so the guard is attached to it
        ...(setup.hooks.guard && { hooks: [{ name: 'guard', trigger: 'PreToolUse', action: { type: 'command', command: 'node .ai/hooks/kiro/hook.mjs' }, timeout: 10 }] }),
      });
    }
  }
  if (setup.hooks.guard) {
    out['.ai/hooks/guard.mjs'] = readFileSync(join(repo, 'hooks/guard.mjs'));
    for (const tool of tools) out[`.ai/hooks/${tool}/hook.mjs`] = readFileSync(join(repo, 'hooks', tool, 'hook.mjs'));
    if (on('copilot')) out['.github/hooks/guard.json'] = readFileSync(join(repo, 'hooks/copilot/guard.json'));
    if (on('kiro')) out['.kiro/hooks/guard.json'] = readFileSync(join(repo, 'hooks/kiro/guard.json'));
  }
  for (const rel of walk(join(repo, 'templates'))) out[`.ai/templates/${rel}`] = readFileSync(join(repo, 'templates', rel));
  return out;
}

const same = (a, b) => Buffer.from(a).equals(Buffer.from(b));

// ---- user-level and shared files: only managed keys change ----

// Claude's settings and the MCP files are plain JSON; one with comments is left for the user (with the keys to set).
// VS Code settings, which often have comments, go through editJsonc instead.
function readJson(file) {
  if (!existsSync(file)) return {};
  const text = readFileSync(file, 'utf8');
  try { return JSON.parse(text.replace(/^﻿/, '') || '{}'); } catch { return null; }
}

export function claudeDeny(work) {
  const ws = '//' + posix(work).replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase()).replace(/^\/+|\/+$/g, '');
  const sh = (p) => [`Bash(${p})`, `PowerShell(${p})`];
  const hostinger = ['vps', 'hosting', 'agency-hosting', 'dns', 'domains', 'wordpress', 'billing', 'reach'].flatMap((s) => [`mcp__hostinger-${s}__execute`, `mcp__hostinger-${s}__multi-execute`]);
  return [
    ...['**/.env', '**/.env.*', '**/*.env', '**/*.mdenc', `${ws}/personal/**`].flatMap((p) => [`Read(${p})`, `Edit(${p})`]),
    ...['git *push*--force*', 'git *push* -f*', 'docker volume rm *', 'docker volume prune*', 'docker system prune*', 'docker*compose*down*-v*', 'docker*compose*prod*', 'ssh *', 'scp *', 'sftp *'].flatMap(sh),
    ...hostinger, 'mcp__hostinger-wordpress-sites__execute_site_tool', 'mcp__claude_ai_Atlassian_MCP__executeDestructive', 'mcp__atlassian__executeDestructive',
  ];
}

// ~/.claude/settings.json: auto mode, the guard hook, deny rules, built-ins off, the main model
export function mergeClaudeSettings(cur, { setup, work, enabled, managed, repo = REPO }) {
  const s = structuredClone(cur);
  const hookPath = posix(join(work, CLAUDE_HOOK));
  const ours = (h) => JSON.stringify(h).replace(/\\\\/g, '/').includes(CLAUDE_HOOK);
  s.permissions = isObj(s.permissions) ? s.permissions : {};
  const prevDeny = new Set(managed.claudeDeny ?? []);
  const deny = enabled ? claudeDeny(work) : [];
  s.permissions.deny = [...new Set([...(s.permissions.deny ?? []).filter((r) => !prevDeny.has(r) && !deny.includes(r)), ...deny])];
  if (!s.permissions.deny.length) delete s.permissions.deny;
  if (enabled) s.permissions.defaultMode = 'auto';
  else if (managed.claudeKeys?.includes('defaultMode') && s.permissions.defaultMode === 'auto') delete s.permissions.defaultMode;
  if (!Object.keys(s.permissions).length) delete s.permissions;
  const pre = (s.hooks?.PreToolUse ?? []).filter((h) => !ours(h));
  if (enabled && setup.hooks.guard) {
    const frag = JSON.parse(readText(join(repo, 'hooks/claude/settings.json')).replace('{{HOOK}}', hookPath));
    pre.push(...frag.hooks.PreToolUse);
  }
  if (pre.length) s.hooks = { ...s.hooks, PreToolUse: pre };
  else if (s.hooks) { delete s.hooks.PreToolUse; if (!Object.keys(s.hooks).length) delete s.hooks; }
  const keys = [];
  let model;
  if (enabled) {
    if (setup.off['claude-auto-memory']) { s.autoMemoryEnabled = false; keys.push('autoMemoryEnabled'); }
    if (setup.off['claude-output-style'] && s.outputStyle === 'Concise') delete s.outputStyle;
    // the main model, unless the user picked another one (with /model or by hand) after the install last set it
    if (setup.main) {
      const want = setup.models[setup.main.tier].claude;
      const ours = managed.claudeModel ?? (managed.claudeKeys?.includes('model') ? want : undefined);
      if (s.model === undefined || s.model === ours) { s.model = want; model = want; }
    }
    keys.push('defaultMode');
  } else if (managed.claudeKeys?.includes('autoMemoryEnabled')) delete s.autoMemoryEnabled;
  return { settings: s, deny, keys, model };
}

// VS Code User settings.json: hooks on, Claude's files and hooks off for Copilot, Copilot memory off, never-auto-approve rules
export function vscodeKeys(setup) {
  const keys = { 'chat.useHooks': true, 'chat.useAgentsMdFile': true };
  if (setup.off['copilot-claude-files']) Object.assign(keys, {
    'chat.useClaudeHooks': false, 'chat.useClaudeMdFile': false,
    'chat.agentFilesLocations': { '.claude/agents': false },
    'chat.instructionsFilesLocations': { '.claude/rules': false },
    'chat.agentSkillsLocations': { '.claude/skills': false },
  });
  if (setup.off['copilot-memory']) keys['chat.copilot.memory.local.enabled'] = false;
  // false = always ask, a second line behind the hook (Copilot lets a call through when a hook times out)
  keys['chat.tools.terminal.autoApprove'] = {
    '/\\bgit\\s+push\\b.*(--force|\\s-f\\b)/i': false, '/\\bdown\\b.*(\\s-v\\b|--volumes)/i': false, '/\\bdocker\\s+(volume\\s+(rm|prune)|system\\s+prune)\\b/i': false,
    '/(^|[\\s;&|(])(ssh|scp|sftp)(\\.exe)?\\s/i': false, '/\\.env\\b|\\.mdenc\\b/i': false,
  };
  keys['chat.tools.edits.autoApprove'] = { '**/.env': false, '**/.env.*': false, '**/*.env': false, '**/*.mdenc': false, '**/personal/**': false };
  return keys;
}
// JSON with comments (VS Code settings.json): comments and trailing commas become spaces, so the text parses as JSON and
// every offset still points at the same place in the original
export function blankJsonc(text) {
  const c = text.split('');
  const pass = (fn) => { for (let i = 0, str = false; i < c.length; i++) {
    if (str) { if (c[i] === '\\') i++; else if (c[i] === '"') str = false; continue; }
    if (c[i] === '"') str = true; else i = fn(i);
  } };
  pass((i) => {
    if (c[i] !== '/' || (c[i + 1] !== '/' && c[i + 1] !== '*')) return i;
    const end = c[i + 1] === '/' ? text.indexOf('\n', i) : text.indexOf('*/', i + 2) + 2;
    const stop = end <= 1 || end < 0 ? c.length : end;
    for (let j = i; j < stop; j++) if (c[j] !== '\n') c[j] = ' ';
    return stop - 1;
  });
  pass((i) => { if (c[i] === ',') { let j = i + 1; while (/\s/.test(c[j] ?? '')) j++; if (c[j] === '}' || c[j] === ']') c[i] = ' '; } return i; });
  return c.join('');
}
// the top-level keys of a JSON object text: where each key starts and where its value starts and ends
function topLevelKeys(b) {
  const spans = new Map();
  let depth = 0, key = null, keyStart = -1, valStart = -1, open = -1;
  for (let i = 0; i < b.length; i++) {
    const ch = b[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < b.length && b[j] !== '"') j += b[j] === '\\' ? 2 : 1;
      if (depth === 1 && key === null) { key = JSON.parse(b.slice(i, j + 1)); keyStart = i; }
      i = j;
    } else if (ch === ':' && depth === 1 && valStart < 0) valStart = i + 1;
    else if (ch === '{' || ch === '[') { if (depth === 0) open = i; depth++; }
    else if ((ch === ',' || ch === '}') && depth === 1) {
      if (key !== null) spans.set(key, { keyStart, valStart, valEnd: b.slice(0, i).trimEnd().length });
      key = null; valStart = -1;
      if (ch === '}') depth--;
    } else if (ch === '}' || ch === ']') depth--;
  }
  return { spans, open };
}
// writes only the top-level keys that changed from `cur` to `next` into the JSONC text, so the user's comments stay
// (comments inside a value that changes are lost with that value)
export function editJsonc(text, cur, next) {
  const b = blankJsonc(text);
  const { spans, open } = topLevelKeys(b);
  const unit = /\n([ \t]+)"/.exec(text)?.[1] ?? '  ';
  const val = (v) => JSON.stringify(v, null, unit).replace(/\n/g, `\n${unit}`);
  const edits = [];
  const adds = [];
  for (const k of new Set([...Object.keys(cur), ...Object.keys(next)])) {
    if (JSON.stringify(cur[k]) === JSON.stringify(next[k])) continue;
    const sp = spans.get(k);
    if (sp && k in next) edits.push([sp.valStart, sp.valEnd, ` ${val(next[k])}`]);
    else if (sp) {
      // the member and one comma: the one after it, else the one before it
      const after = b.slice(sp.valEnd).search(/\S/) + sp.valEnd;
      const lineStart = b.lastIndexOf('\n', sp.keyStart - 1) + 1;
      const from = /^\s*$/.test(b.slice(lineStart, sp.keyStart)) ? lineStart : sp.keyStart;
      if (b[after] === ',') edits.push([from, after + 1, '']);
      else { const before = b.slice(0, sp.keyStart).trimEnd(); edits.push([before.endsWith(',') ? before.length - 1 : from, sp.valEnd, '']); }
    } else adds.push(`${unit}${JSON.stringify(k)}: ${val(next[k])}`);
  }
  if (adds.length) {
    const last = [...spans.values()].filter((s) => edits.every(([f, t, r]) => r !== '' || s.keyStart < f || s.keyStart >= t)).sort((x, y) => y.valEnd - x.valEnd)[0];
    if (last) edits.push([last.valEnd, last.valEnd, `,\n${adds.join(',\n')}`]);
    else edits.push([open + 1, open + 1, `\n${adds.join(',\n')}\n`]);
  }
  let out = text;
  for (const [from, to, rep] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, from) + rep + out.slice(to);
  return out;
}

export function mergeVscode(cur, { setup, enabled, managed }) {
  const s = structuredClone(cur);
  // previous managed entries: [key] or [key, subkey]
  for (const [k, sub] of managed.vscode ?? []) {
    if (sub === undefined) delete s[k];
    else if (isObj(s[k])) { delete s[k][sub]; if (!Object.keys(s[k]).length) delete s[k]; }
  }
  const entries = [];
  if (enabled) for (const [k, v] of Object.entries(vscodeKeys(setup))) {
    if (isObj(v)) { s[k] = { ...(isObj(s[k]) ? s[k] : {}), ...v }; for (const sub of Object.keys(v)) entries.push([k, sub]); }
    else { s[k] = v; entries.push([k]); }
  }
  return { settings: s, entries };
}

// MCP servers in one file: ours added when missing (an existing entry, and so its sign-in, is never rewritten),
// retired and dropped ones removed, everyone else's kept
export function mergeMcp(cur, { key, servers, remove, entry }) {
  const s = structuredClone(cur);
  const all = { ...(isObj(s[key]) ? s[key] : {}) };
  for (const n of remove) delete all[n];
  for (const [n, def] of Object.entries(servers)) if (!(n in all)) all[n] = entry(def);
  if (!Object.keys(all).length && !(key in s)) return s;
  s[key] = all;
  return s;
}

// Kiro permissions.yaml: `rules:` items, each kept as its own text; ours are JSON one-liners matched by content, since
// Kiro rewrites the file and drops comments
// the old setup's generated block (node _ai/sync.mjs), dropped whole
const OLD_KIRO_BLOCK = /^\s*# >>> generated by node _ai\/sync\.mjs[^\n]*\n(?:[^\n]*\n)*?\s*# <<< generated by node _ai\/sync\.mjs[^\n]*(\n|$)/m;
export function parseKiroRules(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(OLD_KIRO_BLOCK, '').replace(/\n+$/, '').split('\n');
  // `rules:`, also `rules: []` and `rules: # note`
  const start = lines.findIndex((l) => /^rules:\s*(\[\s*\])?\s*(#.*)?$/.test(l));
  if (start < 0) return { head: lines.join('\n').replace(/\n+$/, ''), items: [], tail: '', indent: '  ' };
  const items = [];
  // a rule starts at the indent of the first `- ` (none is valid YAML too); deeper `- ` lines are list values inside a rule
  const indent = lines.slice(start + 1).map((l) => /^(\s*)-\s/.exec(l)?.[1]).find((x) => x !== undefined) ?? '  ';
  let i = start + 1;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (/^\S/.test(l) && !(indent === '' && /^-\s/.test(l))) break; // the next top-level key
    const own = l.startsWith(`${indent}- `) || l.startsWith(`${indent}-\t`) || (/^\s*#/.test(l) && l.search(/\S/) <= indent.length);
    if (own || !items.length) items.push({ lines: [l] });
    else items[items.length - 1].lines.push(l);
  }
  for (const it of items) it.rule = kiroRule(it.lines);
  return { head: lines.slice(0, start).join('\n'), items: items.filter((it) => it.lines.some((l) => l.trim())), tail: lines.slice(i).join('\n'), indent };
}
function kiroRule(lines) {
  const first = lines[0].replace(/^\s*-\s*/, '');
  if (/^\s*#/.test(lines[0])) return null;
  if (first.startsWith('{')) { try { return JSON.parse(first); } catch { return null; } }
  const rule = {};
  let key;
  const bare = (v) => v.trim().replace(/^(["'])(.*)\1$/, '$2');
  for (const l of [first, ...lines.slice(1)]) {
    const item = /^\s*-\s+(.*)$/.exec(l), kv = /^\s*([\w-]+):\s*(.*)$/.exec(l);
    if (item && key && Array.isArray(rule[key])) rule[key].push(bare(item[1]));
    else if (kv) { key = kv[1]; rule[key] = kv[2].trim() === '' ? [] : bare(kv[2]); }
  }
  return rule;
}
const canon = (r) => JSON.stringify(r, Object.keys(r ?? {}).sort());
export function kiroRules({ work, vault, home = homedir(), temp = tmpdir() }) {
  const f = (p) => posix(p).replace(/\/+$/, '');
  const credentials = ['.ssh/**', '.aws/**', '.azure/**', '.kube/**', '.docker/config.json', '.git-credentials', '.npmrc', '.pypirc', '.netrc',
    '.config/gh/**', 'AppData/Roaming/GitHub CLI/**', '.claude/.credentials.json'].map((p) => `${f(home)}/${p}`);
  return [
    { capability: 'fs_read', effect: 'allow' },
    { capability: 'filesystem', match: [`${f(temp)}/**`], effect: 'allow' },
    ...(vault ? [{ capability: 'filesystem', match: [`${f(vault)}/**`], effect: 'allow' }] : []),
    { capability: 'filesystem', match: ['**/.env', '**/.env.*', '**/*.env', '**/*.mdenc', `${f(work)}/personal/**`, ...credentials, '**/*.pem', '**/*.key', '**/*.pfx'], exclude: EXAMPLES, effect: 'deny' },
    { capability: 'shell', match: ['*git push --force*', '*git push -f*', '*push --force-with-lease*', '*down -v*', '*down --volumes*', '*docker volume rm*', '*docker volume prune*', '*docker system prune*', 'ssh *', 'scp *', 'sftp *'], effect: 'deny' },
    { capability: 'mcp', match: ['*executeDestructive*', '*hostinger*_execute', '*hostinger*multi-execute*', '*execute_site_tool*'], effect: 'deny' },
  ];
}
export function mergeKiroPermissions(text, { rules, managed, vault }) {
  const { head, items, tail, indent } = parseKiroRules(text);
  const drop = new Set([...(managed.kiroRules ?? []), ...rules].map(canon));
  const seen = new Set();
  const v = vault && posix(vault).replace(/\/+$/, '');
  const kept = items.filter((it) => {
    const line = it.lines.join('\n');
    // a stray marker of the old setup's block, and its vault rules (Personal denied, .obsidian excluded) that the guard now handles
    if (/# (>>>|<<<) generated by node _ai\/sync\.mjs/.test(line)) return false;
    if (!it.rule) return true;
    if (v && /Personal\/\*\*|\.obsidian\/\*\*/.test(JSON.stringify(it.rule)) && JSON.stringify(it.rule).includes(v)) return false;
    const c = canon(it.rule);
    if (drop.has(c) || seen.has(c)) return false;
    seen.add(c);
    return true;
  });
  const body = [...kept.map((it) => it.lines.join('\n')), ...rules.map((r) => `${indent}- ${JSON.stringify(r)}`)];
  // a bare `rules:` is null, and Kiro then denies every tool call ("Policy must contain a rules array")
  return [...(head.trim() ? [head.replace(/\n+$/, '')] : []), body.some((l) => l.trim()) ? 'rules:' : 'rules: []', ...body, ...(tail.trim() ? [tail.replace(/\n+$/, '')] : [])].join('\n') + '\n';
}

// .ignore: lines this setup needs, added once
function mergeIgnore(text, lines, prev) {
  const have = text.replace(/\r\n/g, '\n').split('\n').filter((l, i, a) => !(i === a.length - 1 && l === '') && !(prev.includes(l) && !lines.includes(l)));
  for (const l of lines) if (!have.includes(l)) have.push(l);
  return have.join('\n') + '\n';
}

// ---- the run ----

export function install(opts = {}) {
  const repo = drive(opts.repo ?? REPO);
  const home = drive(opts.home ?? homedir());
  const work = drive(resolve(opts.work ?? dirname(repo)));
  const log = opts.log ?? console.log;
  const dry = !!opts.dryRun;
  const detect = opts.which ?? which;
  const vscodeUser = opts.vscodeUser ?? vscodeUserDir(home);
  const setup = loadSetup(repo);
  if (!existsSync(work) || !statSync(work).isDirectory()) throw new Error(`${work} is not a folder`);
  const deviceFile = join(work, '.ai-device.json');
  let device = {};
  if (existsSync(deviceFile)) {
    try { device = JSON.parse(readFileSync(deviceFile, 'utf8')); } catch { throw new Error(`${deviceFile} is not valid JSON; fix or delete it, then run again`); }
  }
  const managed = device.manifest ?? {};
  // the vault: --vault, else the device file (the old setup kept it under obsidian.vault)
  let vault = opts.vault ?? device.vault ?? device.obsidian?.vault;
  if (vault) vault = drive(vault);
  const warnings = [];
  if (vault && !(existsSync(join(vault, '.obsidian')))) { warnings.push(`vault ${vault} has no .obsidian folder: left out until it is fixed`); vault = undefined; }
  if (vault) {
    const r = relative(work, vault);
    if (!r.startsWith('..') && !isAbsolute(r)) { warnings.push(`vault ${vault} is inside the work folder: left out`); vault = undefined; }
  }
  const found = {
    claude: existsSync(join(home, '.claude')) || detect('claude'),
    copilot: existsSync(vscodeUser) || detect('code'),
    kiro: existsSync(join(home, '.kiro')) || detect('kiro'),
  };
  const tools = TOOLS.filter((t) => setup.tools[t] && found[t]);
  const clis = Object.fromEntries([['claude', 'claude'], ['gh', 'gh'], ['gitleaks', 'gitleaks'], ['playwright', 'playwright-cli']].map(([k, c]) => [k, detect(c)]));
  const projects = readdirSync(work, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.') && existsSync(join(work, e.name, 'code'))).map((e) => e.name).sort();
  setup.deviceModels = isObj(device.models) ? device.models : {};

  const changes = [];
  const write = (file, data) => {
    if (existsSync(file) && same(readFileSync(file), data)) return;
    changes.push(`write ${file}`);
    if (dry) return;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, data);
  };
  const remove = (file) => {
    if (!existsSync(file)) return;
    changes.push(`remove ${file}`);
    if (!dry) rmSync(file, { force: true });
  };
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const backup = (file, rel) => {
    const to = join(work, '.ai', 'backup', stamp, rel);
    changes.push(`backup ${file} -> ${to}`);
    if (dry) return;
    mkdirSync(dirname(to), { recursive: true });
    try { renameSync(file, to); } catch { cpSync(file, to); rmSync(file, { force: true }); } // another drive
  };
  // a user-level settings file: a copy of the old one goes to the backup first, and the new text is written to a temp file
  // and renamed, so a tool watching the file never reads half of it
  const writeUser = (file, data) => {
    if (existsSync(file) && same(readFileSync(file), data)) return;
    if (existsSync(file)) {
      const rel = relative(home, file);
      const to = join(work, '.ai', 'backup', stamp, 'user', rel.startsWith('..') || isAbsolute(rel) ? basename(file) : rel);
      changes.push(`backup ${file} -> ${to}`);
      if (!dry) { mkdirSync(dirname(to), { recursive: true }); cpSync(file, to); }
    }
    changes.push(`write ${file}`);
    if (dry) return;
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.ai-tmp`;
    writeFileSync(tmp, data);
    try { renameSync(tmp, file); } catch { writeFileSync(file, data); rmSync(tmp, { force: true }); } // the file is locked
  };

  // 1. files inside <work>
  const files = workFiles({ repo, setup, tools, work, vault });
  const before = new Set(managed.files ?? []);
  for (const rel of [...before].filter((f) => !(f in files))) remove(join(work, rel));
  // empty folders left by removed files, up to the managed roots
  if (!dry) for (const rel of [...before].filter((f) => !(f in files))) {
    for (let d = dirname(join(work, rel)); d !== work && relative(work, d) && !relative(work, d).startsWith('..'); d = dirname(d)) {
      if (existsSync(d) && !readdirSync(d).length) rmSync(d, { recursive: true }); else break;
    }
  }
  for (const [rel, data] of Object.entries(files)) {
    const file = join(work, rel);
    if (existsSync(file) && !before.has(rel) && !same(readFileSync(file), data)) backup(file, rel);
    write(file, data);
  }
  const ignoreLines = ['/AI-Setup/', '.*/skills/ui-ux-pro-max/data/'];
  write(join(work, '.ignore'), mergeIgnore(existsSync(join(work, '.ignore')) ? readFileSync(join(work, '.ignore'), 'utf8') : '', ignoreLines, managed.ignore ?? []));

  // 2. MCP: workspace files only (~/.claude.json is never touched)
  const servers = Object.fromEntries(Object.keys(setup.mcp).filter((n) => setup.mcp[n]).map((n) => [n, JSON.parse(readText(join(repo, 'mcp', `${n}.json`)))]));
  const dropMcp = [...new Set([...(setup.off['retired-mcp'] ?? []), ...(device.mcpSynced ?? []).filter((n) => !(n in servers))])];
  const mcpFile = (file, key, enabled, entry) => {
    const cur = readJson(file);
    if (cur === null) { warnings.push(`${file} is not plain JSON: MCP servers not merged`); return; }
    if (!existsSync(file) && !enabled) return;
    const next = mergeMcp(cur, { key, servers: enabled ? servers : {}, remove: enabled ? dropMcp : [...dropMcp, ...Object.keys(servers)], entry });
    if (existsSync(file) || Object.keys(next[key] ?? {}).length) write(file, json(next, textOf(file)));
  };
  const plainEntry = ({ type, url, command, args, env, headers }) => ({ type, ...(url && { url }), ...(command && { command }), ...(args && { args }), ...(env && { env }), ...(headers && { headers }) });
  mcpFile(join(work, '.mcp.json'), 'mcpServers', tools.includes('claude') || tools.includes('copilot'), (d) => ({ ...plainEntry(d), tools: ['*'] }));
  mcpFile(join(work, '.kiro/settings/mcp.json'), 'mcpServers', tools.includes('kiro'), (d) => { const { type, ...rest } = plainEntry(d); return rest; });
  if (existsSync(join(work, '.vscode/mcp.json'))) {
    const cur = readJson(join(work, '.vscode/mcp.json'));
    if (cur) write(join(work, '.vscode/mcp.json'), json(mergeMcp(cur, { key: 'servers', servers: {}, remove: dropMcp, entry: (d) => d })));
  }

  // 3. user-level settings the tools require
  const next = { files: Object.keys(files).sort(), ignore: ignoreLines };
  const claudeFile = join(home, '.claude', 'settings.json');
  if (tools.includes('claude') || managed.claudeDeny) {
    const cur = readJson(claudeFile);
    if (cur === null) warnings.push(`${claudeFile} is not plain JSON: set permissions.defaultMode "auto", autoMemoryEnabled false and the guard hook by hand`);
    else {
      const { settings, deny, keys, model } = mergeClaudeSettings(cur, { setup, work, enabled: tools.includes('claude'), managed, repo });
      writeUser(claudeFile, json(settings, textOf(claudeFile)));
      if (deny.length) next.claudeDeny = deny;
      if (keys.length) next.claudeKeys = keys;
      if (model) next.claudeModel = model;
    }
  }
  const vsFile = join(vscodeUser, 'settings.json');
  if (tools.includes('copilot') || managed.vscode) {
    // VS Code allows comments and trailing commas; with any, only the changed keys are edited in place
    const text = textOf(vsFile).replace(/^﻿/, '');
    const blank = blankJsonc(text);
    let cur = null;
    try { cur = JSON.parse(blank.trim() || '{}'); } catch { /* not JSON even without comments */ }
    if (!isObj(cur)) warnings.push(`${vsFile} is not valid JSON: add these keys by hand: ${JSON.stringify(vscodeKeys(setup))}`);
    else {
      const { settings, entries } = mergeVscode(cur, { setup, enabled: tools.includes('copilot'), managed });
      writeUser(vsFile, blank === text || !text.trim() ? json(settings, text) : editJsonc(text, cur, settings));
      if (entries.length) next.vscode = entries;
    }
  }
  const kiroFile = join(home, '.kiro', 'settings', 'permissions.yaml');
  if (existsSync(join(home, '.kiro')) && (tools.includes('kiro') || managed.kiroRules)) {
    const rules = tools.includes('kiro') ? kiroRules({ work, vault, home }) : [];
    writeUser(kiroFile, mergeKiroPermissions(existsSync(kiroFile) ? readFileSync(kiroFile, 'utf8') : '', { rules, managed, vault }));
    if (rules.length) next.kiroRules = rules;
  }
  // Kiro's own rules for the work folder (the old setup kept its block there); the path is Kiro's hash of the folder
  const kiroWs = join(home, '.kiro', 'workspace-roots', createHash('sha256').update(process.platform === 'win32' ? posix(work).toLowerCase() : posix(work)).digest('hex').slice(0, 16), 'permissions.yaml');
  if (existsSync(kiroWs)) writeUser(kiroWs, mergeKiroPermissions(readFileSync(kiroWs, 'utf8'), { rules: [], managed: {}, vault }));

  // 4. what the old setup left that now gets in the way
  const local = join(work, '.claude', 'settings.local.json');
  if (existsSync(local)) {
    const cur = readJson(local);
    if (cur) {
      const s = structuredClone(cur);
      if (s.permissions?.defaultMode === 'bypassPermissions') delete s.permissions.defaultMode;
      if (Array.isArray(s.permissions?.allow)) s.permissions.allow = s.permissions.allow.filter((r) => !OLD_LOCAL_ALLOW.includes(r));
      if (s.permissions && !s.permissions.allow?.length) delete s.permissions.allow;
      if (s.permissions && !Object.keys(s.permissions).length) delete s.permissions;
      delete s.hooks; // a workspace Claude hook would also run in Copilot
      if (!Object.keys(s).length) remove(local); else write(local, json(s));
    }
  }
  // the old setup's links in ~/.kiro/skills into <work>/skills/, which no longer exists: Kiro lists them but cannot read them
  const kiroSkills = join(home, '.kiro', 'skills');
  for (const e of existsSync(kiroSkills) ? readdirSync(kiroSkills, { withFileTypes: true }).filter((d) => d.isSymbolicLink()) : []) {
    const link = join(kiroSkills, e.name);
    const r = relative(work, realOf(resolve(kiroSkills, readlinkSync(link).replace(/^\\\\\?\\/, ''))));
    if (existsSync(link) || !r || r.startsWith('..') || isAbsolute(r)) continue;
    changes.push(`remove ${link}`);
    if (!dry) unlinkSync(link); // only the link; its target is already gone
  }
  if (vault) {
    const old = join(vault, '.claude');
    const rest = walk(old);
    if (rest.length && rest.every((f) => OLD_VAULT_CLAUDE.includes(f))) {
      for (const f of rest) backup(join(old, f), `vault-claude/${f}`);
      if (!dry) rmSync(old, { recursive: true, force: true });
    }
  }

  // 5. the device file: machine facts and the manifest; keys of the old setup are kept, so it can still be restored
  const nextDevice = {
    ...device, workRoot: work, ...(vault ? { vault } : {}), toolsFound: found, clis, projects,
    models: setup.deviceModels, mcpSynced: Object.keys(servers), manifest: next,
  };
  if (!vault) delete nextDevice.vault;
  write(deviceFile, json(nextDevice));

  const missing = Object.entries(clis).filter(([, v]) => !v).map(([k]) => k);
  log(`${dry ? 'dry run: ' : ''}${changes.length ? `${changes.length} changes` : 'nothing to change'}; tools: ${tools.join(', ') || 'none'}; vault: ${vault ?? 'none'}`);
  for (const c of changes) log(`  ${c}`);
  for (const w of warnings) log(`warning: ${w}`);
  if (missing.length) log(`not installed: ${missing.join(', ')} (skills that need them fall back or say so)`);
  if (changes.length && !dry) log('Start a new chat in each tool so it loads the new files; Claude Code asks once to approve the servers in .mcp.json.');
  return { changes, warnings, tools, vault };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--work' && args[i + 1]) opts.work = args[++i];
    else if (args[i] === '--vault' && args[i + 1]) opts.vault = resolve(args[++i]);
    else { console.error('usage: node install.mjs [--work <folder>] [--vault <folder>] [--dry-run]'); process.exit(1); }
  }
  try { install(opts); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
