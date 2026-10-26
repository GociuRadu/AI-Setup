# Build-time only: resolves the Delta and JDBC jars into the Ivy cache.
import os

from delta import configure_spark_with_delta_pip
from pyspark.sql import SparkSession

builder = SparkSession.builder.master("local[1]").config("spark.ui.enabled", "false")
extra = [p for p in os.environ.get("SPARK_EXTRA_PACKAGES", "").split(",") if p]
spark = configure_spark_with_delta_pip(builder, extra_packages=extra).getOrCreate()
spark.range(1).count()
spark.stop()
