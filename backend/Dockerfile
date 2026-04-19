# syntax=docker/dockerfile:1.7
# =========================================================
# TrustLayer backend — FastAPI + SQLite + cryptography
# =========================================================
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Pakiety systemowe: fonty (dla seed'u zdjęć), libjpeg dla Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
        libjpeg62-turbo \
        libopenjp2-7 \
        fonts-dejavu-core \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# =========================================================
# Stage: deps — cache'owane osobno dla szybkich rebuildów
# =========================================================
FROM base AS deps

COPY requirements.txt .
RUN pip install -r requirements.txt

# =========================================================
# Stage: dev — z hot-reload, wolumenem bind-mount do /app
# =========================================================
FROM deps AS dev

# Tryb deweloperski: kod leci z bind-mountu przez compose.
# Uvicorn watcha pliki .py i sam restartuje serwer.
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--reload", \
     "--reload-dir", "/app/app"]

# =========================================================
# Stage: prod — kod kopiowany, bez reloada, bez dev-deps
# =========================================================
FROM deps AS prod

COPY app ./app

# Non-root user dla produkcji
RUN useradd -r -u 1000 -m trustlayer \
    && mkdir -p /app/app/demo_data \
    && chown -R trustlayer:trustlayer /app
USER trustlayer

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--access-log"]
