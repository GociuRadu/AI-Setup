// Self-check of the AI setup. Run after every change to it: node _ai/check.mjs [--fix]
// Checks skill and agent headers, the Kiro wrappers (generated from .claude/), relative links and anchors,
// JSON files, template placeholders and the guard hook tests. --fix rewrites the Kiro wrappers.
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

// 2. agents: .claude/agents/<name>.md is the source; .kiro/agents/<name>.json uses it as the prompt
const MODELS = { haiku: 'claude-haiku-5.5', sonnet: 'claude-sonnet-5.5', opus: 'claude-opus-5.5' };
const TOOLS = { Read: 'read', Grep: 'read', Glob: 'read', Edit: 'write', Write: 'write', Bash: 'shell', PowerShell: 'shell', WebSearch: 'web', WebFetch: 'web' };
// tags for the IDE and CLI V3, plus the tool names Kiro CLI 2.x needs (a `web` tag alone gives no web tools there)
const KIRO_TOOLS = { read: ['read', 'glob', 'grep'], write: ['write'], shell: ['shell'], web: ['web', 'web_search', 'web_fetch'] };
const agents = walk(p('.claude/agents')).filter((f) => f.endsWith('.md')).map((f) => f.split(/[\\/]/).pop().slice(0, -3));
for (const a of agents) {
  const h = header(p('.claude/agents', `${a}.md`));
  if (!h) { errors.push(`.claude/agents/${a}.md: no frontmatter`); continue; }
  if (h.get('name') !== a) errors.push(`.claude/agents/${a}.md: name must be "${a}"`);
  const model = MODELS[h.get('model')];
  if (!model) errors.push(`.claude/agents/${a}.md: model must be one of ${Object.keys(MODELS).join(', ')}`);
  const tools = (h.get('tools') ?? '').split(/,\s*/).filter(Boolean);
  const unknown = tools.filter((t) => !TOOLS[t]);
  if (unknown.length) errors.push(`.claude/agents/${a}.md: unknown tools ${unknown.join(', ')}`);
  const tags = [...new Set(tools.map((t) => TOOLS[t]).filter(Boolean))];
  // inline hooks guard the helper even where workspace hook files are not loaded (Kiro CLI before V3)
  const hooks = tags.filter((t) => t !== 'web').map((t) => ({ name: `guard ${t}`, trigger: 'PreToolUse', matcher: t, action: { type: 'command', command: 'node _ai/hooks/guard.mjs' }, timeout: 10 }));
  const kiro = { name: a, description: h.get('description'), model, tools: tags.flatMap((t) => KIRO_TOOLS[t]), prompt: `file://../../.claude/agents/${a}.md`, hooks };
  expect(p('.kiro/agents', `${a}.json`), JSON.stringify(kiro, null, 2) + '\n', 'Kiro agent');
}
orphans(p('.kiro/agents'), agents, false);

// 3. relative links and anchors in the setup's Markdown
const slug = (h) => h.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s/g, '-');
const anchors = (f) => [...read(f).matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1]));
const docs = [p('AGENTS.md'), p('CLAUDE.md'), p('README.md'), p('_ai/SOURCES.md'), ...['.claude', '.github', '.kiro', '_ai/profiles'].flatMap((d) => walk(p(d)))]
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
  try { const t = read(f); JSON.parse(t); if (/hooks/.test(f) || f.endsWith('settings.json')) { if (!t.includes('_ai/hooks/guard.mjs')) errors.push(`${rel(f)}: does not run _ai/hooks/guard.mjs`); } }
  catch (e) { errors.push(`${rel(f)}: invalid JSON (${e.message})`); }
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

// 7. size of the always-loaded rules
const lines = read(p('AGENTS.md')).split('\n').length;
if (lines > 200) errors.push(`AGENTS.md: ${lines} lines; keep the always-loaded rules under 200`);

// 8. guard hook tests, including one stdin payload per tool through the real script
try { await import(pathToFileURL(p('_ai/hooks/guard.test.mjs')).href); } catch (e) { errors.push(`guard tests: ${e.message.split('\n')[0]}`); }

for (const f of fixed) console.log(`fixed: ${f}`);
if (errors.length) { for (const e of errors) console.error(`FAIL ${e}`); process.exit(1); }
console.log(`setup ok: ${skills.length} skills, ${agents.length} agents, ${docs.length} docs checked`);
