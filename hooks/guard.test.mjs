import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir, homedir } from 'node:os';
import { check, checkPaths, checkToolHardStop, checkAsk, decide, patchFiles } from './guard.mjs';

const dir = mkdtempSync(join(tmpdir(), 'guard-'));
writeFileSync(join(dir, 'read.sql'), 'SELECT TOP 10 item_id, name FROM dbo.item WHERE updated_at > @d;');
writeFileSync(join(dir, 'write.sql'), 'UPDATE dbo.item SET name = N\'x\';');

test('shell commands: writing SQL, hard stops, secrets and personal/ are denied; the rest is not', () => {
  const allowed = [
    'npm test', 'git status',
    'sqlcmd -S dev-sql -d app -Q "SELECT TOP 10 item_id, updated_at FROM dbo.item"',
    'sqlcmd -S dev-sql -Q "SELECT session_id, wait_type FROM sys.dm_exec_requests"',
    'docker exec db /opt/mssql-tools18/bin/sqlcmd -Q "SELECT COUNT_BIG(*) FROM dbo.item_deleted_log"',
    'docker exec -i db sqlcmd -Q "SELECT 1"', 'sqlcmd -S dev-sql -i read.sql', 'sqlcmd -S update-db01 -Q "SELECT 1" -o into.txt',
    'bcp "SELECT item_id FROM dbo.item" queryout out.csv -S dev-sql -c', 'grep -rn "INSERT INTO" src/', 'grep -i sqlcmd README.md',
    'git commit -m "Create psql helper"', 'mysql -f -e "SELECT 1"', 'Invoke-Sqlcmd -ServerInstance $srv -Query "SELECT 1"',
    'sqlcmd -S dev -Q "SELECT item_id FROM dbo.item" -o "C:/out/into.txt"', 'git push origin feature/x',
    'git commit -m "docs: explain docker compose down -v and ssh"', 'docker compose -p app_test up -d', 'docker compose --env-file local.env up -d',
    'cat .env.example', 'Get-Content config/settings.yaml', 'python -m venv .venv', 'ssh-keygen -t ed25519', 'npm install personal-finance-lib',
    'docker compose exec api pytest tests/products', 'gh pr create --title "fix ssh config docs"',
  ];
  const blocked = [
    'sqlcmd -S dev-sql -Q "DELETE FROM dbo.item"', 'sqlcmd -S localhost -Q "CREATE TABLE dbo.t (id INT)"', 'docker exec db sqlcmd -Q "TRUNCATE TABLE stg.item"',
    'sqlcmd -S dev-sql -Q "SELECT item_id INTO dbo.copy FROM dbo.item"', 'sqlcmd -S dev-sql -Q "EXEC dbo.Item_Publish"', 'sqlcmd -S dev-sql -i write.sql',
    'sqlcmd -S dev-sql -iwrite.sql', 'sqlcmd -S dev-sql -i missing.sql', 'bcp dbo.item in data.csv -S dev-sql -c', 'psql -h dev -c "drop table x"',
    'pwsh -c "Invoke-Sqlcmd -ServerInstance dev -Query \'UPDATE dbo.item SET a=1\'"', 'python -c "import pyodbc; pyodbc.connect(cs).execute(\'DELETE FROM t\')"',
    'Get-Content w.sql | sqlcmd -S dev', 'cat w.sql | psql', 'sqlcmd -Q "$(cat w.sql)"', 'mysql -e "source w.sql"', 'sqlite3 app.db ".read w.sql"', 'psql -c "\\i w.sql"',
    'mysql app < dump.dump', 'pg_restore -d app dump.backup', 'sqlpackage /Action:Publish /SourceFile:app.dacpac', 'dotnet ef database update', 'alembic upgrade head',
    'node -e "require(\'mssql\').query(\'DROP TABLE t\')"', 'cd sub && sqlcmd -S dev -Q "DELETE FROM t"', 'sqlcmd -S dev -Q "SELECT 1; DELETE FROM dbo.t"',
    'psql -c "select 1; drop table x"', 'sqlcmd -Q "SELECT 1\nGO\nDELETE FROM t"', '$q = "DELETE FROM dbo.t"; Invoke-Sqlcmd -Query $q', 'sqlcmd -S dev -Q %Q%',
    'psql -c "$SQL"', 'Invoke-Sqlcmd -InputFile $f',
    // hard stops
    'git push --force origin main', 'git push -f', 'git push origin +main', 'git push --force-with-lease', 'docker compose down -v', 'docker-compose -p app down --volumes',
    'docker volume rm app_data', 'docker system prune -af', 'docker compose -f docker-compose.prod.yml up -d', 'bash scripts/release.sh', 'ssh root@203.0.113.10',
    'npm test && scp dump.sql user@host:/tmp', 'echo y | ssh host', 'wsl ssh root@host', 'powershell -c "ssh host"', 'git -C code push --force origin main',
    'git --no-pager push -f', 'wsl -d Ubuntu ssh host', 'bash -lc "ssh host"', 'cmd /c ssh host', '& ssh host', 'ssh.exe host',
    'env git push --force origin x', 'GIT_TRACE=1 git push -f', 'git push -uf origin main', 'git -P push --force', 'env ssh host', 'FOO=1 ssh host',
    'python -c "import os; os.system(\'git push --force\')"', "node -e \"require('child_process').execSync('ssh host')\"", "perl -e 'system(\"docker volume rm data\")'",
    // secrets and personal/
    'cat .env.example .env', 'cat .env', 'Get-Content -Path "C:\\app\\local.env"', 'type code\\.test.env', 'grep PASSWORD .env.local',
    'Get-Content x.txt | Select-String key; cat prod.env', 'Get-ChildItem personal', 'cat personal/notes.md',
  ];
  for (const c of allowed) assert.equal(check(c, dir, dir), null, `should allow: ${c}`);
  for (const c of blocked) assert.notEqual(check(c, dir, dir), null, `should block: ${c}`);
  assert.notEqual(check('cat ../../personal/x.md', join(dir, 'Shop', 'code'), dir), null, 'should block ../../personal from a code folder');
  assert.notEqual(check('type ' + join(dir, 'personal', 'x.md'), dir, dir), null, 'should block an absolute personal path');
  assert.equal(check('cd x & ssh user@host', dir, dir), 'SSH to a server is a hard stop');
  for (const c of ['& git push -f', 'powershell -Command "git push --force"', 'bash -c "git push --force"']) assert.equal(check(c, dir, dir), 'force-push is a hard stop', c);
});

