"""Explore ML entrypoint — every module on one port: `uvicorn main:app --port 8000`."""

import logging

import config
from server import create_app

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=config.HOST, port=config.PORT)
