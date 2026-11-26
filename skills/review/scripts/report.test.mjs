import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chain, graph, inline, render, source } from './report.mjs';

test('chain reads node kinds and arrow labels', () => {
  assert.deepEqual(chain('a > [main] > !risk > +new >on error> b'), [
    { id: 'a', kind: '', label: '' },
    { id: 'main', kind: 'main', label: '' },
    { id: 'risk', kind: 'risk', label: '' },
    { id: 'new', kind: 'new', label: '' },
    { id: 'b', kind: '', label: 'on error' },
  ]);
});

const xs = (svg) => Object.fromEntries([...svg.matchAll(/<rect x="(\d+)" y="(\d+)"[^>]*\/><text[^>]*><tspan[^>]*>([^<]+)</g)].map((m) => [m[3], { x: +m[1], y: +m[2] }]));

test('graph: the same text is one node, layers run left to right, a cycle is dashed', () => {
  const svg = graph('a > b > d\na > c > d\nd > a');
  const at = xs(svg);
  assert.deepEqual(Object.keys(at), ['a', 'b', 'd', 'c']);
  assert.ok(at.a.x < at.b.x && at.b.x === at.c.x && at.c.x < at.d.x, JSON.stringify(at));
  assert.notEqual(at.b.y, at.c.y);
  assert.equal((svg.match(/class="e"/g) ?? []).length, 4);
  assert.equal((svg.match(/class="e back"/g) ?? []).length, 1);
});

test('graph turns top-down when asked or when too wide', () => {
  assert.ok(xs(graph('a > b', true)).a.y < xs(graph('a > b', true)).b.y);
  const wide = Array.from({ length: 12 }, (_, i) => `a fairly long node name ${i}`).join(' > ');
  const at = xs(graph(wide));
  assert.ok(Object.values(at).every((p, i, all) => !i || p.y > all[i - 1].y));
});

test('inline escapes HTML and keeps only safe links', () => {
  assert.equal(inline('**a** `<b>` [x](docs/a.md#L3) [y](javascript:alert)'), '<strong>a</strong> <code>&lt;b&gt;</code> <a href="docs/a.md#L3">x</a> y');
});

test('the template builds with no scan warning and keeps its source', () => {
  const md = readFileSync(new URL('../report-template.md', import.meta.url), 'utf8');
  const { html, warnings } = render(md);
  assert.deepEqual(warnings, []);
  assert.equal(source(html), md);
  for (const part of ['class="bottom"', 'class="decide"', 'class="card high"', 'class="card q"', 'class="compare"', '<svg class="graph"', 'class="flow"', 'class="bars"', 'class="seq"', 'class="tree"']) assert.ok(html.includes(part), part);
});

test('only http(s), mailto and relative links become links', () => {
  assert.equal(inline('[a](https://x.dev/p?q=1) [b](mailto:a@b.c) [c](../x.md#L2)'), '<a href="https://x.dev/p?q=1">a</a> <a href="mailto:a@b.c">b</a> <a href="../x.md#L2">c</a>');
  for (const href of ['javascript:alert', '\u0001javascript:alert', 'data:text/html,x', 'vbscript:x', 'C:/x']) assert.equal(inline(`[t](${href})`), 't', JSON.stringify(href));
  assert.equal(inline('[t](a**b**c)'), '<a href="a**b**c">t</a>');
});

test('CRLF sources come back unchanged', () => {
  const md = '# T\r\n**Bottom line:** ok.\r\n';
  assert.equal(source(render(md).html), md);
});

test('a table without a |---| line keeps its first row', () => {
  assert.ok(render('# T\n**Bottom line:** ok.\n\n## It works\n| a | b |\n| 1 | 2 |\n| 3 | 4 |\n').html.includes('<td>1</td><td>2</td></tr><tr><td>3</td><td>4</td>'));
});

test('broken input is named, not drawn', () => {
  const head = '# T\n**Bottom line:** ok.\n\n';
  assert.deepEqual(render(`${head}\`\`\`bars\nA: 1.2.3\nB: 2\n\`\`\`\n`).warnings, ['bars value is not a number: 1.2.3']);
  assert.deepEqual(render(`${head}\`\`\`graph\n\`\`\`\n`).warnings, ['empty graph block']);
  assert.deepEqual(render(`${head}\`\`\`flow\nA: a > b\n`).warnings, ['unclosed ```flow block']);
  assert.deepEqual(render(`${head}<!-- note\nmore\n`).warnings, ['unclosed <!-- comment hides the rest of the file']);
});

test('status cells become chips; High is a chip only in a Sev column', () => {
  const { html } = render('# T\n**Bottom line:** ok.\n\n## It works\n| Check | Sev | Result |\n|---|---|---|\n| High load | High | done |\n');
  assert.ok(html.includes('<td>High load</td><td><span class="chip no">High</span></td><td><span class="chip ok">done</span></td>'));
});

test('scan warnings name each broken limit', () => {
  const long = Array(52).fill('word').join(' ');
  const md = ['# T', '', '## Overview', long + '.', '', '- a\n- b\n- c\n- d\n- e\n- f\n- g\n- h', '',
    '| a | b | c | d | e | f |\n|---|---|---|---|---|---|\n| 1 | 2 | 3 | 4 | 5 | 6 |', '', '## Text only', 'One. Two. Three.', '', '```mermaid\ngraph LR\n```'].join('\n');
  assert.deepEqual(render(md).warnings, [
    'heading "Overview" names a topic; state the conclusion',
    'paragraph "word word word word word word word word ..." has 52 words, 1 sentences (max 50 words, 2 sentences)',
    'list "a..." has 8 items (max 7)',
    'table "a" has 6 columns (max 5)',
    'paragraph "One. Two. Three...." has 3 words, 3 sentences (max 50 words, 2 sentences)',
    'Mermaid block: use graph, flow, bars, compare, seq or tree',
    'section "Text only" has no picture (diagram, compare, table or steps)',
    'no **Bottom line:** paragraph',
  ]);
});

test('the collapsed Evidence is not counted', () => {
  const md = `# T\n**Bottom line:** ok.\n\n<details><summary>Evidence</summary>\n\n${Array(700).fill('word').join(' ')}\n\n</details>\n`;
  assert.deepEqual(render(md).warnings, []);
});