test('file tools: secret files and personal/ are denied, by path or by glob', () => {
  const ok = [{ pattern: '**/*.py' }, { pattern: '**/*' }, { file_path: 'src/app.py' }, { path: '.env.example' }, { filePath: 'docs/ai/project.md' }, { includePattern: '**/.env.example' }, { glob: '**/*.py' }, { path: 'personal-site/index.html' }];
  const bad = [{ file_path: 'C:/proj/.env' }, { path: 'code/local.env' }, { filePath: 'x/.test.env' }, { paths: ['a.md', '.env.prod'] }, { path: 'personal/diary.md' }, { path: join(dir, 'personal') }, { operations: [{ mode: 'Line', path: 'Shop/code/.env' }] }, { pattern: 'personal/**' }, { includePattern: '**/*.env' }, { includePattern: '**/.env*' }, { includePattern: '**/*.env.*' }, { includePattern: '**/.e?v' }, { includePattern: '**/.e*' }, { includePattern: '**/.*' }, { glob: '**/*.env' }, { pattern: '{.env,a.txt}' }];
  for (const a of ok) assert.equal(checkPaths(a, dir, dir), null, `should allow: ${JSON.stringify(a)}`);
  for (const a of bad) assert.notEqual(checkPaths(a, dir, dir), null, `should block: ${JSON.stringify(a)}`);
  assert.notEqual(checkPaths({ path: '../personal/x.md' }, join(dir, 'Shop'), dir), null);
  assert.equal(checkPaths({ pattern: 'Load .env file' }, dir, dir, 'Grep'), null, 'a grep regex is not a path');
  assert.equal(checkPaths({ pattern: 'Load .env file', path: 'src' }, dir, dir, 'rg'), null, 'Copilot rg pattern is content');
  assert.equal(checkPaths({ query: '.env', includePattern: 'src/**' }, dir, dir, 'grep_search'), null);
  assert.notEqual(checkPaths({ query: '**/*.env' }, dir, dir, 'file_search'), null, 'file_search query is a glob');
  assert.notEqual(checkPaths({ pattern: '**/*.env' }, dir, dir, 'glob'), null, 'Copilot glob pattern is a glob');
});

