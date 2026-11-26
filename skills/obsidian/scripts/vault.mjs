// The Obsidian vault named in the workspace's .ai-device.json (format: ../notes.md). Reads only; never lists or opens the
// Personal folder or encrypted .mdenc notes.
//   node vault.mjs                  prints the vault path, its notes (path | type) and the PDFs in Books
//   node vault.mjs check [<note>]   checks one note, base or canvas (name or vault path), or all of them; prints
//                                   scan: lines and exits 1 when there are any
// The device file is found by walking up from this script (the install writes it to the workspace root), so the
// checker runs from any project; AI_DEVICE_FILE overrides it.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DIAGRAMS = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|stateDiagram|erDiagram|mindmap|timeline|quadrantChart|C4Context|C4Container|architecture-beta|gitGraph|pie|xychart-beta|block-beta|journey|requirementDiagram)\b/;
const GENERIC = /^(overview|introduction|intro|background|summary|conclusion|details|notes|index|basics|general|diagram|definition|references|sources)$/i;
const LIMIT = { words: 1500, bottom: 40, para: 50, nodes: 10, lrNodes: 4, columns: 5, svgWidth: 520, svgFont: 16 };
const PRIVATE = /^personal$|\.mdenc$/i;

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
// text a reader sees before opening anything: no code, folded callouts or comments
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

// The vault as seen by the checks. `files`: vault-relative path -> text (notes, bases, canvases, SVGs; other files ''),
// never the private folder. `banned`: names notes must not use (the workspace's projects).
export function index(files) {
  const names = new Set();
  for (const p of Object.keys(files)) {
    const lower = p.toLowerCase();
    names.add(lower).add(lower.replace(/\.md$/, '')).add(lower.split('/').pop()).add(lower.split('/').pop().replace(/\.md$/, ''));
  }
  const notes = Object.fromEntries(Object.entries(files).filter(([p]) => p.endsWith('.md')).map(([p, t]) => [p, parseNote(t)]));
  return { files, names, notes };
}
const resolves = (vi, target) => { const t = target.toLowerCase(); return vi.names.has(t) || vi.names.has(t.replace(/\.md$/, '')); };

// Rules for every note.
function checkEveryNote(path, vi, warn) {
  const { meta, body } = vi.notes[path];
  // `## In my own words` is the user's: never changed by an agent, so not checked
  const plain = withoutCode(body).replace(/^## In my own words$[\s\S]*/m, '');
  for (const k of ['created', 'updated']) if (meta[k] !== undefined && !DATE.test(meta[k])) warn(`property ${k} must be YYYY-MM-DD`);
  for (const l of links(plain + '\n' + Object.values(meta).flat().join('\n'))) {
    if (!l.target) continue;
    if (/\.pdf$/i.test(l.target) && l.part && !/^page=[1-9]\d*/.test(l.part)) warn(`${l.raw} needs #page=<number>`);
    // the private folder is never listed; PDFs in Books are not synced, so one missing on this device is fine
    if (/^personal\//i.test(l.target) || /\.mdenc$/i.test(l.target) || /\.pdf$/i.test(l.target)) continue;
    if (!resolves(vi, l.target)) warn(`${l.raw} does not exist in the vault`);
  }
  for (const line of plain.split('\n')) {
    if (/^(> )*\|/.test(line) && /\[\[[^\]\\]*[^\\]\|[^\]]*\]\]/.test(line)) warn(`a link label in a table needs \\| : ${line.trim().slice(0, 60)}`);
  }
  for (const d of mermaids(body)) {
    const first = d.split('\n')[0].trim();
    if (!DIAGRAMS.test(first)) warn(`unknown diagram type: ${first.slice(0, 40)}`);
  }
}

