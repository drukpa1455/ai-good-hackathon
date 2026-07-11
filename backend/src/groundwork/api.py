from __future__ import annotations

import json
import logging
import os
import re
import secrets
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .agent_context import ContextTooLargeError, FullGraphContextProvider
from .contracts import (
    AgentContextPacket,
    AgentContextRequest,
    AgentRuntimeConfig,
    ApiError,
    ContextGraph,
    EvidenceRecord,
    PublicRuntimeConfig,
    SiteSummary,
)
from .repository import InvalidFocusError, JsonReleaseRepository, NotFoundError

RequestIdFactory = Callable[[], str]
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,80}$")
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class BackendSettings:
    release_dir: Path
    static_dir: Path | None
    git_sha: str = "unknown"
    function_token: str = ""
    agent_enabled: bool = False
    agent_script_url: str | None = None
    agent_id: str | None = None
    chatbot_id: str | None = None
    agent_name: str = "Groundwork SF"
    agent_starting_message: str = (
        "Ask about one of the three demo sites. I will inspect its evidence graph first."
    )
    agent_primary_color: str = "#5b4bc4"
    agent_secondary_color: str = "#1a1822"
    agent_button_background_color: str = "#5b4bc4"

    @classmethod
    def from_env(cls) -> BackendSettings:
        root = Path(__file__).resolve().parents[3]
        static_value = os.getenv("STATIC_DIR", str(root / "web" / "dist"))
        return cls(
            release_dir=Path(os.getenv("GRAPH_RELEASE_DIR", root / "data/releases/demo-v1")),
            static_dir=Path(static_value) if static_value else None,
            git_sha=os.getenv("GIT_SHA", "unknown"),
            function_token=os.getenv("FUNCTION_TO_APP_TOKEN", ""),
            agent_enabled=_env_bool("AGENT_ENABLED"),
            agent_script_url=os.getenv("AGENT_SCRIPT_URL"),
            agent_id=os.getenv("AGENT_ID"),
            chatbot_id=os.getenv("AGENT_CHATBOT_ID"),
            agent_name=os.getenv("AGENT_NAME", "Groundwork SF"),
            agent_starting_message=os.getenv(
                "AGENT_STARTING_MESSAGE",
                "Ask about one of the three demo sites. I will inspect its evidence graph first.",
            ),
            agent_primary_color=os.getenv("AGENT_PRIMARY_COLOR", "#5b4bc4"),
            agent_secondary_color=os.getenv("AGENT_SECONDARY_COLOR", "#1a1822"),
            agent_button_background_color=os.getenv("AGENT_BUTTON_BACKGROUND_COLOR", "#5b4bc4"),
        )


