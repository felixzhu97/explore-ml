"""Domain errors mapped to HTTP status codes by the controller layer."""


class NotFoundError(Exception):
    """A requested resource does not exist."""


class InvalidRequestError(ValueError):
    """Input breaks a domain rule (unsupported file, empty upload, ...)."""


class ServiceUnavailableError(Exception):
    """A required backing service (LLM, vector store) cannot answer."""


class UpstreamError(Exception):
    """An upstream HTTP source answered with an error status."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