test('Copilot apply_patch: the files it names are checked like any other path', () => {
  const patch = (body) => ({ input: `*** Begin Patch\n${body}\n*** End Patch` });
  assert.deepEqual(patchFiles('*** Begin Patch\n*** Update File: a.py\n*** Move to: b.py\n*** Delete File: c.py\n*** End Patch'), [{ op: 'update', path: 'a.py' }, { op: 'add', path: 'b.py' }, { op: 'delete', path: 'c.py' }]);
  assert.notEqual(checkPaths(patch('*** Update File: code/.env\n@@\n-a\n+b'), dir, dir, 'apply_patch'), null);
  assert.notEqual(checkPaths(patch('*** Add File: personal/x.md\n+x'), dir, dir, 'apply_patch'), null);
  assert.equal(checkPaths(patch('*** Update File: src/a.py\n@@\n-a\n+b'), dir, dir, 'apply_patch'), null);
  assert.match(checkAsk(undefined, patch(`*** Delete File: ${join(homedir(), 'zz-outside.txt')}`), dir, dir, 'apply_patch'), /outside the workspace/);
  assert.equal(checkAsk(undefined, patch('*** Delete File: src/old.py'), dir, dir, 'apply_patch'), null);
});

test('MCP tools: Hostinger execute and executeDestructive are hard stops; shared writes and deletes ask', () => {
  for (const t of ['mcp_hostinger_execute', 'mcp_hostinger-mcp_multi-execute', 'mcp_hostinger_execute_site_tool', 'mcp_atlassian-mcp_executeDestructive', 'mcp__claude_ai_Atlassian_MCP__executeDestructive']) assert.notEqual(checkToolHardStop(t), null, t);
  for (const t of ['', 'mcp_atlassian-mcp_search', 'mcp_hostinger_list_sites', 'read_file']) assert.equal(checkToolHardStop(t), null, t);
  const ask = (t) => checkAsk(undefined, {}, dir, dir, t);
  for (const t of ['mcp_atlassian-mcp_createConfluencePage', 'mcp_mlflow_mcp_delete_run', 'mcp_some_server_execute_action', 'mcp_some_server_upload_file', 'mcp_mlflow_mcp_set_trace_tag', 'mcp__atlassian__editJiraIssue', 'mcp__hostinger-dns__updateRecord']) assert.notEqual(ask(t), null, t);
  for (const t of ['mcp_atlassian-mcp_getConfluencePage', 'mcp_atlassian-mcp_search', 'mcp_atlassian-mcp_lookupJiraAccountId', 'mcp_atlassian-mcp_atlassianUserInfo', 'mcp_mlflow_mcp_describe_run', 'mcp_some_server_get_settings', 'mcp_atlassian-mcp_listJiraIssueComments', 'mcp_atlassian-mcp_executeRead', 'mcp_github_pull_request_read']) assert.equal(ask(t), null, t);
  assert.notEqual(checkAsk(undefined, { operation: 'apply_changes' }, dir, dir, 'mssql_dab'), null);
});