def create_app(
    settings: BackendSettings | None = None,
    request_id_factory: RequestIdFactory | None = None,
) -> FastAPI:
    settings = settings or BackendSettings.from_env()
    request_id_factory = request_id_factory or (lambda: f"req-{uuid.uuid4().hex[:16]}")
    repository = JsonReleaseRepository.load(settings.release_dir)
    context_provider = FullGraphContextProvider(repository)

    app = FastAPI(title="Groundwork SF Context API", version="0.1.0")

    @app.middleware("http")
    async def request_ids(request: Request, call_next):
        supplied = request.headers.get("x-request-id", "")
        request.state.request_id = (
            supplied if REQUEST_ID_PATTERN.fullmatch(supplied) else request_id_factory()
        )
        started_at = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-ID"] = request.state.request_id
            return response
        finally:
            logger.info(
                json.dumps(
                    {
                        "duration_ms": round((time.perf_counter() - started_at) * 1_000, 1),
                        "event": "request_complete",
                        "graph_release_id": repository.release_id,
                        "method": request.method,
                        "packet_sha256": getattr(request.state, "packet_sha256", None),
                        "path": request.url.path,
                        "request_id": request.state.request_id,
                        "status_code": status_code,
                    },
                    separators=(",", ":"),
                    sort_keys=True,
                )
            )

    @app.exception_handler(NotFoundError)
    async def not_found(request: Request, error: NotFoundError) -> JSONResponse:
        return _api_error(request, 404, "not_found", str(error))

    @app.exception_handler(InvalidFocusError)
    async def invalid_focus(request: Request, error: InvalidFocusError) -> JSONResponse:
        return _api_error(request, 400, "invalid_focus", str(error))

    @app.exception_handler(ContextTooLargeError)
    async def context_too_large(request: Request, error: ContextTooLargeError) -> JSONResponse:
        return _api_error(request, 413, "context_too_large", str(error))

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, _error: RequestValidationError) -> JSONResponse:
        return _api_error(request, 400, "unavailable", "Invalid request payload")

    @app.get("/healthz")
    def health() -> dict[str, str | bool]:
        return {
            "status": "ok",
            "git_sha": settings.git_sha,
            "graph_release_id": repository.release_id,
            "data_mode": "api",
            "mock": repository.mock,
        }

    @app.get("/api/runtime-config", response_model=PublicRuntimeConfig)
    def runtime_config() -> PublicRuntimeConfig:
        complete = all((settings.agent_script_url, settings.agent_id, settings.chatbot_id))
        return PublicRuntimeConfig(
            data_mode="api",
            agent=AgentRuntimeConfig(
                enabled=settings.agent_enabled and complete,
                script_url=settings.agent_script_url,
                agent_id=settings.agent_id,
                chatbot_id=settings.chatbot_id,
                name=settings.agent_name,
                starting_message=settings.agent_starting_message,
                primary_color=settings.agent_primary_color,
                secondary_color=settings.agent_secondary_color,
                button_background_color=settings.agent_button_background_color,
            ),
        )

    @app.get("/api/sites", response_model=list[SiteSummary])
    def list_sites() -> list[SiteSummary]:
        return repository.list_sites()

    @app.get("/api/sites/{parcel_id}/context", response_model=ContextGraph)
    def get_context(parcel_id: str, focus: str = "overview") -> ContextGraph:
        return repository.get_context(parcel_id, focus)

    @app.get("/api/evidence/{evidence_id}", response_model=EvidenceRecord)
    def get_evidence(evidence_id: str) -> EvidenceRecord:
        return repository.get_evidence(evidence_id)

    @app.post("/internal/agent/context", response_model=AgentContextPacket)
    def get_agent_context(
        body: AgentContextRequest,
        request: Request,
        authorization: str | None = Header(default=None),
    ) -> AgentContextPacket:
        if not settings.function_token:
            raise ServiceUnavailableError("Agent context route is not configured")
        scheme, _, token = (authorization or "").partition(" ")
        if scheme.lower() != "bearer" or not secrets.compare_digest(token, settings.function_token):
            raise UnauthorizedError("Invalid Function credential")
        packet = context_provider.retrieve(body.site, body.focus, body.question)
        request.state.packet_sha256 = packet.packet_sha256
        return packet

    @app.exception_handler(UnauthorizedError)
    async def unauthorized(request: Request, error: UnauthorizedError) -> JSONResponse:
        return JSONResponse(
            status_code=401,
            content={"detail": str(error), "request_id": request.state.request_id},
            headers={"WWW-Authenticate": "Bearer"},
        )

    @app.exception_handler(ServiceUnavailableError)
    async def unavailable(request: Request, error: ServiceUnavailableError) -> JSONResponse:
        return _api_error(request, 503, "unavailable", str(error))

    _mount_frontend(app, settings.static_dir)
    return app


class UnauthorizedError(ValueError):
    pass


class ServiceUnavailableError(RuntimeError):
    pass


def _api_error(
    request: Request,
    status_code: int,
    code: str,
    message: str,
) -> JSONResponse:
    error = ApiError(code=code, message=message, request_id=request.state.request_id)
    return JSONResponse(status_code=status_code, content=error.model_dump(mode="json"))


def _mount_frontend(app: FastAPI, static_dir: Path | None) -> None:
    if static_dir is None or not static_dir.is_dir():
        return
    root = static_dir.resolve()
    assets = root / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{requested_path:path}", include_in_schema=False)
    def frontend(requested_path: str):
        if requested_path == "api" or requested_path.startswith(("api/", "internal/")):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = (root / requested_path).resolve()
        if candidate.is_relative_to(root) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(root / "index.html")


def _env_bool(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


app = create_app()
