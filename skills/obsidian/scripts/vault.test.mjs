import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseNote, links, visible, index, checkFile, main } from './vault.mjs';

const topicNote = `---
type: topic
created: 2026-11-24
updated: 2026-11-24
---
> [!abstract] Bottom line
> One sentence.

## 1. The stage sits between two others
\`\`\`mermaid
flowchart TD
  a[C1] -->|why| b["C2"]
  class a,b internal-link
\`\`\`

## 2. Five terms carry it
| Term | Means |
|---|---|
| [[C1]] | one (2026) |
| [[C2\\|second]] | two |

[[C3]], [[C4]] and [[Books/b.pdf#page=3|p. 3]] follow.

## 3. The shape is a stack
\`\`\`mermaid
stateDiagram-v2
  [*] --> Open
\`\`\`

## 4. Steps run in order
1. First.
2. Second.

## In my own words

`;
const good = () => ({
  'Learn/Topic.md': topicNote,
  'Learn/Learning map.md': '---\ntype: map\n---\n[[Topic]]\n',
  'Learn/Sub/C1.md': 'x', 'C2.md': 'x', 'C3.md': 'x', 'C4.md': 'x',
});
const scan = (change = () => {}, banned = [], path = 'Learn/Topic.md') => {
  const files = good();
  change(files);
  return checkFile(path, index(files), banned);
};
const swap = (a, b, note = 'Learn/Topic.md') => (f) => { assert.ok(f[note].includes(a), a); f[note] = f[note].replace(a, () => b); };

test('notes: properties, links and the text seen before anything is opened', () => {
  const { meta, body } = parseNote('---\r\ntype: topic\r\nnext:\r\n  - "[[A]]"\r\n  - "[[B]]"\r\naliases: [x, "y z"]\r\n---\r\ntext');
  assert.deepEqual(meta, { type: 'topic', next: ['[[A]]', '[[B]]'], aliases: ['x', 'y z'] });
  assert.equal(body, 'text');
  assert.deepEqual(links('![[a.svg|300]] [[N#H\\|l]] [[b.pdf#page=3|p]]').map((l) => [l.embed, l.target, l.part]), [[true, 'a.svg', undefined], [false, 'N', 'H'], [false, 'b.pdf', 'page=3']]);
  assert.equal(visible('seen\n> [!info]- closed\n> hidden\n\n> [!info] open\n> shown\n```js\nhidden\n```\nend').replace(/\n+/g, ' '), 'seen > [!info] open > shown end');
});

test('a complete study note is clean, with a missing Books PDF and a link into a subfolder', () => assert.deepEqual(scan(), []));

