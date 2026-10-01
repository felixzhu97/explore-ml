import uvicorn

import config


def main() -> int:
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
