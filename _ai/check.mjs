// Self-check of the AI setup. Run after every change to it: node _ai/check.mjs [--fix]
// Checks skill and agent headers, the helper core in each agent, the files generated from .claude/ (Kiro skills, agents
// and rules; Copilot agents), relative links and anchors, JSON files, template placeholders and the guard hook tests.
// --fix rewrites the generated files.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = process.argv.includes('--fix');
const errors = [];
const fixed = [];
const p = (...a) => join(ROOT, ...a);
const read = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const rel = (f) => relative(ROOT, f).replace(/\\/g, '/');
const walk = (d) => existsSync(d) ? readdirSync(d).flatMap((n) => statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]) : [];
const dirs = (d) => existsSync(d) ? readdirSync(d).filter((n) => statSync(join(d, n)).isDirectory()) : [];

// frontmatter values as written (raw) and parsed; descriptions are YAML double-quoted strings
function header(file) {
  const m = read(file).match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const raw = Object.fromEntries(m[1].split('\n').map((l) => l.match(/^([\w-]+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2]]));
  const val = (v) => (v?.startsWith('"') ? JSON.parse(v) : v);
  return { raw, get: (k) => val(raw[k]) };
}
function expect(file, text, what) {
  if (existsSync(file) && read(file) === text) return;
  if (FIX) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); fixed.push(rel(file)); }
  else errors.push(`${rel(file)}: ${existsSync(file) ? 'out of date' : 'missing'} (${what}); run node _ai/check.mjs --fix`);
}
function orphans(dir, keep, isDir) {
  for (const n of existsSync(dir) ? readdirSync(dir) : []) {
    const name = isDir ? n : n.replace(/\.json$/, '');
    if (keep.includes(name)) continue;
    if (FIX) { rmSync(join(dir, n), { recursive: true, force: true }); fixed.push(`removed ${rel(join(dir, n))}`); }
    else errors.push(`${rel(join(dir, n))}: no matching source in .claude/; run node _ai/check.mjs --fix`);
  }
}

// 1. skills: .claude/skills/<name>/SKILL.md is the source; .kiro/skills/<name>/SKILL.md loads it
const skills = dirs(p('.claude/skills'));
for (const s of skills) {
  const f = p('.claude/skills', s, 'SKILL.md');
  const h = existsSync(f) && header(f);
  if (!h) { errors.push(`.claude/skills/${s}/SKILL.md: missing or no frontmatter`); continue; }
  if (h.get('name') !== s) errors.push(`.claude/skills/${s}/SKILL.md: name must be "${s}"`);
  const desc = h.get('description') ?? '';
  if (!desc || desc.length > 1024) errors.push(`.claude/skills/${s}/SKILL.md: description missing or over 1024 characters`);
  const hint = h.get('argument-hint');
  expect(p('.kiro/skills', s, 'SKILL.md'), `---\nname: ${s}\ndescription: ${h.raw.description}\n---\n# ${s}\n\n` +
    `Read \`.claude/skills/${s}/SKILL.md\` in full now and follow it exactly; it is the single source shared with Claude Code and Copilot. ` +
    `Relative links in it resolve from \`.claude/skills/${s}/\`; read linked files only when its steps say so.\n` +
    (hint ? `\nExpected input after the slash command: ${hint}\n` : ''), 'Kiro skill wrapper');
}
orphans(p('.kiro/skills'), skills, true);

// The one guard command for every hook wiring. It fails closed: a missing or broken guard.mjs blocks (exit 2).
// Only double quotes outside, so cmd, PowerShell and bash pass it unchanged; Claude Code sets CLAUDE_PROJECT_DIR, the others run from the root.
export const GUARD_CMD = `node -e "import(require('url').pathToFileURL(require('path').resolve(process.env.CLAUDE_PROJECT_DIR||'','_ai/hooks/guard.mjs')).href).then(m=>m.run(),e=>{console.error('Blocked: the guard hook could not load ('+e.message+'). Fix _ai/hooks/guard.mjs.');process.exit(2)})"`;

