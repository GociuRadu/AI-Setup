// Self-check: node _ai/hooks/guard.test.mjs (also run by node _ai/check.mjs)
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { check, checkPaths } from './guard.mjs';

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

const pathsAllowed = [{ pattern: '**/*.py' }, { file_path: 'src/app.py' }, { path: '.env.example' }, { filePath: 'docs/ai/project.md' }, { includePattern: '**/*.env' }, { path: 'personal-site/index.html' }];
const pathsBlocked = [{ file_path: 'C:/proj/.env' }, { path: 'code/local.env' }, { filePath: 'x/.test.env' }, { paths: ['a.md', '.env.prod'] }, { path: 'personal/diary.md' }, { path: join(dir, 'personal') }, { operations: [{ mode: 'Line', path: 'Shop/code/.env' }] }, { pattern: 'personal/**' }];
for (const a of pathsAllowed) assert.equal(checkPaths(a, dir, dir), null, `should allow path: ${JSON.stringify(a)}`);
assert.notEqual(checkPaths({ path: '../personal/x.md' }, join(dir, 'Shop'), dir), null, 'should block ../personal from a project folder');
for (const a of pathsBlocked) assert.notEqual(checkPaths(a, dir, dir), null, `should block path: ${JSON.stringify(a)}`);

// wiring: the payload shape each tool sends on stdin, through the real script
const script = fileURLToPath(new URL('./guard.mjs', import.meta.url));
const payloads = [
  ['Claude Code', { tool_name: 'Bash', tool_input: { command: 'git push --force' }, cwd: dir }, 2],
  ['Claude Code', { tool_name: 'Read', tool_input: { file_path: join(dir, '.env') }, cwd: dir }, 2],
  ['Kiro', { hook_event_name: 'PreToolUse', tool_name: 'execute_pwsh', tool_input: { command: 'Get-Content .env' }, cwd: dir }, 2],
  // shape captured from Kiro CLI 2.21 (inline agent hook)
  ['Kiro CLI', { hook_event_name: 'preToolUse', cwd: dir, session_id: 's', tool_name: 'shell', tool_tags: ['shell', '@builtin'], tool_input: { command: 'docker volume rm data', __tool_use_purpose: 'x' } }, 2],
  ['Kiro', { hook_event_name: 'PreToolUse', tool_name: 'read_file', tool_input: { path: 'src/app.py' }, cwd: dir }, 0],
  ['Copilot', { toolName: 'bash', toolArgs: JSON.stringify({ command: 'docker compose down -v' }), cwd: dir }, 2],
  ['Copilot', { toolName: 'bash', toolArgs: JSON.stringify({ command: 'npm test' }), cwd: dir }, 0],
  ['Copilot', { sessionId: 's', toolName: 'powershell', toolArgs: { command: 'git push --force' }, cwd: dir }, 2],
  ['Copilot', { sessionId: 's', toolName: 'view', toolArgs: { path: join(dir, 'code', '.env') }, cwd: dir }, 2],
  ['Copilot', { sessionId: 's', toolName: 'create', toolArgs: { path: 'personal/x.md', file_text: 'x' }, cwd: fileURLToPath(new URL('../..', import.meta.url)) }, 2],
  ['Copilot', { sessionId: 's', toolName: 'view', toolArgs: { path: join(dir, 'README.md') }, cwd: dir }, 0],
  // Copilot runs the PascalCase PreToolUse hook in .claude/settings.json with VS Code compatible fields and Claude tool names
  ['Copilot (.claude hook)', { hook_event_name: 'PreToolUse', session_id: 's', tool_name: 'Bash', tool_input: { command: 'ssh host' }, cwd: dir }, 2],
  ['Copilot (.claude hook)', { hook_event_name: 'PreToolUse', session_id: 's', tool_name: 'Read', tool_input: { path: '.env.local' }, cwd: dir }, 2],
];
for (const [tool, payload, code] of payloads) {
  const r = spawnSync(process.execPath, [script], { input: JSON.stringify(payload) });
  assert.equal(r.status, code, `${tool} payload ${JSON.stringify(payload.tool_input ?? payload.toolArgs)} exit ${r.status}`);
  if (code === 2) assert.match(r.stdout.toString(), /"permissionDecision":"deny"/);
}

// fail-closed: the exact wired command blocks, allows, and blocks when guard.mjs cannot be loaded
const wired = JSON.parse(readFileSync(new URL('../../.kiro/hooks/guard.json', import.meta.url), 'utf8')).hooks[0].action.command;
const root = fileURLToPath(new URL('../..', import.meta.url));
const runWired = (payload, projectDir) => spawnSync(wired, { shell: true, cwd: root, input: JSON.stringify(payload), env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir ?? '' } }).status;
assert.equal(runWired({ tool_name: 'Bash', tool_input: { command: 'git push --force' }, cwd: dir }), 2, 'wired command should block');
assert.equal(runWired({ tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: dir }), 0, 'wired command should allow');
assert.equal(runWired({ tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: dir }, dir), 2, 'a missing guard.mjs should block');

console.log(`guard ok: ${payloads.length} tool payloads, ${allowed.length + pathsAllowed.length} allowed, ${blocked.length + pathsBlocked.length} blocked`);
