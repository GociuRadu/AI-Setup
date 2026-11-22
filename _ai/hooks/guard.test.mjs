// Self-check: node _ai/hooks/guard.test.mjs (also run by node --test)
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { check, checkPaths, checkToolHardStop, checkAsk, canAutoAllow } from './guard.mjs';
import { build } from '../sync.mjs';

const dir = mkdtempSync(join(tmpdir(), 'guard-'));
writeFileSync(join(dir, 'read.sql'), 'SELECT TOP 10 item_id, name FROM dbo.item WHERE updated_at > @d;');
writeFileSync(join(dir, 'write.sql'), 'UPDATE dbo.item SET name = N\'x\';');

const allowed = [
  'npm test',
  'git status',
  'sqlcmd -S dev-sql -d app -Q "SELECT TOP 10 item_id, updated_at FROM dbo.item"',
  'sqlcmd -S dev-sql -Q "SELECT session_id, wait_type FROM sys.dm_exec_requests"',
  'docker exec db /opt/mssql-tools18/bin/sqlcmd -Q "SELECT COUNT_BIG(*) FROM dbo.item_deleted_log"',
  'docker exec -i db sqlcmd -Q "SELECT 1"',
  'sqlcmd -S dev-sql -i read.sql',
  'sqlcmd -S update-db01 -Q "SELECT 1" -o into.txt',
  'bcp "SELECT item_id FROM dbo.item" queryout out.csv -S dev-sql -c',
  'grep -rn "INSERT INTO" src/',
  'grep -i sqlcmd README.md',
  'git commit -m "Create psql helper"',
  'mysql -f -e "SELECT 1"',
  'Invoke-Sqlcmd -ServerInstance $srv -Query "SELECT 1"',
  'sqlcmd -S dev -Q "SELECT item_id FROM dbo.item" -o "C:/out/into.txt"',
  'git push origin feature/x',
  'git commit -m "docs: explain docker compose down -v and ssh"',
  'docker compose -p app_test up -d',
  'docker compose --env-file local.env up -d',
  'cat .env.example',
  'Get-Content config/settings.yaml',
  'python -m venv .venv',
  'ssh-keygen -t ed25519',
  'npm install personal-finance-lib',
  'docker compose exec api pytest tests/products',
  'gh pr create --title "fix ssh config docs"',
];
const blocked = [
  'sqlcmd -S dev-sql -Q "DELETE FROM dbo.item"',
  'sqlcmd -S localhost -Q "CREATE TABLE dbo.t (id INT)"',
  'docker exec db sqlcmd -Q "TRUNCATE TABLE stg.item"',
  'sqlcmd -S dev-sql -Q "SELECT item_id INTO dbo.copy FROM dbo.item"',
  'sqlcmd -S dev-sql -Q "EXEC dbo.Item_Publish"',
  'sqlcmd -S dev-sql -i write.sql',
  'sqlcmd -S dev-sql -iwrite.sql',
  'sqlcmd -S dev-sql -i missing.sql',
  'bcp dbo.item in data.csv -S dev-sql -c',
  'psql -h dev -c "drop table x"',
  'pwsh -c "Invoke-Sqlcmd -ServerInstance dev -Query \'UPDATE dbo.item SET a=1\'"',
  'python -c "import pyodbc; pyodbc.connect(cs).execute(\'DELETE FROM t\')"',
  'Get-Content w.sql | sqlcmd -S dev',
  'cat w.sql | psql',
  'sqlcmd -Q "$(cat w.sql)"',
  'mysql -e "source w.sql"',
  'sqlite3 app.db ".read w.sql"',
  'psql -c "\\i w.sql"',
  'mysql app < dump.dump',
  'pg_restore -d app dump.backup',
  'sqlpackage /Action:Publish /SourceFile:app.dacpac',
  'dotnet ef database update',
  'alembic upgrade head',
  'node -e "require(\'mssql\').query(\'DROP TABLE t\')"',
  'cd sub && sqlcmd -S dev -Q "DELETE FROM t"',
  'sqlcmd -S dev -Q "SELECT 1; DELETE FROM dbo.t"',
  'psql -c "select 1; drop table x"',
  'python -c "import pyodbc; c=pyodbc.connect(cs); c.execute(\'DELETE FROM t\')"',
  'sqlcmd -Q "SELECT 1\nGO\nDELETE FROM t"',
  '$q = "DELETE FROM dbo.t"; Invoke-Sqlcmd -Query $q',
  'sqlcmd -S dev -Q %Q%',
  'psql -c "$SQL"',
  'Invoke-Sqlcmd -InputFile $f',
  // hard stops
  'git push --force origin main',
  'git push -f',
  'git push origin +main',
  'git push --force-with-lease',
  'docker compose down -v',
  'docker-compose -p app down --volumes',
  'docker volume rm app_data',
  'docker system prune -af',
  'docker compose -f docker-compose.prod.yml up -d',
  'bash scripts/release.sh',
  'ssh root@203.0.113.10',
  'npm test && scp dump.sql user@host:/tmp',
  'echo y | ssh host',
  'wsl ssh root@host',
  'powershell -c "ssh host"',
  'git -C code push --force origin main',
  'git --no-pager push -f',
  'wsl -d Ubuntu ssh host',
  'bash -lc "ssh host"',
  'cmd /c ssh host',
  '& ssh host',
  'ssh.exe host',
  'cat .env.example .env',
  // secrets and personal/
  'cat .env',
  'Get-Content -Path "C:\\app\\local.env"',
  'type code\\.test.env',
  'grep PASSWORD .env.local',
  'Get-Content x.txt | Select-String key; cat prod.env',
  'Get-ChildItem personal',
  'cat personal/notes.md',
];
for (const c of allowed) assert.equal(check(c, dir, dir), null, `should allow: ${c}`);
assert.notEqual(check('cat ../../personal/x.md', join(dir, 'Shop', 'code'), dir), null, 'should block ../../personal from a code folder');
assert.notEqual(check('type ' + join(dir, 'personal', 'x.md'), dir, dir), null, 'should block an absolute personal path');
for (const c of blocked) assert.notEqual(check(c, dir, dir), null, `should block: ${c}`);

