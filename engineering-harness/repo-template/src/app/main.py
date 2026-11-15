"""Service entry point. Replace the example route with your own."""

import json
import logging
import os
import sys

from fastapi import FastAPI

APP_ENV = os.environ.get("APP_ENV", "local")


class JsonFormatter(logging.Formatter):
    """One JSON object per line, which Cloud Logging parses into fields."""

    def format(self, record: logging.LogRecord) -> str:
        return json.dumps(
            {
                "severity": record.levelname,
                "message": record.getMessage(),
                "logger": record.name,
            }
        )


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"), handlers=[handler], force=True)


configure_logging()
log = logging.getLogger("app")
app = FastAPI(title="service", docs_url=None if APP_ENV == "prod" else "/docs")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "env": APP_ENV}
