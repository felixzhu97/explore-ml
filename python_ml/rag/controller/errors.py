"""Map domain errors to HTTP responses with a `detail` body."""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from domain.errors import (
    InvalidRequestError,
    NotFoundError,
    ServiceUnavailableError,
    UpstreamError,
)


def register_exception_handlers(app: FastAPI) -> None:
    def respond(status_code: int, detail: str) -> JSONResponse:
        return JSONResponse(status_code=status_code, content={"detail": detail})

    @app.exception_handler(InvalidRequestError)
    async def invalid_request(_request: Request, error: InvalidRequestError) -> JSONResponse:
        return respond(status.HTTP_400_BAD_REQUEST, str(error))

    @app.exception_handler(NotFoundError)
    async def not_found(_request: Request, error: NotFoundError) -> JSONResponse:
        return respond(status.HTTP_404_NOT_FOUND, str(error))

    @app.exception_handler(ServiceUnavailableError)
    async def service_unavailable(
        _request: Request, error: ServiceUnavailableError
    ) -> JSONResponse:
        return respond(status.HTTP_503_SERVICE_UNAVAILABLE, str(error))

    @app.exception_handler(UpstreamError)
    async def upstream_failed(_request: Request, error: UpstreamError) -> JSONResponse:
        return respond(error.status_code, error.detail)