const pathsAllowed = [{ pattern: '**/*.py' }, { pattern: '**/*' }, { file_path: 'src/app.py' }, { path: '.env.example' }, { filePath: 'docs/ai/project.md' }, { includePattern: '**/.env.example' }, { glob: '**/*.py' }, { path: 'personal-site/index.html' }];
const pathsBlocked = [{ file_path: 'C:/proj/.env' }, { path: 'code/local.env' }, { filePath: 'x/.test.env' }, { paths: ['a.md', '.env.prod'] }, { path: 'personal/diary.md' }, { path: join(dir, 'personal') }, { operations: [{ mode: 'Line', path: 'Shop/code/.env' }] }, { pattern: 'personal/**' }, { includePattern: '**/*.env' }, { includePattern: '**/.env*' }, { includePattern: '**/*.env.*' }, { includePattern: '**/.e?v' }, { includePattern: '**/.e*' }, { includePattern: '**/.*' }, { glob: '**/*.env' }, { pattern: '{.env,a.txt}' }];
for (const a of pathsAllowed) assert.equal(checkPaths(a, dir, dir), null, `should allow path: ${JSON.stringify(a)}`);
assert.notEqual(checkPaths({ path: '../personal/x.md' }, join(dir, 'Shop'), dir), null, 'should block ../personal from a project folder');
for (const a of pathsBlocked) assert.notEqual(checkPaths(a, dir, dir), null, `should block path: ${JSON.stringify(a)}`);
assert.equal(checkPaths({ pattern: 'Load .env file' }, dir, dir, 'Grep'), null, 'a grep regex is not a path');
assert.equal(checkPaths({ query: '.env', includePattern: 'src/**' }, dir, dir, 'grep_search'), null, 'grep_search query is content');
assert.notEqual(checkPaths({ query: '**/*.env' }, dir, dir, 'file_search'), null, 'file_search query is a glob');
assert.notEqual(checkPaths({ query: '**/*.env' }, dir, dir, 'copilot_findFiles'), null, 'copilot_findFiles query is a glob');

