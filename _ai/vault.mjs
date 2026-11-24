// The study notes of the Obsidian vault set in .ai-device.json (format: _ai/skills/learn/notes.md). Reads only; never looks into
// the private folder or encrypted notes.
//   node _ai/vault.mjs                  prints the vault path, the notes in Learn and the PDFs in Books
//   node _ai/vault.mjs check "<topic>"  checks one topic note and its concept notes; prints scan: lines and exits 1 when there are any
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkVault } from './sync.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS = ['standard', 'common', 'growing', 'niche', 'legacy'];
const DIAGRAMS = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|erDiagram|mindmap|timeline|quadrantChart|C4Context|C4Container|architecture-beta|gitGraph|pie|xychart-beta|block-beta|journey|requirementDiagram)\b/;
const GENERIC = /^(overview|introduction|intro|background|summary|conclusion|details|notes|index|basics|general|diagram|definition|references)$/i;
const LIMIT = { words: 600, concept: 200, bottom: 40, para: 50, nodes: 10, lrNodes: 4, columns: 5, svgWidth: 520, svgFont: 16 };

// frontmatter: `key: value` and `key:` followed by `- item` lines; quotes removed
export function parseNote(text) {
  const t = text.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(t);
  const meta = {};
  let key;
  const bare = (s) => s.trim().replace(/^(["'])(.*)\1$/, '$2');
  for (const line of m ? m[1].split('\n') : []) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line), item = /^\s*-\s+(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      const v = kv[2].trim();
      meta[key] = v === '' ? [] : /^\[(?!\[).*\]$/.test(v) ? v.slice(1, -1).split(',').map(bare).filter(Boolean) : bare(v);
    } else if (item && key && Array.isArray(meta[key])) meta[key].push(bare(item[1]));
  }
  return { meta, body: m ? t.slice(m[0].length) : t };
}
const list = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
// [[target#part|label]] and ![[target]]: target without heading or label; `raw` keeps the link as typed
export function links(text) {
  return [...text.matchAll(/(!?)\[\[([^\]\n]+)\]\]/g)].map((m) => {
    const target = m[2].split(/\\?\|/)[0].split('#')[0].trim();
    return { embed: m[1] === '!', target, part: /#([^|\\]*)/.exec(m[2])?.[1], raw: m[0] };
  });
}
const mermaids = (body) => [...body.matchAll(/^```mermaid\n([\s\S]*?)^```/gm)].map((m) => m[1].trim());
const withoutCode = (body) => body.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '');
// text a reader sees before opening anything: no code, folded callouts, footnote texts or comments
export function visible(body) {
  const out = [];
  let folded = false;
  for (const line of withoutCode(body).replace(/%%[\s\S]*?%%/g, '').split('\n')) {
    if (/^> \[!\w+\]-/.test(line)) folded = true;
    else if (!line.startsWith('>')) folded = false;
    if (!folded && !/^\[\^[^\]]+\]:/.test(line)) out.push(line);
  }
  return out.join('\n');
}
const words = (s) => s.replace(/!?\[\[[^\]]*?\\?\|?([^\]|]*)\]\]/g, '$1').replace(/\]\([^)]*\)/g, ']').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
// node ids of a flowchart
const nodeIds = (d) => new Set([...d.replace(/^\s*(class|classDef|style|linkStyle|click|subgraph|direction|end)\b.*$/gm, '').replace(/"[^"]*"/g, '').replace(/\|[^|]*\|/g, ' ').replace(/--\s+\w[^\n]*?\s(-->|---)/g, '$1')
  .matchAll(/(?:^|[\s>&-])([A-Za-z][\w]*)(?=\s*(?:[[({<]|:::|-{2,}|-\.|==|~~|&|$))/gm)].map((m) => m[1]).filter((w) => !/^(flowchart|graph|TD|TB|LR|RL|BT)$/.test(w)));

// `notes`: name -> text of every note in Learn; `files`: lower-case names of every linkable file (notes without .md);
// `svg`: file name -> text. Returns { warnings, info }.
export function checkTopic(topic, notes, files, svg = {}) {
  const warnings = [], info = [];
  const warn = (note, msg) => warnings.push(`${note}: ${msg}`);
  if (!Object.hasOwn(notes, topic)) return { warnings: [`${topic}: no such note in Learn`], info };
  const parsed = Object.fromEntries(Object.entries(notes).map(([n, t]) => [n, parseNote(t)]));
  const topicsOf = (n) => list(parsed[n].meta.topic).flatMap((v) => links(v).map((l) => l.target));
  const concepts = Object.keys(notes).filter((n) => parsed[n].meta.type === 'concept' && topicsOf(n).includes(topic));
  const exists = (t) => files.has(t.toLowerCase()) || files.has(t.toLowerCase().replace(/\.md$/, '')) || files.has(t.toLowerCase().split('/').pop());

  for (const n of [topic, ...concepts]) {
    const { meta, body } = parsed[n];
    const plain = withoutCode(body);
    for (const k of ['created', 'updated']) if (!DATE.test(meta[k] ?? '')) warn(n, `property ${k} must be YYYY-MM-DD`);
    for (const l of links(plain + '\n' + Object.values(meta).flat().join('\n'))) {
      if (!l.target) continue;
      if (/^personal\//i.test(l.target) || /\.mdenc$/i.test(l.target)) warn(n, 'links to a private note');
      else if (!exists(l.target)) warn(n, `${l.raw} does not exist in the vault`);
      if (/\.pdf$/i.test(l.target) && l.part && !/^page=[1-9]\d*/.test(l.part)) warn(n, `${l.raw} needs #page=<number>`);
    }
    for (const line of plain.split('\n')) {
      if (!/^(> )*\|/.test(line)) continue;
      if (/\[\[[^\]\\]*[^\\]\|[^\]]*\]\]/.test(line)) warn(n, `a link label in a table needs \\| : ${line.trim().slice(0, 60)}`);
      const cols = line.replace(/^(> )*\|?/, '').replace(/\|\s*$/, '').split(/(?<!\\)\|/).length;
      if (cols > LIMIT.columns) warn(n, `a table has ${cols} columns (at most ${LIMIT.columns})`);
    }
    const tag = /<(?!https?:)[/!a-z][^>\n]*>/i.exec(plain)?.[0];
    if (tag) warn(n, `${tag.slice(0, 40)}: HTML or a placeholder left over; use callouts, tables and embeds`);
    if (/^# /m.test(plain)) warn(n, 'no # heading: the file name is the title');
    for (const h of plain.matchAll(/^#{2,4} (.+)$/gm)) if (GENERIC.test(h[1].trim())) warn(n, `heading "${h[1]}" says nothing: state the point`);
    const defs = new Map([...plain.matchAll(/^\[\^([^\]]+)\]:\s*(.*)$/gm)].map((m) => [m[1], m[2]]));
    const refs = new Set([...plain.replace(/^\[\^[^\]]+\]:.*$/gm, '').matchAll(/\[\^([^\]]+)\]/g)].map((m) => m[1]));
    for (const r of refs) if (!defs.has(r)) warn(n, `footnote ${r} has no text`);
    for (const [d, text] of defs) {
      if (!refs.has(d)) warn(n, `footnote ${d} is never used`);
      if (!/https?:\/\/|\.pdf#page=/.test(text)) warn(n, `footnote ${d} needs a source link`);
    }
    const textLinks = new Set(links(plain).map((l) => l.target));
    for (const l of links(Object.values(meta).flat().join('\n'))) if (!textLinks.has(l.target)) warn(n, `property link ${l.raw} also needs a link in the text: properties are hidden while reading`);
    for (const d of mermaids(body)) {
      const first = d.split('\n')[0].trim();
      if (!DIAGRAMS.test(first)) { warn(n, `unknown diagram type: ${first.slice(0, 40)}`); continue; }
      if (/^(flowchart|graph)\b/.test(first)) {
        const count = nodeIds(d).size, max = /\b(LR|RL)\b/.test(first) ? LIMIT.lrNodes : LIMIT.nodes;
        if (count > max) warn(n, `a ${first} diagram has ${count} nodes (at most ${max}; ${max === LIMIT.lrNodes ? 'use TD' : 'split it'})`);
        for (const m of d.matchAll(/^\s*class\s+([\w, ]+?)\s+internal-link/gm)) {
          for (const id of m[1].split(/[,\s]+/).filter(Boolean)) {
            const label = new RegExp(`\\b${id}\\s*[\\[({]+"?([^"\\])}]+)`).exec(d)?.[1]?.trim() ?? id;
            if (!exists(label)) warn(n, `diagram node "${label}" is an internal-link to no note`);
            else if (n === topic && !textLinks.has(label) && label !== topic) warn(n, `diagram node "${label}" also needs a [[link]] in the text: links in diagrams do not reach the graph`);
          }
        }
      }
    }
    for (const l of links(plain)) {
      if (!l.embed || !/\.svg$/i.test(l.target)) continue;
      const s = svg[l.target.split('/').pop()];
      if (s === undefined) continue; // a missing file is reported above
      const vb = /viewBox="0 0 ([\d.]+) [\d.]+"/.exec(s);
      if (!vb || Number(vb[1]) > LIMIT.svgWidth) warn(n, `${l.target}: viewBox must start at 0 0 and be at most ${LIMIT.svgWidth} wide, to stay readable on a phone`);
      if (!/<title>[^<]+<\/title>/.test(s)) warn(n, `${l.target}: needs a <title> that says what it shows`);
      if ([...s.matchAll(/font-size(?:=|:)\s*"?([\d.]+)/g)].some((m) => Number(m[1]) < LIMIT.svgFont)) warn(n, `${l.target}: text under ${LIMIT.svgFont} px`);
      if (/<(script|foreignObject|image)\b|\bon\w+=|href="http/i.test(s)) warn(n, `${l.target}: only plain shapes and text`);
    }
    for (const p of visible(body).split(/\n\s*\n/)) {
      if (/^\s*([#>|!-]|\d+\.|\*\s|\[\^|```)/.test(p) || !p.trim()) continue;
      const sentences = p.trim().split(/(?<=[.!?])\s+(?=[A-Z[*])/).length;
      if (words(p) > LIMIT.para || sentences > 2) warn(n, `long paragraph (${sentences} sentences, ${words(p)} words): "${p.trim().slice(0, 50)}"`);
    }
  }

  const { meta, body } = parsed[topic];
  const seen = visible(body);
  if (meta.type !== 'topic') warn(topic, 'property type must be topic');
  const bottom = /^\s*> \[!abstract\][^\n]*\n((?:>.*\n?)*)/.exec(body);
  if (!bottom) warn(topic, 'must start with a > [!abstract] callout');
  else if (words(bottom[1].replace(/^>/gm, '')) > LIMIT.bottom) warn(topic, `the first callout is over ${LIMIT.bottom} words`);
  if (words(seen) > LIMIT.words) warn(topic, `${words(seen)} visible words (at most ${LIMIT.words}): move depth to concept notes or folded callouts`);
  for (const s of body.split(/^## /m).slice(1)) {
    if (!/^```mermaid|^(> )?\||^!\[\[|^\d+\. |^> \[!question\]-/m.test(s)) warn(topic, `section "${s.split('\n')[0]}" has no diagram, table, picture, steps or questions`);
  }
  if (mermaids(body).length < 2) warn(topic, 'needs at least 2 diagrams');
  if (!links(body).some((l) => l.embed && /\.(svg|png|jpe?g|webp|gif|avif)$/i.test(l.target))) warn(topic, 'needs a picture (![[name.svg]])');
  if ((body.match(/^> \[!question\]- /gm) ?? []).length < 5) warn(topic, 'needs 5 folded questions (> [!question]- ...)');
  if (concepts.length < 5 || concepts.length > 9) warn(topic, `${concepts.length} concept notes (5 to 9)`);
  if (!Object.keys(notes).some((n) => parsed[n].meta.type === 'map' && links(parsed[n].body).some((l) => l.target === topic))) warn(topic, 'is not linked from a map note');
  const linked = new Set(links(withoutCode(body)).map((l) => l.target));
  for (const n of concepts) {
    const c = parsed[n];
    if (!linked.has(n)) warn(n, `is not linked from the text of ${topic}`);
    if (!STATUS.includes(c.meta.status)) warn(n, `property status must be one of ${STATUS.join(', ')}`);
    if (!/^\s*> \[!abstract\]/.test(c.body)) warn(n, 'must start with a > [!abstract] callout');
    if (!/^## In my own words$/m.test(c.body)) warn(n, 'needs a "## In my own words" section');
    const own = visible(c.body).split(/^## In my own words$/m)[0];
    if (words(own) > LIMIT.concept) warn(n, `${words(own)} visible words (at most ${LIMIT.concept})`);
    const related = new Set(links(withoutCode(c.body)).map((l) => l.target).filter((t) => t !== n && parsed[t]?.meta.type === 'concept'));
    if (related.size < 2) warn(n, 'links to fewer than 2 other concept notes');
    const others = topicsOf(n).filter((t) => t !== topic);
    if (others.length) info.push(`${n} is shared with ${others.join(', ')}: append or correct, do not rewrite`);
  }
  return { warnings, info };
}

const walk = (dir, skip) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.name.startsWith('.') || skip.test(e.name) ? []
  : e.isDirectory() ? walk(join(dir, e.name), skip).map((f) => `${e.name}/${f}`) : [e.name]);

export function main(args, root = ROOT) {
  let vault;
  try { vault = JSON.parse(readFileSync(join(root, '.ai-device.json'), 'utf8')).obsidian?.vault; } catch { /* no device file: no vault */ }
  if (!vault) { console.error('no vault: set it in the setup page (Obsidian section), then Apply'); return 1; }
  try { checkVault(vault); } catch (e) { console.error(e.message); return 1; }
  const all = walk(vault, /^personal$|\.mdenc$/i);
  const learn = all.filter((f) => /^Learn\/[^/]+\.md$/.test(f));
  const notes = Object.fromEntries(learn.map((f) => [f.slice(6, -3), readFileSync(join(vault, f), 'utf8')]));
  if (args[0] === 'check' && args[1]) {
    const files = new Set(all.flatMap((f) => [f, f.split('/').pop()].map((x) => x.toLowerCase().replace(/\.md$/, ''))));
    const svg = Object.fromEntries(all.filter((f) => f.endsWith('.svg')).map((f) => [f.split('/').pop(), readFileSync(join(vault, f), 'utf8')]));
    const { warnings, info } = checkTopic(args[1], notes, files, svg);
    for (const i of info) console.log(`info: ${i}`);
    for (const w of warnings) console.log(`scan: ${w}`);
    console.log(warnings.length ? `${warnings.length} to fix` : 'clean');
    return warnings.length ? 1 : 0;
  }
  if (args.length) { console.error('usage: node _ai/vault.mjs [check "<topic>"]'); return 1; }
  console.log(`vault: ${vault}`);
  for (const [n, t] of Object.entries(notes)) {
    const { meta } = parseNote(t);
    console.log([n, meta.type ?? '-', list(meta.topic).join(' '), list(meta.aliases).join(', ')].join(' | '));
  }
  for (const f of all.filter((x) => /^Books\/.*\.pdf$/i.test(x))) console.log(`book: ${f}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
