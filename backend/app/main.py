from fastapi import FastAPI

from app.api.auth import router as auth_router

app = FastAPI(
    title="Community Management System",
    version="1.0.0",
)

app.include_router(auth_router)


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}