// wiring: the payload shape each tool sends on stdin, through the real script
const script = fileURLToPath(new URL('./guard.mjs', import.meta.url));
const payloads = [
  ['Claude Code', { tool_name: 'Bash', tool_input: { command: 'git push --force' }, cwd: dir }, 2],
  ['Claude Code', { tool_name: 'Read', tool_input: { file_path: join(dir, '.env') }, cwd: dir }, 2],
  ['Kiro', { hook_event_name: 'PreToolUse', tool_name: 'execute_pwsh', tool_input: { command: 'Get-Content .env' }, cwd: dir }, 2],
  // shape captured from Kiro CLI 2.21 (inline agent hook)
  ['Kiro CLI', { hook_event_name: 'preToolUse', cwd: dir, session_id: 's', tool_name: 'shell', tool_tags: ['shell', '@builtin'], tool_input: { command: 'docker volume rm data', __tool_use_purpose: 'x' } }, 2],
  ['Kiro', { hook_event_name: 'PreToolUse', tool_name: 'read_file', tool_input: { path: 'src/app.py' }, cwd: dir }, 0],
  ['Copilot', { hook_event_name: 'PreToolUse', tool_name: 'readFile', tool_input: { filePath: join(dir, '.env') }, cwd: dir, session_id: 's', tool_use_id: 't' }, 2],
  ['Copilot', { toolName: 'runInTerminal', toolArgs: JSON.stringify({ command: 'git push -f' }), cwd: dir }, 2],
];
for (const [tool, payload, code] of payloads) {
  const r = spawnSync(process.execPath, [script], { input: JSON.stringify(payload) });
  assert.equal(r.status, code, `${tool} payload ${JSON.stringify(payload.tool_input ?? payload.toolArgs)} exit ${r.status}`);
  if (code === 2) assert.match(r.stdout.toString(), /"permissionDecision":"deny"/);
}

// fail-closed: the exact wired Claude exec-form hook blocks, allows, and sets onFailure: "block"
const wired = JSON.parse(build('work', ['claude'])['.claude/settings.json']).hooks.PreToolUse[0].hooks[0];
assert.equal(wired.onFailure, 'block', 'wired Claude hook must fail closed via onFailure: block');
const root = fileURLToPath(new URL('../..', import.meta.url));
const runWired = (payload, projectDir) => spawnSync(
  wired.command,
  wired.args.map((a) => a.replace('${CLAUDE_PROJECT_DIR}', projectDir ?? root)),
  { cwd: root, input: JSON.stringify(payload) },
).status;
assert.equal(runWired({ tool_name: 'Bash', tool_input: { command: 'git push --force' }, cwd: dir }), 2, 'wired command should block');
assert.equal(runWired({ tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: dir }), 0, 'wired command should allow');
assert.notEqual(runWired({ tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: dir }, dir), 0, 'a missing run-guard.mjs should fail non-zero (blocked by onFailure: block)');

// run-guard.mjs: blocks, allows, and blocks when the guard cannot load
const runGuard = (payload, { flag = '', env = process.env } = {}) => {
  const input = JSON.stringify(payload);
  const args = ['_ai/hooks/run-guard.mjs', ...(flag ? [flag] : [])];
  return process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-NoLogo', '-Command', `node ${args.join(' ')}; exit $LASTEXITCODE`], { cwd: root, input, env })
    : spawnSync(process.execPath, args, { cwd: root, input, env });
};
const blockedRun = runGuard({ tool_name: 'Bash', tool_input: { command: 'git push --force' }, cwd: dir });
assert.equal(blockedRun.status, 2, 'run-guard should block');
assert.match(blockedRun.stdout.toString(), /"permissionDecision":"deny"/);
assert.equal(runGuard({ tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: dir }).status, 0, 'run-guard should allow');
assert.equal(runGuard({ tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: dir }, { env: { ...process.env, AI_GUARD_PATH: join(dir, 'no-such-guard.mjs') } }).status, 0, 'AI_GUARD_PATH ignored without NODE_ENV=test');
const missing = runGuard({ tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: dir }, { env: { ...process.env, NODE_ENV: 'test', AI_GUARD_PATH: join(dir, 'no-such-guard.mjs') } });
assert.equal(missing.status, 2, 'a missing guard should block');
assert.match(missing.stderr.toString(), /could not load/);

