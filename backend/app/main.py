from fastapi import FastAPI

from app.api.auth import router as auth_router
from app.api.communities import router as communities_router
from app.api.finance import router as finance_router


app = FastAPI(
    title="Community Management System",
    version="1.0.0",
)

app.include_router(auth_router)
app.include_router(communities_router)
app.include_router(finance_router)

@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}