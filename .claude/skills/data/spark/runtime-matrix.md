# Runtime compatibility matrix

| Synapse runtime | Spark | Java | Scala | Delta | Python | Status |
|---|---|---|---|---|---|---|
| Apache Spark 3.4 | 3.4 | - | - | - | - | support ended 2026-03-31; do not target |
| Apache Spark 3.5 | 3.5 | 17 | 2.12.18 | 3.2 | 3.11 or 3.10 (Microsoft docs disagree) | supported |

Local runner: `pyspark==3.5.*`, `delta-spark==3.2.*`, Java 17, Python 3.11. Local tests do not cover `mssparkutils`, linked services, Entra tokens, pipeline orchestration, Azure SQL limits or performance.

Read the pool values in one read-only DEV cell and record them:

```python
import sys
jvm = spark.sparkContext._jvm
print(spark.version, sys.version, jvm.java.lang.System.getProperty("java.version"),
      jvm.scala.util.Properties.versionNumberString())
driver = jvm.com.microsoft.sqlserver.jdbc.SQLServerDriver()
print("mssql-jdbc", driver.getMajorVersion(), driver.getMinorVersion())
spark.sql("DESCRIBE DETAIL delta.`<source path>`").select("minReaderVersion", "minWriterVersion").show()
```

The Delta library version is listed in the pool's runtime page and `spark.sparkContext.getConf().get("spark.jars", "")` when custom jars are added.
