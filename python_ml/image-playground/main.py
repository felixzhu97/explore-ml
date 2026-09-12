from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
from api import router

app = FastAPI(title="Image Playground API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=config.HOST, port=config.PORT)
