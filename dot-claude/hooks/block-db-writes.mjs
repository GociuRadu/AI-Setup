// PreToolUse hook: the agent may only read databases. Blocks shell commands that send writing SQL
// (DML, DDL, EXEC, ...) through a database client, inline, piped or from a script, and write-only DB tools.
// shortcut: matches command text only; code that opens its own connection (pytest, a loader) is not seen.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CLIENT = /\b(sqlcmd|osql|isql|bcp|psql|mysql|mariadb|sqlite3|duckdb|mssql-cli|usql|Invoke-Sqlcmd|Invoke-DbaQuery|pyodbc|pymssql|psycopg2?|pg8000|sqlalchemy|mssql|tedious|oracledb)\b/i;
// tools whose job is to write a database
const WRITE_TOOL = /\b(pg_restore|sqlpackage|mysqlimport|Import-Dba\w+|Write-Dba\w+|Invoke-DbaDbDataMasking|flyway|liquibase|alembic\s+(upgrade|downgrade)|dotnet\s+ef\s+database\s+update)\b/i;
const WRITE = /\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|CREATE|ALTER|EXEC|EXECUTE|GRANT|REVOKE|DENY|BACKUP|RESTORE|DBCC|INTO|sp_rename|sp_executesql|sp_configure)\b/i;
// script input: -i/-f/-InputFile/--file (a .sql path), or a < redirect (any file)
const FILES = /(?:\s-[if]\s*|\s-InputFile\s+|\s--file[=\s]+)("[^"]+\.sql"|'[^']+\.sql'|[^\s"']+\.sql)\b|<\s*("[^"]+"|'[^']+'|[^\s<>|&;]+)/gi;
const SEARCH = /^\s*(git|grep|rg|findstr|Select-String|echo|Write-Host|code|cat|type|Get-Content|less|more|head|tail)\b/i;

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

export function check(command, cwd = process.cwd()) {
  // each simple command on its own; a pipe keeps its parts together so `x | sqlcmd` is seen
  for (const part of parts(command)) {
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

if (process.argv[1]?.endsWith('block-db-writes.mjs')) {
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
  // Claude Code sends tool_input; Copilot sends toolArgs, sometimes as a JSON string
  let args = input?.tool_input ?? input?.toolArgs ?? {};
  if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = { command: args }; } }
  const reason = check(args.command ?? args.commandLine ?? '', input?.cwd);
  if (reason) {
    const message = `Blocked: ${reason}. The agent only reads databases; give the user the query to run.`;
    process.stdout.write(JSON.stringify({ permissionDecision: 'deny', permissionDecisionReason: message,
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: message } }));
    process.stderr.write(message);
    process.exit(2);
  }
}
