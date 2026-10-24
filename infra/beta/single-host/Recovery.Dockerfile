FROM postgres:17-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends python3 age ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY infra/beta/recovery.py /opt/hse/recovery.py
ENTRYPOINT ["python3", "/opt/hse/recovery.py"]
