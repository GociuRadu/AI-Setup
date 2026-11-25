// PreToolUse guard for Claude Code, Kiro and GitHub Copilot. Blocks (exit 2 plus a deny decision):
// - shell commands that send writing SQL (DML, DDL, EXEC, ...) through a database client, inline, piped or
//   from a script, and tools that only write databases;
// - hard stops: force-push, deleting Docker volumes, production compose files, release scripts, SSH;
// - reading or writing secret files (.env, local.env, ...) and anything under personal/, by shell or file tools;
// - the private folder and .mdenc notes of the Obsidian vault set in .ai-device.json, and reads of that whole vault.
// Asks only on what leaves the machine or cannot be undone, by the profile in .ai-device.json (no profile: work):
// pushes and work-discarding Git, wide or unknown deletes, edits outside the workspace, loaders, publishing,
// destructive MCP tools, setup-ui/; on work also cloud CLIs, writing gh/HTTP calls and writes to shared MCP servers.
// It is the one place that asks: the tools' own permission files only allow and deny. With --allow it lets
// read-only and guarded tools skip VS Code's own prompt.
// shortcut: matches command text and path arguments only; code that opens its own connection (pytest, a loader) is not seen.
import { readFileSync, existsSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative, isAbsolute, join, dirname, basename } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const CLIENT = /\b(sqlcmd|osql|isql|bcp|psql|mysql|mariadb|sqlite3|duckdb|mssql-cli|usql|Invoke-Sqlcmd|Invoke-DbaQuery|pyodbc|pymssql|psycopg2?|pg8000|sqlalchemy|mssql|tedious|oracledb)\b/i;
// tools whose job is to write a database
const WRITE_TOOL = /\b(pg_restore|sqlpackage|mysqlimport|Import-Dba\w+|Write-Dba\w+|Invoke-DbaDbDataMasking|flyway|liquibase|alembic\s+(upgrade|downgrade)|dotnet\s+ef\s+database\s+update)\b/i;
const WRITE = /\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|CREATE|ALTER|EXEC|EXECUTE|GRANT|REVOKE|DENY|BACKUP|RESTORE|DBCC|INTO|sp_rename|sp_executesql|sp_configure)\b/i;
// script input: -i/-f/-InputFile/--file (a .sql path), or a < redirect (any file)
const FILES = /(?:\s-[if]\s*|\s-InputFile\s+|\s--file[=\s]+)("[^"]+\.sql"|'[^']+\.sql'|[^\s"']+\.sql)\b|<\s*("[^"]+"|'[^']+'|[^\s<>|&;]+)/gi;
// commands that only mention text (a commit message, a search pattern) are not checked for SQL or hard stops
const SEARCH = /^\s*(git|grep|rg|findstr|Select-String|echo|Write-Host|Write-Output|code)\b/i;
const HARD_STOPS = [
  [/^\s*git\b[^|;&]*\spush\b.*(\s--force(-with-lease)?\b|\s-f\b|\s\+\S)/i, 'force-push'],
  [/\bdown\b.*(\s-v\b|\s--volumes\b)/i, 'deleting Docker volumes (down -v)'],
  [/\bdocker\s+(volume\s+(rm|prune)|system\s+prune)\b/i, 'deleting Docker volumes'],
  [/\bcompose\b.*\b(prod|production|staging|hostinger|monitoring)\b/i, 'a production or staging compose file'],
  [/\b(release|rollback)\.sh\b/i, 'a release or rollback script'],
  // ssh as the command word: first, after &, wsl [-d X], sudo, exec, or inside -c/-lc/-Command/cmd /c
  [/(^\s*&?\s*|\b(wsl(\s+-d\s+\S+)?|sudo|exec)\s+|(-l?c|-Command|\/c)\s+["']?)(ssh|scp|sftp)(\.exe)?\s/i, 'SSH to a server'],
];
// the workspace root (this file is _ai/hooks/guard.mjs), so personal/ is found from any working folder
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// .env, .env.local, local.env, prod.env, .test.env; examples and templates are fine
const SECRET = /(^|[\\/\s"'=])(\.?[\w-]*\.env(\.[\w-]+)*)(?=$|[\s"';|&)])/i;
const EXAMPLE = /\.(example|sample|template|dist)\b/i;
const READER = /^\s*(cat|type|gc|Get-Content|Select-String|sls|grep|egrep|rg|findstr|less|more|head|tail|awk|sed|cp|copy|Copy-Item|mv|move|Move-Item|notepad|code|strings|xxd|Format-Hex|base64)\b/i;

const SECRETS = new RegExp(SECRET.source, 'gi');
const isSecret = (text) => [...String(text).matchAll(SECRETS)].some((m) => !EXAMPLE.test(m[2]));
// words of a command with quotes removed, to test each one as a path
const tokens = (s) => [...s.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
const outside = (rel) => /^\.\.([\\/]|$)/.test(rel) || isAbsolute(rel);
// a path inside the workspace folder that `re` matches (relative to the root)
const inside = (re) => (path, cwd, root = ROOT) => {
  const rel = relative(root, resolve(cwd, String(path))).replace(/\\/g, '/');
  return !outside(rel) && re.test(rel);
};
const isPersonal = inside(/^personal(\/|$)/i);
// not AI context: read or run only after the user approves (searches skip it through the root .ignore)
const ON_REQUEST = 'setup-ui';
const isOnRequest = inside(new RegExp(`^${ON_REQUEST}(\\/|$)`, 'i'));

// .ai-device.json of this workspace, or {}; read per call, so a change needs no restart
function device(root) {
  try { return JSON.parse(readFileSync(join(root, '.ai-device.json'), 'utf8')) ?? {}; } catch { return {}; }
}
// the Obsidian vault of this device, or null
function vaultOf(root) {
  const v = device(root).obsidian?.vault;
  return typeof v === 'string' && isAbsolute(v) ? v : null;
}
const profileOf = (root) => (device(root).profile === 'home' ? 'home' : 'work');
const VAULT_PRIVATE = 'the private folder of the Obsidian vault and its .mdenc notes are never opened by the agent';
const VAULT_WHOLE = 'this reads the whole Obsidian vault, private folder included; name one folder, for example Learn';
// the real path, so a short Windows name or a link is seen; for a file that does not exist yet, that of its nearest folder
const real = (p) => { try { return realpathSync.native(p); } catch { const up = dirname(p); return up === p ? p : join(real(up), basename(p)); } };
// a path as the shell would see it: home folder, file:, \\?\, Git Bash drive
const plain = (path) => String(path).replace(/^(~|\$HOME|\$\{HOME\}|\$env:USERPROFILE|\$\{env:USERPROFILE\}|\$USERPROFILE|%USERPROFILE%)(?=[\\/]|$)/i, () => homedir())
  .replace(/^file:\/+(?=[A-Za-z]:)/i, '').replace(/^[\\/]{2}[?.][\\/]/, '').replace(/^\/([A-Za-z])(?=\/|$)/, '$1:/');
// 'private' for the vault's Personal folder or an encrypted note; 'whole' for the vault root or a wildcard in its first level;
// 'above' for a folder that holds the vault; else null. Windows drops dots and spaces at the end of a folder name.
function vaultPart(path, cwd, vault) {
  const text = plain(path).replace(/([^\\/.])[. ]+(?=[\\/]|$)/g, '$1');
  const [fixed, ...wild] = text.split(/[*?{[]/);
  const full = resolve(cwd, fixed);
  const rel = relative(real(vault), real(full)).replace(/\\/g, '/');
  // after a wildcard, .. can climb back to any folder
  if (!outside(rel) && (/^personal($|[\/:])/i.test(rel) || /\.mdenc$/i.test(text) || wild.some((w) => /\.\.[\\/]/.test(w)))) return 'private';
  if (!outside(rel) && (rel === '' || (wild.length && !rel.includes('/') && !/[\\/]$/.test(fixed)))) return 'whole';
  const up = relative(real(full), real(vault));
  return up !== '' && !outside(up) ? 'above' : null;
}
// commands that walk a folder tree, or any command reading a wildcard
const TREE = /(\s--?recurs(e|ive)\b|\s\/s(\s|$)|^\s*(find|rg|tree|tar|robocopy|xcopy|7z|zip|du|Compress-Archive)\b|^\s*git\b.*\sgrep\b)/i;
// a short flag cluster with r (-r, -rn, -R); a PowerShell -Word parameter such as -Pattern or -Raw is not one
const SHORT_R = /\s-(?![A-Z][a-z]{2})[a-zA-Z]*[rR][a-zA-Z]*(\s|$)/;
const CD = /^\s*(?:cd|chdir|pushd|sl|Set-Location|Push-Location)\s+(?:(?:\/d|-Path|-LiteralPath|--)\s+)*("[^"]*"|'[^']*'|[^\s)]+)/i;
// the vault rules for a shell command: follows cd, looks into bash -c and the like, and into lists and redirects
function checkVaultCommand(command, cwd, vault) {
  let dir = cwd;
  for (const part of parts(command)) {
    const inner = part.replace(WRAPPERS, '');
    if (inner !== part) {
      const reason = checkVaultCommand(inner.replace(/["')}]\s*$/, ''), dir, vault);
      if (reason) return reason;
    }
    const walks = TREE.test(part) || SHORT_R.test(part);
    for (const t of tokens(part)) {
      const value = t.replace(/^[\w-]+=/, '');
      const where = vaultPart(value, dir, vault);
      const wildcard = READER.test(part) && /[*?{[]/.test(t);
      const reads = t === value && (walks || wildcard);
      if (where === 'private') return VAULT_PRIVATE;
      // a wildcard above the vault counts when a folder is named before it; '/{/p' is a search pattern
      if (reads && (where === 'whole' || (where && (walks || /[\w.][\\/][^*?{[]*[*?{[]/.test(t))))) return VAULT_WHOLE;
      // one token can hold several paths: a,b  >file  "gc path"
      for (const piece of t.split(/[\s,;<>()"'|=]+/).filter((x) => x && x !== t)) {
        const at = vaultPart(piece, dir, vault);
        if (at === 'private') return VAULT_PRIVATE;
        if (at === 'whole' && reads) return VAULT_WHOLE;
      }
    }
    if (walks && dir !== cwd && vaultPart('.', dir, vault)) return VAULT_WHOLE;
    const cd = CD.exec(inner);
    if (cd) dir = resolve(dir, plain(cd[1].replace(/^["']|["']$/g, '')));
  }
  return null;
}

// split on && || ; and newlines outside quotes, so `-Q "SELECT 1; DELETE ..."` stays one command
function parts(command) {
  const out = [];
  let cur = '', quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i], two = command.slice(i, i + 2);
    if (quote) { if (c === quote) quote = null; cur += c; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (two === '&&' || two === '||') { out.push(cur); cur = ''; i++; continue; }
    // a lone & separates commands, except in redirections (2>&1, <&) and PowerShell's call operator at segment start
    if (c === '&' && command[i - 1] !== '&' && command[i - 1] !== '>' && command[i - 1] !== '<' && cur.trim() !== '') { out.push(cur); cur = ''; continue; }
    if (c === ';' || c === '\n') { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  return [...out, cur];
}

export function check(command, cwd = process.cwd(), root = ROOT) {
  // each simple command on its own; a pipe keeps its parts together so `x | sqlcmd` is seen
  for (const part of parts(command)) {
    // per pipe stage, so `echo y | ssh host` is seen; a stage that only prints or searches text is skipped
    const hard = part.split('|').flatMap((s) => {
      const u = s.replace(WRAPPERS, ''); // `& git push -f` and `bash -c "git push -f"` unwrap to the plain command
      return HARD_STOPS.filter(([re], i) => (i === 0 ? re.test(s) || re.test(u) : re.test(s) && !SEARCH.test(s)));
    })[0];
    if (hard) return `${hard[1]} is a hard stop`;
    // a program that only receives an env file (docker compose --env-file local.env) is fine; reading it is not
    if (part.split('|').some((s) => READER.test(s) && isSecret(s))) return 'secret files (.env and similar) are never opened by the agent';
    if (tokens(part).some((t) => /personal/i.test(t) && isPersonal(t.replace(/^[\w-]+[=:](?![\\/])/, ''), cwd, root))) return 'personal/ is private';
    if (WRITE_TOOL.test(part) && !SEARCH.test(part)) return 'this tool writes to a database';
    if (!CLIENT.test(part)) continue;
    const stages = part.split('|');
    const clientAt = stages.findIndex((s) => CLIENT.test(s) && !SEARCH.test(s));
    if (clientAt < 0) continue; // only mentions a client (git commit -m, grep)
    if (clientAt > 0) return 'input piped into a database client';
    const cmd = stages[clientAt];
    if (/\$\(|`/.test(cmd)) return 'command substitution into a database client';
    if (/\bsource\b|\.read\b|\\i\b/i.test(cmd)) return 'a script run from inside the client';
    if (/\bbcp\b[^|;&]*\s(in|format)\s/i.test(cmd)) return 'bcp in writes to a database';
    // query or script from a variable ($q, %Q%, @file): its text is set elsewhere and cannot be checked
    if (/\s(-Q|-q|-Query|-c|--command|-e|--execute|-i|-f|-InputFile|--file)[=\s]*["']?[$%@]/i.test(cmd)) return 'query text in a variable cannot be checked';
    // only the query text, so server names, paths and flags do not count
    const query = cmd.replace(/\s-(o|OutputFile)\s+("[^"]*"|'[^']*')/gi, ''); // output paths are not SQL
    const quoted = [...query.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2]).join('\n');
    if (WRITE.test(quoted)) return 'the command contains writing SQL';
    for (const [, flagged, redirected] of cmd.matchAll(FILES)) {
      const raw = flagged ?? redirected;
      const file = resolve(cwd, raw.replace(/^["']|["']$/g, ''));
      if (!existsSync(file)) return `cannot read the SQL script ${raw} to check it`;
      if (WRITE.test(readFileSync(file, 'utf8'))) return `the SQL script ${raw} contains writing SQL`;
    }
  }
  const vault = vaultOf(root);
  return vault ? checkVaultCommand(command, cwd, vault) : null;
}

// {a,b} groups into separate globs; globMatchesSecret tests whether a file glob can match a secret file name
function expandBraces(s) {
  const m = /\{([^{}]*)\}/.exec(s);
  return m ? m[1].split(',').flatMap((o) => expandBraces(s.slice(0, m.index) + o + s.slice(m.index + m[0].length))) : [s];
}
function globMatchesSecret(glob) {
  const tail = glob.replace(/\\/g, '/').split('/').pop() ?? '';
  if (!tail || /^(\*+|\*\*)$/.test(tail) || EXAMPLE.test(tail)) return false;
  const rx = new RegExp('^' + tail.replace(/[.+^$()|\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]') + '$', 'i');
  return ['.env', 'local.env', 'prod.env', '.test.env', '.env.local'].some((name) => rx.test(name));
}
// file tools: every argument whose name is a path (Claude file_path, Kiro path/paths),
// also nested (Kiro CLI batch reads send {operations: [{path}]})
function pathArgs(value, key = '', isContentGrep = false, queryIsGlob = false) {
  if (typeof value === 'string' && (/^(glob|includePattern)$/i.test(key) || (queryIsGlob && key === 'query') || (/pattern/i.test(key) && !isContentGrep))) {
    // a glob is not a file, but one rooted in personal/ still lists it, and one that can match .env is a secret read
    return expandBraces(value).flatMap((v) => [
      ...(/personal/i.test(v) ? [v.split(/[*?[{]/)[0]] : []),
      ...(globMatchesSecret(v) ? ['.env'] : []),
      v.replace(/[*?[\]]+/g, '').replace(/\.+$/, ''),
    ]);
  }
  if (typeof value === 'string' && /pattern/i.test(key)) return []; // a content regex, not a path
  if (typeof value === 'string') return /path|file|target|dir/i.test(key) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((v) => pathArgs(v, key, isContentGrep, queryIsGlob));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => pathArgs(v, k, isContentGrep, queryIsGlob));
  return [];
}
// the paths and globs a file tool call names; a content search's text is not one
function filePaths(args, toolName = '') {
  const isContentGrep = /(^|_)(grep|grep_search|grepSearch|findTextInFiles)$/i.test(String(toolName));
  const queryIsGlob = /(^|_)(file_search|fileSearch|findFiles|glob)$/i.test(String(toolName));
  return pathArgs(args ?? {}, '', isContentGrep, queryIsGlob);
}
const SEARCH_TOOL = /(^|_)(grep|glob|grep_search|file_search|grepSearch|fileSearch|findTextInFiles|findFiles|semantic_search|list_dir)$/i;
export function checkPaths(args, cwd = process.cwd(), root = ROOT, toolName = '') {
  for (const p of filePaths(args, toolName)) {
    if (isSecret(p)) return 'secret files (.env and similar) are never opened by the agent';
    if (isPersonal(p, cwd, root)) return 'personal/ is private';
  }
  const vault = vaultOf(root);
  if (!vault) return null;
  const search = SEARCH_TOOL.test(String(toolName));
  // a search's globs are checked as typed, from the folder it searches: their wildcards are cut out of filePaths
  const globs = search ? Object.entries(args ?? {}).filter(([k, v]) => typeof v === 'string' && (/^(glob|includePattern)$/i.test(k) || (/^(pattern|query)$/i.test(k) && !/grep/i.test(toolName))))
    .flatMap(([, v]) => expandBraces(v).map((g) => resolve(cwd, String(args.path ?? '.'), g.replace(/^\/([A-Za-z])\//, '$1:/')))) : [];
  const paths = [...filePaths(args, toolName), ...globs];
  for (const p of search && !paths.length ? ['.'] : paths) {
    const where = vaultPart(p, cwd, vault);
    if (where === 'private') return VAULT_PRIVATE;
    if (where && search) return VAULT_WHOLE;
  }
  return null;
}

// MCP tools that are hard stops by name (AGENTS.md Hard stops)
export function checkToolHardStop(toolName = '') {
  const t = String(toolName);
  return /(^|__|_)hostinger[-_\w]*?(execute|multi[-_]execute|execute_site_tool)$/i.test(t) || /executeDestructive$/i.test(t)
    ? 'this MCP tool is a hard stop' : null;
}

const WRAPPERS = /^\s*(?:&\s*|[({]\s*|(?:cmd(?:\.exe)?\s+\/[ck]|(?:bash|sh|zsh)(?:\.exe)?\s+-l?c|powershell(?:\.exe)?\s+(?:-\w+\s+)*-Command|pwsh(?:\.exe)?\s+(?:-\w+\s+)*-Command|wsl(?:\.exe)?(?:\s+-d\s+\S+)?|sudo|exec)\s+["']?)*/i;
const PRINT = /^\s*(grep|egrep|rg|findstr|Select-String|sls|echo|Write-Host|Write-Output)\b/i;
// git, its global options, the subcommand and the rest
const GIT = /^\s*git(?:\.exe)?((?:\s+(?:-C\s+(?:"[^"]+"|'[^']+'|\S+)|-c\s+\S+|--no-pager|--git-dir[=\s]\S+|--work-tree[=\s]\S+))*)\s+([\w-]+)(.*)$/i;
// local Git that discards work or rewrites history; everything else local (add, commit, switch, stash, fetch, pull, merge) runs
const GIT_DISCARD = {
  reset: (r) => /\s--(hard|merge|keep)\b/.test(r),
  clean: (r) => !/\s(-n|--dry-run)\b/.test(r),
  rebase: () => true,
  restore: (r) => !/\s(--staged|-S)\b/.test(r) || /\s(--worktree|-W)\b/.test(r),
  checkout: (r) => /\s(--|-f|--force|\.)(?=\s|$)/.test(r),
  switch: (r) => /\s(-f|--force|--discard-changes)\b/.test(r),
  branch: (r) => /\s-[a-zA-Z]*D|\s-M\b|\s--delete\b.*\s(-f|--force)\b|\s(-f|--force)\b.*\s(-d|--delete)\b/.test(r),
  stash: (r) => /^\s+(drop|clear)\b/.test(r),
  tag: (r) => /\s(-d|--delete)\b/.test(r),
  'update-ref': (r) => /\s-d\b/.test(r),
  reflog: (r) => /^\s+(expire|delete)\b/.test(r),
  gc: (r) => /\s--prune\b/.test(r),
  'filter-branch': () => true,
  'filter-repo': () => true,
  worktree: (r) => /^\s+remove\b.*\s(-f|--force)\b/.test(r),
  // reading one key is fine; setting, unsetting or editing changes the user's Git config
  config: (r) => !/\s(--get|--get-all|--get-regexp|--list|-l|--show-origin|--show-scope)\b/.test(r) && r.trim().split(/\s+/).filter((w) => w && !w.startsWith('-')).length !== 1
    || /\s(--unset|--unset-all|--add|--replace-all|--edit|-e)\b/.test(r),
};
function gitAsk(stage, profile) {
  const m = GIT.exec(stage);
  if (!m) return null;
  const sub = m[2].toLowerCase(), rest = m[3];
  if (sub === 'push') {
    if (profile === 'work') return 'git push requires approval';
    if (/(\s|:)(main|master)(?=\s|$)|\s(--all|--mirror|--delete|-d)\b|\s:\S/.test(rest)) return 'pushing or deleting main, master or every branch requires approval';
    return null;
  }
  return GIT_DISCARD[sub]?.(rest) ? `git ${sub} can discard work or rewrite history and requires approval` : null;
}

const DELETE_CMD = /^\s*(rm|del|erase|rmdir|rd|ri|Remove-Item|Clear-Content|Clear-Item)(\.exe)?(\s|$)/i;
// deletes that are not the first word: PowerShell blocks, xargs rm, find -delete; their targets are not known here
const DELETE_ANY = /\b(Remove-Item|Clear-Content|Clear-Item)\b|\bxargs\b.*\b(rm|del|rmdir)\b|\bfind\b.*\s-delete\b/i;
const DELETE_INLINE = /\b(rmSync|rmdirSync|unlinkSync|fs\.rm|promises\.rm|shutil\.rmtree|os\.(remove|unlink|rmdir))\b|\.unlink\s*\(|\[(?:System\.)?IO\.(?:File|Directory)\]::Delete/i;
// -r, -rf, -R; a PowerShell -Word parameter (-Force, -Recurse) is not a short flag, so -Recurse is matched on its own
const recursive = (s) => /\s-(?![A-Z][a-z]{2})[a-zA-Z]*[rR][a-zA-Z]*(?=\s|$)/.test(s) || /\s-Recurse\b|\s\/s(?=\s|$)/i.test(s);
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const inTemp = (p) => { const r = relative(real(tmpdir()), real(p)); return r !== '' && !outside(r); };
// a delete runs unless it reaches outside the workspace (the temp folder is fine), a whole project, repo or .git,
// a wildcard at the top level or in a recursive delete, or a path set elsewhere
function deleteAsk(stage, cwd, root) {
  const words = tokens(stage.replace(/["')}]\s*$/, '')).slice(1);
  const targets = [];
  for (let i = 0; i < words.length; i++) {
    if (/^-(Filter|Include|Exclude)$/i.test(words[i])) { i++; continue; }
    if (!/^-/.test(words[i]) && !/^\/[a-z]$/i.test(words[i])) targets.push(words[i]);
  }
  if (!targets.length || targets.some((t) => /[$%`{]/.test(t))) return 'deleting files whose path is set elsewhere requires approval';
  const deep = recursive(stage);
  for (const t of targets) {
    const full = resolve(cwd, plain(t));
    const rel = relative(real(root), real(full)).replace(/\\/g, '/');
    if (outside(rel)) {
      if (inTemp(full)) continue;
      return 'deleting files outside the workspace requires approval';
    }
    const wild = /[*?[]/.test(t);
    if ((deep || isDir(full)) && (rel === '' || !rel.includes('/') || /(^|\/)code$/i.test(rel))) return 'deleting a whole project, repo or the workspace requires approval';
    if (/(^|\/)\.git(\/|$)/i.test(rel)) return 'deleting inside .git requires approval';
    if (wild && (deep || !rel.includes('/'))) return 'a wildcard delete this wide requires approval';
  }
  return null;
}

const LOADER = /\b(run_notebook\.py|seed_lake\.py|copy-from-dev\.ps1)\b|\bdev\.ps1\b.*\b(Notebook|Lake)\b/i;
const PUBLISH = /^\s*((npm|pnpm|yarn|twine|poetry|uv)\s+publish|twine\s+upload|docker\s+push)\b/i;
// work only: cloud CLIs can reach any environment, so even their reads ask (AGENTS.md: unknown environment = PRODUCTION)
const CLOUD = /^\s*(az|kubectl|helm|terraform)(\.exe)?(\s|$)/i;
const GH = /^\s*gh(\.exe)?(\s|$)/i;
const GH_READ = /^\s*gh(\.exe)?\s+(--version|help\b|status\b|browse\b|search\s|auth\s+status\b|repo\s+clone\b|(pr|issue|run|workflow|release|repo|label|cache|gist|ruleset|variable|secret|project)\s+(view|list|ls|status|diff|checks|watch|download)\b|api\s)/i;
const GH_API_WRITE = /\s(-X|--method)[\s=]*["']?(?!GET\b)\w|\s(-f|-F|--field|--raw-field|--input)(?=[\s=]|$)/;
const HTTP = /^\s*(curl|wget|Invoke-RestMethod|Invoke-WebRequest|irm|iwr)(\.exe)?(\s|$)/i;
// curl flags are case-sensitive (-f fails quietly, -F posts a form); PowerShell parameters are not
const HTTP_WRITE = /\s(-X|--request|--method)[\s=]*["']?(?!GET\b|HEAD\b)\w|\s(-d|--data[\w-]*|-F|--form|-T|--upload-file|--post-data|--post-file|--json)(?=[\s=]|$)/;
const PS_HTTP_WRITE = /\s-Method\s+["']?(?!GET\b|HEAD\b)\w|\s-(Body|InFile)\b|Authorization/i;

// one shell command; `$( ... )` inside it is checked as its own command
function shellAsk(command, cwd, root, profile) {
  for (const part of parts(command)) {
    for (const [, inner] of part.matchAll(/\$\(([^()]*)\)/g)) {
      const r = shellAsk(inner, cwd, root, profile);
      if (r) return r;
    }
    for (const s of part.split('|')) {
      const stage = s.replace(WRAPPERS, '');
      if (PRINT.test(stage)) continue;
      const git = gitAsk(stage, profile);
      if (git) return git;
      if (DELETE_CMD.test(stage)) { const d = deleteAsk(stage, cwd, root); if (d) return d; }
      else if (DELETE_ANY.test(stage)) return 'deleting files through a pipe or block requires approval';
      if (DELETE_INLINE.test(part)) return 'deleting files from inline code requires approval';
      if (/\bclean\.mjs\b.*--apply\b/i.test(part)) return 'the clean script deletes files outside the workspace and requires approval';
      if (LOADER.test(stage)) return 'running data loaders or notebooks requires approval';
      if (PUBLISH.test(stage)) return 'publishing requires approval';
      if (profile !== 'work') continue;
      if (CLOUD.test(stage)) return 'cloud CLIs require approval on the work profile';
      if (GH.test(stage) && (!GH_READ.test(stage) || (/^\s*gh(\.exe)?\s+api\s/i.test(stage) && GH_API_WRITE.test(stage)))) return 'a writing gh command requires approval';
      if (HTTP.test(stage) && (HTTP_WRITE.test(stage) || PS_HTTP_WRITE.test(stage))) return 'an HTTP call that sends data requires approval';
    }
  }
  return null;
}

const EDIT_TOOL = /(^|_)(replace_string_in_file|multi_replace_string_in_file|create_file|insert_edit_into_file|edit_notebook_file|create_directory|Edit|Write|NotebookEdit|write|fs_write|str_replace|fs_append)$/i;
// `run` is left out: read-only names such as describe_run must not match; `run_query` is listed whole.
// Case-sensitive so camelCase boundaries ([a-z] -> [A-Z]) work without matching `settings` on `set`.
const MUTATING_MCP = /(?:^|_|-|[a-z])(create|Create|update|Update|delete|Delete|remove|Remove|add|Add|edit|Edit|transition|Transition|comment|Comment|send|Send|post|Post|put|Put|patch|Patch|register|Register|rename|Rename|restore|Restore|set|Set|log|Log|link|Link|evaluate|Evaluate|write|Write|exec|Exec|execute|Execute|apply|Apply|upload|Upload|insert|Insert|merge|Merge|push|Push|deploy|Deploy|publish|Publish|drop|Drop|destroy|Destroy|run_query)(?:$|_|-|[A-Z])/;
const DESTRUCTIVE_MCP = /(?:^|_|-|[a-z])(delete|Delete|remove|Remove|drop|Drop|destroy|Destroy|purge|Purge)(?:$|_|-|[A-Z])/;
// servers that only touch this machine: their writes run on every profile
export const LOCAL_MCP = ['playwright'];
const isLocalMcp = (name) => LOCAL_MCP.some((s) => new RegExp(`^mcp_+${s}[_-]`, 'i').test(name));
// Playwright actions that send local files or run code outside the page
const RISKY_BROWSER = /(?:^|_)browser_(file_upload|run_code_unsafe)$/;

// calls that VS Code or the tool should confirm with the user (permissionDecision ask); null = no objection
export function checkAsk(command, args = {}, cwd = process.cwd(), root = ROOT, toolName = '') {
  const onRequest = `${ON_REQUEST}/ is not AI context: reading or running it requires approval`;
  if (typeof command === 'string' && (isOnRequest('.', cwd, root) || parts(command).some((part) => tokens(part)
    .some((t) => t.toLowerCase().includes(ON_REQUEST) && isOnRequest(t.replace(/^[\w-]+[=:](?![\\/])/, ''), cwd, root))))) return onRequest;
  if (filePaths(args, toolName).some((p) => isOnRequest(p, cwd, root))) return onRequest;
  const profile = profileOf(root);
  if (typeof command === 'string') {
    const r = shellAsk(command, cwd, root, profile);
    if (r) return r;
  }
  const name = String(toolName);
  if (EDIT_TOOL.test(name)) {
    const vault = vaultOf(root);
    for (const p of pathArgs(args ?? {}, '', false, false)) {
      const full = resolve(cwd, plain(p));
      const rel = relative(root, full).replace(/\\/g, '/');
      // the vault's own files; dot folders hold settings and plugin code, so those edits are asked about
      const note = vault && relative(real(vault), real(full));
      if (vault && !outside(note)) {
        if (/^\.(?!\.)/.test(note)) return 'editing files outside the workspace requires approval';
        continue;
      }
      if (outside(rel) && !inTemp(full) && !String(p).startsWith('untitled:') && !String(p).startsWith('/memories/')) return 'editing files outside the workspace requires approval';
    }
  }
  if (/^mcp_/i.test(name)) {
    if (DESTRUCTIVE_MCP.test(name)) return 'a deleting MCP tool requires approval';
    if (RISKY_BROWSER.test(name)) return 'uploading files or running code from the browser requires approval';
    if (profile === 'work' && !isLocalMcp(name) && MUTATING_MCP.test(name) && !/executeRead$/i.test(name)) return 'writing to a shared MCP server requires approval';
  }
  if (/^mssql_dab$/i.test(name) && args?.operation === 'apply_changes') return 'modifying Data API builder config requires approval';
  return null;
}

// tools that are read-only or guarded by the checks above, so --allow may skip VS Code's own prompt
export function canAutoAllow(toolName = '') {
  return /^(read_file|list_dir|file_search|grep_search|semantic_search|view_image|get_errors|get_vscode_api|vscode_listCodeUsages|vscode_searchExtensions_internal|copilot_getNotebookSummary|read_notebook_cell_output|memory|resolve_memory_file_uri|session_store_sql|fetch_webpage|runSubagent|run_in_terminal|get_terminal_output|terminal_last_command|terminal_selection|testFailure|replace_string_in_file|multi_replace_string_in_file|create_file|insert_edit_into_file|create_directory|edit_notebook_file|activate_[\w]+|mcp_[\w-]+|mssql_(list_[\w]+|get_connection_details|query_store_(?!plan_forcing)[\w]+)|copilot_(readFile|listDirectory|findFiles|findTextInFiles|searchWorkspaceSymbols|getErrors|getNotebookSummary|readNotebookCellOutput|fetchWebPage|memory|runInTerminal|getTerminalOutput|terminalLastCommand|terminalSelection|testFailure|replaceString|multiReplaceString|createFile|insertEdit|createDirectory|editNotebook))$/i.test(String(toolName));
}

// Hook entry. The hook wiring calls run() through a loader that blocks (exit 2) when this file cannot load,
// and any error inside the check blocks too: the guard fails closed. Unreadable stdin (no tool call) is allowed.
export function run(opts = {}) {
  try { decide(opts); } catch (e) {
    process.stderr.write(`Blocked: the guard hook failed (${e?.message ?? e}). Fix _ai/hooks/guard.mjs, then retry.`);
    process.exit(2);
  }
}
if (/[\\/]guard\.mjs$/.test(process.argv[1] ?? '')) run();

function decide(opts = {}) {
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
  let args = input?.tool_input ?? input?.toolArgs ?? {};
  if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = { command: args }; } }
  const cwd = input?.cwd ?? process.cwd();
  const command = args.command ?? args.commandLine;
  const toolName = input?.tool_name ?? input?.toolName ?? '';
  const reason = checkToolHardStop(toolName) ?? (typeof command === 'string' ? check(command, cwd) : null) ?? checkPaths(args, cwd, ROOT, toolName);
  if (reason) {
    const message = `Blocked: ${reason}. Give the user the command or query to run instead.`;
    process.stdout.write(JSON.stringify({ permissionDecision: 'deny', permissionDecisionReason: message,
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: message } }));
    process.stderr.write(message);
    process.exit(2);
  }
  const ask = checkAsk(command, args, cwd, ROOT, toolName);
  if (ask) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `Confirm: ${ask}.` } }));
    process.exit(0);
  }
  if (opts.allow && canAutoAllow(toolName)) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } }));
    process.exit(0);
  }
}
