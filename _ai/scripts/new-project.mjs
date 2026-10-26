// Creates a project from _ai/templates/<template>; never overwrites an existing folder.
// Usage: node _ai/scripts/new-project.mjs <Name> [--template app|data-eng] [--dest <dir>]
//   app:      docs/ai + entrypoints; clone the repo into code/
//   data-eng: also the local data-engineering skeleton under code/ (git init there)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] ?? '' : d; };
const name = args[0];
const template = opt('--template', 'app');
const src = path.join(root, '_ai/templates', template);

// starts with a letter or digit: Docker Compose project names require it
if (!name || !template || !/^[A-Za-z0-9][\w.-]*$/.test(name)) { console.error('usage: new-project.mjs <Name> [--template app|data-eng] [--dest <dir>]'); process.exit(1); }
if (!fs.existsSync(src)) { console.error(`no template ${template}: ${fs.readdirSync(path.dirname(src)).join(', ')}`); process.exit(1); }
const target = path.join(path.resolve(opt('--dest', root)), name);
if (fs.existsSync(target)) { console.error(`${target} exists; not overwriting`); process.exit(1); }

// {{project}}: Docker Compose and database names must be lowercase
const vars = { PROJECT: name, project: name.toLowerCase().replace(/[^a-z0-9_-]/g, '_'), DATE: new Date().toISOString().slice(0, 10) };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

let n = 0;
for (const f of walk(src)) {
  const out = path.join(target, path.relative(src, f));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, fs.readFileSync(f, 'utf8').replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m));
  n++;
}
const next = template === 'data-eng' ? 'git init in code/' : 'clone the repo into code/';
console.log(`created ${target} (${template}, ${n} files). Next: ${next}, then fill docs/ai/project.md.`);
