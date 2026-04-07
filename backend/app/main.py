from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import create_tables
from .routes import portfolio, radar, stocks

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


@app.get("/")
def root():
    return {"status": "ok", "message": "Stock Tracker API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}
