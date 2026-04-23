from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load .env from backend directory (two levels up from this file)
_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(_env_path)

from .database import create_tables
from .routes import portfolio, radar, stocks, ziv_index, chat, market, ai_insights

app = FastAPI(
    title="Stock Tracker API",
    description="מערכת מעקב מניות עם ניתוח טכני",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
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


@app.get("/")
def root():
    return {"status": "ok", "message": "Stock Tracker API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}
