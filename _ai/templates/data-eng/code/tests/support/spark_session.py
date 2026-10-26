"""One shared local SparkSession for the Spark tier (Delta enabled, small and fast)."""
import os
from functools import lru_cache


@lru_cache(maxsize=1)
def get_spark():
    from delta import configure_spark_with_delta_pip
    from pyspark.sql import SparkSession

    builder = (
        SparkSession.builder.master("local[2]")
        .appName("{{project}}-tests")
        .config("spark.driver.memory", os.environ.get("SPARK_DRIVER_MEMORY", "2g"))
        .config("spark.sql.shuffle.partitions", "2")
        .config("spark.ui.enabled", "false")
        .config("spark.sql.session.timeZone", "UTC")
        .config("spark.sql.warehouse.dir", "/tmp/spark-warehouse")
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
    )
    extra = [p for p in os.environ.get("SPARK_EXTRA_PACKAGES", "").split(",") if p]
    return configure_spark_with_delta_pip(builder, extra_packages=extra).getOrCreate()
