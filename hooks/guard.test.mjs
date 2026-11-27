import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir, homedir } from 'node:os';
import { decide, patchFiles } from './guard.mjs';

const dir = mkdtempSync(join(tmpdir(), 'guard-'));
writeFileSync(join(dir, 'read.sql'), 'SELECT TOP 10 item_id, name FROM dbo.item WHERE updated_at > @d;');
writeFileSync(join(dir, 'write.sql'), 'UPDATE dbo.item SET name = N\'x\';');
// a workspace whose device file names a vault, and a link to that vault
const vroot = mkdtempSync(join(tmpdir(), 'ws-'));
const vault = mkdtempSync(join(tmpdir(), 'vault-'));
writeFileSync(join(vroot, '.ai-device.json'), JSON.stringify({ vault }));
const fwd = vault.replace(/\\/g, '/');
const bash = fwd.replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`);
const link = join(mkdtempSync(join(tmpdir(), 'link-')), 'v');
symlinkSync(vault, link, 'junction');

// a row: [expected, tool, args, root = dir, cwd = root]; expected is a decision, or a RegExp the reason must match
const D = 'deny', A = 'ask', N = null;
const P = /vault's Personal folder\.$/, W = /whole Obsidian vault/, M = /encrypted \.mdenc notes/;
const sh = (expected, ...commands) => commands.map((command) => [expected, 'Bash', { command }]);
const on = (expected, tool, ...argsList) => argsList.map((args) => [expected, tool, args]);
const inVault = (rows) => rows.map(([e, t, a]) => [e, t, a, vroot]);
// rows with Windows paths (a drive letter, \ as separator): on Linux and macOS those are plain file names
const win = (rows) => (process.platform === 'win32' ? rows : []);
const patch = (body) => ({ input: `*** Begin Patch\n${body}\n*** End Patch` });

const cases = [
  // writing SQL: inline, piped, from a script or a variable, statement verbs, tools that write databases
  ...sh(D, 'sqlcmd -S dev-sql -Q "DELETE FROM dbo.item"', 'sqlcmd -S localhost -Q "CREATE TABLE dbo.t (id INT)"', 'docker exec db sqlcmd -Q "TRUNCATE TABLE stg.item"',
    'sqlcmd -S dev-sql -Q "SELECT item_id INTO dbo.copy FROM dbo.item"', 'sqlcmd -S dev-sql -Q "EXEC dbo.Item_Publish"', 'sqlcmd -S dev-sql -i write.sql', 'sqlcmd -S dev-sql -iwrite.sql',
    'sqlcmd -S dev-sql -i missing.sql', 'bcp dbo.item in data.csv -S dev-sql -c', 'psql -h dev -c "drop table x"', 'pwsh -c "Invoke-Sqlcmd -ServerInstance dev -Query \'UPDATE dbo.item SET a=1\'"',
    'python -c "import pyodbc; pyodbc.connect(cs).execute(\'DELETE FROM t\')"', 'Get-Content w.sql | sqlcmd -S dev', 'cat w.sql | psql', 'sqlcmd -Q "$(cat w.sql)"', 'mysql -e "source w.sql"',
    'sqlite3 app.db ".read w.sql"', 'psql -c "\\i w.sql"', 'mysql app < dump.dump', 'pg_restore -d app dump.backup', 'sqlpackage /Action:Publish /SourceFile:app.dacpac', 'dotnet ef database update',
    'alembic upgrade head', 'node -e "require(\'mssql\').query(\'DROP TABLE t\')"', 'cd sub && sqlcmd -S dev -Q "DELETE FROM t"', 'sqlcmd -S dev -Q "SELECT 1; DELETE FROM dbo.t"',
    'psql -c "select 1; drop table x"', 'sqlcmd -Q "SELECT 1\nGO\nDELETE FROM t"', '$q = "DELETE FROM dbo.t"; Invoke-Sqlcmd -Query $q', 'sqlcmd -S dev -Q %Q%', 'psql -c "$SQL"',
    'Invoke-Sqlcmd -InputFile $f', 'psql -c "CALL purge()"', "psql -c \"COPY t FROM 'f'\"", 'psql -c "VACUUM"', 'mysql -e "SET GLOBAL x=1"', 'mysql -e "LOCK TABLES t WRITE"',
    'mysql -e "RENAME TABLE a TO b"', 'sqlcmd -Q "KILL 55"', 'sqlcmd -Q "SHUTDOWN"', 'sqlcmd -Q "ENABLE TRIGGER t ON x"', 'sqlite3 db "PRAGMA writable_schema=1"'),
  ...sh(N, 'sqlcmd -S dev-sql -d app -Q "SELECT TOP 10 item_id, updated_at FROM dbo.item"', 'sqlcmd -S dev-sql -Q "SELECT session_id, wait_type FROM sys.dm_exec_requests"',
    'docker exec db /opt/mssql-tools18/bin/sqlcmd -Q "SELECT COUNT_BIG(*) FROM dbo.item_deleted_log"', 'docker exec -i db sqlcmd -Q "SELECT 1"', 'sqlcmd -S dev-sql -i read.sql',
    'sqlcmd -S update-db01 -Q "SELECT 1" -o into.txt', 'bcp "SELECT item_id FROM dbo.item" queryout out.csv -S dev-sql -c', 'mysql -f -e "SELECT 1"',
    'Invoke-Sqlcmd -ServerInstance $srv -Query "SELECT 1"', 'sqlcmd -S dev -Q "SELECT item_id FROM dbo.item" -o "C:/out/into.txt"', 'sqlcmd -Q "SET NOCOUNT ON; SELECT 1"',
    'sqlite3 db "PRAGMA table_info(t)"', "psql -c \"SELECT replace(name, 'a', 'b') FROM t\"", "sqlcmd -Q \"SELECT name FROM sys.tables WHERE name LIKE '%copy%'\"",
    'grep -rn "INSERT INTO" src/', 'grep -i sqlcmd README.md', 'git commit -m "Create psql helper"'),

  // hard stops: force-push, Docker volumes, production compose files, release scripts, SSH, behind any prefix or wrapper
  ...sh(D, 'git push --force origin main', 'git push -f', 'git push origin +main', 'git push --force-with-lease', 'git push -uf origin main', 'git -C code push --force origin main',
    'git --no-pager push -f', 'git -P push --force', 'env git push --force origin x', 'GIT_TRACE=1 git push -f', 'command git push -f', '\\git push -f', 'nohup git push -f', 'xargs git push -f',
    'eval "git push -f"', 'iex "git push -f"', 'python -c "import os; os.system(\'git push --force\')"',
    'docker compose down -v', 'docker-compose -p app down --volumes', 'docker compose down -fv', 'docker compose down -vf', 'echo $(docker compose down -v)', 'docker volume rm app_data',
    'docker system prune -af', "perl -e 'system(\"docker volume rm data\")'", 'docker compose -f docker-compose.prod.yml up -d', 'bash scripts/release.sh',
    'ssh root@203.0.113.10', 'npm test && scp dump.sql user@host:/tmp', 'echo y | ssh host', 'wsl ssh root@host', 'wsl -d Ubuntu ssh host', 'powershell -c "ssh host"', 'bash -lc "ssh host"',
    'cmd /c ssh host', '& ssh host', 'ssh.exe host', 'env ssh host', 'FOO=1 ssh host', 'command ssh host', 'nohup ssh host', 'time ssh host', 'timeout 5 ssh host', '/usr/bin/ssh host',
    'echo $(ssh host rm)', 'x=$(ssh host rm)', '(ssh host)', 'if true; then ssh host; fi', 'for h in a; do ssh $h; done', 'Start-Process ssh',
    "& 'C:\\Windows\\System32\\OpenSSH\\ssh.exe' host", "node -e \"require('child_process').execSync('ssh host')\""),
  // skipping Git hooks turns off the secret scan
  ...sh(D, 'git commit --no-verify -m "x"', 'git commit -n -m "x"', 'git commit -anm "x"', 'git push --no-verify', 'git -c core.hooksPath=/dev/null commit -m "x"',
    'git -c "core.hooksPath=x" commit', 'git config core.hooksPath .husky', 'git config --global --unset core.hooksPath', 'bash -c "git commit --no-verify"',
    'git commit --no-verif -m x', 'GIT_CONFIG_GLOBAL=/dev/null git commit -m x', 'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/x git commit',
    "git -c alias.c='commit -n' c", 'git -c alias.c=commit\\ -n c', "git config alias.c 'commit -n'", 'git config alias.ci "commit --no-verify"'),
  ...sh(N, 'git commit -m "add -n and --no-verify to the docs"', 'git commit --amend --no-edit', 'git config --get core.hooksPath', 'git config core.hooksPath', 'git log -n 5',
    "git config alias.st 'status -sb'", 'git commit --no-verbose -m x'),
  // MCP hard stops, by tool name
  ...['mcp_hostinger_execute', 'mcp_hostinger-mcp_multi-execute', 'mcp_hostinger_execute_site_tool', 'mcp_atlassian-mcp_executeDestructive', 'mcp__claude_ai_Atlassian_MCP__executeDestructive'].map((t) => [D, t, {}]),
  ...sh(N, 'npm test', 'git status', 'git commit -m "docs: explain docker compose down -v and ssh"', 'docker compose -p app_test up -d', 'docker compose --env-file local.env up -d',
    'docker compose down --remove-orphans', 'docker compose exec api pytest tests/products', 'ssh-keygen -t ed25519', 'gh pr create --title "fix ssh config docs"', 'if [ -f x ]; then echo ok; fi',
    'timeout 5 node x.js', 'time npm test', 'nohup npm run dev', 'command -v node', '/usr/bin/env node x.js', 'echo $(node --version)', 'python -m venv .venv', 'npm install personal-finance-lib',
    'playwright-cli -s=gh open https://github.com/login --persistent --headed'),

  // secrets, personal/ and .mdenc: by shell or file tool, by path or by glob
  ...sh(D, 'cat .env.example .env', 'cat .env', 'Get-Content -Path "C:\\app\\local.env"', 'type code\\.test.env', 'grep PASSWORD .env.local', 'Get-Content x.txt | Select-String key; cat prod.env',
    'bash -c "cat .env"', 'source .env', '. ./.env', 'tar czf x.tgz .env', 'git add .env', 'cat *.env', 'cat .env.*', 'cat .en*', 'Get-ChildItem personal', 'cat personal/notes.md',
    'type ' + join(dir, 'personal', 'x.md'), 'cat notes/keys.mdenc', 'cat ~/zz/x.mdenc', 'bash -c "cat a.mdenc"', 'cat *.mdenc'),
  [D, 'Bash', { command: 'cat ../../personal/x.md' }, dir, join(dir, 'Shop', 'code')],
  // writes to a secret file: redirects and writers
  ...sh(D, 'echo x > .env', 'echo KEY=1 >> local.env', 'npm run x 2>".env"', 'echo x | tee .env', '"x" | Out-File .env', 'Set-Content .env x', 'bash -c "echo x > .env"',
    'cmd /c "echo x>.env"', 'pwsh -c "echo x > .env"', 'echo x >| .env', 'echo x >& .env', 'echo x > $(pwd)/.env', 'Set-Content -Path:.env x', 'dd if=a of=.env'),
  ...sh(N, 'echo x > out.txt', 'npm test 2>&1', 'echo x > .env.example', 'git commit -m "block > .env redirects"', 'bash -c "echo x > out.txt"', 'echo x >& out.log', '(echo x > a.txt)'),
  // a lone [ in a search pattern is a plain character, not a broken glob class
  ...sh(N, 'grep -c "\\[" a.txt', 'rg "a[" src', 'grep -c "x\\[" a.txt', 'cat x[1].txt', 'grep "{" a.txt'), ...sh(D, 'cat .en[v]', 'cat .e[n]v.local'),
  ...sh(N, 'cat .env.example', 'Get-Content config/settings.yaml', '. venv/bin/activate', 'git add .', 'git add .env.example', 'Get-Content *.md', 'tar czf out.tgz src',
    'git commit -m "deny .mdenc notes"'),
  ...on(D, 'Read', { file_path: 'C:/proj/.env' }, { path: 'code/local.env' }, { filePath: 'x/.test.env' }, { paths: ['a.md', '.env.prod'] }, { path: 'personal/diary.md' }, { path: join(dir, 'personal') },
    { operations: [{ mode: 'Line', path: 'Shop/code/.env' }] }, { pattern: 'personal/**' }, { includePattern: '**/*.env' }, { includePattern: '**/.env*' }, { includePattern: '**/*.env.*' },
    { includePattern: '**/.e?v' }, { includePattern: '**/.e*' }, { includePattern: '**/.*' }, { glob: '**/*.env' }, { pattern: '{.env,a.txt}' }, { file_path: 'C:/v/Inbox/keys.mdenc' }),
  [D, 'Read', { path: '../personal/x.md' }, dir, join(dir, 'Shop')],
  ...on(D, 'Write', { file_path: 'notes/x.mdenc', content: 'x' }), ...on(D, 'Glob', { pattern: '**/*.mdenc' }),
  ...on(D, 'file_search', { query: '**/*.env' }), ...on(D, 'glob', { pattern: '**/*.env' }),
  ...on(N, 'Read', { pattern: '**/*.py' }, { pattern: '**/*' }, { file_path: 'src/app.py' }, { path: '.env.example' }, { filePath: 'docs/ai/project.md' }, { includePattern: '**/.env.example' },
    { glob: '**/*.py' }, { path: 'personal-site/index.html' }),
  // a content search's text is not a path
  ...on(N, 'Grep', { pattern: 'Load .env file' }), ...on(N, 'rg', { pattern: 'Load .env file', path: 'src' }), ...on(N, 'grep_search', { query: '.env', includePattern: 'src/**' }),
  // edits are not asked about, outside the workspace included: Claude's auto mode and the tools' own prompts judge those
  ...on(N, 'Write', { filePath: 'c:/Outside/x.txt' }),
  // Copilot apply_patch: the files it names are checked like any other path
  ...on(D, 'apply_patch', patch('*** Update File: code/.env\n@@\n-a\n+b'), patch('*** Add File: personal/x.md\n+x')),
  ...on(N, 'apply_patch', patch('*** Update File: src/a.py\n@@\n-a\n+b'), patch('*** Delete File: src/old.py')),
  [/outside the workspace/, 'apply_patch', patch(`*** Delete File: ${join(homedir(), 'zz-outside.txt')}`)],

  // run by the user only: cloud CLIs, gh merges, deletes and releases, publishing, loaders, Hostinger changes
  ...sh(D, 'az group list', 'kubectl get pods', 'helm list', 'terraform plan', 'gh pr merge 12', 'gh repo delete o/r --yes', 'gh release create v1', 'gh api -X DELETE repos/o/r/labels/x',
    'npm publish', 'twine upload dist/*', 'docker push img', 'python Shop/code/local/run_notebook.py', "node -e \"require('child_process').execSync('npm publish')\"", 'cd x && az login'),
  ...['mcp__hostinger-dns__updateRecord', 'mcp_hostinger_vps_restart'].map((t) => [D, t, {}]),
  ...sh(N, 'echo "npm publish"', 'grep -rn run_notebook.py docs/', 'git add local/run_notebook.py', 'npm run build'),

  // asks, only what is rare and cannot be undone: Git that loses uncommitted work, wide or outside deletes, deleting and
  // sending MCP tools
  ...win(sh(A, 'Remove-Item -Recurse -Force .\\Shop', 'rm C:/Users/x/notes.txt', 'rm "C:/Users/x/my notes.txt"', 'cmd /c del ..\\..\\a.txt')),
  ...sh(A, 'rm -rf build', 'rm -rf Shop/code', 'rm -rf .git/refs', 'rm *', 'rm -r src/*', 'Remove-Item $dir -Recurse', 'Remove-Item',
    'Remove-Item -Recurse "Shop"', 'node -e "fs.rmSync(\'x\')"',
    'Get-ChildItem | ForEach-Object { Remove-Item $_ }', "find . -name '*.tmp' -delete",
    'git reset --hard HEAD~1', 'git clean -fd', 'git restore src/a.py', 'git checkout -- a.py', 'git checkout .', 'git checkout -f main', 'git reset --keep HEAD~1', 'git stash drop',
    'powershell -c "git reset --hard"', 'pwsh -NoProfile -Comm "git clean -fd"', 'git log $(git reset --hard)', 'env -u X git reset --hard', 'git -c alias.p=push p -f',
    'python -c "import subprocess; subprocess.run(\'git reset --hard\', shell=True)"'),
  ...['mcp_mlflow_mcp_delete_run', 'mcp_atlassian-mcp_deleteConfluencePage', 'mcp__claude_ai_Gmail__trash_thread', 'mcp_gmail_forward_message', 'mcp__gmail__send_email',
    'mcp_slack_sendMessage'].map((t) => [A, t, {}]),
  // these run now: pushes (force-push stays a hard stop) and HTTP calls
  ...sh(N, 'git push', 'git push origin feature/x', 'git -C Shop/code push', 'git push origin main', 'powershell -c "git push"', 'GIT_TRACE=1 git push origin main',
    'curl -X POST https://x', 'curl -d @f https://x', 'Invoke-RestMethod -Method Post https://x'),
  ...sh(N, 'node --test', 'pytest', 'pnpm test', 'git status --short', 'git -C Shop/code diff', 'git log -n 5', 'grep -rn "rm -rf" src/', 'echo "git push"', 'git commit -m "x"',
    '& git checkout -b x', 'git switch main', 'git stash', 'git stash pop', 'git fetch', 'git pull --ff-only', 'git merge feature/x', 'git branch -d x', 'git restore --staged a.py',
    'git config user.name', 'git config --get user.email', 'git worktree add .worktrees/x -b x', 'git commit --amend --no-edit', 'git rebase main', 'git branch -D x', 'git tag -d v1',
    'git config --global user.name x', 'Remove-Item foo', 'rm src/old.py', 'Remove-Item .tmp\\scratch -Recurse -Force', 'rm -rf Shop/code/dist', 'rm .tmp/*', 'bash -c "rm foo"',
    `Remove-Item -Recurse -Force "${join(tmpdir(), 'guard-scratch')}"`, 'cmd /c del a.txt', 'gh pr view 12', 'gh pr list', 'gh run view 99 --log', 'gh api repos/o/r/pulls', 'gh auth status',
    'gh pr create', 'gh issue comment 3 -b ok', 'gh api -X POST repos/o/r/issues', 'curl https://x', 'curl -fsSL https://x -o a.json', 'Invoke-RestMethod https://x', 'iwr -Method Get https://x',
    'curl -X POST http://localhost:8000/api/items -d @a.json', 'Invoke-RestMethod -Method Post http://127.0.0.1:5000/x', 'docker run --rm alpine echo ok', 'echo "git push -f"',
    'grep "git push -f" x', 'git -P log -n 5', 'GIT_TRACE=1 git status', 'env NODE_ENV=test node --test', 'git push-helper', 'python -c "print(\'hello\')"',
    "node -e \"console.log(require('os').platform())\"", 'git -c core.pager=cat log -n 3'),
  ...['', 'read_file', 'mcp_atlassian-mcp_createConfluencePage', 'mcp__atlassian__editJiraIssue', 'mcp_mlflow_mcp_set_trace_tag', 'mcp_some_server_execute_action',
    'mcp_atlassian-mcp_getConfluencePage', 'mcp_atlassian-mcp_search', 'mcp_atlassian-mcp_atlassianUserInfo', 'mcp_mlflow_mcp_describe_run', 'mcp_atlassian-mcp_listJiraIssueComments',
    'mcp_atlassian-mcp_executeRead', 'mcp_github_pull_request_read', 'mcp_hostinger_list_sites', 'mcp__hostinger-dns__getRecords',
    'mcp__claude_ai_Gmail__create_draft', 'mcp__claude_ai_Gmail__search_threads'].map((t) => [N, t, {}]),

  // the Obsidian vault: Personal and whole-vault reads ask, the rest is open; no vault set, nothing is special
  ...inVault([
    ...on(M, 'Read', { file_path: `${fwd}/Inbox/keys.mdenc` }, { file_path: `${vault}\\Inbox\\keys.mdenc` }), ...sh(M, `cat "${fwd}/Personal/a.mdenc"`, `cp ${fwd}/Inbox/keys.mdenc .`),
    ...[`${fwd}/Personal/a.md`, `${fwd}/personal/a.md`, ...win([`${vault}\\Personal\\a.md`]),`${fwd}/Learn/../Personal/a.md`, `${fwd}/Personal./a.md`, `${fwd}/Personal /a.md`, `${fwd}/Personal`]
      .flatMap((p) => [[P, 'Read', { file_path: p }], [P, 'view', { path: p }], [P, 'Bash', { command: `cat "${p}"` }]]),
    // a bare Personal/ path is also read from the workspace root, as its personal/ folder: denied, stricter than the ask
    ...sh(D, `cd ${fwd} && cat Personal/a.md`, `cd "${vault}"; gc Personal\\a.md`), ...win(sh(D, `Set-Location -Path ${fwd}; type .\\Personal\\a.md`)),
    ...sh(P, `ls ${bash}/Personal`, `(cd ${bash} && ls Personal)`, `cd ${fwd}/Learn && cat ../Personal/a.md`, `bash -c "cat ${fwd}/Personal/a.md"`,
      `echo x >${fwd}/Personal/b.md`, `cat<${fwd}/Personal/a.md`, `cat ${fwd}/Learn/*/../../Personal/x.md`),
    ...win(sh(P, `Get-Content ${vault}\\Learn\\a.md,${vault}\\Personal\\b.md`, `pwsh -Command "gc ${vault}\\Personal\\a.md"`, `cat "\\\\?\\${vault}\\Personal\\a.md"`)),
    ...on(P, 'Write', { file_path: join(link, 'Personal', 'new.md'), content: 'x' }), ...on(P, 'Glob', { pattern: '{a,../Personal}/**', path: `${fwd}/Learn` }),
    ...[vault, `${fwd}/`, join(vault, '..')].flatMap((path) => [[W, 'Grep', { pattern: 'x', path }], [W, 'Glob', { pattern: '**/*.md', path }]]),
    ...on(W, 'Glob', { pattern: `${fwd}/**/*.md` }),
    ...sh(W, `grep -rn x ${fwd}`, `rg x ${bash}`, `Get-ChildItem -Recurse ${fwd}`, `cat ${fwd}/*/a.md`, `tar cf a.tar ${fwd}`, `cd ${fwd} && rg foo`, `cd ${fwd}; grep -r foo .`,
      `grep --recursive foo ${fwd}`, `git -C ${fwd} grep foo`, `bash -c "grep -r x ${fwd}"`, `Get-ChildItem -r ${fwd}`, `ls -R ${fwd}`, `cat ${fwd}/../*/Personal/a.md`),
    ...[`${fwd}/Learn/Requirements.md`, `${fwd}/Learn/Personal finance.md`, `${fwd}/Files/a.svg`, `${fwd}/Personal.base`, `${fwd}/.obsidian/plugins/x/main.js`]
      .flatMap((p) => [[N, 'Read', { file_path: p }], [N, 'Write', { file_path: p, content: 'x' }], [N, 'Bash', { command: `cat "${p}"` }]]),
    ...sh(N, `cd ${fwd}/Learn && grep -rn x .`, `cp a.svg "${fwd}/Files/My picture.svg"`, `mv ${fwd}/Learn/A.md ${fwd}/Learn/B.md`, `grep -rn x ${fwd}/Learn`, `D=${bash}; cp a.svg $D/Files/`,
      "sed -n '/{/p' a.md", `Select-String -Path ${fwd}/Learn/a.md -Pattern '[0-9]'`, `Get-Content -Raw ${fwd}/Learn/a.md`),
    ...on(N, 'Grep', { pattern: 'personal', path: `${fwd}/Learn` }), ...on(N, 'Glob', { pattern: '**/*.md', path: `${fwd}/Learn` }),
    ...on(N, 'Write', { file_path: join(link, 'Learn', 'new.md'), content: 'x' }),
  ]),
  ...on(N, 'Read', { file_path: `${fwd}/Personal/a.md` }),

  // the reason names the rule
  ...sh(/force-push is a hard stop/, '& git push -f', 'powershell -Command "git push --force"', 'bash -c "git push --force"'),
  ...sh(/SSH to a server is a hard stop/, 'cd x & ssh user@host'),
  ...sh(/git reset can discard uncommitted work/, 'command git reset --hard'),
  ...sh(/deleting a whole project, repo or the workspace/, 'echo a & rm -rf x'),
  [/^Blocked: this MCP tool is a hard stop/, 'mcp__atlassian__executeDestructive', {}],
];

