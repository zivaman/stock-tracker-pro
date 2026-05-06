from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import os

# Load .env from backend directory (two levels up from this file)
_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(_env_path, override=True)

from .database import create_tables
from .routes import portfolio, radar, stocks, ziv_index, chat, market, ai_insights, settings

app = FastAPI(
    title="Stock Tracker API",
    description="מערכת מעקב מניות עם ניתוח טכני",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    create_tables()
    print("✅ Database initialized")


app.include_router(portfolio.router)
app.include_router(radar.router)
app.include_router(stocks.router)
app.include_router(ziv_index.router)
app.include_router(chat.router)
app.include_router(market.router)
app.include_router(ai_insights.router)
app.include_router(settings.router)


@app.get("/health")
def health():
    return {"status": "healthy"}


# ── Serve React frontend (production build) ──
_dist = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
if os.path.isdir(_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        """Catch-all: serve index.html for all non-API routes (React Router)."""
        index = os.path.join(_dist, "index.html")
        return FileResponse(index)