// Rules for study notes (type: topic).
function checkTopic(path, vi, banned, warn) {
  const { meta, body } = vi.notes[path];
  const name = path.split('/').pop().replace(/\.md$/, '');
  const plain = withoutCode(body).replace(/^## In my own words$[\s\S]*/m, '');
  const text = vi.files[path];
  for (const b of banned) {
    const esc = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^\\w-])${esc}($|[^\\w-])`, 'i').test(text)) warn(`names the project "${b}": examples stay generic`);
  }
  for (const k of ['created', 'updated']) if (meta[k] === undefined) warn(`property ${k} must be YYYY-MM-DD`);
  for (const line of plain.split('\n')) {
    if (!/^(> )*\|/.test(line)) continue;
    const cols = line.replace(/^(> )*\|?/, '').replace(/\|\s*$/, '').split(/(?<!\\)\|/).length;
    if (cols > LIMIT.columns) warn(`a table has ${cols} columns (at most ${LIMIT.columns})`);
  }
  const tag = /<(?!https?:|br>)[/!a-z][^>\n]*>/i.exec(plain)?.[0];
  if (tag) warn(`${tag.slice(0, 40)}: HTML or a placeholder left over; use callouts, tables and embeds`);
  if (/^# /m.test(plain)) warn('no # heading: the file name is the title');
  for (const h of plain.matchAll(/^#{2,4} (.+)$/gm)) if (GENERIC.test(h[1].trim())) warn(`heading "${h[1]}" says nothing: state the point`);
  if (/\[\^[^\]]+\]/.test(plain)) warn('footnotes are not used: put a year inline where a fact can age');
  const textLinks = new Set(links(plain).map((l) => l.target));
  for (const l of links(Object.values(meta).flat().join('\n'))) if (!textLinks.has(l.target)) warn(`property link ${l.raw} also needs a link in the text: properties are hidden while reading`);
  for (const d of mermaids(body)) {
    const first = d.split('\n')[0].trim();
    if (!/^(flowchart|graph)\b/.test(first)) continue;
    const count = nodeIds(d).size, max = /\b(LR|RL)\b/.test(first) ? LIMIT.lrNodes : LIMIT.nodes;
    if (count > max) warn(`a ${first} diagram has ${count} nodes (at most ${max}; ${max === LIMIT.lrNodes ? 'use TD' : 'split it'})`);
    for (const m of d.matchAll(/^\s*class\s+([\w, ]+?)\s+internal-link/gm)) {
      for (const id of m[1].split(/[,\s]+/).filter(Boolean)) {
        const label = new RegExp(`\\b${id}\\s*[\\[({]+"?([^"\\])}]+)`).exec(d)?.[1]?.trim() ?? id;
        if (!resolves(vi, label)) warn(`diagram node "${label}" is an internal-link to no note`);
        else if (!textLinks.has(label) && label !== name) warn(`diagram node "${label}" also needs a [[link]] in the text: links in diagrams do not reach the graph`);
      }
    }
  }
  for (const l of links(plain)) {
    if (!l.embed || !/\.svg$/i.test(l.target)) continue;
    const svgPath = Object.keys(vi.files).find((p) => p.toLowerCase().endsWith(l.target.toLowerCase().split('/').pop()) && p.endsWith('.svg'));
    if (!svgPath) continue; // a missing file is reported by the every-note rules
    const s = vi.files[svgPath];
    const vb = /viewBox="0 0 ([\d.]+) [\d.]+"/.exec(s);
    if (!vb || Number(vb[1]) > LIMIT.svgWidth) warn(`${l.target}: viewBox must start at 0 0 and be at most ${LIMIT.svgWidth} wide, to stay readable on a phone`);
    if (!/<title>[^<]+<\/title>/.test(s)) warn(`${l.target}: needs a <title> that says what it shows`);
    if ([...s.matchAll(/font-size(?:=|:)\s*"?([\d.]+)/g)].some((m) => Number(m[1]) < LIMIT.svgFont)) warn(`${l.target}: text under ${LIMIT.svgFont} px`);
    if (/<(script|foreignObject|image)\b|\bon\w+=|href="http/i.test(s)) warn(`${l.target}: only plain shapes and text`);
  }
  // the reader's own words do not count
  const seen = visible(body).split(/^## In my own words$/m)[0];
  for (const p of seen.split(/\n\s*\n/)) {
    if (/^\s*([#>|!-]|\d+\.|\*\s|```)/.test(p) || !p.trim()) continue;
    const sentences = p.trim().split(/(?<=[.!?])\s+(?=[A-Z[*])/).length;
    if (words(p) > LIMIT.para || sentences > 2) warn(`long paragraph (${sentences} sentences, ${words(p)} words): "${p.trim().slice(0, 50)}"`);
  }
  const bottom = /^\s*> \[!abstract\][^\n]*\n((?:>.*\n?)*)/.exec(body);
  if (!bottom) warn('must start with a > [!abstract] callout');
  else if (words(bottom[1].replace(/^>/gm, '')) > LIMIT.bottom) warn(`the first callout is over ${LIMIT.bottom} words`);
  if (words(seen) > LIMIT.words) warn(`${words(seen)} visible words (at most ${LIMIT.words}): move depth to folded callouts`);
  for (const s of body.split(/^## /m).slice(1)) {
    if (/^In my own words\s*$/.test(s.split('\n')[0])) continue;
    if (!/^```mermaid|^(> )?\||^!\[\[|^\d+\. /m.test(s.slice(s.indexOf('\n') + 1))) warn(`section "${s.split('\n')[0]}" has no diagram, table, picture or steps`);
  }
  if (mermaids(body).length < 2) warn('needs at least 2 Mermaid diagrams');
  if (/^> \[!question\]/m.test(body)) warn('no question callouts: the note holds only what is used');
  if (!/^## In my own words$/m.test(body)) warn('needs a "## In my own words" section');
  const linked = Object.entries(vi.notes).some(([, n]) => n.meta.type === 'map' && links(n.body).some((l) => l.target.toLowerCase() === name.toLowerCase()));
  if (!linked) warn('is not linked from a map note');
}

// JSON Canvas 1.0: unique ids, required node fields, edges between existing nodes, file nodes pointing at vault files.
export function checkCanvas(text, vi, warn) {
  let c;
  try { c = JSON.parse(text); } catch (e) { warn(`not valid JSON (${e.message})`); return; }
  const nodes = c?.nodes ?? [], edges = c?.edges ?? [];
  if (!Array.isArray(nodes) || !Array.isArray(edges)) { warn('nodes and edges must be arrays'); return; }
  const ids = new Set();
  for (const n of nodes) {
    if (ids.has(n?.id)) warn(`node id ${n?.id} is used twice`);
    ids.add(n?.id);
    if (!['text', 'file', 'link', 'group'].includes(n?.type)) warn(`node ${n?.id}: type must be text, file, link or group`);
    for (const k of ['id', 'x', 'y', 'width', 'height']) if (n?.[k] === undefined) warn(`node ${n?.id ?? '?'}: missing ${k}`);
    if (n?.type === 'file' && typeof n.file === 'string' && !resolves(vi, n.file) && !/^personal\//i.test(n.file)) warn(`node ${n.id}: file ${n.file} does not exist in the vault`);
  }
  for (const e of edges) {
    if (ids.has(e?.id)) warn(`edge id ${e?.id} is used twice`);
    ids.add(e?.id);
    for (const k of ['fromNode', 'toNode']) if (!nodes.some((n) => n?.id === e?.[k])) warn(`edge ${e?.id}: ${k} ${e?.[k]} is no node`);
  }
}

// Obsidian Bases: YAML with known top-level keys and at least one named view of a known type; formula.X needs formulas.X.
export function checkBase(text, warn) {
  const t = text.replace(/\r\n/g, '\n');
  if (/^\t/m.test(t)) warn('tabs are not valid YAML indentation');
  const top = [...t.matchAll(/^([A-Za-z_][\w-]*):/gm)].map((m) => m[1]);
  for (const k of top) if (!['filters', 'formulas', 'properties', 'summaries', 'views'].includes(k)) warn(`unknown top-level key ${k}`);
  const views = /^views:\n((?:[ \t-].*\n?|\n)*)/m.exec(t)?.[1] ?? '';
  const items = views.split(/^\s{0,4}- (?=\w+:)/m).slice(1);
  if (!items.length) warn('needs views: with at least one view');
  for (const v of items) {
    const type = /^(?:\s*)type:\s*(\S+)/m.exec(v)?.[1];
    if (!['table', 'cards', 'list', 'map', 'kanban'].includes(type)) warn(`view type ${type ?? '(none)'}: use table, cards, list, map or kanban`);
    if (!/^\s*name:\s*\S/m.test(v)) warn(`a ${type ?? ''} view has no name`);
  }
  const formulas = /^formulas:\n((?:[ \t].*\n?)*)/m.exec(t)?.[1] ?? '';
  const defined = new Set([...formulas.matchAll(/^\s+([\w-]+):/gm)].map((m) => m[1]));
  for (const m of t.matchAll(/\bformula\.([\w-]+)/g)) if (!defined.has(m[1])) warn(`formula.${m[1]} is not defined in formulas`);
}

// Warnings for one vault file (a note, base or canvas), each prefixed with its path.
export function checkFile(path, vi, banned = []) {
  const out = [];
  const warn = (msg) => out.push(`${path}: ${msg}`);
  if (path.endsWith('.md')) {
    checkEveryNote(path, vi, warn);
    if (vi.notes[path].meta.type === 'topic') checkTopic(path, vi, banned, warn);
  } else if (path.endsWith('.canvas')) checkCanvas(vi.files[path], vi, warn);
  else if (path.endsWith('.base')) checkBase(vi.files[path], warn);
  return out;
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.name.startsWith('.') || PRIVATE.test(e.name) ? []
  : e.isDirectory() ? walk(join(dir, e.name)).map((f) => `${e.name}/${f}`) : [e.name]);

// the nearest .ai-device.json above this script, or AI_DEVICE_FILE
export function findDevice(start = dirname(fileURLToPath(import.meta.url))) {
  if (process.env.AI_DEVICE_FILE) return process.env.AI_DEVICE_FILE;
  for (let d = resolve(start); ; d = dirname(d)) {
    if (existsSync(join(d, '.ai-device.json'))) return join(d, '.ai-device.json');
    if (dirname(d) === d) return null;
  }
}

export function main(args, deviceFile = findDevice()) {
  let device = {};
  try { device = JSON.parse(readFileSync(deviceFile, 'utf8')); } catch { /* no device file: no vault */ }
  const vault = device.vault;
  if (!vault) { console.error('no vault: run the install (node install.mjs in the AI-Setup repo); it records the vault path in .ai-device.json'); return 1; }
  if (!existsSync(vault) || !statSync(vault).isDirectory() || !existsSync(join(vault, '.obsidian'))) { console.error(`${vault} is not an Obsidian vault`); return 1; }
  const all = walk(vault);
  const files = Object.fromEntries(all.map((f) => [f, /\.(md|base|canvas|svg)$/i.test(f) ? readFileSync(join(vault, f), 'utf8') : '']));
  const vi = index(files);
  if (args[0] === 'check' && args.length <= 2) {
    // templates hold placeholders ({{date}}), not notes
    const checkable = all.filter((f) => /\.(md|base|canvas)$/.test(f) && !/^Templates\//.test(f));
    let targets = checkable;
    if (args[1]) {
      const want = args[1].replace(/\\/g, '/').toLowerCase();
      targets = checkable.filter((f) => { const l = f.toLowerCase(); return l === want || l.replace(/\.md$/, '') === want || l.split('/').pop() === want || l.split('/').pop().replace(/\.md$/, '') === want; });
      if (!targets.length) { console.log(`scan: ${args[1]}: no such note, base or canvas`); return 1; }
    }
    const warnings = targets.flatMap((f) => checkFile(f, vi, device.projects ?? []));
    for (const w of warnings) console.log(`scan: ${w}`);
    console.log(warnings.length ? `${warnings.length} to fix` : 'clean');
    return warnings.length ? 1 : 0;
  }
  if (args.length) { console.error('usage: node vault.mjs [check ["<note>"]]'); return 1; }
  console.log(`vault: ${vault}`);
  for (const [p, n] of Object.entries(vi.notes)) console.log([p, n.meta.type ?? '-', list(n.meta.aliases).join(', ')].join(' | '));
  for (const f of all.filter((x) => /^Books\/.*\.pdf$/i.test(x))) console.log(`book: ${f}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