test('one table: every call gets the decision or reason its row names', () => {
  const wrong = cases.filter(([expected, tool, args, root = dir, cwd = root]) => {
    const got = decide({ tool_name: tool, tool_input: args, cwd }, root);
    return expected instanceof RegExp ? !expected.test(got.reason) : got.decision !== expected;
  }).map(([expected, tool, args, root = dir, cwd = root]) => `${tool} ${JSON.stringify(args)}: expected ${expected}, got ${JSON.stringify(decide({ tool_name: tool, tool_input: args, cwd }, root))}`);
  assert.deepEqual(wrong, []);
});

test('payloads: Copilot sends toolName and toolArgs (a JSON string, or plain text); patches name their files', () => {
  assert.equal(decide({ toolName: 'powershell', toolArgs: JSON.stringify({ command: 'Get-Content .env' }), cwd: dir }, dir).decision, 'deny');
  assert.equal(decide({ toolName: 'view', toolArgs: JSON.stringify({ path: join(dir, 'personal', 'a.md') }), cwd: dir }, dir).decision, 'deny');
  assert.equal(decide({ toolName: 'bash', toolArgs: 'git reset --hard', cwd: dir }, dir).decision, 'ask');
  assert.deepEqual(patchFiles('*** Begin Patch\n*** Update File: a.py\n*** Move to: b.py\n*** Delete File: c.py\n*** End Patch'), [{ op: 'update', path: 'a.py' }, { op: 'add', path: 'b.py' }, { op: 'delete', path: 'c.py' }]);
});

