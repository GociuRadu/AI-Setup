// PreToolUse guard shared by Claude Code, GitHub Copilot and Kiro; a small fail-closed loader per tool (hooks/<tool>/hook.mjs)
// turns its decision into that tool's output. decide(input) returns { decision: 'deny' | 'ask' | null, reason }.
// Deny (only the user runs it):
// - shell commands that send writing SQL (DML, DDL, EXEC, ...) through a database client, inline, piped or from a script,
//   and tools that only write databases;
// - hard stops: force-push, deleting Docker volumes, production compose files, release scripts, SSH, Hostinger anything
//   but reads, Atlassian executeDestructive;
// - run by the user only: data loaders, publishing, cloud CLIs, gh merges, repo deletes and releases;
// - Git that skips the hooks and so the secret scan (--no-verify, commit -n, core.hooksPath);
// - secret files (.env, local.env, ...) and the workspace's personal/ folder, by shell (redirects included) or file tools;
// - encrypted .mdenc notes, by name, anywhere.
// Ask, only what is rare and cannot be undone: Git that discards uncommitted work, deletes outside the workspace (the vault
// included), of a whole project or of targets not known here, the vault's Personal folder, and MCP tools that delete,
// trash or send. Everything else runs (git push, HTTP calls): an ask nobody reads protects nothing.
// This guard catches accidents, it is not a sandbox. shortcut: matches command text and path arguments only (strings in
// inline -c/-e code included); code that opens its own connection or builds a command at run time is not seen. A bypass
// is fixed when an agent was seen using one (/improve), not for every one a review can think of.
// Speed: every check is a regex on the call; the file system is touched only for paths a regex already picked out.
import { readFileSync, existsSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative, isAbsolute, join, dirname, basename } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const CLIENT = /\b(sqlcmd|osql|isql|bcp|psql|mysql|mariadb|sqlite3|duckdb|mssql-cli|usql|Invoke-Sqlcmd|Invoke-DbaQuery|pyodbc|pymssql|psycopg2?|pg8000|sqlalchemy|mssql|tedious|oracledb)\b/i;
// tools whose job is to write a database
const WRITE_TOOL = /\b(pg_restore|sqlpackage|mysqlimport|Import-Dba\w+|Write-Dba\w+|Invoke-DbaDbDataMasking|flyway|liquibase|alembic\s+(upgrade|downgrade)|dotnet\s+ef\s+database\s+update)\b/i;
const WRITE = /\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|CREATE|ALTER|EXEC|EXECUTE|GRANT|REVOKE|DENY|BACKUP|RESTORE|DBCC|INTO|sp_rename|sp_executesql|sp_configure)\b/i;
// statements that change data or the server without those words, counted only at the start of a statement, so a column
// or a LIKE '%copy%' in a read does not count
const WRITE_STMT = /(?:^|;)\s*(?:(?:CALL|COPY|KILL|SHUTDOWN|VACUUM|REINDEX|CLUSTER|REFRESH|OPTIMIZE|FLUSH|LOCK|UNLOCK|RENAME|ATTACH|DETACH|ENABLE|DISABLE|LOAD|REPLACE|UPSERT|DISCARD|REASSIGN|IMPORT)\b|COMMENT\s+ON\b|SET\s+(?:GLOBAL|PERSIST)\b|PRAGMA\s+[\w.]+\s*=)/im;
const writesSql = (text) => WRITE.test(text) || WRITE_STMT.test(text);
// script input: -i/-f/-InputFile/--file (a .sql path), or a < redirect (any file)
const FILES = /(?:\s-[if]\s*|\s-InputFile\s+|\s--file[=\s]+)("[^"]+\.sql"|'[^']+\.sql'|[^\s"']+\.sql)\b|<\s*("[^"]+"|'[^']+'|[^\s<>|&;]+)/gi;
// commands that only mention text (a commit message, a search pattern) are not checked for SQL or hard stops
const SEARCH = /^\s*(git|grep|rg|findstr|Select-String|echo|Write-Host|Write-Output|code)\b/i;
const HARD_STOPS = [
  // -f alone or in a short-flag cluster (-uf); --force-with-lease and +branch
  [/^\s*git\b[^|;&]*\spush\b.*(\s--force(-with-lease)?\b|\s-[a-z]*f[a-z]*\b|\s\+\S)/i, 'force-push'],
  // -v alone or in a cluster (-fv, -vf)
  [/\bdown\b.*(\s-[a-z]*v[a-z]*\b|\s--volumes\b)/i, 'deleting Docker volumes (down -v)'],
  [/\bdocker\s+(volume\s+(rm|prune)|system\s+prune)\b/i, 'deleting Docker volumes'],
  [/\bcompose\b.*\b(prod|production|staging|hostinger|monitoring)\b/i, 'a production or staging compose file'],
  [/\b(release|rollback)\.sh\b/i, 'a release or rollback script'],
  // the command word after bareCmd (wrappers, VAR=, paths off): `wsl ssh host`, `Start-Process ssh`, `/usr/bin/ssh host`
  [/^(ssh|scp|sftp)(\.exe)?(["']?\s|$)/i, 'SSH to a server'],
];
// the workspace root (this file is <workspace>/.ai/hooks/guard.mjs), so personal/ is found from any working folder
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// .env, .env.local, local.env, prod.env, .test.env; examples and templates are fine
const SECRET = /(^|[\\/\s"'=:])(\.?[\w-]*\.env(\.[\w-]+)*)(?=$|[\s"';|&)])/i;
const EXAMPLE = /\.(example|sample|template|dist)\b/i;
// commands that read, write, copy, pack, load or stage a file they name (`. ./.env` and `source .env` load it into the shell)
const READER = /^\s*(?:(cat|type|gc|Get-Content|Select-String|sls|grep|egrep|rg|findstr|less|more|head|tail|awk|sed|cp|copy|Copy-Item|mv|move|Move-Item|notepad|code|strings|xxd|Format-Hex|base64|source|tar|zip|7z|Compress-Archive|scp|tee|Set-Content|Add-Content|Out-File|dd)\b|\.(?=\s)|git\s+add\b)/i;
// the file a redirect writes (>, >>, >|, >&, 2>); quoted text is matched first and skipped, so a commit message may name one
const REDIRECT = /"[^"]*"|'[^']*'|\d?>[>|&]?\s*("[^"]*"|'[^']*'|[^\s;|&<>]+)/g;

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
const MDENC = 'encrypted .mdenc notes are never opened by the agent';
const isMdenc = (text) => String(text).split(/[\s,;<>()"'|=]+/).some((w) => /\.mdenc$/i.test(w));
const PERSONAL = "this reads or touches the Obsidian vault's Personal folder";
const WHOLE = "this reads the whole Obsidian vault, Personal folder included; name one folder, for example Learn, to skip the prompt";
// the real path, so a short Windows name or a link is seen; for a file that does not exist yet, that of its nearest folder
const real = (p) => { try { return realpathSync.native(p); } catch { const up = dirname(p); return up === p ? p : join(real(up), basename(p)); } };
// a path as the shell would see it: home folder, file:, \\?\, Git Bash drive
const plain = (path) => String(path).replace(/^(~|\$HOME|\$\{HOME\}|\$env:USERPROFILE|\$\{env:USERPROFILE\}|\$USERPROFILE|%USERPROFILE%)(?=[\\/]|$)/i, () => homedir())
  .replace(/^file:\/+(?=[A-Za-z]:)/i, '').replace(/^[\\/]{2}[?.][\\/]/, '').replace(/^\/([A-Za-z])(?=\/|$)/, '$1:/');
// 'personal' for the vault's Personal folder (or a wildcard that can climb into it);
// 'whole' for the vault root or a wildcard in its first level; 'above' for a folder that holds the vault; 'in' for any
// other vault path; else null. Windows drops dots and spaces at the end of a folder name.
function vaultPart(path, cwd, vault) {
  const text = plain(path).replace(/([^\\/.])[. ]+(?=[\\/]|$)/g, '$1');
  const [fixed, ...wild] = text.split(/[*?{[]/);
  const full = resolve(cwd, fixed);
  const rel = relative(real(vault), real(full)).replace(/\\/g, '/');
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
const SEVERITY = { personal: 2, whole: 1 };
// the vault rule a shell command meets ('personal' or 'whole', the most severe), or null; follows cd, looks into
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
      if (where === 'personal') seen(where);
      // a wildcard above the vault counts when a folder is named before it; '/{/p' is a search pattern
      if (reads && (where === 'whole' || ((where === 'above') && (walks || /[\w.][\\/][^*?{[]*[*?{[]/.test(t))))) seen('whole');
      // one token can hold several paths: a,b  >file  "gc path"
      for (const piece of t.split(/[\s,;<>()"'|=]+/).filter((x) => x && x !== t)) {
        const at = vaultPart(piece, dir, vault);
        if (at === 'personal') seen(at);
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
    // $( ... ) and `...` run as commands of their own, also inside echo or an assignment
    for (const [, a, b] of part.matchAll(/\$\(([^()]*)\)|`([^`]*)`/g)) { const r = check(a ?? b, cwd, root); if (r) return r; }
    // per pipe stage, so `echo y | ssh host` is seen; a stage that only prints or searches text is skipped (git is in
    // SEARCH for its messages, so the force-push check, which needs git first, always runs)
    const hard = part.split('|').flatMap((s) => {
      const u = bareCmd(s);
      return HARD_STOPS.filter(([re], i) => re.test(u) && (i === 0 || !SEARCH.test(u)));
    })[0];
    if (hard) return `${hard[1]} is a hard stop`;
    // a stage that only prints or searches text (echo "npm publish", grep run_notebook.py) is not a run
    const userOnly = part.split('|').map(bareCmd).filter((u) => !SEARCH.test(u) && !PRINT.test(u)).flatMap((u) => USER_ONLY.filter(([re]) => re.test(u)))[0];
    if (userOnly) return `${userOnly[1]} is run by the user only`;
    if (part.split('|').some((s) => skipsHooks(bareCmd(s), part))) return 'skipping Git hooks (--no-verify, commit -n, core.hooksPath) turns off the secret scan';
    // code an interpreter runs inline: the strings inside it are checked as commands (os.system('git push -f'))
    const bare = part.replace(WRAPPERS, '');
    if (INLINE.test(bare)) for (const q of quotedDeep(bare)) { const r = check(q, cwd, root); if (r) return r; }
    // a program that only receives an env file (docker compose --env-file local.env) is fine; reading it is not
    // a glob counts when it can match a secret file name (cat *.env, .env.*, .en*)
    if (part.split('|').some((s) => { const u = bareCmd(s); return READER.test(u) && (isSecret(u) || tokens(u).some((t) => /[*?[]/.test(t) && globMatchesSecret(t))); })) return 'secret files (.env and similar) are never opened by the agent';
    // also after a wrapper, whose quotes would hide the redirect: bash -c "echo x > .env"
    if ([part, part.replace(WRAPPERS, '')].some((p) => [...p.matchAll(REDIRECT)].some((m) => m[1] && isSecret(m[1])))) return 'secret files (.env and similar) are never opened by the agent';
    if (tokens(part).some((t) => /personal/i.test(t) && isPersonal(t.replace(/^[\w-]+[=:](?![\\/])/, ''), cwd, root))) return 'the personal/ folder is private';
    // a stage that only prints or commits text (echo, git commit -m) may name an .mdenc note; reading one may not
    if (part.split('|').some((s) => { const u = bareCmd(s); return (READER.test(u) || !SEARCH.test(u)) && isMdenc(u); })) return MDENC;
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
    if (writesSql(quoted)) return 'the command contains writing SQL';
    for (const [, flagged, redirected] of cmd.matchAll(FILES)) {
      const raw = flagged ?? redirected;
      const file = resolve(cwd, raw.replace(/^["']|["']$/g, ''));
      if (!existsSync(file)) return `cannot read the SQL script ${raw} to check it`;
      if (writesSql(readFileSync(file, 'utf8'))) return `the SQL script ${raw} contains writing SQL`;
    }
  }
  return null;
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
// the vault rule a file tool call meets ('personal' or 'whole'), or null
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
    if (/\.mdenc$/i.test(p)) return MDENC;
  }
  return null;
}

// MCP tools that are hard stops by name
export function checkToolHardStop(toolName = '') {
  const t = String(toolName);
  if (/(^|__|_)hostinger[-_\w]*?(execute|multi[-_]execute|execute_site_tool)$/i.test(t) || /executeDestructive$/i.test(t)) return 'this MCP tool is a hard stop';
  // Hostinger hosts production: anything but a read
  return /^mcp_.*hostinger/i.test(t) && !/(get|list|show|search|describe|check)/i.test(t) ? 'a Hostinger change reaches production, a hard stop' : null;
}

// also `env [-i] [-u NAME]` and `NAME=value` prefixes, so `env git push -f` and `GIT_TRACE=1 git push` are seen
// also the prefixes that run the next word as a command (command, nohup, time, timeout 5, xargs -0, eval, iex, Start-Process)
// and the shell keywords before one (if, then, do, ...)
const WRAPPERS = /^\s*(?:&\s*|[({]\s*|(?:cmd(?:\.exe)?\s+\/[ck]|(?:bash|sh|zsh)(?:\.exe)?\s+-l?c|(?:powershell|pwsh)(?:\.exe)?\s+(?:-\w+\s+)*-c(?:o(?:m(?:m(?:a(?:n(?:d)?)?)?)?)?)?|wsl(?:\.exe)?(?:\s+-d\s+\S+)?|sudo|exec|env(?:\s+(?:-u\s+\S+|-\w+))*|command|builtin|nohup|time|nice(?:\s+-n\s+\S+)?|timeout(?:\s+-\S+)*\s+\S+|xargs(?:\s+-\w+)*|eval|iex|Invoke-Expression|Start-Process(?:\s+-FilePath)?|if|then|else|elif|do|while|until|!|[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|[^\s"']*))\s+["']?)*/i;
// the command word as the shell runs it: wrappers off, a leading \ (it skips aliases) off, quotes and a folder path around
// the program off, so `\git`, `/usr/bin/ssh` and `& 'C:\...\ssh.exe'` read as git and ssh
function bareCmd(s) {
  let u = s, prev;
  do {
    prev = u;
    u = u.replace(WRAPPERS, '').replace(/^\\(?=\w)/, '').replace(/^(["'])([^"']*)\1/, (_, q, p) => p.split(/[\\/]/).pop())
      .replace(/^(?:[A-Za-z]:)?[^\s"'|]*[\\/](?=[\w.-]+["']?(\s|$))/, '');
  } while (u !== prev);
  return u;
}
const PRINT = /^\s*(grep|egrep|rg|findstr|Select-String|sls|echo|Write-Host|Write-Output)\b/i;
// interpreters running code given inline (python -c, node -e, perl -e, ...)
const INLINE = /^\s*(python[\d.]*|py|node|deno|bun|perl|ruby|php)(\.exe)?\b[^|]*?\s(-c|-e|--eval|-r|-p)(\s|$)/i;
// the strings in a command, and the strings inside those: the inline code, then the commands it runs
const quoted = (s) => [...String(s).matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2]);
const quotedDeep = (s) => { const one = quoted(s); return [...one, ...one.flatMap(quoted)]; };
// git, its global options (those with a value first, then any --flag[=x] or -X such as -P), the subcommand and the rest
const GIT = /^\s*git(?:\.exe)?((?:\s+(?:-C\s+(?:"[^"]+"|'[^']+'|\S+)|-c\s+\S+|--(?:git-dir|work-tree|namespace|exec-path|config-env|super-prefix)[=\s]\S+|--[\w-]+(?:=\S+)?|-[A-Za-z]))*)\s+([\w-]+)(.*)$/i;
// local Git that discards uncommitted work, which Git cannot bring back; history changes (rebase, branch -D, tag -d) run,
// because the reflog undoes them and publishing a rewrite needs a force-push (a hard stop)
const GIT_DISCARD = {
  reset: (r) => /\s--(hard|merge|keep)\b/.test(r),
  clean: (r) => !/\s(-n|--dry-run)\b/.test(r),
  restore: (r) => !/\s(--staged|-S)\b/.test(r) || /\s(--worktree|-W)\b/.test(r),
  checkout: (r) => /\s(--|-f|--force|\.)(?=\s|$)/.test(r),
  switch: (r) => /\s(-f|--force|--discard-changes)\b/.test(r),
  stash: (r) => /^\s+(drop|clear)\b/.test(r),
  worktree: (r) => /^\s+remove\b.*\s(-f|--force)\b/.test(r),
};
// Git that skips the hooks, and so the secret scan: --no-verify (or a prefix Git accepts), commit -n, core.hooksPath for
// one command (-c) or written to a config, an alias that skips them, Git config swapped by environment variables; quoted
// text (a commit message) does not count, a read of core.hooksPath runs
const NO_VERIFY = /\s--no-veri(f|fy)?(?=[\s="']|$)/;
const SKIP_ALIAS = /\balias\.[\w.-]+[=\s]*["']?[^"']*?(--no-veri|[\s"'=]commit\b[^"']*\s-[a-zA-Z]*n[a-zA-Z]*(?=\s|$|["']))/i;
function skipsHooks(stage, part = stage) {
  if (/\bgit\b/i.test(part) && /(^|\s)GIT_CONFIG_(GLOBAL|SYSTEM|NOSYSTEM|COUNT|PARAMETERS)=/.test(part)) return true;
  if (!/^\s*git(\.exe)?\s/i.test(stage)) return false;
  if (/\s-c\s*["']?core\.hooksPath\b/i.test(stage) || SKIP_ALIAS.test(stage)) return true;
  const m = GIT.exec(stage.replace(/"[^"]*"|'[^']*'/g, '""'));
  if (!m) return false;
  const sub = m[2].toLowerCase(), rest = m[3];
  if (NO_VERIFY.test(rest)) return true;
  if (sub === 'commit' && /\s-[a-zA-Z]*n[a-zA-Z]*(?=\s|$)/.test(rest)) return true;
  return sub === 'config' && /\bcore\.hooksPath\b/i.test(rest) && !/\s--(get|get-all|get-regexp|list|show-origin)\b/.test(rest)
    && !/^(\s+--(global|local|system))?\s+core\.hooksPath\s*$/i.test(rest);
}
function gitAsk(stage) {
  const m = GIT.exec(stage);
  if (!m) return null;
  const sub = m[2].toLowerCase(), rest = m[3];
  // `git -c alias.p=push p -f`: an alias set on the command line can stand for any command
  if (/(^|\s)-c\s+["']?alias\./i.test(m[1])) return 'a git alias set on the command line can run anything and requires approval';
  return GIT_DISCARD[sub]?.(rest) ? `git ${sub} can discard uncommitted work and requires approval` : null;
}

const DELETE_CMD = /^\s*(rm|del|erase|rmdir|rd|ri|Remove-Item|Clear-Content|Clear-Item)(\.exe)?(\s|$)/i;
// deletes that are not the first word: PowerShell blocks, xargs rm, find -delete; their targets are not known here
const DELETE_ANY = /\b(Remove-Item|Clear-Content|Clear-Item)\b|\bxargs\b.*\b(rm|del|rmdir)\b|\bfind\b.*\s-delete\b/i;
const DELETE_INLINE = /\b(rmSync|rmdirSync|unlinkSync|fs\.rm|promises\.rm|shutil\.rmtree|os\.(remove|unlink|rmdir))\b|\.unlink\s*\(|\[(?:System\.)?IO\.(?:File|Directory)\]::Delete/i;
// -r, -rf, -R; a PowerShell -Word parameter (-Force, -Recurse) is not a short flag, so -Recurse is matched on its own
const recursive = (s) => /\s-(?![A-Z][a-z]{2})[a-zA-Z]*[rR][a-zA-Z]*(?=\s|$)/.test(s) || /\s-Recurse\b|\s\/s(?=\s|$)/i.test(s);
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const inTemp = (p) => { const r = relative(real(tmpdir()), real(p)); return r !== '' && !outside(r); };
// a delete of these paths asks when it reaches outside the workspace (the vault too; the temp folder is fine), a whole
// project, repo or .git, or a wildcard at the top level or in a recursive delete
function deleteTargetsAsk(targets, deep, cwd, root) {
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

// run by the user only (denied): rare for an agent, and each can reach shared or production systems
const USER_ONLY = [
  [/\b(run_notebook\.py|seed_lake\.py|copy-from-dev\.ps1)\b|\bdev\.ps1\b.*\b(Notebook|Lake)\b/i, 'running data loaders or notebooks'],
  [/^\s*((npm|pnpm|yarn|twine|poetry|uv)\s+publish|twine\s+upload|docker\s+push)\b/i, 'publishing'],
  // cloud CLIs can reach any environment, so even their reads count (unknown environment = PRODUCTION)
  [/^\s*(az|kubectl|helm|terraform)(\.exe)?(\s|$)/i, 'a cloud CLI'],
  // gh that cannot be undone from a PR page; PRs, issues and comments run
  [/^\s*gh(\.exe)?\s+(pr\s+merge|repo\s+(delete|archive|rename)|release\s+(create|delete|edit|upload)|api\s.*(-X|--method)[\s=]*["']?DELETE)\b/i, 'a gh merge, repo delete or release'],
];

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
      if (INLINE.test(stage)) for (const q of quotedDeep(stage)) { const r = shellAsk(q, cwd, root); if (r) return r; }
      const git = gitAsk(stage);
      if (git) return git;
      if (DELETE_CMD.test(stage)) { const d = deleteAsk(stage, cwd, root); if (d) return d; }
      else if (DELETE_ANY.test(stage)) return 'deleting files through a pipe or block requires approval';
      if (DELETE_INLINE.test(part)) return 'deleting files from inline code requires approval';
    }
  }
  return null;
}

// MCP tools that delete; other writes (Confluence, Jira) run: the skills show a draft first and page history undoes them.
// Case-sensitive so camelCase boundaries ([a-z] -> [A-Z]) work: deletePage, delete_run
const DESTRUCTIVE_MCP = /(?:^|_|-|[a-z])(delete|Delete|remove|Remove|drop|Drop|destroy|Destroy|purge|Purge|trash|Trash)(?:$|_|-|[A-Z])/;
// MCP tools that send mail or messages to other people (Gmail send and forward, chat messages); drafts and labels run
const SEND_MCP = /(?:^|_|-|[a-z])(send|Send|forward|Forward)(?:$|_|-|[A-Z])/;
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
  if (/^mcp_/i.test(name) && DESTRUCTIVE_MCP.test(name)) return 'a deleting MCP tool requires approval';
  if (/^mcp_/i.test(name) && SEND_MCP.test(name)) return 'an MCP tool that sends mail or messages requires approval';
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
