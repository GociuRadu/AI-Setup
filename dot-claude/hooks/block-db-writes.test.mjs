// Self-check: node .claude/hooks/block-db-writes.test.mjs
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { check } from './block-db-writes.mjs';

const dir = mkdtempSync(join(tmpdir(), 'dbhook-'));
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
  'sqlcmd -S dev -Q "SELECT item_id FROM dbo.item" -o "C:/out/into.txt"',
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
];

for (const c of allowed) assert.equal(check(c, dir), null, `should allow: ${c}`);
for (const c of blocked) assert.notEqual(check(c, dir), null, `should block: ${c}`);
console.log(`ok: ${allowed.length} allowed, ${blocked.length} blocked`);
