// Generates the Claude Code, Kiro and GitHub Copilot setup from one source (AGENTS.md + _ai/).
//   node _ai/sync.mjs [home|work] [--tools claude,kiro,copilot]   write the chosen tools' files (profile and tools: remembered in .ai-device.json)
//   node _ai/sync.mjs --check       exit 1 when a generated file is missing, stale or extra, or a link is broken
// Source: _ai/agents (all get _core.md first), _ai/skills, _ai/rules (applyTo), _ai/tools/<tool>.md, _ai/profiles.
// Local, gitignored: .ai-device.json (profile and tools of this device), CLAUDE.local.md, .claude/settings.local.json (permission mode; other keys kept), .kiro/steering/profile.md.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const walk = (d, base = ROOT) => existsSync(join(base, d))
  ? readdirSync(join(base, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`, base) : [`${d}/${e.name}`])
  : [];
const note = (src) => `<!-- Generated from ${src} by node _ai/sync.mjs; edit the source. -->\n`;

const TOOL_NAMES = ['claude', 'kiro', 'copilot'];
// Generated paths per tool; sync replaces them whole, --check flags extra files in them. Never .github itself: user files live there.
const MANAGED = {
  claude: ['.claude/agents', '.claude/skills', '.claude/rules', '.claude/settings.json', 'CLAUDE.local.md'],
  kiro: ['.kiro/agents', '.kiro/skills', '.kiro/hooks', '.kiro/steering'],
  copilot: ['.github/agents', '.github/skills', '.github/instructions', '.github/hooks/guard.json', '.github/copilot-instructions.md'],
};
const PROFILES = ['home', 'work'];
const MODELS = {
  claude: { haiku: 'haiku', sonnet: 'sonnet', opus: 'opus' },
  kiro: { haiku: 'claude-haiku-5.5', sonnet: 'claude-sonnet-5.5', opus: 'claude-opus-5.5' },
  copilot: { haiku: 'Claude Haiku 5.5 (copilot)', sonnet: 'Claude Sonnet 5.5 (copilot)', opus: 'Claude Opus 5.5 (copilot)' },
};
const TOOLS = {
  claude: { read: ['Read'], search: ['Grep', 'Glob'], web: ['WebSearch', 'WebFetch'], edit: ['Edit', 'Write'], execute: ['Bash', 'PowerShell'] },
  kiro: { read: ['read'], search: ['glob', 'grep'], web: ['web_search', 'web_fetch'], edit: ['write'], execute: ['shell'] },
  copilot: { read: ['read'], search: ['search'], web: ['web'], edit: ['edit'], execute: ['execute'] },
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
const yaml = (meta) => `---\n${Object.entries(meta).map(([k, v]) => `${k}: ${Array.isArray(v) || !/^[\w.-]+$/.test(v) ? JSON.stringify(v) : v}`).join('\n')}\n---\n`;

// Rewrites relative links from a source file so they resolve from its generated copy.
// Targets in _ai/agents or _ai/skills map to the same tree of the tool; _ai/rules maps to .claude/rules for Claude.
// Copilot renames agents and rules, so those stay pointing at the source; only skills map to .github/skills.
export function relink(text, src, dest, tool) {
  return text.replace(/\]\((?!https?:|mailto:|#|\/)([^)\s#]+)(#[^)\s]*)?\)/g, (all, link, hash = '') => {
    let target = posix.normalize(posix.join(posix.dirname(src), link));
    const mapped = tool === 'copilot' ? { '_ai/skills/': '.github/skills/' }
      : { '_ai/agents/': `.${tool}/agents/`, '_ai/skills/': `.${tool}/skills/`, ...(tool === 'claude' ? { '_ai/rules/': '.claude/rules/' } : {}) };
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
export function build(profile, tools = TOOL_NAMES) {
  const out = {};
  const on = (t) => tools.includes(t);
  const core = read('_ai/agents/_core.md');
  const agents = walk('_ai/agents').filter((f) => f.endsWith('.md') && !f.endsWith('/_core.md'));
  for (const src of agents) {
    const { meta, body } = parse(read(src));
    const prompt = `${core}\n${body}`;
    const toolList = (tool) => [...new Set((meta.tools ?? []).flatMap((t) => {
      if (!(t in TOOLS[tool])) throw new Error(`${src}: unknown tool ${t}`);
      return TOOLS[tool][t];
    }))];
    if (!MODELS.claude[meta.model]) throw new Error(`${src}: unknown model ${meta.model}`);
    const effort = meta['reasoning-effort'];
    if (on('claude')) {
      const cdest = `.claude/agents/${meta.name}.md`;
      out[cdest] = yaml({ name: meta.name, description: meta.description, model: MODELS.claude[meta.model], ...(effort && { effort }), tools: toolList('claude').join(', '),
        // agents get _core.md instead of AGENTS.md and CLAUDE.local.md: about 1,400 fewer words per agent start
        omitClaudeMd: 'true' })
        + note(src) + relink(prompt, src, cdest, 'claude');
    }
    if (on('kiro')) {
      const has = (t) => (meta.tools ?? []).includes(t);
      const kdest = `.kiro/agents/${meta.name}.json`;
      out[kdest] = JSON.stringify({
        name: meta.name, description: meta.description, model: MODELS.kiro[meta.model], tools: toolList('kiro'),
        prompt: relink(prompt, src, kdest, 'kiro'),
        hooks: [['execute', 'shell'], ['read', 'read'], ['search', 'read'], ['edit', 'write']].filter(([t]) => has(t))
          .map(([, matcher]) => matcher).filter((m, i, a) => a.indexOf(m) === i)
          .map((matcher) => ({ name: `guard ${matcher}`, trigger: 'PreToolUse', matcher, action: { type: 'command', command: GUARD }, timeout: 10 })),
      }, null, 2) + '\n';
    }
    if (on('copilot')) {
      const gdest = `.github/agents/${meta.name}.agent.md`;
      out[gdest] = yaml({ name: meta.name, description: meta.description, tools: toolList('copilot'), model: MODELS.copilot[meta.model], ...(effort && { 'reasoning-effort': effort }) })
        + note(src) + relink(prompt, src, gdest, 'copilot');
    }
  }

  for (const src of walk('_ai/skills')) {
    const rel = src.slice('_ai/skills/'.length);
    for (const tool of tools) {
      const dest = `${tool === 'copilot' ? '.github' : `.${tool}`}/skills/${rel}`;
      let text = relink(read(src), src, dest, tool);
      if (rel.endsWith('/SKILL.md')) {
        const { meta, body } = parse(text);
        if (meta.name !== rel.split('/')[0]) throw new Error(`${src}: name must be the folder name`);
        const hint = meta['argument-hint'];
        text = tool === 'kiro'
          ? yaml({ name: meta.name, description: meta.description }) + note(src) + body + (hint ? `\nExpected input after the slash command: ${hint}\n` : '')
          : yaml({ name: meta.name, description: meta.description, ...(hint && { 'argument-hint': hint }) }) + note(src) + body;
      }
      out[dest] = text;
    }
  }

  for (const src of walk('_ai/rules')) {
    const { meta, body } = parse(read(src));
    const name = src.split('/').pop();
    if (on('claude')) out[`.claude/rules/${name}`] = `---\npaths:\n  - ${JSON.stringify(meta.applyTo)}\n---\n${note(src)}${body}`;
    if (on('kiro')) out[`.kiro/steering/${name}`] = `---\ninclusion: fileMatch\nfileMatchPattern: ${JSON.stringify(meta.applyTo)}\n---\n${note(src)}${body}`;
    if (on('copilot')) out[`.github/instructions/${name.replace(/\.md$/, '.instructions.md')}`] = `---\napplyTo: ${JSON.stringify(meta.applyTo)}\n---\n${note(src)}${body}`;
  }

  if (on('claude')) out['.claude/settings.json'] = JSON.stringify(claudeSettings(), null, 2) + '\n';
  if (on('kiro')) {
    for (const [f, v] of Object.entries(kiroHooks)) out[f] = JSON.stringify(v, null, 2) + '\n';
    out['.kiro/steering/kiro.md'] = `---\ninclusion: always\n---\n${note('_ai/tools/kiro.md')}${read('_ai/tools/kiro.md')}`;
  }
  if (on('copilot')) {
    out['.github/hooks/guard.json'] = JSON.stringify({ hooks: { PreToolUse: [{ type: 'command', command: GUARD, timeout: 10 }] } }, null, 2) + '\n';
    out['.github/copilot-instructions.md'] = note('_ai/tools/copilot.md') + read('_ai/tools/copilot.md');
  }

  if (profile) {
    const body = read(`_ai/profiles/${profile}.md`);
    const mark = (tool) => `<!-- profile: ${profile}. Generated by node _ai/sync.mjs from _ai/tools/${tool}.md and _ai/profiles/${profile}.md; edit those. -->\n`;
    if (on('claude')) out['CLAUDE.local.md'] = `${mark('claude-code')}@AGENTS.md\n\n${read('_ai/tools/claude-code.md')}\n${body}`;
    if (on('kiro')) out['.kiro/steering/profile.md'] = `---\ninclusion: always\n---\n${mark('claude-code')}${body}`;
    if (on('copilot')) out['.github/copilot-instructions.md'] += `\n${mark('copilot')}${body}`;
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

const MANAGED_ALL = Object.values(MANAGED).flat();
const managedFiles = (dir) => MANAGED_ALL.flatMap((p) => !existsSync(join(dir, p)) ? [] : statSync(join(dir, p)).isDirectory() ? walk(p, dir) : [p]);

// <dir>/.ai-device.json: the profile and tools of this device; a pre-tools device is read from the CLAUDE.local.md mark
function savedDevice(dir) {
  const f = join(dir, '.ai-device.json');
  if (existsSync(f)) {
    let d;
    try { d = JSON.parse(readFileSync(f, 'utf8')); }
    catch { throw new Error(`${f} is not valid JSON; fix or delete it, then run again`); }
    if (!PROFILES.includes(d?.profile) || !Array.isArray(d.tools) || !d.tools.length || !d.tools.every((t) => TOOL_NAMES.includes(t))) {
      throw new Error(`${f}: profile must be home|work and tools a list of claude, kiro, copilot`);
    }
    return d;
  }
  const old = join(dir, 'CLAUDE.local.md');
  const profile = existsSync(old) ? /profile: (home|work)\b/.exec(readFileSync(old, 'utf8'))?.[1] : undefined;
  return profile ? { profile, tools: ['claude', 'kiro'] } : {};
}

function localSettings(profile, dir) {
  const f = join(dir, '.claude/settings.local.json');
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

export function main(args, dir = ROOT) {
  const usage = 'usage: node _ai/sync.mjs [home|work] [--tools claude,kiro,copilot] [--check]';
  let check = false, argProfile, argTools;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--check') check = true;
    else if (PROFILES.includes(a)) argProfile = a;
    else if (a === '--tools' && i + 1 < args.length) {
      argTools = [...new Set(args[++i].split(',').map((t) => t.trim()))];
      if (!argTools.every((t) => TOOL_NAMES.includes(t))) { console.error(usage); return 1; }
    } else { console.error(usage); return 1; }
  }
  const saved = savedDevice(dir);
  const profile = argProfile ?? saved.profile;
  const tools = argTools ?? saved.tools;
  if (!profile || !tools) {
    if (check) console.log('no device settings: run node _ai/sync.mjs home|work --tools <list>');
    else console.error('first run: node _ai/sync.mjs home|work --tools claude,kiro,copilot');
    return 1;
  }
  const out = build(profile, tools);
  const broken = [...brokenLinks(out).map((b) => `broken link: ${b}`), ...missingPaths().map((b) => `missing path: ${b}`)];
  const localFile = '.claude/settings.local.json';

  if (check) {
    const problems = [
      ...Object.entries(out).filter(([f, t]) => !existsSync(join(dir, f)) || readFileSync(join(dir, f), 'utf8') !== t).map(([f]) => `stale or missing: ${f}`),
      ...managedFiles(dir).filter((f) => !(f in out)).map((f) => `extra: ${f}`),
      ...(!tools.includes('claude') && existsSync(join(dir, localFile)) ? [`extra: ${localFile}`] : []),
      ...broken,
    ];
    console.log(problems.length ? `${problems.join('\n')}\nnot synced: run node _ai/sync.mjs` : 'in sync');
    return problems.length ? 1 : 0;
  }

  writeFileSync(join(dir, '.ai-device.json'), JSON.stringify({ profile, tools }, null, 2) + '\n');
  for (const p of MANAGED_ALL) rmSync(join(dir, p), { recursive: true, force: true });
  for (const [f, text] of Object.entries(out)) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), text);
  }
  if (tools.includes('claude')) {
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, localFile), localSettings(profile, dir));
  } else rmSync(join(dir, localFile), { force: true });
  const hints = profile === 'home' ? { kiro: 'Kiro: use Autopilot.' }
    : { kiro: 'Kiro: use Supervised.', claude: 'Claude Code: keep approvals on.', copilot: 'Copilot: keep approvals on.' };
  if (broken.length) console.log(broken.join('\n'));
  console.log([`synced ${Object.keys(out).length} files, profile ${profile}, tools ${tools.join(',')}.`, ...tools.map((t) => hints[t]).filter(Boolean)].join(' '));
  return broken.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
