# Local runner matching the Synapse Spark 3.5 runtime: Python 3.11, Java 17, Spark 3.5, Delta 3.2
FROM python:3.11-slim-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jre-headless ca-certificates libltdl7 \
 && rm -rf /var/lib/apt/lists/*
# Arch-neutral JAVA_HOME (amd64 and arm64)
RUN ln -s "/usr/lib/jvm/java-17-openjdk-$(dpkg --print-architecture)" /usr/lib/jvm/java-17
ENV JAVA_HOME=/usr/lib/jvm/java-17

# Optional company root CAs (local/runner/hostca/*.crt) for TLS-inspecting proxies
COPY --from=hostca . /usr/local/share/ca-certificates/host/
RUN update-ca-certificates \
 && for c in /usr/local/share/ca-certificates/host/*.crt; do \
      [ -f "$c" ] && keytool -importcert -noprompt -cacerts -storepass changeit -alias "$(basename "$c")" -file "$c"; \
    done; true
ENV PIP_CERT=/etc/ssl/certs/ca-certificates.crt \
    REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Download Delta and JDBC jars at build time so tests run offline; keep in sync with the pool's mssql-jdbc
ENV SPARK_EXTRA_PACKAGES=com.microsoft.sqlserver:mssql-jdbc:12.8.1.jre11
COPY warm_spark.py /opt/warm_spark.py
RUN python /opt/warm_spark.py

WORKDIR /workspace
