import unittest

from tests.support.sql_test_db import apply_ddl, check_target, connect


class SqlGuardTest(unittest.TestCase):
    def test_refuses_remote_host(self):
        with self.assertRaises(RuntimeError):
            check_target("<server>.database.windows.net", "{{project}}_test")

    def test_refuses_non_test_database(self):
        with self.assertRaises(RuntimeError):
            check_target("sqlserver", "{{PROJECT}}")

    def test_local_container_accepts_ddl(self):
        conn = connect()
        apply_ddl(conn)
        cur = conn.cursor()
        cur.execute("SELECT 1")
        self.assertEqual(cur.fetchone()[0], 1)
        conn.close()


if __name__ == "__main__":
    unittest.main()
