// PreToolUse guard shared by Claude Code, GitHub Copilot and Kiro; a small fail-closed loader per tool (hooks/<tool>/hook.mjs)
// turns its decision into that tool's output. decide(input) returns { decision: 'deny' | 'ask' | null, reason }.
// Deny (only the user runs it):
// - shell commands that send writing SQL (DML, DDL, EXEC, ...) through a database client, inline, piped or from a script,
//   and tools that only write databases;
// - hard stops: force-push, deleting Docker volumes, production compose files, release scripts, SSH, Hostinger execute,
//   Atlassian executeDestructive;
// - secret files (.env, local.env, ...) and the workspace's personal/ folder, by shell or file tools;
// - encrypted .mdenc notes of the Obsidian vault named in .ai-device.json.
// Ask (one list on every device): git push, Git that discards work or rewrites history, deletes outside the workspace, of a
// whole project or in the vault, the vault's Personal folder, publishing, data loaders, cloud CLIs, writing gh and HTTP
// calls, writes to shared MCP servers and deleting MCP tools.
// shortcut: matches command text and path arguments only; code that opens its own connection (pytest, a loader) is not seen.
// Speed: every check is a regex on the call; the file system is touched only for paths a regex already picked out.
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
  // -f alone or in a short-flag cluster (-uf); --force-with-lease and +branch
  [/^\s*git\b[^|;&]*\spush\b.*(\s--force(-with-lease)?\b|\s-[a-z]*f[a-z]*\b|\s\+\S)/i, 'force-push'],
  [/\bdown\b.*(\s-v\b|\s--volumes\b)/i, 'deleting Docker volumes (down -v)'],
  [/\bdocker\s+(volume\s+(rm|prune)|system\s+prune)\b/i, 'deleting Docker volumes'],
  [/\bcompose\b.*\b(prod|production|staging|hostinger|monitoring)\b/i, 'a production or staging compose file'],
  [/\b(release|rollback)\.sh\b/i, 'a release or rollback script'],
  // ssh as the command word: first, after &, wsl [-d X], sudo, exec, or inside -c/-lc/-Command/cmd /c
  [/(^\s*&?\s*([A-Za-z_]\w*=\S*\s+)*|\b(wsl(\s+-d\s+\S+)?|sudo|exec|env)\s+|(-l?c|-Command|\/c)\s+["']?)(ssh|scp|sftp)(\.exe)?\s/i, 'SSH to a server'],
];
// the workspace root (this file is <workspace>/.ai/hooks/guard.mjs), so personal/ is found from any working folder
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
const isPersonal = (path, cwd, root = ROOT) => {
  const rel = relative(root, resolve(cwd, String(path))).replace(/\\/g, '/');
  return !outside(rel) && /^personal(\/|$)/i.test(rel);
};

// the Obsidian vault of this device (.ai-device.json at the workspace root, read per call), or null
function vaultOf(root) {
  try {
    const v = JSON.parse(readFileSync(join(root, '.ai-device.json'), 'utf8'))?.vault;
    return typeof v === 'string' && isAbsolute(v) ? v : null;
  } catch { return null; }
}
const MDENC = 'encrypted .mdenc notes of the Obsidian vault are never opened by the agent';
const PERSONAL = "this reads or touches the Obsidian vault's Personal folder";
const WHOLE = "this reads the whole Obsidian vault, Personal folder included; name one folder, for example Learn, to skip the prompt";
// the real path, so a short Windows name or a link is seen; for a file that does not exist yet, that of its nearest folder
const real = (p) => { try { return realpathSync.native(p); } catch { const up = dirname(p); return up === p ? p : join(real(up), basename(p)); } };
// a path as the shell would see it: home folder, file:, \\?\, Git Bash drive
const plain = (path) => String(path).replace(/^(~|\$HOME|\$\{HOME\}|\$env:USERPROFILE|\$\{env:USERPROFILE\}|\$USERPROFILE|%USERPROFILE%)(?=[\\/]|$)/i, () => homedir())
  .replace(/^file:\/+(?=[A-Za-z]:)/i, '').replace(/^[\\/]{2}[?.][\\/]/, '').replace(/^\/([A-Za-z])(?=\/|$)/, '$1:/');
// 'mdenc' for an encrypted note; 'personal' for the vault's Personal folder (or a wildcard that can climb into it);
// 'whole' for the vault root or a wildcard in its first level; 'above' for a folder that holds the vault; 'in' for any
// other vault path; else null. Windows drops dots and spaces at the end of a folder name.
function vaultPart(path, cwd, vault) {
  const text = plain(path).replace(/([^\\/.])[. ]+(?=[\\/]|$)/g, '$1');
  const [fixed, ...wild] = text.split(/[*?{[]/);
  const full = resolve(cwd, fixed);
  const rel = relative(real(vault), real(full)).replace(/\\/g, '/');
  if (!outside(rel) && /\.mdenc$/i.test(text)) return 'mdenc';
  // after a wildcard, .. can climb back to any folder
  if (!outside(rel) && (/^personal($|[\/:])/i.test(rel) || wild.some((w) => /\.\.[\\/]/.test(w)))) return 'personal';
  if (!outside(rel) && (rel === '' || (wild.length && !rel.includes('/') && !/[\\/]$/.test(fixed)))) return 'whole';
  if (!outside(rel)) return 'in';
  const up = relative(real(full), real(vault));
  return up !== '' && !outside(up) ? 'above' : null;
}
// commands that walk a folder tree
const TREE = /(\s--?recurs(e|ive)\b|\s\/s(\s|$)|^\s*(find|rg|tree|tar|robocopy|xcopy|7z|zip|du|Compress-Archive)\b|^\s*git\b.*\sgrep\b)/i;
// a short flag cluster with r (-r, -rn, -R); a PowerShell -Word parameter such as -Pattern or -Raw is not one
const SHORT_R = /\s-(?![A-Z][a-z]{2})[a-zA-Z]*[rR][a-zA-Z]*(\s|$)/;
const CD = /^\s*(?:cd|chdir|pushd|sl|Set-Location|Push-Location)\s+(?:(?:\/d|-Path|-LiteralPath|--)\s+)*("[^"]*"|'[^']*'|[^\s)]+)/i;
const SEVERITY = { mdenc: 3, personal: 2, whole: 1 };
// the vault rule a shell command meets ('mdenc', 'personal' or 'whole', the most severe), or null; follows cd, looks into
// bash -c and the like, and into lists and redirects
function vaultCommand(command, cwd, vault) {
  let dir = cwd, worst = null;
  const seen = (kind) => { if (kind && (SEVERITY[kind] ?? 0) > (SEVERITY[worst] ?? 0)) worst = kind; };
  for (const part of parts(command)) {
    const inner = part.replace(WRAPPERS, '');
    if (inner !== part) seen(vaultCommand(inner.replace(/["')}]\s*$/, ''), dir, vault));
    const walks = TREE.test(part) || SHORT_R.test(part);
    for (const t of tokens(part)) {
      const value = t.replace(/^[\w-]+=/, '');
      const where = vaultPart(value, dir, vault);
      const wildcard = READER.test(part) && /[*?{[]/.test(t);
      const reads = t === value && (walks || wildcard);
      if (where === 'mdenc' || where === 'personal') seen(where);
      // a wildcard above the vault counts when a folder is named before it; '/{/p' is a search pattern
      if (reads && (where === 'whole' || ((where === 'above') && (walks || /[\w.][\\/][^*?{[]*[*?{[]/.test(t))))) seen('whole');
      // one token can hold several paths: a,b  >file  "gc path"
      for (const piece of t.split(/[\s,;<>()"'|=]+/).filter((x) => x && x !== t)) {
        const at = vaultPart(piece, dir, vault);
        if (at === 'mdenc' || at === 'personal') seen(at);
        if (at === 'whole' && reads) seen('whole');
      }
    }
    if (walks && dir !== cwd && ['whole', 'above'].includes(vaultPart('.', dir, vault))) seen('whole');
    const cd = CD.exec(inner);
    if (cd) dir = resolve(dir, plain(cd[1].replace(/^["']|["']$/g, '')));
  }
  return worst;
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

// deny reason for a shell command, or null
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
    if (tokens(part).some((t) => /personal/i.test(t) && isPersonal(t.replace(/^[\w-]+[=:](?![\\/])/, ''), cwd, root))) return 'the personal/ folder is private';
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
  return vault && vaultCommand(command, cwd, vault) === 'mdenc' ? MDENC : null;
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
// the files a patch touches (Copilot apply_patch): *** Add/Update/Delete File: and *** Move to:
export function patchFiles(text) {
  return [...String(text).matchAll(/^\*\*\* (Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm)]
    .map((m) => ({ op: m[1]?.toLowerCase() ?? 'add', path: (m[2] ?? m[3]).trim() }));
}
// file tools: every argument whose name is a path (Claude file_path, Kiro path/paths, Copilot path), also nested
// (Kiro CLI batch reads send {operations: [{path}]}), and the files named in a patch
function pathArgs(value, key = '', isContentGrep = false, queryIsGlob = false) {
  if (typeof value === 'string' && /^\*\*\* Begin Patch/m.test(value)) return patchFiles(value).map((f) => f.path);
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
const CONTENT_GREP = /(^|_)(grep|rg|grep_search|grepSearch|findTextInFiles)$/i;
const GLOB_QUERY = /(^|_)(file_search|fileSearch|findFiles|glob)$/i;
// the paths and globs a file tool call names; a content search's text is not one
const filePaths = (args, toolName = '') => pathArgs(args ?? {}, '', CONTENT_GREP.test(String(toolName)), GLOB_QUERY.test(String(toolName)));
const SEARCH_TOOL = /(^|_)(grep|rg|glob|grep_search|file_search|grepSearch|fileSearch|findTextInFiles|findFiles|semantic_search|list_dir)$/i;
// the vault rule a file tool call meets ('mdenc', 'personal' or 'whole'), or null
function vaultPaths(args, cwd, root, toolName) {
  const vault = vaultOf(root);
  if (!vault) return null;
  const search = SEARCH_TOOL.test(String(toolName));
  // a search's globs are checked as typed, from the folder it searches: their wildcards are cut out of filePaths
  const globs = search ? Object.entries(args ?? {}).filter(([k, v]) => typeof v === 'string' && (/^(glob|includePattern)$/i.test(k) || (/^(pattern|query)$/i.test(k) && !CONTENT_GREP.test(toolName))))
    .flatMap(([, v]) => expandBraces(v).map((g) => resolve(cwd, String(args.path ?? '.'), g.replace(/^\/([A-Za-z])\//, '$1:/')))) : [];
  const paths = [...filePaths(args, toolName), ...globs];
  let worst = null;
  for (const p of search && !paths.length ? ['.'] : paths) {
    let where = vaultPart(p, cwd, vault);
    if (search && (where === 'whole' || where === 'above')) where = 'whole';
    if ((SEVERITY[where] ?? 0) > (SEVERITY[worst] ?? 0)) worst = where;
  }
  return worst;
}
// deny reason for a file tool call, or null
export function checkPaths(args, cwd = process.cwd(), root = ROOT, toolName = '') {
  for (const p of filePaths(args, toolName)) {
    if (isSecret(p)) return 'secret files (.env and similar) are never opened by the agent';
    if (isPersonal(p, cwd, root)) return 'the personal/ folder is private';
  }
  return vaultPaths(args, cwd, root, toolName) === 'mdenc' ? MDENC : null;
}

// MCP tools that are hard stops by name
export function checkToolHardStop(toolName = '') {
  const t = String(toolName);
  return /(^|__|_)hostinger[-_\w]*?(execute|multi[-_]execute|execute_site_tool)$/i.test(t) || /executeDestructive$/i.test(t)
    ? 'this MCP tool is a hard stop' : null;
}

// also `env [-i] [-u NAME]` and `NAME=value` prefixes, so `env git push -f` and `GIT_TRACE=1 git push` are seen
const WRAPPERS = /^\s*(?:&\s*|[({]\s*|(?:cmd(?:\.exe)?\s+\/[ck]|(?:bash|sh|zsh)(?:\.exe)?\s+-l?c|powershell(?:\.exe)?\s+(?:-\w+\s+)*-Command|pwsh(?:\.exe)?\s+(?:-\w+\s+)*-Command|wsl(?:\.exe)?(?:\s+-d\s+\S+)?|sudo|exec|env(?:\s+(?:-u\s+\S+|-\w+))*|[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|[^\s"']*))\s+["']?)*/i;
const PRINT = /^\s*(grep|egrep|rg|findstr|Select-String|sls|echo|Write-Host|Write-Output)\b/i;
// git, its global options (those with a value first, then any --flag[=x] or -X such as -P), the subcommand and the rest
const GIT = /^\s*git(?:\.exe)?((?:\s+(?:-C\s+(?:"[^"]+"|'[^']+'|\S+)|-c\s+\S+|--(?:git-dir|work-tree|namespace|exec-path|config-env|super-prefix)[=\s]\S+|--[\w-]+(?:=\S+)?|-[A-Za-z]))*)\s+([\w-]+)(.*)$/i;
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
function gitAsk(stage) {
  const m = GIT.exec(stage);
  if (!m) return null;
  const sub = m[2].toLowerCase(), rest = m[3];
  if (sub === 'push') return 'git push requires approval';
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
// a delete of these paths asks when it reaches the vault, outside the workspace (the temp folder is fine), a whole project,
// repo or .git, or a wildcard at the top level or in a recursive delete
function deleteTargetsAsk(targets, deep, cwd, root) {
  const vault = vaultOf(root);
  for (const t of targets) {
    const full = resolve(cwd, plain(t));
    if (vault && vaultPart(t, cwd, vault) && vaultPart(t, cwd, vault) !== 'above') return 'deleting files in the Obsidian vault requires approval (Sync is its only undo)';
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
// a stage without the closer a wrapper left behind: `(cd x && rm y)`, `bash -c "rm y"`; a quote is cut only when unbalanced,
// so `rm "C:\a b\c.md"` keeps its quoted path
function unwrapped(stage) {
  const s = stage.replace(/[)}]\s*$/, '');
  const q = /(["'])\s*$/.exec(s)?.[1];
  return q && (s.split(q).length - 1) % 2 === 1 ? s.replace(/["']\s*$/, '') : s;
}
function deleteAsk(stage, cwd, root) {
  const words = tokens(unwrapped(stage)).slice(1);
  const targets = [];
  for (let i = 0; i < words.length; i++) {
    if (/^-(Filter|Include|Exclude)$/i.test(words[i])) { i++; continue; }
    if (!/^-/.test(words[i]) && !/^\/[a-z]$/i.test(words[i])) targets.push(words[i]);
  }
  if (!targets.length || targets.some((t) => /[$%`{]/.test(t))) return 'deleting files whose path is set elsewhere requires approval';
  return deleteTargetsAsk(targets, recursive(stage), cwd, root);
}

const LOADER = /\b(run_notebook\.py|seed_lake\.py|copy-from-dev\.ps1)\b|\bdev\.ps1\b.*\b(Notebook|Lake)\b/i;
const PUBLISH = /^\s*((npm|pnpm|yarn|twine|poetry|uv)\s+publish|twine\s+upload|docker\s+push)\b/i;
// cloud CLIs can reach any environment, so even their reads ask (unknown environment = PRODUCTION)
const CLOUD = /^\s*(az|kubectl|helm|terraform)(\.exe)?(\s|$)/i;
const GH = /^\s*gh(\.exe)?(\s|$)/i;
const GH_READ = /^\s*gh(\.exe)?\s+(--version|help\b|status\b|browse\b|search\s|auth\s+status\b|repo\s+clone\b|(pr|issue|run|workflow|release|repo|label|cache|gist|ruleset|variable|secret|project)\s+(view|list|ls|status|diff|checks|watch|download)\b|api\s)/i;
const GH_API_WRITE = /\s(-X|--method)[\s=]*["']?(?!GET\b)\w|\s(-f|-F|--field|--raw-field|--input)(?=[\s=]|$)/;
const HTTP = /^\s*(curl|wget|Invoke-RestMethod|Invoke-WebRequest|irm|iwr)(\.exe)?(\s|$)/i;
// curl flags are case-sensitive (-f fails quietly, -F posts a form); PowerShell parameters are not
const HTTP_WRITE = /\s(-X|--request|--method)[\s=]*["']?(?!GET\b|HEAD\b)\w|\s(-d|--data[\w-]*|-F|--form|-T|--upload-file|--post-data|--post-file|--json)(?=[\s=]|$)/;
const PS_HTTP_WRITE = /\s-Method\s+["']?(?!GET\b|HEAD\b)\w|\s-(Body|InFile)\b|Authorization/i;

// one shell command; `$( ... )` inside it is checked as its own command
function shellAsk(command, cwd, root) {
  for (const part of parts(command)) {
    for (const [, inner] of part.matchAll(/\$\(([^()]*)\)/g)) {
      const r = shellAsk(inner, cwd, root);
      if (r) return r;
    }
    for (const s of part.split('|')) {
      const stage = s.replace(WRAPPERS, '');
      if (PRINT.test(stage)) continue;
      const git = gitAsk(stage);
      if (git) return git;
      if (DELETE_CMD.test(stage)) { const d = deleteAsk(stage, cwd, root); if (d) return d; }
      else if (DELETE_ANY.test(stage)) return 'deleting files through a pipe or block requires approval';
      if (DELETE_INLINE.test(part)) return 'deleting files from inline code requires approval';
      if (LOADER.test(stage)) return 'running data loaders or notebooks requires approval';
      if (PUBLISH.test(stage)) return 'publishing requires approval';
      if (CLOUD.test(stage)) return 'cloud CLIs require approval';
      if (GH.test(stage) && (!GH_READ.test(stage) || (/^\s*gh(\.exe)?\s+api\s/i.test(stage) && GH_API_WRITE.test(stage)))) return 'a writing gh command requires approval';
      if (HTTP.test(stage) && (HTTP_WRITE.test(stage) || PS_HTTP_WRITE.test(stage))) return 'an HTTP call that sends data requires approval';
    }
  }
  return null;
}

// Case-sensitive so camelCase boundaries ([a-z] -> [A-Z]) work without matching `settings` on `set`. `run` is left out:
// read-only names such as describe_run must not match; `run_query` is listed whole.
const MUTATING_MCP = /(?:^|_|-|[a-z])(create|Create|update|Update|delete|Delete|remove|Remove|add|Add|edit|Edit|transition|Transition|comment|Comment|send|Send|post|Post|put|Put|patch|Patch|register|Register|rename|Rename|restore|Restore|set|Set|log|Log|link|Link|evaluate|Evaluate|write|Write|exec|Exec|execute|Execute|apply|Apply|upload|Upload|insert|Insert|merge|Merge|push|Push|deploy|Deploy|publish|Publish|drop|Drop|destroy|Destroy|run_query)(?:$|_|-|[A-Z])/;
const DESTRUCTIVE_MCP = /(?:^|_|-|[a-z])(delete|Delete|remove|Remove|drop|Drop|destroy|Destroy|purge|Purge)(?:$|_|-|[A-Z])/;
// file tools that delete what they name
const DELETE_TOOL = /(^|_)(delete|delete_file|deleteFile|remove_file|fs_delete)$/i;

// ask reason for a call, or null
export function checkAsk(command, args = {}, cwd = process.cwd(), root = ROOT, toolName = '') {
  if (typeof command === 'string') {
    const r = shellAsk(command, cwd, root);
    if (r) return r;
    const vault = vaultOf(root);
    const v = vault && vaultCommand(command, cwd, vault);
    if (v === 'personal') return PERSONAL;
    if (v === 'whole') return WHOLE;
  }
  const name = String(toolName);
  const patchDeletes = Object.values(args ?? {}).filter((v) => typeof v === 'string').flatMap(patchFiles).filter((f) => f.op === 'delete').map((f) => f.path);
  const deletes = [...patchDeletes, ...(DELETE_TOOL.test(name) ? filePaths(args, name) : [])];
  if (deletes.length) { const d = deleteTargetsAsk(deletes, false, cwd, root); if (d) return d; }
  const v = vaultPaths(args, cwd, root, name);
  if (v === 'personal') return PERSONAL;
  if (v === 'whole') return WHOLE;
  if (/^mcp_/i.test(name)) {
    if (DESTRUCTIVE_MCP.test(name)) return 'a deleting MCP tool requires approval';
    if (MUTATING_MCP.test(name) && !/executeRead$/i.test(name)) return 'writing to a shared MCP server requires approval';
  }
  if (/^mssql_dab$/i.test(name) && args?.operation === 'apply_changes') return 'modifying Data API builder config requires approval';
  return null;
}

// The decision for one hook payload (Claude Code and Kiro: tool_name/tool_input; Copilot: toolName/toolArgs, a JSON string).
export function decide(input, root = ROOT) {
  let args = input?.tool_input ?? input?.toolArgs ?? {};
  if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = { command: args }; } }
  const cwd = input?.cwd ?? process.cwd();
  const command = args?.command ?? args?.commandLine;
  const toolName = input?.tool_name ?? input?.toolName ?? '';
  const deny = checkToolHardStop(toolName) ?? (typeof command === 'string' ? check(command, cwd, root) : null) ?? checkPaths(args, cwd, root, toolName);
  if (deny) return { decision: 'deny', reason: `Blocked: ${deny}. Give the user the command or query to run instead.` };
  const ask = checkAsk(command, args, cwd, root, toolName);
  return ask ? { decision: 'ask', reason: `Confirm: ${ask}.` } : { decision: null, reason: '' };
}

// stdin of a hook as JSON, or null when it is empty (no tool call: nothing to check). A failed read or text that is not
// JSON throws, so the loader blocks the call instead of letting it through; a leading BOM is dropped.
export function readInput() {
  const text = readFileSync(0, 'utf8').replace(/^﻿/, '');
  return text.trim() ? JSON.parse(text) : null;
}
