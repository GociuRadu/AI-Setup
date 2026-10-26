"""AST loader: takes imports, functions, classes and literal constants from a notebook, never runs its I/O cells."""
import ast
import json
from pathlib import Path

from tests.support import mssparkutils_stub

_KEEP = (ast.Import, ast.ImportFrom, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)


def _code_cells(path):
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    cells = doc.get("properties", doc).get("cells", [])  # Synapse Git JSON or .ipynb
    for cell in cells:
        if cell.get("cell_type") == "code":
            src = cell.get("source", "")
            yield "".join(src) if isinstance(src, list) else src


def _is_literal_assign(node):
    return isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant)


def load_definitions(path):
    """Returns the notebook's definitions as a namespace dict; magic lines (%, !) and non-Python %% cells are skipped."""
    mssparkutils_stub.install()
    ns = {"__name__": Path(path).stem}
    for src in _code_cells(path):
        first = src.lstrip().split("\n", 1)[0].strip().lower()
        if first.startswith("%%") and first.split()[0] not in ("%%pyspark", "%%python"):
            continue  # %%sql, %%sparksql, %%configure: not Python
        lines = [l for l in src.splitlines() if not l.lstrip().startswith(("%", "!"))]
        tree = ast.parse("\n".join(lines))
        body = [n for n in tree.body if isinstance(n, _KEEP) or _is_literal_assign(n)]
        exec(compile(ast.Module(body=body, type_ignores=[]), str(path), "exec"), ns)
    return ns
