import json
import tempfile
import unittest
from pathlib import Path

from tests.support.notebook_loader import load_definitions

CELLS = [
    "%%configure\n{}",
    "%%sql\nSELECT key, qty FROM never_runs WHERE qty > 1\n",
    "from notebookutils import mssparkutils\nTARGET = 'dbo.example'\n",
    "def add_one(x):\n    return x + 1\n",
    "spark.read.table('never_runs')\nmssparkutils.notebook.exit('done')\n",
]


class NotebookLoaderTest(unittest.TestCase):
    def _write(self, doc):
        path = Path(tempfile.mkdtemp()) / "nb.json"
        path.write_text(json.dumps(doc), encoding="utf-8")
        return path

    def test_synapse_json_keeps_definitions_and_skips_io(self):
        doc = {"properties": {"cells": [{"cell_type": "code", "source": c.splitlines(True)} for c in CELLS]}}
        ns = load_definitions(self._write(doc))
        self.assertEqual(ns["add_one"](1), 2)
        self.assertEqual(ns["TARGET"], "dbo.example")

    def test_ipynb_format(self):
        doc = {"cells": [{"cell_type": "code", "source": c} for c in CELLS]}
        self.assertEqual(load_definitions(self._write(doc))["add_one"](2), 3)


if __name__ == "__main__":
    unittest.main()