// 2. agents: .claude/agents/<name>.md is the source; .kiro/agents/<name>.json uses it as the prompt and
// .github/agents/<name>.agent.md is a copy with Copilot model IDs and tool aliases (Copilot prefers .github/agents).
// Every source starts with the helper core from _ai/helper-core.md and sets omitClaudeMd: Copilot starts custom
// subagents without AGENTS.md, so the core gives all helpers the same safety rules and Claude Code skips the full set.
const MODELS = { haiku: 'claude-haiku-5.5', sonnet: 'claude-sonnet-5.5', opus: 'claude-opus-5.5' };
const TOOLS = { Read: 'read', Grep: 'read', Glob: 'read', Edit: 'write', Write: 'write', Bash: 'shell', PowerShell: 'shell', WebSearch: 'web', WebFetch: 'web' };
const COPILOT_TOOLS = { Read: 'read', Grep: 'search', Glob: 'search', Edit: 'edit', Write: 'edit', Bash: 'execute', PowerShell: 'execute', WebSearch: 'web', WebFetch: 'web' };
const CORE_START = '<!-- helper core: generated from _ai/helper-core.md by node _ai/check.mjs --fix -->\n';
const CORE_END = '<!-- /helper core -->\n';
const CORE = CORE_START + read(p('_ai/helper-core.md')) + CORE_END;
const AGENT_GEN = '<!-- Generated from .claude/agents/';
// tags for the IDE and CLI V3, plus the tool names Kiro CLI 2.x needs (a `web` tag alone gives no web tools there)
const KIRO_TOOLS = { read: ['read', 'glob', 'grep'], write: ['write'], shell: ['shell'], web: ['web', 'web_search', 'web_fetch'] };
const agents = walk(p('.claude/agents')).filter((f) => f.endsWith('.md')).map((f) => f.split(/[\\/]/).pop().slice(0, -3));
for (const a of agents) {
  const src = p('.claude/agents', `${a}.md`);
  const h = header(src);
  if (!h) { errors.push(`.claude/agents/${a}.md: no frontmatter`); continue; }
  if (h.get('name') !== a) errors.push(`.claude/agents/${a}.md: name must be "${a}"`);
  if (h.get('omitClaudeMd') !== 'true') errors.push(`.claude/agents/${a}.md: needs omitClaudeMd: true (the helper core replaces AGENTS.md)`);
  const model = MODELS[h.get('model')];
  if (!model) errors.push(`.claude/agents/${a}.md: model must be one of ${Object.keys(MODELS).join(', ')}`);
  const tools = (h.get('tools') ?? '').split(/,\s*/).filter(Boolean);
  const unknown = tools.filter((t) => !TOOLS[t]);
  if (unknown.length) errors.push(`.claude/agents/${a}.md: unknown tools ${unknown.join(', ')}`);
  // the helper core block right after the frontmatter, the same in every helper
  const [, front, rest] = read(src).match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
  const after = rest.includes(CORE_END) && rest.startsWith(CORE_START) ? rest.slice(rest.indexOf(CORE_END) + CORE_END.length) : rest;
  expect(src, front + CORE + after, 'helper core block');
  const body = (FIX ? read(src) : front + CORE + after).slice(front.length);
  // Copilot copy: same body; links re-based from .claude/agents/ to .github/agents/
  const rebased = body.replace(/\]\((?!https?:|#)([^)\s]+)\)/g, (m, t) => `](${relative(p('.github/agents'), resolve(p('.claude/agents'), t)).replace(/\\/g, '/')})`);
  expect(p('.github/agents', `${a}.agent.md`), `---\nname: ${a}\ndescription: ${h.raw.description}\n` +
    `tools: ${JSON.stringify([...new Set(tools.map((t) => COPILOT_TOOLS[t]).filter(Boolean))])}\nmodel: ${model}\n---\n` +
    `${AGENT_GEN}${a}.md by node _ai/check.mjs --fix; edit the source. -->\n${rebased}`, 'Copilot agent');
  const tags = [...new Set(tools.map((t) => TOOLS[t]).filter(Boolean))];
  // inline hooks guard the helper even where workspace hook files are not loaded (Kiro CLI before V3)
  const hooks = tags.filter((t) => t !== 'web').map((t) => ({ name: `guard ${t}`, trigger: 'PreToolUse', matcher: t, action: { type: 'command', command: GUARD_CMD }, timeout: 10 }));
  const kiro = { name: a, description: h.get('description'), model, tools: tags.flatMap((t) => KIRO_TOOLS[t]), prompt: `file://../../.claude/agents/${a}.md`, hooks };
  // Kiro CLI V3 rewrites these files on first run (tool order, extra keys, a .bak copy): compare only the keys written here
  const file = p('.kiro/agents', `${a}.json`);
  let cur = null;
  try { cur = JSON.parse(read(file)); } catch { /* missing or invalid: regenerate */ }
  const same = cur && Object.keys(kiro).every((k) => k === 'tools'
    ? JSON.stringify([...(cur.tools ?? [])].sort()) === JSON.stringify([...kiro.tools].sort())
    : JSON.stringify(cur[k]) === JSON.stringify(kiro[k]));
  if (!same) expect(file, JSON.stringify(kiro, null, 2) + '\n', 'Kiro agent');
}
orphans(p('.kiro/agents'), [...agents, ...(existsSync(p('.kiro/agents')) ? readdirSync(p('.kiro/agents')).filter((n) => /\.json\.bak(\.\d+)?$/.test(n)) : [])], false);
// generated Copilot agents whose source is gone; hand-written Copilot agents (no marker) stay
for (const n of existsSync(p('.github/agents')) ? readdirSync(p('.github/agents')) : []) {
  if (!n.endsWith('.agent.md') || !read(p('.github/agents', n)).includes(AGENT_GEN) || agents.includes(n.slice(0, -9))) continue;
  if (FIX) { rmSync(p('.github/agents', n)); fixed.push(`removed .github/agents/${n}`); }
  else errors.push(`.github/agents/${n}: no matching source in .claude/agents/; run node _ai/check.mjs --fix`);
}

// 2b. path-scoped rules: .claude/rules/<name>.md is the source, read by Claude Code and Copilot (which reads .claude/rules
// like .github/instructions, so a copy there would load twice); Kiro gets a generated copy. One glob per rule
// (Kiro's fileMatchPattern takes one).
const rules = walk(p('.claude/rules')).filter((f) => f.endsWith('.md')).map((f) => f.split(/[\\/]/).pop().slice(0, -3));
const GEN = '<!-- Generated from .claude/rules/';
for (const r of rules) {
  const m = read(p('.claude/rules', `${r}.md`)).match(/^---\npaths:\n {2}- "([^"\n]+)"\n---\n([\s\S]*)$/);
  if (!m) { errors.push(`.claude/rules/${r}.md: frontmatter must be exactly one paths entry: paths:\\n  - "<glob>"`); continue; }
  const [, glob, body] = m;
  const note = `${GEN}${r}.md by node _ai/check.mjs --fix; edit the source. -->\n`;
  expect(p('.kiro/steering', `${r}.md`), `---\ninclusion: fileMatch\nfileMatchPattern: "${glob}"\n---\n${note}${body}`, 'Kiro rule');
}
// generated rule copies whose source is gone, and any generated Copilot copy (Copilot reads .claude/rules itself)
for (const [dir, suffix, keep] of [[p('.kiro/steering'), '.md', rules], [p('.github/instructions'), '.instructions.md', []]]) {
  for (const n of existsSync(dir) ? readdirSync(dir) : []) {
    if (!n.endsWith(suffix) || !read(join(dir, n)).includes(GEN) || keep.includes(n.slice(0, -suffix.length))) continue;
    if (FIX) { rmSync(join(dir, n)); fixed.push(`removed ${rel(join(dir, n))}`); }
    else errors.push(`${rel(join(dir, n))}: no matching source in .claude/rules/; run node _ai/check.mjs --fix`);
  }
}

// 3. relative links and anchors in the setup's Markdown
const slug = (h) => h.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s/g, '-');
const anchors = (f) => [...read(f).matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1]));
const docs = [p('AGENTS.md'), p('README.md'), p('_ai/orchestration.md'), p('_ai/claude.md'), p('_ai/helper-core.md'), ...['.claude', '.github', '.kiro', '_ai/profiles'].flatMap((d) => walk(p(d)))]
  .filter((f) => f.endsWith('.md') && existsSync(f));
