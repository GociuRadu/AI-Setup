// Sets this device's profile: node _ai/setup.mjs home|work
// Copies _ai/profiles/<profile>.md into the local file each tool loads on its own (all gitignored):
//   CLAUDE.local.md (Claude Code), .github/instructions/profile.instructions.md (Copilot), .kiro/steering/profile.md (Kiro)
// and sets Claude Code's permissions in .claude/settings.local.json (home: no prompts; work: prompts for all but reads).
// CLAUDE.local.md also imports AGENTS.md and holds the Claude adapter (_ai/claude.md). There is no root CLAUDE.md,
// because Copilot reads CLAUDE.md and expands its imports, which would load AGENTS.md twice there.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const profile = process.argv[2];
if (!['home', 'work'].includes(profile)) { console.error('usage: node _ai/setup.mjs home|work'); process.exit(1); }

const body = readFileSync(join(ROOT, '_ai/profiles', `${profile}.md`), 'utf8').replace(/\r\n/g, '\n');
const note = `<!-- Written by node _ai/setup.mjs ${profile}. Edit _ai/profiles/${profile}.md and run it again. -->\n`;
const claude = readFileSync(join(ROOT, '_ai/claude.md'), 'utf8').replace(/\r\n/g, '\n');
const files = {
  'CLAUDE.local.md': `${note.replace(' and run', ' or _ai/claude.md and run')}@AGENTS.md\n\n${claude}\n${body}`,
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

// MCP cleanup report: every enabled server adds its tool list to every chat. Names only, nothing is changed.
function mcpReport() {
  const HOME = process.env.USERPROFILE ?? process.env.HOME ?? '';
  const json = (f) => { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; } catch { return null; } };
  const rows = new Set();
  const add = (tool, where, servers, off = []) => {
    for (const [name, cfg] of Object.entries(servers ?? {})) rows.add(`  ${tool} (${where}): ${name}${cfg?.disabled || off.includes(name) ? ' [off]' : ''}`);
  };
  const claude = json(join(HOME, '.claude.json'));
  // Claude Code may keep one folder under several keys (C:\x, C:/x, c:/x): merge them all
  const here = Object.entries(claude?.projects ?? {}).filter(([p]) => resolve(p).toLowerCase() === ROOT.toLowerCase()).map(([, v]) => v);
  const claudeOff = here.flatMap((v) => [...(v.disabledMcpServers ?? []), ...(v.disabledMcpjsonServers ?? [])]);
  add('Claude Code', 'user', claude?.mcpServers, claudeOff);
  for (const v of here) add('Claude Code', 'this workspace', v.mcpServers, claudeOff);
  add('Claude Code', '.mcp.json', json(join(ROOT, '.mcp.json'))?.mcpServers, claudeOff);
  add('Kiro', 'user', json(join(HOME, '.kiro/settings/mcp.json'))?.mcpServers);
  add('Kiro', 'workspace', json(join(ROOT, '.kiro/settings/mcp.json'))?.mcpServers);
  add('VS Code', 'user', json(join(process.env.APPDATA ?? '', 'Code/User/mcp.json'))?.servers);
  add('VS Code', 'workspace', json(join(ROOT, '.vscode/mcp.json'))?.servers);
  if (!rows.size) return console.log('MCP servers: none found.');
  console.log(`MCP servers (${rows.size}); turn off the ones you don't use, each one costs tokens in every chat:\n${[...rows].join('\n')}`);
  console.log('  Turn off: Claude Code `/mcp` (per workspace) or `claude mcp remove <name> -s user`; Kiro: MCP panel or "disabled": true; VS Code: "MCP: List Servers".');
}

console.log(`profile ${profile}: ${[...Object.keys(files), '.claude/settings.local.json'].join(', ')}`);
mcpReport();
console.log(profile === 'home'
  ? 'Kiro: use Autopilot. Copilot: enable auto-approve for this workspace if you want no prompts.'
  : 'Kiro: use Supervised. Copilot and Claude Code: keep approvals on.');
