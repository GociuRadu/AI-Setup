// Generates the Claude Code, Kiro and GitHub Copilot setup from one source (AGENTS.md + _ai/).
//   node _ai/sync.mjs [home|work] [--tools claude,kiro,copilot]   write the chosen tools' files (profile and tools: remembered in .ai-device.json)
//   node _ai/sync.mjs --check       exit 1 when a generated file is missing, stale or extra, or a link is broken
// A source's `sections: [...]` frontmatter copies those `## ` sections of AGENTS.md into its output, for readers that do not load AGENTS.md.
// .claude/settings.local.json is local: sync sets the permission mode and keeps its other keys.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, resolve, posix } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const walk = (d, base = ROOT) => existsSync(join(base, d))
  ? readdirSync(join(base, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`, base) : [`${d}/${e.name}`])
  : [];
const note = (src) => `<!-- Generated from ${src} by node _ai/sync.mjs; edit the source. -->\n`;

const TOOL_NAMES = ['claude', 'kiro', 'copilot'];
const CLAUDE_ISOLATION = ['worktree'];
const CLAUDE_MEMORY = ['user', 'project', 'local'];
// Generated paths per tool; sync replaces them whole, --check flags extra files in them. Never .github itself: user files live there.
const MANAGED = {
  claude: ['.claude/agents', '.claude/skills', '.claude/rules', '.claude/settings.json', 'CLAUDE.local.md'],
  kiro: ['.kiro/agents', '.kiro/skills', '.kiro/hooks', '.kiro/steering'],
  copilot: ['.github/agents', '.github/skills', '.github/instructions', '.github/hooks/guard.json', '.github/copilot-instructions.md'],
};
const PROFILES = ['home', 'work'];
const TIERS = ['fast', 'balanced', 'deep'];
const TOOLS = {
  claude: { read: ['Read'], search: ['Grep', 'Glob'], web: ['WebSearch', 'WebFetch'], edit: ['Edit', 'Write'], execute: ['Bash', 'PowerShell'] },
  kiro: { read: ['read'], search: ['glob', 'grep'], web: ['web_search', 'web_fetch'], edit: ['write'], execute: ['shell'] },
  copilot: { read: ['read'], search: ['search'], web: ['web'], edit: ['edit'], execute: ['execute'] },
};

function mergeModels(base, override) {
  const out = {};
  for (const t of TOOL_NAMES) {
    const b = base?.[t] ?? {}, o = override?.[t] ?? {};
    out[t] = {
      tiers: { ...b.tiers, ...o.tiers },
      agents: { ...b.agents, ...o.agents },
      ...((o.default ?? b.default) && { default: o.default ?? b.default }),
      ...((o.subagentDefault ?? b.subagentDefault) && { subagentDefault: o.subagentDefault ?? b.subagentDefault }),
    };
  }
  return out;
}

// Loads per-tool model profiles from _ai/models.json and merges optional local overrides (e.g. from .ai-device.json).
export function loadModels(override) {
  let base;
  try { base = JSON.parse(read('_ai/models.json')); }
  catch { throw new Error('_ai/models.json is not valid JSON'); }
  const merged = mergeModels(base, override);
  for (const t of TOOL_NAMES) {
    for (const tier of TIERS) {
      if (typeof merged[t].tiers[tier] !== 'string' || !merged[t].tiers[tier].trim()) {
        throw new Error(`_ai/models.json: ${t}.tiers.${tier} must be a non-empty string`);
      }
    }
    for (const [agent, val] of Object.entries(merged[t].agents)) {
      if (typeof val !== 'string' || !val.trim()) throw new Error(`_ai/models.json: ${t}.agents.${agent} must be a non-empty string`);
    }
  }
  return merged;
}

// Resolves a tier name (fast|balanced|deep) or literal model ID for one tool, honoring per-agent overrides.
export function resolveModel(models, tool, tier, agentName, src = '_ai/models.json') {
  const cfg = models[tool];
  const raw = agentName && cfg.agents?.[agentName] ? cfg.agents[agentName] : tier;
  if (raw in cfg.tiers) return cfg.tiers[raw];
  if (agentName && cfg.agents?.[agentName]) return raw;
  throw new Error(`${src}: unknown model tier ${tier} (expected ${TIERS.join(', ')})`);
}

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
// The named `## ` sections of AGENTS.md, in the order given; an unknown name throws so a renamed section cannot drop rules.
export function sections(names = [], src) {
  const all = read('AGENTS.md').split(/^(?=## )/m);
  return names.map((n) => {
    const s = all.find((p) => p.startsWith(`## ${n}\n`));
    if (!s) throw new Error(`${src}: AGENTS.md has no section "${n}"`);
    return s.trimEnd() + '\n';
  }).join('\n');
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

function claudeSettings(models) {
  const sh = (p) => [`Bash(${p})`, `PowerShell(${p})`];
  const hostinger = ['vps', 'hosting', 'agency-hosting', 'dns', 'domains', 'wordpress', 'billing', 'reach'].flatMap((s) => [`mcp__hostinger-${s}__execute`, `mcp__hostinger-${s}__multi-execute`]);
  const c = models.claude;
  const pick = (v, fallback) => (v && v in c.tiers ? c.tiers[v] : v || c.tiers[fallback]);
  return {
    $schema: 'https://json.schemastore.org/claude-code-settings.json',
    model: pick(c.default, 'balanced'),
    env: { CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '60', CLAUDE_CODE_SUBAGENT_MODEL: pick(c.subagentDefault, 'fast') },
    permissions: {
      allow: ['Read', 'Grep', 'Glob'],
      deny: [
        'Read(**/.env)', 'Read(**/.env.*)', 'Read(**/*.env)', 'Edit(**/.env)', 'Edit(**/.env.*)', 'Edit(**/*.env)',
        'Read(./personal/**)', 'Edit(./personal/**)', 'Read(**/personal/**)', 'Edit(**/personal/**)',
        'Agent(general-purpose)', 'Agent(Explore)', 'Agent(Plan)',
        ...['git *push*--force*', 'git *push* -f*', 'docker volume rm *', 'docker volume prune*', 'docker system prune*',
          'docker*compose*down*-v*', 'docker*compose*prod*', 'ssh *', 'scp *', 'sftp *'].flatMap(sh),
        ...hostinger, 'mcp__hostinger-wordpress-sites__execute_site_tool', 'mcp__claude_ai_Atlassian_MCP__executeDestructive',
      ],
    },
    hooks: {
      UserPromptSubmit: [{
        hooks: [{
          type: 'command',
          command: 'node',
          args: ['${CLAUDE_PROJECT_DIR}/_ai/hooks/lang.mjs'],
          timeout: 10,
        }],
      }],
      PreToolUse: [{
        matcher: 'Bash|PowerShell|Read|Edit|Write|NotebookEdit|Grep|Glob',
        hooks: [{
          type: 'command',
          command: 'node',
          args: ['${CLAUDE_PROJECT_DIR}/_ai/hooks/run-guard.mjs'],
          onFailure: 'block',
          timeout: 10,
        }],
      }],
    },
  };
}

const kiroHooks = {
  // no `matcher`: Kiro then matches every PreToolUse event (shell, read, grep, glob, write, subagent, mcp)
  '.kiro/hooks/guard.json': { version: 'v1', hooks: [{ name: 'Guard tool calls', description: 'Blocks hard stops, writing SQL, secret files and personal/; asks on deletes, Git writes, external CLI and mutating MCP (_ai/hooks/guard.mjs).', trigger: 'PreToolUse', action: { type: 'command', command: 'node _ai/hooks/run-guard.mjs' }, timeout: 10 }] },
  '.kiro/hooks/lang.json': { version: 'v1', hooks: [{ name: 'Reply in English', description: 'Adds a one-line reminder to reply in English to every prompt.', trigger: 'UserPromptSubmit', action: { type: 'command', command: 'node _ai/hooks/lang.mjs' }, timeout: 10 }] },
};

export function claudeAgentMeta(meta, tools, src, models = loadModels()) {
  const effort = meta['reasoning-effort'];
  if (meta.isolation && !CLAUDE_ISOLATION.includes(meta.isolation)) throw new Error(`${src}: unknown isolation ${meta.isolation}`);
  if (meta.memory && !CLAUDE_MEMORY.includes(meta.memory)) throw new Error(`${src}: unknown memory ${meta.memory}`);
  return {
    name: meta.name, description: meta.description, model: resolveModel(models, 'claude', meta.model, meta.name, src),
    ...(effort && { effort }),
    ...(meta.isolation && { isolation: meta.isolation }),
    ...(meta.memory && { memory: meta.memory }),
    tools: tools.join(', '),
    // helpers get _core.md and their `sections:` of AGENTS.md, not all of AGENTS.md and CLAUDE.local.md
    omitClaudeMd: 'true',
  };
}

// Every generated file as { path: text }.
export function build(profile, tools = TOOL_NAMES, modelOverrides) {
  const out = {};
  const on = (t) => tools.includes(t);
  const models = loadModels(modelOverrides);
  const core = read('_ai/agents/_core.md');
  const agents = walk('_ai/agents').filter((f) => f.endsWith('.md') && !f.endsWith('/_core.md'));
  for (const src of agents) {
    const { meta, body } = parse(read(src));
    const shared = sections(meta.sections, src);
    const from = meta.sections ? `${src} and AGENTS.md` : src;
    const prompt = (dest, tool) => relink(`${core}\n${body.trimEnd()}\n`, src, dest, tool) + (shared && `\n${relink(shared, 'AGENTS.md', dest, tool)}`);
    const toolList = (tool) => [...new Set((meta.tools ?? []).flatMap((t) => {
      if (!(t in TOOLS[tool])) throw new Error(`${src}: unknown tool ${t}`);
      return TOOLS[tool][t];
    }))];
    if (!TIERS.includes(meta.model)) throw new Error(`${src}: unknown model ${meta.model}`);
    const effort = meta['reasoning-effort'];
    if (on('claude')) {
      const cdest = `.claude/agents/${meta.name}.md`;
      out[cdest] = yaml(claudeAgentMeta(meta, toolList('claude'), src, models)) + note(from) + prompt(cdest, 'claude');
    }
    if (on('kiro')) {
      const kdest = `.kiro/agents/${meta.name}.json`;
      out[kdest] = JSON.stringify({
        name: meta.name, description: meta.description, model: resolveModel(models, 'kiro', meta.model, meta.name, src), tools: toolList('kiro'),
        prompt: prompt(kdest, 'kiro'),
        hooks: [{ name: 'guard', trigger: 'PreToolUse', action: { type: 'command', command: 'node _ai/hooks/run-guard.mjs' }, timeout: 10 }],
      }, null, 2) + '\n';
    }
    if (on('copilot')) {
      const gdest = `.github/agents/${meta.name}.agent.md`;
      out[gdest] = yaml({ name: meta.name, description: meta.description, tools: toolList('copilot'), model: resolveModel(models, 'copilot', meta.model, meta.name, src), ...(effort && { 'reasoning-effort': effort }) })
        + note(from) + prompt(gdest, 'copilot');
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

  if (on('claude')) out['.claude/settings.json'] = JSON.stringify(claudeSettings(models), null, 2) + '\n';
  if (on('kiro')) {
    for (const [f, v] of Object.entries(kiroHooks)) out[f] = JSON.stringify(v, null, 2) + '\n';
    out['.kiro/steering/kiro.md'] = `---\ninclusion: always\n---\n${note('_ai/tools/kiro.md')}${read('_ai/tools/kiro.md')}`;
  }
  if (on('copilot')) {
    // no quotes in the commands: Windows PowerShell -Command turns exit 2 into 1 unless `exit $LASTEXITCODE` follows
    out['.github/hooks/guard.json'] = JSON.stringify({
      hooks: {
        // --allow lets the guard auto-confirm safe calls; it still answers ask on sensitive ones and exits 2 on hard stops
        PreToolUse: [{ type: 'command', command: 'node _ai/hooks/run-guard.mjs --allow', windows: 'node _ai/hooks/run-guard.mjs --allow; exit $LASTEXITCODE', cwd: '.', timeout: 10 }],
        UserPromptSubmit: [{ type: 'command', command: 'node _ai/hooks/lang.mjs --json', cwd: '.', timeout: 10 }],
      },
    }, null, 2) + '\n';
    const src = '_ai/tools/copilot.md', dest = '.github/copilot-instructions.md';
    const { meta, body } = parse(read(src));
    out[dest] = note(`${src} and AGENTS.md`) + body + `\n${relink(sections(meta.sections, src), 'AGENTS.md', dest, 'copilot')}`;
  }

  if (profile) {
    const p = `_ai/profiles/${profile}.md`, body = read(p);
    const mark = (...srcs) => `<!-- profile: ${profile}. Generated by node _ai/sync.mjs from ${srcs.join(' and ')}; edit those. -->\n`;
    if (on('claude')) out['CLAUDE.local.md'] = `${mark('_ai/tools/claude-code.md', p)}@AGENTS.md\n\n${read('_ai/tools/claude-code.md')}\n${body}`;
    if (on('kiro')) out['.kiro/steering/profile.md'] = `---\ninclusion: always\n---\n${mark(p)}${body}`;
    if (on('copilot')) out['.github/copilot-instructions.md'] += `\n${mark(p)}${body}`;
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

const MANAGED_VSCODE = {
  'chat.useAgentsMdFile': true,
  'chat.useHooks': true,
  'chat.agent.maxRequests': 250,
  'chat.tools.terminal.autoApprove': {
    '/.*/': true,
    '/(^|[\\s;|&(])(rm|del|erase|rmdir|rd|ri|Remove-Item|Clear-Content|Clear-Item)(\\s|$)/i': false,
    '/(^|[\\s;|&(])git\\s+(?!(-C\\s+\\S+\\s+|--no-pager\\s+|-c\\s+\\S+\\s+)*(status|log|diff|show|ls-files|blame|rev-parse|grep|remote\\s+-v|branch\\s+(--show-current|-a|-r|--list)|--version|merge-base|stash\\s+list|config\\s+(--get|--list)|describe|shortlog)\\b)/i': false,
    '/(^|[\\s;|&(])(az|gh|curl(\\.exe)?|wget|Invoke-RestMethod|Invoke-WebRequest|irm|iwr|kubectl|helm|terraform)\\s/i': false,
  },
  'chat.tools.urls.autoApprove': { 'https://*': true },
  'chat.tools.edits.autoApprove': { '**/*': true, '**/.env': false, '**/.env.*': false, '**/*.env': false, 'personal/**': false },
  'github.copilot.chat.executionSubagent.enabled': false,
  'github.copilot.chat.searchSubagent.enabled': false,
  'github.copilot.chat.cli.customAgents.enabled': true,
  'kiroAgent.agentAutonomy': 'Autopilot',
};

// .vscode/settings.json with our managed keys set and the user's other keys kept
export function vscodeSettings(dir) {
  const f = join(dir, '.vscode/settings.json');
  let s = {};
  if (existsSync(f)) {
    try { s = JSON.parse(readFileSync(f, 'utf8')); }
    catch { throw new Error(`${f} is not valid JSON; fix or delete it, then run again`); }
  }
  return JSON.stringify({ ...s, ...MANAGED_VSCODE }, null, 2) + '\n';
}

export function kiroWorkspacePermissionsPath(dir, home = homedir()) {
  const p = resolve(dir).replace(/\\/g, '/').replace(/\/+$/, '');
  const hash = createHash('sha256').update(process.platform === 'win32' ? p.toLowerCase() : p).digest('hex').slice(0, 16);
  return join(home, '.kiro', 'workspace-roots', hash, 'permissions.yaml');
}

const KIRO_BEGIN = '# >>> generated by node _ai/sync.mjs; add your own rules outside this block';
const KIRO_END = '# <<< generated by node _ai/sync.mjs';

function kiroRules() {
  const cases = (w) => [...new Set([w, w.toLowerCase(), w[0].toUpperCase() + w.slice(1).toLowerCase()])];
  const ask = (words) => ({ capability: 'shell', match: words.flatMap((w) => cases(w).map((c) => `${c} *`)), effect: 'ask' });
  const reads = ['status', 'log', 'diff', 'show', 'ls-files', 'blame', 'rev-parse', 'grep', 'remote -v', 'branch --show-current', 'branch -a', 'branch -r', 'branch --list',
    '--version', 'merge-base', 'stash list', 'config --get', 'config --list', 'describe', 'shortlog'];
  const gits = ['git', 'Git', 'GIT'];
  const writes = ['add', 'am', 'apply', 'branch', 'checkout', 'cherry-pick', 'clean', 'clone', 'commit', 'config', 'fetch', 'init', 'merge', 'mv', 'pull', 'push', 'rebase',
    'reset', 'restore', 'revert', 'rm', 'stash', 'submodule', 'switch', 'tag', 'worktree', 'gc', 'update-ref', 'reflog', 'notes', 'bisect', 'prune', 'sparse-checkout', 'symbolic-ref'];
  const mcp = ['create', 'update', 'delete', 'remove', 'add', 'edit', 'transition', 'comment', 'send', 'post', 'put', 'patch', 'register', 'rename', 'restore', 'set_', 'log_', 'link_', 'evaluate', 'write', 'execute', 'apply', 'upload', 'insert', 'merge', 'push', 'deploy'].flatMap((w) => [`*${w}*`, `*${w[0].toUpperCase() + w.slice(1)}*`]);
  return [
    { capability: 'all', effect: 'allow' },
    { capability: 'filesystem', match: ['**'], effect: 'allow' },
    ask(['rm', 'del', 'erase', 'rmdir', 'rd', 'ri', 'Remove-Item', 'az', 'gh', 'curl', 'curl.exe', 'wget', 'Invoke-RestMethod', 'Invoke-WebRequest', 'irm', 'iwr', 'kubectl', 'helm', 'terraform']),
    { capability: 'shell', match: gits.map((g) => `${g} *`), exclude: gits.flatMap((g) => reads.flatMap((r) => g === 'git' ? [`git ${r}*`, `git -C * ${r}*`, `git --no-pager ${r}*`] : [`${g} ${r}*`])), effect: 'ask' },
    { capability: 'shell', match: writes.map((w) => `git -C * ${w}*`), effect: 'ask' },
    { capability: 'mcp', match: mcp, effect: 'ask' },
    { capability: 'filesystem', match: ['**/.env', '**/.env.*', '**/*.env', 'personal/**'], exclude: ['**/*.example', '**/*.sample', '**/*.template', '**/*.dist'], effect: 'deny' },
  ];
}

// Writes the generated block of the Kiro workspace permissions, keeping any rules outside it.
export function syncKiroPermissions(dir, home = homedir()) {
  const f = kiroWorkspacePermissionsPath(dir, home);
  const block = [`  ${KIRO_BEGIN}`, ...kiroRules().map((r) => `  - ${JSON.stringify(r)}`), `  ${KIRO_END}`].join('\n');
  let text = existsSync(f) ? readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : '';
  const start = text.indexOf(KIRO_BEGIN), end = text.indexOf(KIRO_END);
  if (start >= 0 && end > start) {
    const from = text.lastIndexOf('\n', start) + 1;
    text = text.slice(0, from) + block + text.slice(end + KIRO_END.length);
  } else if (/^rules:[ \t]*$/m.test(text)) text = text.replace(/^rules:[ \t]*$/m, () => `rules:\n${block}`);
  else text = `${text}${text && !text.endsWith('\n') ? '\n' : ''}rules:\n${block}\n`;
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, text);
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
  const out = build(profile, tools, saved.models);
  const broken = [...brokenLinks(out).map((b) => `broken link: ${b}`), ...missingPaths().map((b) => `missing path: ${b}`)];
  const localFile = '.claude/settings.local.json';
  if (tools.includes('claude') && tools.includes('copilot')) {
    console.warn('warning: claude and copilot are both enabled; Copilot also reads .claude/ hooks and agents, which can double-fire hooks.');
  }

  if (check) {
    const problems = [
      ...Object.entries(out).filter(([f, t]) => !existsSync(join(dir, f)) || readFileSync(join(dir, f), 'utf8') !== t).map(([f]) => `stale or missing: ${f}`),
      ...managedFiles(dir).filter((f) => !(f in out)).map((f) => `extra: ${f}`),
      ...(!tools.includes('claude') && existsSync(join(dir, localFile)) ? [`extra: ${localFile}`] : []),
      ...(tools.includes('copilot') && (!existsSync(join(dir, '.vscode/settings.json'))
        || readFileSync(join(dir, '.vscode/settings.json'), 'utf8').replace(/\r\n/g, '\n') !== vscodeSettings(dir)) ? ['stale or missing: .vscode/settings.json'] : []),
      ...broken,
    ];
    console.log(problems.length ? `${problems.join('\n')}\nnot synced: run node _ai/sync.mjs` : 'in sync');
    return problems.length ? 1 : 0;
  }

  writeFileSync(join(dir, '.ai-device.json'), JSON.stringify({ profile, tools, ...(saved.models && { models: saved.models }) }, null, 2) + '\n');
  for (const p of MANAGED_ALL) rmSync(join(dir, p), { recursive: true, force: true });
  for (const [f, text] of Object.entries(out)) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), text);
  }
  if (tools.includes('claude')) {
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, localFile), localSettings(profile, dir));
  } else rmSync(join(dir, localFile), { force: true });
  if (tools.includes('copilot')) {
    mkdirSync(join(dir, '.vscode'), { recursive: true });
    writeFileSync(join(dir, '.vscode/settings.json'), vscodeSettings(dir));
  }
  if (tools.includes('kiro') && dir === ROOT && existsSync(join(homedir(), '.kiro'))) syncKiroPermissions(dir);
  const hints = profile === 'home' ? { kiro: 'Kiro: use Autopilot.' }
    : { kiro: 'Kiro: Autopilot + guard hook.', claude: 'Claude Code: keep approvals on.', copilot: 'Copilot: hooks + auto-approve synced.' };
  if (broken.length) console.log(broken.join('\n'));
  console.log([`synced ${Object.keys(out).length} files, profile ${profile}, tools ${tools.join(',')}.`, ...tools.map((t) => hints[t]).filter(Boolean)].join(' '));
  return broken.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
