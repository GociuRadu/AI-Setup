import tempfile
import unittest

from pyspark.testing import assertDataFrameEqual

from tests.support.spark_session import get_spark


class SparkSmokeTest(unittest.TestCase):
    def test_delta_round_trip(self):
        spark = get_spark()
        df = spark.createDataFrame([("A1", 1), ("B2", 2)], "key string, qty int")
        path = tempfile.mkdtemp() + "/smoke"
        df.write.format("delta").save(path)
        assertDataFrameEqual(spark.read.format("delta").load(path), df)


if __name__ == "__main__":
    unittest.main()