// the real hook scripts, as each tool runs them: payload on stdin, decision on stdout/stderr/exit code
const hook = (tool) => fileURLToPath(new URL(`./${tool}/hook.mjs`, import.meta.url));
const run = (tool, payload, env = process.env) => spawnSync(process.execPath, [hook(tool)], { input: payload === undefined ? '' : JSON.stringify(payload), env, cwd: dir });
const raw = (text) => spawnSync(process.execPath, [hook('claude')], { input: text, cwd: dir });
const bashCall = (command) => ({ tool_name: 'Bash', tool_input: { command }, cwd: dir });

test('Claude Code hook: deny exits 2, ask is JSON, a safe call prints nothing; input that is not JSON blocks', () => {
  const deny = run('claude', bashCall('git push --force'));
  assert.equal(deny.status, 2);
  assert.match(deny.stderr.toString(), /force-push is a hard stop/);
  const ask = run('claude', bashCall('git reset --hard'));
  assert.equal(ask.status, 0);
  assert.equal(JSON.parse(ask.stdout).hookSpecificOutput.permissionDecision, 'ask');
  assert.equal(run('claude', bashCall('npm test')).stdout.toString(), '');
  assert.equal(run('claude', undefined).status, 0, 'no payload: nothing to check');
  // a BOM (PowerShell pipes add one) is dropped first
  assert.equal(raw('\uFEFF' + JSON.stringify(bashCall('git push --force'))).status, 2);
  assert.equal(raw('not json').status, 2);
});