console.log(`guard ok: ${payloads.length} tool payloads, ${allowed.length + pathsAllowed.length} allowed, ${blocked.length + pathsBlocked.length} blocked`);

// tool hard stops
for (const t of ['mcp_hostinger_execute', 'mcp_hostinger-mcp_multi-execute', 'mcp_hostinger_execute_site_tool', 'mcp_atlassian-mcp_executeDestructive']) {
  assert.notEqual(checkToolHardStop(t), null, `hard stop: ${t}`);
}
for (const t of ['', 'mcp_atlassian-mcp_search', 'mcp_hostinger_list_sites', 'read_file']) assert.equal(checkToolHardStop(t), null, `not a hard stop: ${t}`);

// ask layer
const ask = (command, args = {}, toolName = '') => checkAsk(command, args, dir, dir, toolName);
const asks = [
  'rm -rf build', 'Remove-Item foo', 'cmd /c del a.txt', 'node -e "fs.rmSync(\'x\')"', 'node _ai/clean.mjs --apply',
  'git add .', 'git commit -m "x"', 'git -C MCDT/code push', '& git checkout -b x', 'git branch -D x',
  'az group list', 'gh pr create', 'curl https://x', 'Invoke-RestMethod https://x', 'npm publish', 'docker push img',
  'python MCDT/code/local/run_notebook.py',
  'echo a & rm -rf x', 'Get-ChildItem | ForEach-Object { Remove-Item $_ }', "find . -name '*.tmp' -delete", 'bash -c "rm foo"',
];
assert.equal(ask('echo a & rm -rf x'), 'deleting files requires approval');
assert.equal(check('cd x & ssh user@host', dir, dir), 'SSH to a server is a hard stop');
for (const c of ['& git push -f', 'powershell -Command "git push --force"', 'bash -c "git push --force"']) assert.equal(check(c, dir, dir), 'force-push is a hard stop', `should deny: ${c}`);
for (const c of ['docker run --rm alpine echo ok', 'echo "git push -f"', 'grep "git push -f" x']) {
  assert.equal(check(c, dir, dir), null, `not denied: ${c}`);
  assert.equal(ask(c), null, `not asked: ${c}`);
}
for (const c of asks) assert.notEqual(ask(c), null, `should ask: ${c}`);
const noAsks = [
  'node --test "_ai/**/*.test.mjs"', 'pytest', 'pnpm test', 'git status --short', 'git -C MCDT/code diff', 'git log -n 5',
  'grep -rn "rm -rf" src/', 'echo "git push"', 'node _ai/clean.mjs',
];
for (const c of noAsks) assert.equal(ask(c), null, `should not ask: ${c}`);
assert.notEqual(ask(undefined, { filePath: 'c:/Outside/x.txt' }, 'replace_string_in_file'), null, 'outside edit asks');
assert.equal(ask(undefined, { filePath: join(dir, 'a.txt') }, 'replace_string_in_file'), null, 'inside edit');
assert.equal(ask(undefined, { filePath: '/memories/tooling.md' }, 'memory_create_file'), null);
assert.equal(ask(undefined, { filePath: '/memories/tooling.md' }, 'create_file'), null, '/memories/ is fine');
for (const t of ['mcp_atlassian-mcp_createConfluencePage', 'mcp_mlflow_mcp_delete_run', 'mcp_some_server_execute_action', 'mcp_some_server_upload_file', 'mcp_mlflow_mcp_set_trace_tag']) assert.notEqual(ask(undefined, {}, t), null, `should ask: ${t}`);
for (const t of ['mcp_atlassian-mcp_getConfluencePage', 'mcp_atlassian-mcp_search', 'mcp_atlassian-mcp_lookupJiraAccountId', 'mcp_atlassian-mcp_atlassianUserInfo', 'mcp_nx_mcp_nx_docs', 'mcp_mlflow_mcp_describe_run', 'mcp_some_server_get_settings']) assert.equal(ask(undefined, {}, t), null, `should not ask: ${t}`);
assert.notEqual(ask(undefined, { operation: 'apply_changes' }, 'mssql_dab'), null);
assert.equal(ask(undefined, { operation: 'get_state' }, 'mssql_dab'), null);
for (const t of ['read_file', 'runSubagent', 'run_in_terminal', 'mcp_atlassian-mcp_search', 'mssql_list_servers']) assert.equal(canAutoAllow(t), true, `auto-allow: ${t}`);
for (const t of ['unknown_future_tool', 'vscode_askQuestions', 'send_to_terminal', 'kill_terminal', 'mssql_run_query', 'mssql_dab', 'mssql_query_store_plan_forcing', '']) assert.equal(canAutoAllow(t), false, `no auto-allow: ${t}`);

