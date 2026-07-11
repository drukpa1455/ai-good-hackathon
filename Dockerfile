FROM node:22-bookworm-slim AS web-build

WORKDIR /app

COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci --no-audit --no-fund

COPY web ./web
COPY data ./data
ENV VITE_DATA_MODE=api
RUN cd web && npm run build

FROM ghcr.io/astral-sh/uv:0.11.28 AS uv

FROM python:3.13-slim AS runtime

COPY --from=uv /uv /uvx /bin/
WORKDIR /app

COPY backend ./backend
RUN uv sync --project backend --frozen --no-dev

COPY data ./data
COPY --from=web-build /app/web/dist ./web/dist

ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}
ENV GRAPH_RELEASE_DIR=/app/data/releases/demo-v1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV STATIC_DIR=/app/web/dist
ENV PATH=/app/backend/.venv/bin:${PATH}

RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8080
CMD ["uvicorn", "groundwork.api:app", "--host", "0.0.0.0", "--port", "8080"]
