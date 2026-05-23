from fastapi import FastAPI

from app.api.auth import router as auth_router
from app.api.communities import router as communities_router
from app.api.finances import router as finance_router
from app.api.roles import router as roles_router
from app.api.announcements import router as announcements_router

app = FastAPI(
    title="Community Management System",
    version="1.0.0",
)

app.include_router(auth_router)
app.include_router(communities_router)
app.include_router(finance_router)
app.include_router(roles_router)
app.include_router(announcements_router)


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}