import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, relink, build, brokenLinks } from './sync.mjs';

test('parse reads quoted strings and lists', () => {
  const { meta, body } = parse('---\nname: x\ndescription: "a: b"\ntools: [read, search]\n---\nhi\n');
  assert.deepEqual(meta, { name: 'x', description: 'a: b', tools: ['read', 'search'] });
  assert.equal(body, 'hi\n');
});

test('relink maps rules to the Claude copy and to the source for Kiro', () => {
  const src = '_ai/skills/data/SKILL.md';
  assert.equal(relink('[r](../../rules/sql.md#x)', src, '.claude/skills/data/SKILL.md', 'claude'), '[r](../../rules/sql.md#x)');
  assert.equal(relink('[r](../../rules/sql.md)', src, '.kiro/skills/data/SKILL.md', 'kiro'), '[r](../../../_ai/rules/sql.md)');
});

test('build covers every agent for both tools with no broken links', () => {
  const out = build('work');
  for (const a of ['orchestrator', 'scout', 'tester', 'worker', 'reviewer', 'challenger']) {
    assert.ok(out[`.claude/agents/${a}.md`] && out[`.kiro/agents/${a}.json`], a);
  }
  assert.ok(out['CLAUDE.local.md'].includes('profile: work'));
  assert.deepEqual(brokenLinks(out), []);
});
