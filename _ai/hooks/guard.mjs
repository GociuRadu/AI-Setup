// PreToolUse guard for Claude Code, Kiro and GitHub Copilot. Blocks (exit 2 plus a deny decision):
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
  return null;
}

// file tools: every argument whose name is a path (Claude file_path, Kiro path/paths),
// also nested (Kiro CLI batch reads send {operations: [{path}]})
// {a,b} groups into separate globs; globMatch tests whether a file glob can match any candidate filename
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
export function checkPaths(args, cwd = process.cwd(), root = ROOT, toolName = '') {
  const isContentGrep = /(^|_)(grep|grep_search|grepSearch|findTextInFiles)$/i.test(String(toolName));
  const queryIsGlob = /(^|_)(file_search|fileSearch|findFiles|glob)$/i.test(String(toolName));
  for (const p of pathArgs(args ?? {}, '', isContentGrep, queryIsGlob)) {
    if (isSecret(p)) return 'secret files (.env and similar) are never opened by the agent';
    if (isPersonal(p, cwd, root)) return 'personal/ is private';
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
const GIT_READ = /^\s*git(\.exe)?\s+(-C\s+("[^"]+"|'[^']+'|\S+)\s+|--no-pager\s+|-c\s+\S+\s+)*(status|log|diff|show|ls-files|blame|rev-parse|grep|remote\s+-v|branch\s+(--show-current|-a|-r|--list)|--version|merge-base|stash\s+list|config\s+(--get|--list)|describe|shortlog)\b/i;
const DELETE_CMD = /^\s*(rm|del|erase|rmdir|rd|ri|Remove-Item|Clear-Content|Clear-Item)(\.exe)?(\s|$)/i;
// deletes that are not the first word: PowerShell blocks, xargs rm, find -delete
const DELETE_ANY = /\b(Remove-Item|Clear-Content|Clear-Item)\b|\bxargs\b.*\b(rm|del|rmdir)\b|\bfind\b.*\s-delete\b/i;
const DELETE_INLINE = /\b(rmSync|rmdirSync|unlinkSync|fs\.rm|promises\.rm|shutil\.rmtree|os\.(remove|unlink|rmdir))\b|\.unlink\s*\(|\[(?:System\.)?IO\.(?:File|Directory)\]::Delete/i;
const EXTERNAL = /^\s*(az|gh|curl|wget|Invoke-RestMethod|Invoke-WebRequest|irm|iwr|kubectl|helm|terraform|scp|sftp)(\.exe)?(\s|$)/i;
const EDIT_TOOL = /(^|_)(replace_string_in_file|multi_replace_string_in_file|create_file|insert_edit_into_file|edit_notebook_file|create_directory|Edit|Write|NotebookEdit|write|fs_write|str_replace|fs_append)$/i;
// `run` is left out: read-only names such as describe_run must not match; `run_query` is listed whole.
// Case-sensitive so camelCase boundaries ([a-z] -> [A-Z]) work without matching `settings` on `set`.
const MUTATING_MCP = /(?:^|_|-|[a-z])(create|Create|update|Update|delete|Delete|remove|Remove|add|Add|edit|Edit|transition|Transition|comment|Comment|send|Send|post|Post|put|Put|patch|Patch|register|Register|rename|Rename|restore|Restore|set|Set|log|Log|link|Link|evaluate|Evaluate|write|Write|exec|Exec|execute|Execute|apply|Apply|upload|Upload|insert|Insert|merge|Merge|push|Push|deploy|Deploy|publish|Publish|drop|Drop|destroy|Destroy|run_query)(?:$|_|-|[A-Z])/;

// calls that VS Code or the tool should confirm with the user (permissionDecision ask); null = no objection
export function checkAsk(command, args = {}, cwd = process.cwd(), root = ROOT, toolName = '') {
  if (typeof command === 'string') {
    for (const part of parts(command)) {
      if (/\$\(\s*(git|rm|del|erase|rmdir|rd|ri|Remove-Item|az|gh|curl|wget|Invoke-RestMethod|Invoke-WebRequest|irm|iwr|kubectl|helm|terraform)\b/i.test(part)) {
        return 'sensitive command inside substitution requires approval';
      }
      for (const s of part.split('|')) {
        const stage = s.replace(WRAPPERS, '');
        if (PRINT.test(stage) && !stage.includes('$(')) continue;
        if (/^\s*git(\.exe)?\b/i.test(stage) && !(GIT_READ.test(stage) && !/\s--output\b|\s-[dDmM]\b/.test(stage))) return 'Git write or history command requires approval';
        if (DELETE_CMD.test(stage) || DELETE_ANY.test(stage) || DELETE_INLINE.test(part) || /\bclean\.mjs\b.*--apply\b/i.test(part)) return 'deleting files requires approval';
        if (/\b(run_notebook\.py|seed_lake\.py|copy-from-dev\.ps1)\b/i.test(stage) || /\bdev\.ps1\b.*\b(Notebook|Lake)\b/i.test(stage)) return 'running data loaders or notebooks requires approval';
        if (EXTERNAL.test(stage) || /^\s*(npm|pnpm|yarn|twine|poetry|uv)\s+publish\b/i.test(stage) || /^\s*docker\s+push\b/i.test(stage)) return 'external CLI, network or publish command requires approval';
      }
    }
  }
  const name = String(toolName);
  if (EDIT_TOOL.test(name)) {
    for (const p of pathArgs(args ?? {}, '', false, false)) {
      const rel = relative(root, resolve(cwd, String(p))).replace(/\\/g, '/');
      if ((rel.startsWith('..') || isAbsolute(rel)) && !String(p).startsWith('untitled:') && !String(p).startsWith('/memories/')) return 'editing files outside the workspace requires approval';
    }
  }
  if (/^mcp_/i.test(name) && MUTATING_MCP.test(name)) return 'mutating MCP tool requires approval';
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
