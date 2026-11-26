"""Local stand-in for mssparkutils/notebookutils: secrets from env vars, fs on a local folder."""
import os
import shutil
import sys
import types
from pathlib import Path

LAKE_ROOT = Path(os.environ.get("LOCAL_LAKE_ROOT", "/tmp/lake"))


def _local(path):
    # abfss://<container>@<account>.dfs.core.windows.net/<path> -> <LAKE_ROOT>/<container>/<path>
    if "://" in path:
        rest = path.split("://", 1)[1]
        container, _, tail = rest.partition("@")
        path = f"{container}/{tail.partition('/')[2]}"
    return LAKE_ROOT / path.lstrip("/")


class NotebookExit(Exception):
    """Raised by notebook.exit so tests can assert the exit value."""


class _Credentials:
    @staticmethod
    def getSecret(akv_name, secret_name, linked_service=None):
        return os.environ[secret_name.upper().replace("-", "_")]


class _Fs:
    @staticmethod
    def exists(path):
        return _local(path).exists()

    @staticmethod
    def ls(path):
        return [types.SimpleNamespace(name=p.name, path=str(p), isDir=p.is_dir()) for p in _local(path).iterdir()]

    @staticmethod
    def mkdirs(path):
        _local(path).mkdir(parents=True, exist_ok=True)
        return True

    @staticmethod
    def rm(path, recurse=False):
        p = _local(path)
        shutil.rmtree(p) if recurse and p.is_dir() else p.unlink()
        return True


class _Notebook:
    @staticmethod
    def exit(value):
        raise NotebookExit(value)

    @staticmethod
    def run(*args, **kwargs):
        raise NotImplementedError("notebook.run is not available locally")


mssparkutils = types.SimpleNamespace(credentials=_Credentials, fs=_Fs, notebook=_Notebook)


def install():
    """Makes `import mssparkutils` and `from notebookutils import mssparkutils` resolve to this stub."""
    for name in ("mssparkutils", "notebookutils"):
        mod = types.ModuleType(name)
        mod.__dict__.update(mssparkutils.__dict__, mssparkutils=mssparkutils)
        sys.modules.setdefault(name, mod)