test('one ask list on every device: pushes, discarding Git, wide deletes, cloud CLIs, writing gh/HTTP, publishing, loaders', () => {
  const ask = (command) => checkAsk(command, {}, dir, dir, 'Bash');
  const asks = [
    'rm -rf build', 'rm -rf Shop/code', 'Remove-Item -Recurse -Force .\\Shop', 'rm -rf .git/refs', 'rm *', 'rm -r src/*', 'Remove-Item $dir -Recurse', 'Remove-Item',
    'rm C:/Users/x/notes.txt', 'rm "C:/Users/x/my notes.txt"', 'Remove-Item -Recurse "Shop"', 'cmd /c del ..\\..\\a.txt', 'node -e "fs.rmSync(\'x\')"',
    'git push', 'git push origin feature/x', 'git -C Shop/code push', 'git push origin main', 'git branch -D x', 'git reset --hard HEAD~1', 'git clean -fd', 'git rebase main',
    'git restore src/a.py', 'git checkout -- a.py', 'git checkout .', 'git stash drop', 'git config --global user.name x', 'git tag -d v1',
    'az group list', 'kubectl get pods', 'helm list', 'terraform plan', 'gh pr create', 'gh api -X POST repos/o/r/issues', 'gh api repos/o/r/labels -f name=x',
    'curl -X POST https://x', 'curl -d @f https://x', 'Invoke-RestMethod -Method Post https://x', 'iwr https://x -Headers @{Authorization="t"}',
    'npm publish', 'twine upload dist/*', 'docker push img', 'python Shop/code/local/run_notebook.py',
    'echo a & rm -rf x', 'Get-ChildItem | ForEach-Object { Remove-Item $_ }', "find . -name '*.tmp' -delete", 'git log $(git push)',
    'git -P push', 'git --paginate push', 'git --no-optional-locks push', 'env git push', 'GIT_TRACE=1 git push origin main', 'env -u X git reset --hard',
    'git -c alias.p=push p -f', 'python -c "import subprocess; subprocess.run(\'git push\', shell=True)"', "node -e \"require('child_process').execSync('npm publish')\"",
  ];
  for (const c of asks) assert.notEqual(ask(c), null, `should ask: ${c}`);
  assert.equal(ask('echo a & rm -rf x'), 'deleting a whole project, repo or the workspace requires approval');
  const noAsks = [
    'node --test', 'pytest', 'pnpm test', 'git status --short', 'git -C Shop/code diff', 'git log -n 5', 'grep -rn "rm -rf" src/', 'echo "git push"',
    'git add .', 'git commit -m "x"', '& git checkout -b x', 'git switch main', 'git stash', 'git stash pop', 'git fetch', 'git pull --ff-only', 'git merge feature/x',
    'git branch -d x', 'git restore --staged a.py', 'git config user.name', 'git config --get user.email', 'git worktree add .worktrees/x -b x', 'git commit --amend --no-edit',
    'Remove-Item foo', 'rm src/old.py', 'Remove-Item .tmp\\scratch -Recurse -Force', 'rm -rf Shop/code/dist', 'rm .tmp/*', 'bash -c "rm foo"',
    `Remove-Item -Recurse -Force "${join(tmpdir(), 'guard-scratch')}"`, 'cmd /c del a.txt',
    'gh pr view 12', 'gh pr list', 'gh run view 99 --log', 'gh pr checks', 'gh api repos/o/r/pulls', 'gh auth status',
    'curl https://x', 'curl -fsSL https://x -o a.json', 'Invoke-RestMethod https://x', 'iwr -Method Get https://x',
    'docker run --rm alpine echo ok', 'echo "git push -f"', 'grep "git push -f" x',
    'git -P log -n 5', 'GIT_TRACE=1 git status', 'env NODE_ENV=test node --test', 'git push-helper',
    'python -c "print(\'hello\')"', "node -e \"console.log(require('os').platform())\"", 'git -c core.pager=cat log -n 3',
  ];
  for (const c of noAsks) assert.equal(ask(c), null, `should not ask: ${c}`);
  // edits are not asked about, outside the workspace included: Claude's auto mode and the tools' own prompts judge those
  assert.equal(checkAsk(undefined, { filePath: 'c:/Outside/x.txt' }, dir, dir, 'Write'), null);
});

