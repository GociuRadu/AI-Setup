// Generates the Claude Code and Kiro setup from one source (AGENTS.md + _ai/).
//   node _ai/sync.mjs [home|work]   write .claude/ and .kiro/ (profile: remembered from the last run)
//   node _ai/sync.mjs --check       exit 1 when a generated file is missing, stale or extra, or a link is broken
// Source: _ai/agents (helpers get _core.md first), _ai/skills, _ai/rules (applyTo), _ai/tools/<tool>.md, _ai/profiles.
// Local, gitignored: CLAUDE.local.md, .claude/settings.local.json (permission mode; other keys kept), .kiro/steering/profile.md.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve, relative, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const walk = (d) => existsSync(join(ROOT, d))
  ? readdirSync(join(ROOT, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`])
  : [];
const note = (src) => `<!-- Generated from ${src} by node _ai/sync.mjs; edit the source. -->\n`;

// Generated trees; sync replaces them whole, --check flags extra files in them.
const MANAGED = ['.claude/agents', '.claude/skills', '.claude/rules', '.claude/settings.json', '.kiro/agents', '.kiro/skills', '.kiro/hooks', '.kiro/steering'];
const PROFILES = ['home', 'work'];
const MODELS = { claude: { haiku: 'haiku', sonnet: 'sonnet', opus: 'opus' }, kiro: { haiku: 'claude-haiku-5.5', sonnet: 'claude-sonnet-5.5', opus: 'claude-opus-5.5' } };
const TOOLS = {
  claude: { read: ['Read'], search: ['Grep', 'Glob'], web: ['WebSearch', 'WebFetch'], edit: ['Edit', 'Write'], execute: ['Bash', 'PowerShell'], skill: ['Skill'] },
  kiro: { read: ['read'], search: ['glob', 'grep'], web: ['web_search', 'web_fetch'], edit: ['write'], execute: ['shell'], agent: ['subagent'], skill: [] },
};

// frontmatter: `key: value`, "quoted" strings and [a, b] lists only
export function parse(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const v = kv[2].trim();
    meta[kv[1]] = v.startsWith('[') ? v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean)
      : v.startsWith('"') ? JSON.parse(v) : v;
  }
  return { meta, body: text.slice(m[0].length) };
}
const yaml = (meta) => `---\n${Object.entries(meta).map(([k, v]) => `${k}: ${/^[\w.-]+$/.test(v) ? v : JSON.stringify(v)}`).join('\n')}\n---\n`;

// Rewrites relative links from a source file so they resolve from its generated copy.
// Targets in _ai/agents or _ai/skills map to the same tree of the tool; _ai/rules maps to .claude/rules for Claude.
export function relink(text, src, dest, tool) {
  return text.replace(/\]\((?!https?:|mailto:|#|\/)([^)\s#]+)(#[^)\s]*)?\)/g, (all, link, hash = '') => {
    let target = posix.normalize(posix.join(posix.dirname(src), link));
    const mapped = { '_ai/agents/': `.${tool}/agents/`, '_ai/skills/': `.${tool}/skills/`, ...(tool === 'claude' ? { '_ai/rules/': '.claude/rules/' } : {}) };
    for (const [from, to] of Object.entries(mapped)) if (target.startsWith(from)) target = to + target.slice(from.length);
    return `](${posix.relative(posix.dirname(dest), target) || '.'}${hash})`;
  });
}

// blocks (exit 2) when guard.mjs cannot load: the guard fails closed
const GUARD = `node -e "import(require('url').pathToFileURL(require('path').resolve(process.env.CLAUDE_PROJECT_DIR||'','_ai/hooks/guard.mjs')).href).then(m=>m.run(),e=>{console.error('Blocked: the guard hook could not load ('+e.message+'). Fix _ai/hooks/guard.mjs.');process.exit(2)})"`;
// prompt hook: both tools add its stdout to the context, so the AGENTS.md language rule is repeated on every prompt
const LANG = `node -e "console.log('Reply in English, even if this message is in Romanian or another language.')"`;

function claudeSettings() {
  const sh = (p) => [`Bash(${p})`, `PowerShell(${p})`];
  const hostinger = ['vps', 'hosting', 'agency-hosting', 'dns', 'domains', 'wordpress', 'billing', 'reach'].flatMap((s) => [`mcp__hostinger-${s}__execute`, `mcp__hostinger-${s}__multi-execute`]);
  return {
    $schema: 'https://json.schemastore.org/claude-code-settings.json',
    model: 'sonnet',
    env: { CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '50', CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' },
    permissions: {
      allow: ['Read', 'Grep', 'Glob'],
      deny: [
        'Read(**/.env)', 'Read(**/*.env)', 'Edit(**/.env)', 'Edit(**/*.env)', 'Read(./personal/**)', 'Edit(./personal/**)',
        'Agent(general-purpose)', 'Agent(Explore)', 'Agent(Plan)',
        ...['git *push*--force*', 'git *push* -f*', 'docker volume rm *', 'docker volume prune*', 'docker system prune*',
          'docker*compose*down*-v*', 'docker*compose*prod*', 'ssh *', 'scp *', 'sftp *'].flatMap(sh),
        ...hostinger, 'mcp__hostinger-wordpress-sites__execute_site_tool', 'mcp__claude_ai_Atlassian_MCP__executeDestructive',
      ],
    },
    hooks: {
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: LANG }] }],
      PreToolUse: [{ matcher: 'Bash|PowerShell|Read|Edit|Write|NotebookEdit|Grep|Glob', hooks: [{ type: 'command', command: GUARD }] }],
    },
  };
}

const kiroHooks = {
  '.kiro/hooks/guard.json': { version: 'v1', hooks: [['shell', 'Guard shell commands', 'Blocks writing SQL, hard stops and secret reads'], ['read', 'Guard file reads', 'Blocks reading secret files and personal/'], ['write', 'Guard file writes', 'Blocks writing secret files and personal/']]
    .map(([matcher, name, what]) => ({ name, description: `${what} (_ai/hooks/guard.mjs).`, trigger: 'PreToolUse', matcher, action: { type: 'command', command: GUARD }, timeout: 10 })) },
  '.kiro/hooks/lang.json': { version: 'v1', hooks: [{ name: 'Reply in English', description: 'Adds a one-line reminder to reply in English to every prompt.', trigger: 'UserPromptSubmit', action: { type: 'command', command: LANG }, timeout: 10 }] },
};

// Every generated file as { path: text }.
export function build(profile) {
  const out = {};
  const core = read('_ai/agents/_core.md');
  const agents = walk('_ai/agents').filter((f) => f.endsWith('.md') && !f.endsWith('/_core.md'));
  for (const src of agents) {
    const { meta, body } = parse(read(src));
    const helper = meta.name !== 'orchestrator';
    const prompt = (helper ? `${core}\n` : '') + body;
    const tools = (tool) => [...new Set((meta.tools ?? []).flatMap((t) => {
      if (tool === 'claude' && t === 'agent') return [`Agent(${(meta.agents ?? []).join(', ')})`];
      if (!(t in TOOLS[tool])) throw new Error(`${src}: unknown tool ${t}`);
      return TOOLS[tool][t];
    }))];
    if (!MODELS.claude[meta.model]) throw new Error(`${src}: unknown model ${meta.model}`);
    const cdest = `.claude/agents/${meta.name}.md`;
    out[cdest] = yaml({ name: meta.name, description: meta.description, model: MODELS.claude[meta.model], ...(meta['reasoning-effort'] && { effort: meta['reasoning-effort'] }), tools: tools('claude').join(', '),
      // helpers get _core.md instead of AGENTS.md and CLAUDE.local.md: about 1,400 fewer words per helper start
      ...(helper && { omitClaudeMd: 'true' }) })
      + note(src) + relink(prompt, src, cdest, 'claude');
    const has = (t) => (meta.tools ?? []).includes(t);
    const kdest = `.kiro/agents/${meta.name}.json`;
    out[kdest] = JSON.stringify({
      name: meta.name, description: meta.description, model: MODELS.kiro[meta.model], tools: tools('kiro'),
      prompt: relink(prompt, src, kdest, 'kiro'),
      hooks: [['execute', 'shell'], ['read', 'read'], ['search', 'read'], ['edit', 'write']].filter(([t]) => has(t))
        .map(([, matcher]) => matcher).filter((m, i, a) => a.indexOf(m) === i)
        .map((matcher) => ({ name: `guard ${matcher}`, trigger: 'PreToolUse', matcher, action: { type: 'command', command: GUARD }, timeout: 10 })),
    }, null, 2) + '\n';
  }

  for (const src of walk('_ai/skills')) {
    const rel = src.slice('_ai/skills/'.length);
    for (const tool of ['claude', 'kiro']) {
      const dest = `.${tool}/skills/${rel}`;
      let text = relink(read(src), src, dest, tool);
      if (rel.endsWith('/SKILL.md')) {
        const { meta, body } = parse(text);
        if (meta.name !== rel.split('/')[0]) throw new Error(`${src}: name must be the folder name`);
        const hint = meta['argument-hint'];
        text = tool === 'claude'
          ? yaml({ name: meta.name, description: meta.description, ...(hint && { 'argument-hint': hint }) }) + note(src) + body
          : yaml({ name: meta.name, description: meta.description }) + note(src) + body + (hint ? `\nExpected input after the slash command: ${hint}\n` : '');
      }
      out[dest] = text;
    }
  }

  for (const src of walk('_ai/rules')) {
    const { meta, body } = parse(read(src));
    const name = src.split('/').pop();
    out[`.claude/rules/${name}`] = `---\npaths:\n  - ${JSON.stringify(meta.applyTo)}\n---\n${note(src)}${body}`;
    out[`.kiro/steering/${name}`] = `---\ninclusion: fileMatch\nfileMatchPattern: ${JSON.stringify(meta.applyTo)}\n---\n${note(src)}${body}`;
  }

  out['.claude/settings.json'] = JSON.stringify(claudeSettings(), null, 2) + '\n';
  for (const [f, v] of Object.entries(kiroHooks)) out[f] = JSON.stringify(v, null, 2) + '\n';
  out['.kiro/steering/kiro.md'] = `---\ninclusion: always\n---\n${note('_ai/tools/kiro.md')}${read('_ai/tools/kiro.md')}`;

  if (profile) {
    const body = read(`_ai/profiles/${profile}.md`);
    const mark = `<!-- profile: ${profile}. Generated by node _ai/sync.mjs from _ai/tools/claude-code.md and _ai/profiles/${profile}.md; edit those. -->\n`;
    out['CLAUDE.local.md'] = `${mark}@AGENTS.md\n\n${read('_ai/tools/claude-code.md')}\n${body}`;
    out['.kiro/steering/profile.md'] = `---\ninclusion: always\n---\n${mark}${body}`;
  }
  return out;
}

// Broken relative links in generated Markdown (targets must exist in the output or on disk).
export function brokenLinks(out) {
  const bad = [];
  for (const [f, text] of Object.entries(out)) {
    if (!/\.(md|json)$/.test(f)) continue;
    for (const m of text.matchAll(/\]\((?!https?:|mailto:|#|\/)([^)\s#]+)/g)) {
      const target = posix.normalize(posix.join(posix.dirname(f), m[1]));
      if (!(target in out) && !existsSync(join(ROOT, target))) bad.push(`${f} -> ${m[1]}`);
    }
  }
  return bad;
}

// `_ai/...` paths named in a source (AGENTS.md, README.md, _ai/**/*.md) that do not exist; a placeholder such as <name> ends the path
export function missingPaths(files = ['AGENTS.md', 'README.md', ...walk('_ai').filter((f) => f.endsWith('.md'))]) {
  const bad = [];
  for (const f of files) {
    for (const m of read(f).matchAll(/(?<![\w./-])_ai\/[\w./-]*/g)) {
      const p = m[0].replace(/\.+$/, '');
      if (!existsSync(join(ROOT, p))) bad.push(`${f} -> ${p}`);
    }
  }
  return [...new Set(bad)];
}

const savedProfile = () => {
  const f = join(ROOT, 'CLAUDE.local.md');
  return existsSync(f) ? /profile: (home|work)\b/.exec(readFileSync(f, 'utf8'))?.[1] : undefined;
};
const managedFiles = () => MANAGED.flatMap((p) => existsSync(join(ROOT, p)) && !p.endsWith('.json') ? walk(p) : existsSync(join(ROOT, p)) ? [p] : []);

function localSettings(profile) {
  const f = join(ROOT, '.claude/settings.local.json');
  let s = {};
  if (existsSync(f)) {
    try { s = JSON.parse(readFileSync(f, 'utf8')); }
    catch { throw new Error(`${f} is not valid JSON; fix or delete it, then run again`); }
  }
  // the shared settings allow only reads, so work asks; home adds the rest here
  const HOME_ALLOW = ['Edit', 'Write', 'NotebookEdit', 'Bash', 'PowerShell', 'WebFetch', 'WebSearch'];
  s.permissions ??= {};
  const allow = (s.permissions.allow ?? []).filter((r) => !HOME_ALLOW.includes(r));
  if (profile === 'home') { s.permissions.defaultMode = 'bypassPermissions'; s.permissions.allow = [...allow, ...HOME_ALLOW]; }
  else { delete s.permissions.defaultMode; s.permissions.allow = allow; }
  if (!s.permissions.allow.length) delete s.permissions.allow;
  return JSON.stringify(s, null, 2) + '\n';
}

function main(args) {
  const check = args.includes('--check');
  const profile = args.find((a) => PROFILES.includes(a)) ?? savedProfile();
  const unknown = args.filter((a) => a !== '--check' && !PROFILES.includes(a));
  if (unknown.length) { console.error('usage: node _ai/sync.mjs [home|work] [--check]'); return 1; }
  if (!profile && !check) { console.error('first run: name the profile, node _ai/sync.mjs home|work'); return 1; }
  const out = build(profile);
  const broken = [...brokenLinks(out).map((b) => `broken link: ${b}`), ...missingPaths().map((b) => `missing path: ${b}`)];

  if (check) {
    const problems = [
      ...Object.entries(out).filter(([f, t]) => !existsSync(join(ROOT, f)) || readFileSync(join(ROOT, f), 'utf8') !== t).map(([f]) => `stale or missing: ${f}`),
      ...managedFiles().filter((f) => !(f in out)).map((f) => `extra: ${f}`),
      ...broken,
    ];
    if (!profile) problems.push('no profile: run node _ai/sync.mjs home|work');
    console.log(problems.length ? `${problems.join('\n')}\nnot synced: run node _ai/sync.mjs` : 'in sync');
    return problems.length ? 1 : 0;
  }

  for (const p of MANAGED) rmSync(join(ROOT, p), { recursive: true, force: true });
  for (const [f, text] of Object.entries(out)) {
    mkdirSync(dirname(join(ROOT, f)), { recursive: true });
    writeFileSync(join(ROOT, f), text);
  }
  writeFileSync(join(ROOT, '.claude/settings.local.json'), localSettings(profile));
  if (broken.length) console.log(broken.join('\n'));
  console.log(`synced ${Object.keys(out).length} files, profile ${profile}. ${profile === 'home' ? 'Kiro: use Autopilot.' : 'Kiro: use Supervised. Claude Code: keep approvals on.'}`);
  return broken.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