test('Kiro hook: deny and ask both exit 2 with the reason on stderr (a Kiro rule can approve an ask unseen)', () => {
  const deny = run('kiro', { hook_event_name: 'PreToolUse', tool_name: 'shell', tool_input: { command: 'docker volume rm data' }, cwd: dir });
  assert.equal(deny.status, 2);
  assert.match(deny.stderr.toString(), /Blocked: deleting Docker volumes/);
  const ask = run('kiro', { hook_event_name: 'PreToolUse', tool_name: 'execute_pwsh', tool_input: { command: 'git reset --hard' }, cwd: dir });
  assert.equal(ask.status, 2);
  assert.match(ask.stderr.toString(), /^Blocked in Kiro: git reset can discard uncommitted work .* Give the user the exact command/);
  assert.equal(run('kiro', { tool_name: 'read', tool_input: { path: 'src/app.py' }, cwd: dir }).stdout.toString(), '');
});

test('Copilot hook: the decision top-level (Copilot CLI) and in hookSpecificOutput (VS Code), {} to let the call through', () => {
  const out = (payload) => { const r = run('copilot', payload); assert.equal(r.status, 0); return JSON.parse(r.stdout); };
  const deny = out({ toolName: 'powershell', toolArgs: JSON.stringify({ command: 'git push -f' }), cwd: dir });
  assert.equal(deny.permissionDecision, 'deny');
  assert.equal(deny.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(deny.hookSpecificOutput.hookEventName, 'PreToolUse');
  // VS Code agent mode sends Claude's field names
  const ask = out({ hook_event_name: 'PreToolUse', tool_name: 'run_in_terminal', tool_input: { command: 'git clean -fd' }, cwd: dir });
  assert.equal(ask.hookSpecificOutput.permissionDecision, 'ask');
  assert.match(ask.hookSpecificOutput.permissionDecisionReason, /git clean can discard uncommitted work/);
  assert.deepEqual(out({ toolName: 'view', toolArgs: JSON.stringify({ path: 'src/app.py' }), cwd: dir }), {});
});

test('every hook fails closed when the guard cannot load, and only tests can point it elsewhere', () => {
  const missing = join(dir, 'no-such-guard.mjs');
  for (const tool of ['claude', 'kiro', 'copilot']) {
    const r = run(tool, bashCall('npm test'), { ...process.env, NODE_ENV: 'test', AI_GUARD_PATH: missing });
    assert.equal(r.status, 2, tool);
    assert.match(r.stderr.toString(), /guard hook failed/, tool);
    if (tool === 'copilot') assert.match(r.stdout.toString(), /"permissionDecision":"deny"/);
  }
  assert.equal(run('claude', bashCall('npm test'), { ...process.env, AI_GUARD_PATH: missing }).status, 0);
});
