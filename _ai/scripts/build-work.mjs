// Builds the Copilot work setup from the personal core (.claude) plus work overrides.
// Usage: node _ai/scripts/build-work.mjs [--check | --derive] [--vault <path>]
//   (none)   write projects/work/_ai/.github (LF) and <vault>/work/_ai/dot-github (CRLF)
//   --check  build in memory, list files that differ from projects/work, exit 1 on drift
//   --derive record the current projects/work text as overrides (after a deliberate work-only edit)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const mode = args.includes('--check') ? 'check' : args.includes('--derive') ? 'derive' : 'build';
const vi = args.indexOf('--vault');
const vault = vi >= 0 ? args[vi + 1] : 'C:/Users/radug/Desktop/Obsidian/Me/Code/Setup';
const overridesFile = path.join(root, '_ai/work-overrides.json');
const workGithub = path.join(root, 'work/_ai/.github');
const core = path.join(root, '.claude');
// Owned by the work side, never generated: lead (an agent there), global instructions (stricter rewrite),
// copilot-instructions, hooks, user memory, templates and docs.
const skipSkills = new Set(['lead']);
const skipInstructions = new Set(['global.instructions.md']);

const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

// target path (relative to .github, forward slashes) -> core source file
function mapping() {
  const m = {};
  for (const f of walk(path.join(core, 'skills'))) {
    const rel = path.relative(path.join(core, 'skills'), f).split(path.sep);
    if (!skipSkills.has(rel[0])) m['skills/' + rel.join('/')] = f;
  }
  for (const f of walk(path.join(core, 'agents'))) m[`agents/${path.basename(f, '.md')}.agent.md`] = f;
  for (const f of walk(path.join(core, 'instructions')))
    if (!skipInstructions.has(path.basename(f))) m['instructions/' + path.basename(f)] = f;
  return m;
}

// Line LCS diff -> hunks {find, replace}; context widens until find is unique, overlapping hunks merge.
function derive(src, dst) {
  const a = src.split('\n'), b = dst.split('\n');
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const hunks = [];
  const count = s => src.split(s).length - 1;
  // Whole lines with their newline, so a deleted line leaves no blank line behind.
  const lines = (x, lo, hi, len) => x.slice(lo, hi).join('\n') + (hi > lo && hi < len ? '\n' : '');
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { i++; j++; continue; }
    let lo = i, bl = j;
    while ((i < n || j < m) && !(i < n && j < m && a[i] === b[j])) {
      if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) j++; else i++;
    }
    let hi = i, bh = j;
    while (hi === lo || count(lines(a, lo, hi, n)) !== 1) {
      if (lo > 0) { lo--; bl--; } else if (hi < n) { hi++; bh++; } else break;
    }
    const prev = hunks[hunks.length - 1];
    if (prev && lo <= prev.hi) { lo = prev.lo; bl = prev.bl; hunks.pop(); }
    hunks.push({ lo, hi, bl, bh });
  }
  return hunks.map(h => ({ find: lines(a, h.lo, h.hi, n), replace: lines(b, h.bl, h.bh, m) }));
}

// Anchors are matched in the unmodified core text, so one override never creates or hides another's anchor.
function apply(src, hunks, target) {
  const at = hunks.map(h => {
    const n = src.split(h.find).length - 1;
    if (n !== 1) throw new Error(`${target}: override anchor found ${n} times; the core changed there. Fix the work file by hand, then run --derive:\n${h.find.slice(0, 200)}`);
    return { ...h, pos: src.indexOf(h.find) };
  }).sort((x, y) => x.pos - y.pos);
  let out = '', cur = 0;
  for (const h of at) {
    if (h.pos < cur) throw new Error(`${target}: overlapping overrides; run --derive`);
    out += src.slice(cur, h.pos) + h.replace;
    cur = h.pos + h.find.length;
  }
  return out + src.slice(cur);
}

const map = mapping();
const overrides = fs.existsSync(overridesFile) ? JSON.parse(read(overridesFile)) : {};

if (mode === 'derive') {
  const next = {};
  for (const [t, src] of Object.entries(map)) {
    const w = path.join(workGithub, t);
    if (!fs.existsSync(w)) continue;
    const h = derive(read(src), read(w));
    if (h.length) next[t] = h;
  }
  fs.writeFileSync(overridesFile, JSON.stringify(next, null, 2) + '\n');
  console.log(`derived overrides for ${Object.keys(next).length} files`);
  process.exit(0);
}

let built;
try {
  built = Object.fromEntries(Object.entries(map).map(([t, src]) => [t, apply(read(src), overrides[t] || [], t)]));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const drift = Object.keys(built).filter(t => {
  const w = path.join(workGithub, t);
  return !fs.existsSync(w) || read(w) !== built[t];
});

// Vault mirror: the vault root gets the same layout as git (dot-* names, CRLF, never deletes).
// <vault>/work is only compared: work-owned files arrive there from the work workspace (sync-to-vault.ps1).
const rel = f => path.relative(root, f).split(path.sep).join('/');
const dotted = r => r.split('/').map(s => s.startsWith('.') ? 'dot-' + s.slice(1) : s).join('/');
const coreFiles = ['.claude', '_ai', 'CLAUDE.md', 'AGENTS.md', 'README.md', 'HOW-TO-USE.md']
  .map(p => path.join(root, p)).filter(p => fs.existsSync(p))
  .flatMap(p => fs.statSync(p).isDirectory() ? walk(p) : [p])
  .map(rel).filter(r => r !== '.claude/settings.local.json');
const differs = (a, b) => !fs.existsSync(b) || read(a) !== read(b);
const coreDrift = fs.existsSync(vault) ? coreFiles.filter(r => differs(path.join(root, r), path.join(vault, dotted(r)))) : [];
const workDrift = () => fs.existsSync(vault) ? walk(path.join(root, 'work')).map(rel)
  .filter(r => !r.startsWith('work/personal/'))
  .filter(r => differs(path.join(root, r), path.join(vault, r === 'work/STRUCTURE.md' ? 'structure.md' : dotted(r)))) : [];

if (mode === 'check') {
  console.log(drift.length ? `drift in ${drift.length} files:\n` + drift.join('\n') : `ok: ${Object.keys(built).length} files match`);
  if (coreDrift.length) console.log(`vault differs in ${coreDrift.length} files (run without --check):\n` + coreDrift.join('\n'));
  const wd = workDrift();
  if (wd.length) console.log(`vault work differs in ${wd.length} files (copy the newer side by hand):\n` + wd.join('\n'));
  process.exit(drift.length || coreDrift.length || wd.length ? 1 : 0);
}

for (const [t, txt] of Object.entries(built)) {
  const w = path.join(workGithub, t);
  fs.mkdirSync(path.dirname(w), { recursive: true });
  fs.writeFileSync(w, txt);
  if (fs.existsSync(vault)) {
    const v = path.join(vault, 'work/_ai/dot-github', t);
    fs.mkdirSync(path.dirname(v), { recursive: true });
    fs.writeFileSync(v, txt.replace(/\n/g, '\r\n'));
  }
}
for (const r of coreDrift) {
  const v = path.join(vault, dotted(r));
  fs.mkdirSync(path.dirname(v), { recursive: true });
  fs.writeFileSync(v, read(path.join(root, r)).replace(/\n/g, '\r\n'));
}
console.log(`built ${Object.keys(built).length} files (${drift.length} changed)${fs.existsSync(vault) ? ` + vault (${coreDrift.length} updated)` : ''}`);
const wd = workDrift();
if (wd.length) console.log(`vault work differs in ${wd.length} files (copy the newer side by hand):\n` + wd.join('\n'));
