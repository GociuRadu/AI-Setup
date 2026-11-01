// Sets this device's profile: node _ai/setup.mjs home|work
// Copies _ai/profiles/<profile>.md into the local file each tool loads on its own (all gitignored):
//   CLAUDE.local.md (Claude Code), .github/instructions/profile.instructions.md (Copilot), .kiro/steering/profile.md (Kiro)
// and sets Claude Code's permissions in .claude/settings.local.json (home: no prompts; work: prompts for all but reads).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const profile = process.argv[2];
if (!['home', 'work'].includes(profile)) { console.error('usage: node _ai/setup.mjs home|work'); process.exit(1); }

const body = readFileSync(join(ROOT, '_ai/profiles', `${profile}.md`), 'utf8').replace(/\r\n/g, '\n');
const note = `<!-- Written by node _ai/setup.mjs ${profile}. Edit _ai/profiles/${profile}.md and run it again. -->\n`;
const files = {
  'CLAUDE.local.md': note + body,
  '.github/instructions/profile.instructions.md': `---\napplyTo: "**"\n---\n${note}${body}`,
  '.kiro/steering/profile.md': `---\ninclusion: always\n---\n${note}${body}`,
};
for (const [f, text] of Object.entries(files)) {
  mkdirSync(dirname(join(ROOT, f)), { recursive: true });
  writeFileSync(join(ROOT, f), text);
}

// keep any other local Claude settings; only the permission mode changes
const local = join(ROOT, '.claude/settings.local.json');
let settings = {};
if (existsSync(local)) {
  try { settings = JSON.parse(readFileSync(local, 'utf8')); }
  catch { console.error(`${local} is not valid JSON; fix or delete it, then run again`); process.exit(1); }
}
// the shared .claude/settings.json allows only reads, so work asks; home adds the rest here
const HOME_ALLOW = ['Edit', 'Write', 'NotebookEdit', 'Bash', 'PowerShell', 'WebFetch', 'WebSearch'];
settings.permissions ??= {};
const allow = (settings.permissions.allow ?? []).filter((r) => !HOME_ALLOW.includes(r));
if (profile === 'home') { settings.permissions.defaultMode = 'bypassPermissions'; settings.permissions.allow = [...allow, ...HOME_ALLOW]; }
else { delete settings.permissions.defaultMode; settings.permissions.allow = allow; }
if (!settings.permissions.allow.length) delete settings.permissions.allow;
writeFileSync(local, JSON.stringify(settings, null, 2) + '\n');

console.log(`profile ${profile}: ${[...Object.keys(files), '.claude/settings.local.json'].join(', ')}`);
console.log(profile === 'home'
  ? 'Kiro: use Autopilot. Copilot: enable auto-approve for this workspace if you want no prompts.'
  : 'Kiro: use Supervised. Copilot and Claude Code: keep approvals on.');