test('the Obsidian vault: .mdenc is denied, Personal and whole-vault reads ask, deletes ask, the rest is open', () => {
  const root = mkdtempSync(join(tmpdir(), 'ws-'));
  const vault = mkdtempSync(join(tmpdir(), 'vault-'));
  writeFileSync(join(root, '.ai-device.json'), JSON.stringify({ vault }));
  const fwd = vault.replace(/\\/g, '/');
  const bash = fwd.replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`);
  const mdenc = /encrypted \.mdenc notes/, personal = /Personal folder$/, whole = /whole Obsidian vault/;
  const askOf = (command, args = {}, tool = 'Bash') => checkAsk(command, args, root, root, tool);
  // encrypted notes: denied by shell and file tools, reading or writing
  for (const p of [`${fwd}/Inbox/keys.mdenc`, `${vault}\\Inbox\\keys.mdenc`, `${fwd}/Personal/a.mdenc`]) {
    assert.match(checkPaths({ file_path: p }, root, root, 'Read') ?? '', mdenc, p);
    assert.match(checkPaths({ file_path: p, content: 'x' }, root, root, 'Write') ?? '', mdenc, p);
    assert.match(check(`cat "${p}"`, root, root) ?? '', mdenc, p);
  }
  assert.match(check(`cp ${fwd}/Inbox/keys.mdenc .`, root, root) ?? '', mdenc);
  // Personal: not denied, asked
  for (const p of [`${fwd}/Personal/a.md`, `${fwd}/personal/a.md`, `${vault}\\Personal\\a.md`, `${fwd}/Learn/../Personal/a.md`, `${fwd}/Personal./a.md`, `${fwd}/Personal /a.md`, `${fwd}/Personal`]) {
    assert.equal(checkPaths({ file_path: p }, root, root, 'Read'), null, p);
    assert.match(askOf(undefined, { file_path: p }, 'Read') ?? '', personal, p);
    assert.match(askOf(undefined, { path: p }, 'view') ?? '', personal, p);
    assert.equal(check(`cat "${p}"`, root, root), null, p);
    assert.match(askOf(`cat "${p}"`) ?? '', personal, p);
  }
  for (const c of [`ls ${bash}/Personal`, `cd ${fwd} && cat Personal/a.md`, `cd "${vault}"; gc Personal\\a.md`, `(cd ${bash} && ls Personal)`, `Set-Location -Path ${fwd}; type .\\Personal\\a.md`,
    `cd ${fwd}/Learn && cat ../Personal/a.md`, `Get-Content ${vault}\\Learn\\a.md,${vault}\\Personal\\b.md`, `pwsh -Command "gc ${vault}\\Personal\\a.md"`,
    `bash -c "cat ${fwd}/Personal/a.md"`, `echo x >${fwd}/Personal/b.md`, `cat<${fwd}/Personal/a.md`, `cat ${fwd}/Learn/*/../../Personal/x.md`, `cat "\\\\?\\${vault}\\Personal\\a.md"`]) {
    assert.match(askOf(c) ?? 'not asked', personal, c);
  }
  // the whole vault (Personal included): asked
  for (const path of [vault, `${fwd}/`, join(vault, '..')]) {
    assert.match(askOf(undefined, { pattern: 'x', path }, 'Grep') ?? '', whole, path);
    assert.match(askOf(undefined, { pattern: '**/*.md', path }, 'Glob') ?? '', whole, path);
  }
  assert.match(askOf(undefined, { pattern: `${fwd}/**/*.md` }, 'Glob') ?? '', whole);
  assert.match(askOf(undefined, { pattern: '{a,../Personal}/**', path: `${fwd}/Learn` }, 'Glob') ?? '', personal);
  for (const c of [`grep -rn x ${fwd}`, `rg x ${bash}`, `Get-ChildItem -Recurse ${fwd}`, `cat ${fwd}/*/a.md`, `tar cf a.tar ${fwd}`, `cd ${fwd} && rg foo`, `cd ${fwd}; grep -r foo .`,
    `grep --recursive foo ${fwd}`, `git -C ${fwd} grep foo`, `bash -c "grep -r x ${fwd}"`, `Get-ChildItem -r ${fwd}`, `ls -R ${fwd}`, `cat ${fwd}/../*/Personal/a.md`]) {
    assert.match(askOf(c) ?? 'not asked', whole, c);
  }
  // deletes in the vault ask, by shell or patch
  for (const c of [`rm ${fwd}/Learn/Old.md`, `Remove-Item "${vault}\\Inbox\\x.md"`, `rm -rf ${bash}/Files`]) assert.match(askOf(c) ?? '', /deleting files in the Obsidian vault/, c);
  assert.match(askOf(undefined, { input: `*** Begin Patch\n*** Delete File: ${fwd}/Learn/Old.md\n*** End Patch` }, 'apply_patch') ?? '', /deleting files in the Obsidian vault/);
  // everything else is open: reads, edits, .obsidian, renames
  for (const p of [`${fwd}/Learn/Requirements.md`, `${fwd}/Learn/Personal finance.md`, `${fwd}/Files/a.svg`, `${fwd}/Personal.base`, `${fwd}/.obsidian/plugins/x/main.js`]) {
    assert.equal(checkPaths({ file_path: p }, root, root, 'Read'), null, p);
    assert.equal(askOf(undefined, { file_path: p, content: 'x' }, 'Write'), null, p);
    assert.equal(check(`cat "${p}"`, root, root), null, p);
    assert.equal(askOf(`cat "${p}"`), null, p);
  }
  for (const c of [`cd ${fwd}/Learn && grep -rn x .`, `cp a.svg "${fwd}/Files/My picture.svg"`, `mv ${fwd}/Learn/A.md ${fwd}/Learn/B.md`, `grep -rn x ${fwd}/Learn`, `D=${bash}; cp a.svg $D/Files/`,
    "sed -n '/{/p' a.md", `Select-String -Path ${fwd}/Learn/a.md -Pattern '[0-9]'`, `Get-Content -Raw ${fwd}/Learn/a.md`]) assert.equal(askOf(c), null, c);
  assert.equal(askOf(undefined, { pattern: 'personal', path: `${fwd}/Learn` }, 'Grep'), null);
  assert.equal(askOf(undefined, { pattern: '**/*.md', path: `${fwd}/Learn` }, 'Glob'), null);
  // the home folder and links lead to the same place
  const homeWs = mkdtempSync(join(tmpdir(), 'ws-'));
  writeFileSync(join(homeWs, '.ai-device.json'), JSON.stringify({ vault: join(homedir(), 'zz-no-such-vault') }));
  for (const h of ['~', '$HOME', '${HOME}', '$env:USERPROFILE', '%USERPROFILE%']) assert.match(check(`cat ${h}/zz-no-such-vault/x.mdenc`, homeWs, homeWs) ?? '', mdenc, h);
  const link = join(mkdtempSync(join(tmpdir(), 'link-')), 'v');
  symlinkSync(vault, link, 'junction');
  assert.match(askOf(undefined, { file_path: join(link, 'Personal', 'new.md'), content: 'x' }, 'Write') ?? '', personal);
  assert.equal(askOf(undefined, { file_path: join(link, 'Learn', 'new.md'), content: 'x' }, 'Write'), null);
  // no vault set: nothing is special
  const bare = mkdtempSync(join(tmpdir(), 'ws-'));
  assert.equal(checkAsk(undefined, { file_path: `${fwd}/Personal/a.md` }, bare, bare, 'Read'), null);
});

