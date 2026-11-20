"""Errors the HTTP layer can turn into a JSON body."""


class DataEngineError(Exception):
    """A failure the caller can correct, or an upstream limit we should report."""

    def __init__(self, code: str, message: str, status_code: int = 400, **details):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details

    def to_dict(self) -> dict:
        body = {"error": self.code, "message": self.message}
        body.update(self.details)
        return body
