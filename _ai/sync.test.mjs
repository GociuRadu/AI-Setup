import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parse, relink, build, brokenLinks, missingPaths } from './sync.mjs';

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

test('helpers start without CLAUDE.md, the orchestrator keeps it and can use skills', () => {
  const out = build('work');
  for (const a of ['scout', 'tester', 'worker', 'reviewer', 'challenger']) assert.match(out[`.claude/agents/${a}.md`], /^omitClaudeMd: true$/m, a);
  assert.doesNotMatch(out['.claude/agents/orchestrator.md'], /omitClaudeMd/);
  assert.match(out['.claude/agents/orchestrator.md'], /^tools: "Read, Grep, Glob, Edit, Write, Agent\(scout, tester, worker, reviewer, challenger\), Skill"$/m);
});

test('the language reminder is one inline command, the same for both tools', () => {
  const out = build('work');
  const cmd = JSON.parse(out['.claude/settings.json']).hooks.UserPromptSubmit[0].hooks[0].command;
  assert.equal(JSON.parse(out['.kiro/hooks/lang.json']).hooks[0].action.command, cmd);
  assert.equal(spawnSync(cmd, { shell: true, encoding: 'utf8' }).stdout.trim(), 'Reply in English, even if this message is in Romanian or another language.');
});

test('missingPaths names an _ai path that does not exist and accepts real ones and placeholders', () => {
  assert.deepEqual(missingPaths(), []);
  // this test file names one missing path on purpose: _ai/no-such-file.mjs
  assert.deepEqual(missingPaths(['_ai/sync.test.mjs']), ['_ai/sync.test.mjs -> _ai/no-such-file.mjs']);
});
