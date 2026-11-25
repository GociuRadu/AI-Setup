import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseNote, links, visible, checkTopic, main } from './vault.mjs';

// other notes the topic links to: they only need to exist
const names = ['C1', 'C2', 'C3', 'C4', 'C5'];
const topicNote = `---
type: topic
created: 2026-11-24
updated: 2026-11-24
---
> [!abstract] Bottom line
> One sentence.

## The stage sits between two others
\`\`\`mermaid
flowchart TD
  a[C1] -->|why| b["C2"]
  class a,b internal-link
\`\`\`

## Five terms carry it
| Term | Means |
|---|---|
| [[C1]] | one[^1] |
| [[C2\\|second]] | two |

[[C3]], [[C4]] and [[C5]] follow.

## The shape is a stack
![[pic.svg|480]]

\`\`\`mermaid
stateDiagram-v2
  [*] --> Open
\`\`\`

## Steps run in order
1. First.
2. Second.

[^1]: [Source](https://example.com), 2026

## In my own words

`;
const good = () => ({
  notes: { Topic: topicNote, 'Learning map': '---\ntype: map\n---\n[[Topic]]\n' },
  files: new Set(['topic', 'learning map', 'pic.svg', 'book.pdf', ...names.map((n) => n.toLowerCase())]),
  svg: { 'pic.svg': '<svg viewBox="0 0 480 200"><title>Stack</title><text font-size="18">x</text></svg>' },
});
const scan = (change = () => {}, banned = []) => {
  const g = good();
  change(g);
  return checkTopic('Topic', g.notes, g.files, g.svg, banned).warnings;
};
const swap = (note, a, b) => (g) => { assert.ok(g.notes[note].includes(a), a); g.notes[note] = g.notes[note].replace(a, () => b); };

test('notes: properties, links and the text seen before anything is opened', () => {
  const { meta, body } = parseNote('---\r\ntype: topic\r\nnext:\r\n  - "[[A]]"\r\n  - "[[B]]"\r\naliases: [x, "y z"]\r\n---\r\ntext');
  assert.deepEqual(meta, { type: 'topic', next: ['[[A]]', '[[B]]'], aliases: ['x', 'y z'] });
  assert.equal(body, 'text');
  assert.deepEqual(links('![[a.svg|300]] [[N#H\\|l]] [[b.pdf#page=3|p]]').map((l) => [l.embed, l.target, l.part]), [[true, 'a.svg', undefined], [false, 'N', 'H'], [false, 'b.pdf', 'page=3']]);
  assert.equal(visible('seen\n> [!info]- closed\n> hidden\n\n> [!info] open\n> shown\n[^1]: hidden\n```js\nhidden\n```\nend').replace(/\n+/g, ' '), 'seen > [!info] open > shown end');
});

test('a complete topic is clean', () => assert.deepEqual(scan(), []));