for (const f of docs) {
  const text = read(f).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:)/.test(target)) continue;
    const [path, anchor] = target.split('#');
    const file = path ? resolve(dirname(f), path) : f;
    if (!existsSync(file)) { errors.push(`${rel(f)}: broken link ${target}`); continue; }
    if (anchor && file.endsWith('.md') && !anchors(file).includes(anchor)) errors.push(`${rel(f)}: missing anchor ${target}`);
  }
  if (/â€|Ã[\x80-\xBF]/.test(read(f))) errors.push(`${rel(f)}: broken characters (mojibake)`);
}

// 4. JSON files and hook wiring
for (const f of [p('.claude/settings.json'), ...walk(p('.github/hooks')), ...walk(p('.kiro/hooks')), ...walk(p('.kiro/agents'))].filter((x) => x.endsWith('.json'))) {
  let j;
  try { j = JSON.parse(read(f)); } catch (e) { errors.push(`${rel(f)}: invalid JSON (${e.message})`); continue; }
  // every hook command must be the fail-closed guard command; hook files must have at least one
  const cmds = [];
  const collect = (v, k) => { if (typeof v === 'string' && ['command', 'powershell', 'bash'].includes(k) && /guard\.mjs/.test(v)) cmds.push(v); else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) collect(vv, kk); };
  collect(j?.hooks);
  if (/[\\/]guard\.json$/.test(f) || f.endsWith('settings.json')) { if (!cmds.length) errors.push(`${rel(f)}: does not run _ai/hooks/guard.mjs`); }
  if (/[\\/]lang\.json$/.test(f) || f.endsWith('settings.json')) { if (!JSON.stringify(j).includes('_ai/hooks/lang.mjs')) errors.push(`${rel(f)}: does not run _ai/hooks/lang.mjs`); }
  for (const c of cmds) if (c !== GUARD_CMD) errors.push(`${rel(f)}: guard hook command must be the fail-closed GUARD_CMD from _ai/check.mjs`);
}