// run-guard.mjs --allow
const inWs = join(root, 'docs', 'x.md');
const cases = [
  [{ tool_name: 'read_file', tool_input: { filePath: join(dir, '.env') } }, 2, /"permissionDecision":"deny"/],
  [{ tool_name: 'run_in_terminal', tool_input: { command: 'git push --force' } }, 2, /"permissionDecision":"deny"/],
  [{ tool_name: 'mcp_hostinger_execute', tool_input: {} }, 2, /"permissionDecision":"deny"/],
  [{ tool_name: 'mcp_atlassian-mcp_executeDestructive', tool_input: {} }, 2, /"permissionDecision":"deny"/],
  [{ tool_name: 'run_in_terminal', tool_input: { command: 'git commit -m "x"' } }, 0, /"permissionDecision":"ask"/],
  [{ tool_name: 'run_in_terminal', tool_input: { command: 'Remove-Item x' } }, 0, /"permissionDecision":"ask"/],
  [{ tool_name: 'read_file', tool_input: { filePath: 'c:/Users/GOCIURDU/AppData/Roaming/Code/logs/x.log' } }, 0, /"permissionDecision":"allow"/],
  [{ tool_name: 'runSubagent', tool_input: { prompt: 'x' } }, 0, /"permissionDecision":"allow"/],
  [{ tool_name: 'run_in_terminal', tool_input: { command: 'node --test' } }, 0, /"permissionDecision":"allow"/],
  [{ tool_name: 'replace_string_in_file', tool_input: { filePath: inWs } }, 0, /"permissionDecision":"allow"/],
  [{ tool_name: 'unknown_future_tool', tool_input: {} }, 0, /^$/],
];
for (const [payload, code, out] of cases) {
  const r = runGuard({ ...payload, cwd: root }, { flag: '--allow' });
  assert.equal(r.status, code, `--allow ${JSON.stringify(payload)} exit ${r.status}`);
  assert.match(r.stdout.toString(), out, `--allow ${JSON.stringify(payload)} stdout`);
}
const noFlag = runGuard({ tool_name: 'read_file', tool_input: { filePath: inWs }, cwd: root });
assert.equal(noFlag.status, 0);
assert.equal(noFlag.stdout.toString(), '', 'no --allow: no output on safe calls');

// setup-ui/ is not AI context: any read, search or command there asks first; a mention in search text does not
const onRequest = 'setup-ui/ is not AI context: reading or running it requires approval';
for (const [command, args, tool] of [
  [undefined, { file_path: join(dir, 'setup-ui/src/App.tsx') }, 'Read'],
  [undefined, { pattern: 'setup-ui/**/*.tsx' }, 'Glob'],
  [undefined, { pattern: 'x', path: 'setup-ui' }, 'Grep'],
  ['cd setup-ui; npm test', {}, 'Bash'],
  ['cat setup-ui/server.mjs', {}, 'Bash'],
]) assert.equal(ask(command, args, tool), onRequest, `should ask: ${command ?? JSON.stringify(args)}`);
assert.equal(checkAsk('npm test', {}, join(dir, 'setup-ui'), dir, 'Bash'), onRequest, 'a command run inside setup-ui/ asks');
for (const [command, args, tool] of [
  [undefined, { pattern: 'setup-ui', path: '.' }, 'Grep'],
  [undefined, { file_path: join(dir, 'README.md') }, 'Read'],
  ['node --test "_ai/**/*.test.mjs"', {}, 'Bash'],
]) assert.equal(ask(command, args, tool), null, `not asked: ${command ?? JSON.stringify(args)}`);