test('decide: Claude, Kiro and Copilot payloads give one decision', () => {
  assert.equal(decide({ tool_name: 'Bash', tool_input: { command: 'git push --force' }, cwd: dir }, dir).decision, 'deny');
  assert.equal(decide({ tool_name: 'Bash', tool_input: { command: 'git push' }, cwd: dir }, dir).decision, 'ask');
  assert.equal(decide({ tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: dir }, dir).decision, null);
  assert.equal(decide({ toolName: 'powershell', toolArgs: JSON.stringify({ command: 'Get-Content .env' }), cwd: dir }, dir).decision, 'deny');
  assert.equal(decide({ toolName: 'view', toolArgs: JSON.stringify({ path: join(dir, 'personal', 'a.md') }), cwd: dir }, dir).decision, 'deny');
  assert.equal(decide({ toolName: 'bash', toolArgs: 'git reset --hard', cwd: dir }, dir).decision, 'ask');
  assert.match(decide({ tool_name: 'mcp__atlassian__executeDestructive', tool_input: {}, cwd: dir }, dir).reason, /^Blocked: this MCP tool is a hard stop/);
});

test('the guard decides fast enough for Copilot (which runs the call when a hook times out)', () => {
  const calls = [
    { tool_name: 'Bash', tool_input: { command: 'git status && npm test -- --watch=false' }, cwd: dir },
    { toolName: 'view', toolArgs: JSON.stringify({ path: join(dir, 'src', 'a.py') }), cwd: dir },
    { tool_name: 'Grep', tool_input: { pattern: 'TODO', path: 'src' }, cwd: dir },
  ];
  const start = process.hrtime.bigint();
  for (let i = 0; i < 30; i++) for (const c of calls) decide(c, dir);
  const ms = Number(process.hrtime.bigint() - start) / 1e6 / 90;
  assert.ok(ms < 50, `${ms.toFixed(2)} ms per call`);
});

