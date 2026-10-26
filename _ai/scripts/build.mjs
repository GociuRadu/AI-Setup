// Builds the two workspaces from this repo. Same content in both; only the permissions file and the
// tool-specific headers differ.
//   node _ai/scripts/build.mjs --home <dir>   Claude Code workspace: dot-claude -> .claude
//   node _ai/scripts/build.mjs --work <dir>   Copilot workspace: .github/{instructions,agents,skills,hooks}
// Clears and rewrites only the generated folders (home: .claude/{agents,skills,instructions,rules,hooks};
// work: .github/{agents,skills,instructions}); everything else in the target is only added or overwritten.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'dot-claude');
// README.md and _ai/README.md describe this source repo and its build, so they stay here
const SHARED = ['CLAUDE.md', 'AGENTS.md', 'HOW-TO-USE.md', '_ai/SOURCES.md', '_ai/templates', '_ai/scripts/new-project.mjs'];

const TOOLS = { Read: 'read', Grep: 'search', Glob: 'search', Edit: 'edit', Write: 'edit', Bash: 'execute', WebSearch: 'web', WebFetch: 'web' };
const MODELS = {
  'claude-haiku-5-5': ['Claude Haiku 5.5 (copilot)', 'GPT-6 Luna (copilot)'],
  'claude-sonnet-5-5': ['Claude Sonnet 5.5 (copilot)'],
};
const APPLY_TO = { global: '**', permissions: '**', python: '**/*.py', sql: '**/*.sql' };

const files = (dir) => readdirSync(dir).flatMap((n) => statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]);
let written = 0;
function put(path, text) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); written++; }
// text files get LF (as text() below) so a CRLF checkout builds the same output; .ps1 and binaries stay as they are
const raw = (f) => { const b = readFileSync(f); return b.includes(0) || f.endsWith('.ps1') ? b : b.toString('utf8').replace(/\r\n/g, '\n'); };
function copy(from, to) { if (!existsSync(from)) return; for (const f of statSync(from).isDirectory() ? files(from) : [from]) put(join(to, relative(from, f)), raw(f)); }
// LF everywhere, so a CRLF checkout builds the same output
const text = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const clear = (base, dirs) => dirs.forEach((d) => rmSync(join(base, d), { recursive: true, force: true }));
const list = (s) => `[${s.map((x) => `'${x}'`).join(', ')}]`;

function home(out) {
  clear(join(out, '.claude'), ['agents', 'skills', 'instructions', 'rules', 'hooks']);
  copy(SRC, join(out, '.claude'));
  for (const p of SHARED) copy(join(ROOT, p), join(out, p));
}

function work(out) {
  const gh = join(out, '.github');
  clear(gh, ['agents', 'skills', 'instructions']); // .github/hooks may hold work-owned hooks
  // Text in the work copy names the Copilot locations
  const w = (t) => t.replaceAll('.claude/', '.github/').replace(/agents\/(\w+)\.md\b/g, 'agents/$1.agent.md');

  for (const f of files(join(SRC, 'instructions'))) {
    const name = f.split(/[\\/]/).pop().replace('.instructions.md', '');
    const src = name === 'permissions' ? join(ROOT, '_ai/work/permissions.instructions.md') : f;
    let body = text(src);
    if (!/^applyTo:/m.test(body)) body = body.replace(/^---\n/, `---\napplyTo: "${APPLY_TO[name]}"\n`);
    put(join(gh, 'instructions', `${name}.instructions.md`), w(body));
  }

  for (const f of files(join(SRC, 'agents'))) {
    const agent = text(f).replace(/^tools: (.*)$/m, (_, t) => `tools: ${list([...new Set(t.split(/,\s*/).map((x) => TOOLS[x]))])}`)
      .replace(/^model: (.*)$/m, (_, m) => `model: ${list(MODELS[m] ?? [m])}\nagents: []\nuser-invocable: ${f.endsWith('tester.md')}`);
    put(join(gh, 'agents', f.split(/[\\/]/).pop().replace('.md', '.agent.md')), w(agent));
  }

  for (const f of files(join(SRC, 'skills'))) {
    const rel = relative(join(SRC, 'skills'), f);
    put(join(gh, 'skills', rel), f.endsWith('.md') ? w(text(f)) : readFileSync(f));
  }

  copy(join(SRC, 'hooks/block-db-writes.mjs'), join(gh, 'hooks/block-db-writes.mjs'));
  put(join(gh, 'hooks/block-db-writes.json'), JSON.stringify({ version: 1, hooks: { preToolUse: [
    { type: 'command', powershell: 'node .github/hooks/block-db-writes.mjs', bash: 'node .github/hooks/block-db-writes.mjs', timeoutSec: 10 }] } }, null, 2) + '\n');

  put(join(gh, 'copilot-instructions.md'), w(text(join(ROOT, 'CLAUDE.md'))
    .replace(/^@(.+)$/gm, (_, p) => `- [${p.split('/').pop()}](${p.replace('.claude/', '')})`)));
  for (const p of SHARED.filter((p) => p !== 'CLAUDE.md')) copy(join(ROOT, p), join(out, p));
  for (const f of ['AGENTS.md', 'README.md', 'HOW-TO-USE.md'].map((p) => join(out, p)).filter(existsSync))
    writeFileSync(f, w(text(f)).replaceAll('[CLAUDE.md](CLAUDE.md)', '[copilot-instructions.md](.github/copilot-instructions.md)'));
}

const args = process.argv.slice(2);
const target = (flag) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? resolve(args[i + 1]) : null; };
const [h, wk] = [target('--home'), target('--work')];
if (!existsSync(SRC)) { console.error('run build.mjs from the AI-Setup source repo (dot-claude/ not found)'); process.exit(1); }
if (!h && !wk) { console.error('usage: node _ai/scripts/build.mjs [--home <dir>] [--work <dir>]'); process.exit(1); }
if (h) { written = 0; home(h); console.log(`home: ${written} files -> ${h}`); }
if (wk) { written = 0; work(wk); console.log(`work: ${written} files -> ${wk}`); }
