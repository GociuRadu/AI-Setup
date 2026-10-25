// Creates a project from _ai/templates/<template>; never overwrites an existing folder.
// Usage: node _ai/scripts/new-project.mjs <Name> [--template basic|data-eng] [--setup personal|work] [--dest <dir>]
//   personal: <dest>/<Name>/ with the source skeleton under code/ (Git checkout); dest defaults to the projects root
//   work:     <dest>/<Name>/ is the repo itself (code/ flattened); database queries go to the user
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const name = args[0];
const template = opt('--template', 'basic');
const profile = opt('--setup', 'personal');
const dest = path.resolve(opt('--dest', root));
const src = path.join(root, '_ai/templates', template);

if (!name || name.startsWith('--') || !/^[\w.-]+$/.test(name)) { console.error('usage: new-project.mjs <Name> [--template basic|data-eng] [--setup personal|work] [--dest <dir>]'); process.exit(1); }
if (!fs.existsSync(src)) { console.error(`no template ${template}: ${fs.readdirSync(path.dirname(src)).join(', ')}`); process.exit(1); }
if (!['personal', 'work'].includes(profile)) { console.error('--setup must be personal or work'); process.exit(1); }
const target = path.join(dest, name);
if (fs.existsSync(target)) { console.error(`${target} exists; not overwriting`); process.exit(1); }

const work = profile === 'work';
const vars = {
  PROJECT: name,
  DATE: new Date().toISOString().slice(0, 10),
  CODE: work ? '' : 'code/',
  CODEDIR: work ? name : `${name}/code`,
  ROOT: work ? '' : '../',
  DB_ACCESS: work ? 'queries sent to the user' : 'queries run by the agent',
};
const fill = s => s.replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m);
const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

let n = 0;
for (const f of walk(src)) {
  let rel = path.relative(src, f).split(path.sep).join('/');
  if (work) rel = rel.replace(/^code\//, '');
  const out = path.join(target, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, fill(fs.readFileSync(f, 'utf8')));
  n++;
}
const git = work ? '' : fs.existsSync(path.join(target, 'code')) ? 'git init in code/ (it holds the skeleton), ' : 'clone the repo into code/, ';
console.log(`created ${target} (${template}, ${profile}, ${n} files). Next: ${git}fill docs/ai/project.md.`);