test('each broken rule gives its own warning', () => {
  const cases = [
    [swap('Topic', '[[C3]]', '[[Gone]]'), /Topic: \[\[Gone\]\] does not exist/],
    [swap('Topic', '[[C3]]', '[[Personal/x]]'), /links to a private note/],
    [swap('Topic', '[[C2\\|second]]', '[[C2|second]]'), /needs \\\|/],
    [swap('Topic', '[^1]: [Source](https://example.com), 2026', '[^1]: from memory'), /footnote 1 needs a source link/],
    [swap('Topic', 'one[^1]', 'one[^9]'), /footnote 9 has no text/],
    [swap('Topic', '2. Second.', '2. Second.\n\n> [!question]- Why?\n> Because.'), /no question callouts/],
    [swap('Topic', '![[pic.svg|480]]', 'no picture'), /needs a picture/],
    [swap('Topic', '## Five terms carry it', '## Overview'), /heading "Overview" says nothing/],
    [swap('Topic', 'class a,b internal-link', 'class a,b internal-link\n  c[Ghost]\n  class c internal-link'), /"Ghost" is an internal-link to no note/],
    [swap('Topic', '| [[C1]] | one', '| C1 | one'), /"C1" also needs a \[\[link\]\]/],
    [swap('Topic', 'stateDiagram-v2', 'fancyDiagram'), /unknown diagram type: fancyDiagram/],
    [swap('Topic', 'flowchart TD', 'flowchart LR\n  c --> d --> e'), /flowchart LR diagram has 5 nodes \(at most 4; use TD\)/],
    [swap('Topic', '[[C3]], [[C4]] and [[C5]] follow.', '[[C3]] a. [[C4]] b. [[C5]] c.'), /long paragraph \(3 sentences/],
    [swap('Topic', 'One sentence.', 'word '.repeat(41)), /first callout is over 40 words/],
    [swap('Topic', '[[C3]], [[C4]]', `${'- word word word\n'.repeat(510)}\n[[C3]], [[C4]]`), /visible words \(at most 1500\)/],
    [swap('Topic', '## Steps run', '## Only words here\ntext\n\n## Steps run'), /section "Only words here" has no diagram/],
    [swap('Topic', '| Term | Means |', '| a | b | c | d | e | f |'), /6 columns/],
    [swap('Topic', 'One sentence.', '<details>x</details>'), /<details>: HTML/],
    [swap('Topic', 'One sentence.', '<one sentence>'), /Topic: <one sentence>: HTML or a placeholder/],
    [(g) => { g.svg['pic.svg'] = '<svg viewBox="0 0 900 200"><text font-size="10">x</text></svg>'; }, /at most 520 wide[\s\S]*needs a <title>[\s\S]*under 16 px/],
    [(g) => { g.svg['pic.svg'] = '<svg viewBox="0 0 480 200"><title>t</title><script>1</script></svg>'; }, /only plain shapes/],
    [swap('Topic', '## In my own words', '## Mine'), /needs a "## In my own words"/],
    [swap('Topic', 'type: topic', 'type: topic\nnext: "[[C1]]"\nprevious: "[[C5x]]"'), /property link \[\[C5x\]\] also needs a link in the text/],
    [swap('Topic', 'updated: 2026-11-24', 'updated: today'), /property updated must be/],
    [(g) => { delete g.notes['Learning map']; }, /not linked from a map note/],
  ];
  for (const [change, re] of cases) assert.match(scan(change).join('\n'), re);
  assert.match(checkTopic('Nope', {}, new Set()).warnings[0], /no such note/);
  assert.match(checkTopic('constructor', {}, new Set()).warnings[0], /no such note/);
  // words on an edge are not nodes
  assert.deepEqual(scan(swap('Topic', 'flowchart TD', 'flowchart LR\n  a -- one --> b\n  b -- two --> c\n  c -- three --> d')), []);
});

test("the reader's own words are not counted", () => {
  assert.deepEqual(scan(swap('Topic', '## In my own words\n', `## In my own words\n- ${'mine '.repeat(1600)}\n`)), []);
});

test('a workspace project name in the note is flagged, a word that only contains it is not', () => {
  assert.match(scan(swap('Topic', 'One sentence.', 'As in the ACME repo.'), ['ACME']).join('\n'), /names the project "ACME": examples stay generic/);
  assert.match(scan(swap('Topic', 'One sentence.', 'Branch `acme-app/feat`.'), ['acme-app']).join('\n'), /acme-app/);
  assert.deepEqual(scan(swap('Topic', 'One sentence.', 'ACMEX and RFQS stay.'), ['ACME', 'RFQ']), []);
});

test('main lists Learn and Books, never the private folder, and says what to do without a vault', (t) => {
  const out = [], err = [];
  t.mock.method(console, 'log', (l) => out.push(l));
  t.mock.method(console, 'error', (l) => err.push(l));
  const root = mkdtempSync(join(tmpdir(), 'ws-'));
  assert.equal(main([], root), 1);
  assert.match(err[0], /set it in the setup page/);
  const vault = mkdtempSync(join(tmpdir(), 'vault-'));
  for (const d of ['.obsidian', 'Learn', 'Books', 'Personal']) mkdirSync(join(vault, d));
  writeFileSync(join(root, '.ai-device.json'), JSON.stringify({ obsidian: { vault } }));
  writeFileSync(join(vault, 'Learn/Topic.md'), topicNote);
  writeFileSync(join(vault, 'Books/b.pdf'), '');
  writeFileSync(join(vault, 'Personal/secret note.md'), 'x');
  assert.equal(main([], root), 0);
  assert.deepEqual(out, [`vault: ${vault}`, 'Topic | topic |  | ', 'book: Books/b.pdf']);
  // the private folder is never listed, so a link into it does not resolve
  writeFileSync(join(vault, 'Learn/Topic.md'), topicNote.replace('[[C3]]', '[[secret note]]'));
  assert.equal(main(['check', 'Topic'], root), 1);
  assert.ok(out.some((l) => /secret note\]\] does not exist/.test(l)));
  // a folder of the workspace with a code/ repo is a project: its name may not appear in a note
  mkdirSync(join(root, 'Shop', 'code'), { recursive: true });
  writeFileSync(join(vault, 'Learn/Topic.md'), topicNote.replace('One sentence.', 'The Shop repo.'));
  out.length = 0;
  assert.equal(main(['check', 'Topic'], root), 1);
  assert.ok(out.some((l) => /names the project "Shop"/.test(l)), out.join('\n'));
  assert.equal(main(['nope'], root), 1);
});
