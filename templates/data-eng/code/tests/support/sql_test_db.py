"""Connection to the disposable local SQL Server only; refuses any other host or database."""
import os
import re
from pathlib import Path

ALLOWED_HOSTS = {"sqlserver", "localhost", "127.0.0.1"}
DDL_DIR = Path(__file__).resolve().parents[2] / "TablesDataBase"


def check_target(host, database):
    if host not in ALLOWED_HOSTS:
        raise RuntimeError(f"refusing SQL host {host!r}: tests only use the local test container")
    if not database.endswith("_test"):
        raise RuntimeError(f"refusing database {database!r}: name must end in _test")


def connect(database=None, autocommit=True):
    import mssql_python

    host = os.environ.get("SQL_HOST", "sqlserver")
    database = database or os.environ.get("SQL_DATABASE", "{{project}}_test")
    check_target(host, database)
    password = os.environ["MSSQL_SA_PASSWORD"]

    def conn_str(db):
        return f"Server={host};Database={db};UID=sa;PWD={password};Encrypt=yes;TrustServerCertificate=yes"

    master = mssql_python.connect(conn_str("master"), autocommit=True)
    master.cursor().execute(f"IF DB_ID(N'{database}') IS NULL CREATE DATABASE [{database}]")
    master.close()
    return mssql_python.connect(conn_str(database), autocommit=autocommit)


def apply_ddl(conn, ddl_dir=DDL_DIR):
    """Runs every TablesDataBase/*.sql file in name order, split on GO lines."""
    cur = conn.cursor()
    for path in sorted(Path(ddl_dir).rglob("*.sql")):
        for batch in re.split(r"^\s*GO\s*$", path.read_text(encoding="utf-8"), flags=re.M | re.I):
            if batch.strip():
                cur.execute(batch)