// 4b. Claude Code loads AGENTS.md through the @AGENTS.md import in CLAUDE.local.md (written by setup.mjs). A root
// CLAUDE.md would also be read by Copilot, which expands its imports and so would load AGENTS.md twice.
if (existsSync(p('CLAUDE.md'))) errors.push('CLAUDE.md: remove it; Claude Code reads CLAUDE.local.md (node _ai/setup.mjs), and Copilot would load AGENTS.md twice through it');
if (existsSync(p('CLAUDE.local.md'))) {
  const local = read(p('CLAUDE.local.md'));
  if (!/^(<!--.*-->\n)?@AGENTS\.md\n/.test(local) || !local.includes(read(p('_ai/claude.md')))) errors.push('CLAUDE.local.md: out of date (no @AGENTS.md import or an old _ai/claude.md); run node _ai/setup.mjs <profile>');
}

// 5. template placeholders
for (const f of walk(p('_ai/templates'))) {
  for (const [, k] of read(f).matchAll(/\{\{(\w+)\}\}/g)) if (!['PROJECT', 'project', 'DATE'].includes(k)) errors.push(`${rel(f)}: unknown placeholder {{${k}}}`);
}

// the shared Claude settings only allow reads, so the work profile asks; home adds the rest locally
const shared = JSON.parse(read(p('.claude/settings.json'))).permissions?.allow ?? [];
const extra = shared.filter((r) => !['Read', 'Grep', 'Glob'].includes(r));
if (extra.length || JSON.parse(read(p('.claude/settings.json'))).permissions?.defaultMode) errors.push(`.claude/settings.json: only Read, Grep, Glob may be allowed and no defaultMode (found ${extra.join(', ') || 'defaultMode'}); home autonomy belongs in _ai/setup.mjs`);

// 6. lists that name every skill or helper stay complete
const skillLine = read(p('AGENTS.md')).match(/^## Skills\n+([^\n]+)/m)?.[1] ?? '';
const readme = read(p('README.md'));
for (const s of skills) {
  if (!skillLine.includes(`\`${s}\``)) errors.push(`AGENTS.md: Skills section does not list \`${s}\``);
  if (!new RegExp(`/${s}(?![\\w-])`).test(readme)) errors.push(`README.md: Daily use table does not show /${s}`);
}
const MODEL_NAMES = { haiku: 'Haiku', sonnet: 'Sonnet', opus: 'Opus' };
for (const a of agents) {
  const model = MODEL_NAMES[header(p('.claude/agents', `${a}.md`))?.get('model')];
  if (!new RegExp(`\\| \`${a}\` \\| ${model} `).test(readme)) errors.push(`README.md: helper table row for \`${a}\` must say ${model}`);
}

// 7. word limits: the setup must not grow quietly; a new rule replaces or merges an old one
// the generated helper core has its own limit, so an agent's own text is counted without it
const words = (f) => read(f).replace(CORE, '').split(/\s+/).filter(Boolean).length;
const LIMITS = [[p('AGENTS.md'), 1400], [p('_ai/orchestration.md'), 300], [p('_ai/helper-core.md'), 120],
  ...skills.map((s) => [p('.claude/skills', s, 'SKILL.md'), 1400]), ...agents.map((a) => [p('.claude/agents', `${a}.md`), 300]),
  ...rules.map((r) => [p('.claude/rules', `${r}.md`), 300])];
for (const [f, max] of LIMITS) if (existsSync(f) && words(f) > max) errors.push(`${rel(f)}: ${words(f)} words, limit ${max}; shorten or merge rules`);

// 8. guard hook tests, including one stdin payload per tool through the real script
try { await import(pathToFileURL(p('_ai/hooks/guard.test.mjs')).href); } catch (e) { errors.push(`guard tests: ${e.message.split('\n')[0]}`); }

for (const f of fixed) console.log(`fixed: ${f}`);
if (errors.length) { for (const e of errors) console.error(`FAIL ${e}`); process.exit(1); }
console.log(`setup ok: ${skills.length} skills, ${agents.length} agents, ${docs.length} docs checked`);
