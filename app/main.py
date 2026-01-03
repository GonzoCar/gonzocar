from fastapi import FastAPI

app = FastAPI(
    title="Gonzo Core",
    description="Backend system for GonzoFleet",
    version="0.1.0"
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