test('each broken study-note rule gives its own warning', () => {
  const cases = [
    [swap('[[C3]]', '[[Gone]]'), /\[\[Gone\]\] does not exist/],
    [swap('[[C2\\|second]]', '[[C2|second]]'), /needs \\\|/],
    [swap('one (2026)', 'one[^1]\n\n[^1]: [Source](https://example.com)'), /footnotes: no sources section/],
    [swap('2. Second.', '2. Second.\n\n> [!question]- Why?\n> Because.'), /no question callouts/],
    [swap('## 2. Five terms carry it', '## Overview'), /heading "Overview" says nothing/],
    [swap('class a,b internal-link', 'class a,b internal-link\n  c[Ghost]\n  class c internal-link'), /"Ghost" is an internal-link to no note/],
    [swap('| [[C1]] | one', '| C1 | one'), /"C1" also needs a \[\[link\]\]/],
    [swap('stateDiagram-v2', 'fancyDiagram'), /unknown diagram type: fancyDiagram/],
    [swap('flowchart TD', 'flowchart LR\n  c --> d --> e'), /flowchart LR diagram has 5 nodes \(at most 4; use TD\)/],
    [swap('[[C3]], [[C4]] and', '[[C3]] a. [[C4]] b. More c. and'), /long paragraph \(3 sentences/],
    [swap('One sentence.', 'word '.repeat(41)), /first callout is over 40 words/],
    [swap('[[C3]], [[C4]]', `${'- word word word\n'.repeat(510)}\n[[C3]], [[C4]]`), /visible words \(at most 1500\)/],
    [swap('## 4. Steps run', '## 5. Only words here\ntext\n\n## 4. Steps run'), /section "5. Only words here" has no diagram/],
    [swap('| Term | Means |', '| a | b | c | d | e | f |'), /6 columns/],
    [swap('One sentence.', '<details>x</details>'), /<details>: HTML/],
    [swap('One sentence.', '<one sentence>'), /<one sentence>: HTML or a placeholder/],
    [swap('\`\`\`mermaid\nstateDiagram-v2\n  [*] --> Open\n\`\`\`', '| a | b |'), /needs at least 2 Mermaid diagrams/],
    [swap('## In my own words', '## Mine'), /needs a "## In my own words"/],
    [swap('type: topic', 'type: topic\nnext: "[[C1]]"\nprevious: "[[C5x]]"'), /property link \[\[C5x\]\] also needs a link in the text/],
    [swap('updated: 2026-11-24', 'updated: today'), /property updated must be/],
    [swap('[[Books/b.pdf#page=3|p. 3]]', '[[Books/b.pdf#p3|p. 3]]'), /needs #page=<number>/],
    [(f) => { delete f['Learn/Learning map.md']; }, /not linked from a map note/],
  ];
  for (const [change, re] of cases) assert.match(scan(change).join('\n'), re);
});

test('a link into the private folder is neither read nor flagged, nor is the user\'s own section', () => {
  assert.deepEqual(scan(swap('[[C3]]', '[[Personal/diary]]')), []);
  assert.deepEqual(scan(swap('## In my own words\n', '## In my own words\n![[Pasted image 1.png]] gone. Two. Three sentences here.\n')), []);
});

test('an embedded SVG must stay readable on a phone', () => {
  const add = (svg) => (f) => { f['Files/pic.svg'] = svg; swap('1. First.', '1. First.\n\n![[pic.svg|480]]')(f); };
  assert.deepEqual(scan(add('<svg viewBox="0 0 480 200"><title>Stack</title><text font-size="18">x</text></svg>')), []);
  assert.match(scan(add('<svg viewBox="0 0 900 200"><text font-size="10">x</text></svg>')).join('\n'), /at most 520 wide[\s\S]*needs a <title>[\s\S]*under 16 px/);
  assert.match(scan(add('<svg viewBox="0 0 480 200"><title>t</title><script>1</script></svg>')).join('\n'), /only plain shapes/);
});

test('a note that is not a study note gets only the every-note rules', () => {
  const inbox = (text) => (f) => { f['Inbox/quick.md'] = text; };
  assert.deepEqual(scan(inbox('A long line. Another one. And a third, with no diagram.'), [], 'Inbox/quick.md'), []);
  assert.match(scan(inbox('see [[Nowhere]]'), [], 'Inbox/quick.md').join('\n'), /Inbox\/quick.md: \[\[Nowhere\]\] does not exist/);
  assert.match(scan(inbox('---\ncreated: yesterday\n---\nx'), [], 'Inbox/quick.md').join('\n'), /property created must be YYYY-MM-DD/);
});

test('a workspace project name in a study note is flagged, a word that only contains it is not', () => {
  assert.match(scan(swap('One sentence.', 'As in the ACME repo.'), ['ACME']).join('\n'), /names the project "ACME": examples stay generic/);
  assert.deepEqual(scan(swap('One sentence.', 'ACMEX and RFQS stay.'), ['ACME', 'RFQ']), []);
});

test('canvas files: valid JSON, unique ids, edges between nodes, file nodes that exist', () => {
  const canvas = (c) => (f) => { f['Learn/Topic.canvas'] = typeof c === 'string' ? c : JSON.stringify(c); };
  const node = (id, extra = {}) => ({ id, type: 'text', text: 'x', x: 0, y: 0, width: 100, height: 50, ...extra });
  const ok = { nodes: [node('a'), node('b', { type: 'file', file: 'Learn/Topic.md' })], edges: [{ id: 'e', fromNode: 'a', toNode: 'b' }] };
  assert.deepEqual(scan(canvas(ok), [], 'Learn/Topic.canvas'), []);
  assert.match(scan(canvas('{nodes: ['), [], 'Learn/Topic.canvas')[0], /not valid JSON/);
  const bad = { nodes: [node('a'), node('a'), node('c', { type: 'file', file: 'Gone.md' })], edges: [{ id: 'e', fromNode: 'a', toNode: 'z' }] };
  assert.match(scan(canvas(bad), [], 'Learn/Topic.canvas').join('\n'), /node id a is used twice[\s\S]*file Gone.md does not exist[\s\S]*toNode z is no node/);
});

test('base files: known keys, named views of a known type, defined formulas', () => {
  const base = (t) => (f) => { f['Learn.base'] = t; };
  const ok = 'filters:\n  and:\n    - file.inFolder("Learn")\nformulas:\n  age: \'now() - file.ctime\'\nviews:\n  - type: table\n    name: Topics\n    order:\n      - file.name\n      - formula.age\n  - type: cards\n    name: All\n';
  assert.deepEqual(scan(base(ok), [], 'Learn.base'), []);
  assert.match(scan(base(ok.replace('type: cards', 'type: grid')), [], 'Learn.base').join('\n'), /view type grid/);
  assert.match(scan(base(ok.replace('formula.age', 'formula.size')), [], 'Learn.base').join('\n'), /formula.size is not defined/);
  assert.match(scan(base(`colour: red\n${ok}`), [], 'Learn.base').join('\n'), /unknown top-level key colour/);
  assert.match(scan(base(ok.replace('    name: All\n', '')), [], 'Learn.base').join('\n'), /a cards view has no name/);
});

test('main reads the vault and project names from the device file and never lists the private folder', (t) => {
  const out = [], err = [];
  t.mock.method(console, 'log', (l) => out.push(l));
  t.mock.method(console, 'error', (l) => err.push(l));
  const ws = mkdtempSync(join(tmpdir(), 'ws-'));
  const device = join(ws, '.ai-device.json');
  assert.equal(main([], device), 1);
  assert.match(err[0], /run the install/);
  const vault = mkdtempSync(join(tmpdir(), 'vault-'));
  for (const d of ['.obsidian', 'Learn/Sub', 'Books', 'Personal']) mkdirSync(join(vault, d), { recursive: true });
  writeFileSync(device, JSON.stringify({ vault, projects: ['Shop'] }));
  for (const [p, text] of Object.entries(good())) { mkdirSync(join(vault, p, '..'), { recursive: true }); writeFileSync(join(vault, p), text); }
  writeFileSync(join(vault, 'Books/b.pdf'), '');
  writeFileSync(join(vault, 'Personal/secret note.md'), 'x');
  mkdirSync(join(vault, 'Templates'));
  writeFileSync(join(vault, 'Templates/Book.md'), '---\ncreated: {{date}}\n---\n[[{{pdf}}]]');
  assert.equal(main([], device), 0);
  assert.ok(out.includes(`vault: ${vault}`) && out.includes('Learn/Sub/C1.md | - | ') && out.includes('book: Books/b.pdf'), out.join('\n'));
  assert.ok(!out.some((l) => /secret/.test(l)));
  out.length = 0;
  assert.equal(main(['check'], device), 0, out.join('\n'));
  assert.equal(out.at(-1), 'clean');
  writeFileSync(join(vault, 'Learn/Topic.md'), topicNote.replace('One sentence.', 'The Shop repo, see [[secret note]].'));
  out.length = 0;
  assert.equal(main(['check', 'Topic'], device), 1);
  assert.ok(out.some((l) => /names the project "Shop"/.test(l)) && out.some((l) => /secret note\]\] does not exist/.test(l)), out.join('\n'));
  assert.equal(main(['check', 'Nope'], device), 1);
  assert.equal(main(['nope'], device), 1);
});
