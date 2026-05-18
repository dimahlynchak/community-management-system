from fastapi import FastAPI

app = FastAPI(
    title="Community Management System",
    version="1.0.0",
)


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}