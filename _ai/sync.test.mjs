import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, relink, build, brokenLinks, missingPaths, main, ROOT } from './sync.mjs';

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

test('build covers every helper for the three tools with no broken links', () => {
  const out = build('work');
  const helpers = ['challenger', 'reviewer', 'scout', 'tester', 'worker'];
  for (const a of helpers) {
    assert.match(out[`.claude/agents/${a}.md`], /^omitClaudeMd: true$/m, a);
    assert.ok(out[`.kiro/agents/${a}.json`], a);
    assert.ok(out[`.github/agents/${a}.agent.md`].includes('model: "Claude'), a);
  }
  assert.deepEqual(Object.keys(out).filter((k) => k.startsWith('.github/agents/')).sort(), helpers.map((a) => `.github/agents/${a}.agent.md`));
  assert.deepEqual(brokenLinks(out), []);
});

test('Copilot gets every skill, every rule as .instructions.md and the same guard command', () => {
  const out = build('work');
  for (const d of readdirSync(join(ROOT, '_ai/skills'), { withFileTypes: true }).filter((e) => e.isDirectory())) {
    assert.ok(out[`.github/skills/${d.name}/SKILL.md`], d.name);
  }
  for (const f of readdirSync(join(ROOT, '_ai/rules')).filter((n) => n.endsWith('.md'))) {
    assert.ok(out[`.github/instructions/${f.replace(/\.md$/, '.instructions.md')}`].startsWith('---\napplyTo: '), f);
  }
  const claudeGuard = JSON.parse(out['.claude/settings.json']).hooks.PreToolUse[0].hooks[0].command;
  assert.equal(JSON.parse(out['.github/hooks/guard.json']).hooks.PreToolUse[0].command, claudeGuard);
});

test('build writes only the chosen tools', () => {
  assert.ok(!Object.keys(build('home', ['claude', 'kiro'])).some((k) => k.startsWith('.github/')));
  const out = build('work', ['copilot', 'kiro']);
  assert.ok(!Object.keys(out).some((k) => k.startsWith('.claude/') || k === 'CLAUDE.local.md'));
  assert.ok(out['.github/copilot-instructions.md'].includes('profile: work'));
});

test('main migrates the old profile mark, keeps user files in .github and checks extras', (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const tmp = mkdtempSync(join(tmpdir(), 'sync-'));
  writeFileSync(join(tmp, 'CLAUDE.local.md'), '<!-- profile: work. old -->\n');
  assert.equal(main([], tmp), 0);
  assert.deepEqual(JSON.parse(readFileSync(join(tmp, '.ai-device.json'), 'utf8')), { profile: 'work', tools: ['claude', 'kiro'] });
  assert.ok(existsSync(join(tmp, '.claude/agents/scout.md')));
  assert.ok(!existsSync(join(tmp, '.github/agents')));

  mkdirSync(join(tmp, '.github/workflows'), { recursive: true });
  writeFileSync(join(tmp, '.github/workflows/ci.yml'), 'on: push\n');
  assert.equal(main(['home', '--tools', 'copilot,kiro'], tmp), 0);
  assert.ok(existsSync(join(tmp, '.github/workflows/ci.yml')));
  for (const gone of ['.claude/agents', '.claude/settings.local.json', 'CLAUDE.local.md']) assert.ok(!existsSync(join(tmp, gone)), gone);
  assert.ok(existsSync(join(tmp, '.github/agents/scout.agent.md')));
  assert.equal(main(['--check'], tmp), 0);

  mkdirSync(join(tmp, '.claude/agents'), { recursive: true });
  writeFileSync(join(tmp, '.claude/agents/x.md'), 'x');
  console.log.mock.resetCalls();
  assert.equal(main(['--check'], tmp), 1);
  assert.ok(console.log.mock.calls.some((c) => String(c.arguments[0]).split('\n').includes('extra: .claude/agents/x.md')));
});

test('main rejects a broken device file and a first run without settings', (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const tmp2 = mkdtempSync(join(tmpdir(), 'sync-'));
  writeFileSync(join(tmp2, '.ai-device.json'), '{');
  assert.throws(() => main([], tmp2), /not valid JSON/);
  const tmp3 = mkdtempSync(join(tmpdir(), 'sync-'));
  assert.equal(main([], tmp3), 1);
  assert.equal(main(['--tools', 'vim'], tmp3), 1);
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