// the real hook scripts, as each tool runs them: payload on stdin, decision on stdout/stderr/exit code
const hook = (tool) => fileURLToPath(new URL(`./${tool}/hook.mjs`, import.meta.url));
const run = (tool, payload, env = process.env) => spawnSync(process.execPath, [hook(tool)], { input: payload === undefined ? '' : JSON.stringify(payload), env, cwd: dir });

test('Claude Code hook: deny exits 2, ask is JSON, a safe call prints nothing', () => {
  const deny = run('claude', { tool_name: 'Bash', tool_input: { command: 'git push --force' }, cwd: dir });
  assert.equal(deny.status, 2);
  assert.match(deny.stderr.toString(), /force-push is a hard stop/);
  const ask = run('claude', { tool_name: 'Bash', tool_input: { command: 'git push' }, cwd: dir });
  assert.equal(ask.status, 0);
  assert.equal(JSON.parse(ask.stdout).hookSpecificOutput.permissionDecision, 'ask');
  const ok = run('claude', { tool_name: 'Read', tool_input: { file_path: join(dir, 'read.sql') }, cwd: dir });
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout.toString(), '');
  assert.equal(run('claude', undefined).status, 0, 'no payload: nothing to check');
  // input that is not JSON (a BOM is dropped first) blocks instead of letting the call through
  const raw = (text) => spawnSync(process.execPath, [hook('claude')], { input: text, cwd: dir });
  assert.equal(raw('﻿' + JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push --force' }, cwd: dir })).status, 2);
  assert.equal(raw('﻿' + JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: dir })).status, 0);
  assert.equal(raw('not json').status, 2);
});

test('Kiro hook: deny and ask both exit 2 with the reason on stderr (a Kiro rule can approve an ask unseen)', () => {
  const deny = run('kiro', { hook_event_name: 'PreToolUse', tool_name: 'shell', tool_input: { command: 'docker volume rm data' }, cwd: dir });
  assert.equal(deny.status, 2);
  assert.match(deny.stderr.toString(), /Blocked: deleting Docker volumes/);
  const ask = run('kiro', { hook_event_name: 'PreToolUse', tool_name: 'execute_pwsh', tool_input: { command: 'git rebase main' }, cwd: dir });
  assert.equal(ask.status, 2);
  assert.match(ask.stderr.toString(), /^Blocked in Kiro: git rebase can discard work .* Give the user the exact command/);
  assert.equal(ask.stdout.toString(), '');
  assert.equal(run('kiro', { tool_name: 'read', tool_input: { path: 'src/app.py' }, cwd: dir }).stdout.toString(), '');
});

test('Copilot hook: a top-level permissionDecision, {} to let the call through', () => {
  const out = (payload) => { const r = run('copilot', payload); assert.equal(r.status, 0); return JSON.parse(r.stdout); };
  assert.equal(out({ toolName: 'powershell', toolArgs: JSON.stringify({ command: 'git push -f' }), cwd: dir }).permissionDecision, 'deny');
  assert.equal(out({ toolName: 'bash', toolArgs: JSON.stringify({ command: 'git push origin x' }), cwd: dir }).permissionDecision, 'ask');
  assert.deepEqual(out({ toolName: 'view', toolArgs: JSON.stringify({ path: 'src/app.py' }), cwd: dir }), {});
});

test('every hook fails closed when the guard cannot load', () => {
  const env = { ...process.env, NODE_ENV: 'test', AI_GUARD_PATH: join(dir, 'no-such-guard.mjs') };
  for (const tool of ['claude', 'kiro', 'copilot']) {
    const r = run(tool, { tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: dir }, env);
    assert.equal(r.status, 2, tool);
    assert.match(r.stderr.toString(), /guard hook failed/, tool);
  }
  assert.match(run('copilot', { toolName: 'bash', toolArgs: '{}' }, env).stdout.toString(), /"permissionDecision":"deny"/);
  // without NODE_ENV=test the override is ignored
  assert.equal(run('claude', { tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: dir }, { ...process.env, AI_GUARD_PATH: join(dir, 'no-such-guard.mjs') }).status, 0);
});
