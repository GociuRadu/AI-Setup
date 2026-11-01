// PreToolUse guard for Claude Code, GitHub Copilot and Kiro. Blocks (exit 2 plus a deny decision):
// - shell commands that send writing SQL (DML, DDL, EXEC, ...) through a database client, inline, piped or
//   from a script, and tools that only write databases;
// - hard stops: force-push, deleting Docker volumes, production compose files, release scripts, SSH;
// - reading or writing secret files (.env, local.env, ...) and anything under personal/, by shell or file tools.
// shortcut: matches command text and path arguments only; code that opens its own connection (pytest, a loader) is not seen.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
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
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
// .env, .env.local, local.env, prod.env, .test.env; examples and templates are fine
const SECRET = /(^|[\\/\s"'=])(\.?[\w-]*\.env(\.[\w-]+)*)(?=$|[\s"';|&)])/i;
const EXAMPLE = /\.(example|sample|template|dist)\b/i;
const READER = /^\s*(cat|type|gc|Get-Content|Select-String|sls|grep|egrep|rg|findstr|less|more|head|tail|awk|sed|cp|copy|Copy-Item|mv|move|Move-Item|notepad|code|strings|xxd|Format-Hex|base64)\b/i;

const SECRETS = new RegExp(SECRET.source, 'gi');
const isSecret = (text) => [...String(text).matchAll(SECRETS)].some((m) => !EXAMPLE.test(m[2]));
// words of a command with quotes removed, to test each one as a path
const tokens = (s) => [...s.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
function isPersonal(path, cwd, root = ROOT) {
  const rel = relative(root, resolve(cwd, String(path))).replace(/\\/g, '/');
  return !rel.startsWith('..') && !isAbsolute(rel) && /^personal(\/|$)/i.test(rel);
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
    if (c === ';' || c === '\n') { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  return [...out, cur];
}

export function check(command, cwd = process.cwd(), root = ROOT) {
  // each simple command on its own; a pipe keeps its parts together so `x | sqlcmd` is seen
  for (const part of parts(command)) {
    // per pipe stage, so `echo y | ssh host` is seen; a stage that only prints or searches text is skipped
    const hard = part.split('|').flatMap((s) => HARD_STOPS.filter(([re], i) => re.test(s) && (i === 0 || !SEARCH.test(s))))[0];
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
  return null;
}

// file tools: every argument whose name is a path (Claude file_path, Kiro path/paths, Copilot filePath),
// also nested (Kiro CLI batch reads send {operations: [{path}]})
function pathArgs(value, key = '') {
  // a glob pattern is not a file, but one rooted in personal/ still lists it
  if (typeof value === 'string' && /pattern/i.test(key)) return [value.split(/[*?[{]/)[0]].filter((v) => /personal/i.test(v));
  if (typeof value === 'string') return /path|file|target|dir/i.test(key) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((v) => pathArgs(v, key));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => pathArgs(v, k));
  return [];
}
export function checkPaths(args, cwd = process.cwd(), root = ROOT) {
  for (const p of pathArgs(args ?? {})) {
    if (isSecret(p)) return 'secret files (.env and similar) are never opened by the agent';
    if (isPersonal(p, cwd, root)) return 'personal/ is private';
  }
  return null;
}

// Hook entry. The hook wiring calls run() through a loader that blocks (exit 2) when this file cannot load,
// and any error inside the check blocks too: the guard fails closed. Unreadable stdin (no tool call) is allowed.
export function run() {
  try { decide(); } catch (e) {
    process.stderr.write(`Blocked: the guard hook failed (${e?.message ?? e}). Fix _ai/hooks/guard.mjs, then retry.`);
    process.exit(2);
  }
}
if (process.argv[1]?.endsWith('guard.mjs')) run();

function decide() {
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
  // Claude Code and Kiro send tool_input; Copilot sends toolArgs, sometimes as a JSON string
  let args = input?.tool_input ?? input?.toolArgs ?? {};
  if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = { command: args }; } }
  const cwd = input?.cwd ?? process.cwd();
  const command = args.command ?? args.commandLine;
  const reason = (typeof command === 'string' ? check(command, cwd) : null) ?? checkPaths(args, cwd);
  if (reason) {
    const message = `Blocked: ${reason}. Give the user the command or query to run instead.`;
    process.stdout.write(JSON.stringify({ permissionDecision: 'deny', permissionDecisionReason: message,
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: message } }));
    process.stderr.write(message);
    process.exit(2);
  }
}
