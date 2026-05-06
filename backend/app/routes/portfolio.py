from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import datetime
import yfinance as yf
from ..database import get_db, PortfolioPosition, Notification
from ..services.stock_service import get_current_price, get_historical_data
from ..services.technical_analysis import calculate_indicators, compute_signal
import numpy as np

# Simple in-process sector cache (avoids re-fetching on every portfolio load)
_sector_cache: dict = {}

def get_sector(symbol: str) -> str:
    if symbol in _sector_cache:
        return _sector_cache[symbol]
    try:
        info = yf.Ticker(symbol).info
        sector = info.get("sector") or "אחר"
        _sector_cache[symbol] = sector
        return sector
    except Exception:
        return "אחר"

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


class AddPositionRequest(BaseModel):
    symbol: str
    name: Optional[str] = None
    buy_price: float
    buy_date: str  # ISO date string YYYY-MM-DD
    quantity: float


@router.get("")
def get_portfolio(db: Session = Depends(get_db)):
    positions = db.query(PortfolioPosition).all()
    result = []
    for p in positions:
        current_price = get_current_price(p.symbol)
        if current_price is None:
            current_price = p.buy_price

        invested = p.buy_price * p.quantity
        current_value = current_price * p.quantity
        pnl = current_value - invested
        pnl_pct = (current_price - p.buy_price) / p.buy_price * 100

        # Performance since buy date
        performance = {}
        try:
            df = get_historical_data(p.symbol, period="2y")
            if not df.empty:
                buy_dt = datetime.datetime.strptime(p.buy_date, "%Y-%m-%d")
                # Align to nearest available date
                df_since = df[df.index >= buy_dt]
                if not df_since.empty:
                    buy_close = float(df_since["Close"].iloc[0])
                    cur = float(df["Close"].iloc[-1])

                    def pct(days):
                        if len(df) < days + 1:
                            return None
                        return round((cur - float(df["Close"].iloc[-(days + 1)])) / float(df["Close"].iloc[-(days + 1)]) * 100, 2)

                    performance = {
                        "since_buy": round((cur - buy_close) / buy_close * 100, 2),
                        "1d": pct(1),
                        "1w": pct(5),
                        "1m": pct(21),
                        "3m": pct(63),
                        "6m": pct(126),
                        "1y": pct(252),
                    }
        except Exception:
            pass

        # Technical Analysis for this position
        ta = {}
        try:
            df_ta = get_historical_data(p.symbol, period="1y")
            if not df_ta.empty and len(df_ta) >= 60:
                df_ta = df_ta[["Open", "High", "Low", "Close", "Volume"]].copy()
                if df_ta.index.tz is not None:
                    df_ta.index = df_ta.index.tz_localize(None)
                df_ta = calculate_indicators(df_ta)
                sig_data = compute_signal(df_ta)
                ta = {
                    "score": sig_data.get("score"),
                    "signal": sig_data.get("signal"),
                    "buy_signal": sig_data.get("buy_signal", False),
                    "sell_signal": sig_data.get("sell_signal", False),
                    "rsi": sig_data.get("rsi"),
                    "macd": sig_data.get("macd"),
                    "macd_signal": sig_data.get("macd_signal"),
                    "sma50": sig_data.get("sma50"),
                    "sma200": sig_data.get("sma200"),
                    "bb_upper": sig_data.get("bb_upper"),
                    "bb_lower": sig_data.get("bb_lower"),
                    "stoch_k": sig_data.get("stoch_k"),
                    "reasons": sig_data.get("reasons", []),
                    "warnings": sig_data.get("warnings", []),
                }
        except Exception:
            pass

        result.append({
            "id": p.id,
            "symbol": p.symbol,
            "name": p.name,
            "sector": get_sector(p.symbol),
            "buy_price": p.buy_price,
            "buy_date": p.buy_date,
            "quantity": p.quantity,
            "current_price": round(current_price, 2),
            "invested": round(invested, 2),
            "current_value": round(current_value, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "performance": performance,
            "ta": ta,
        })

    # Portfolio summary
    total_invested = sum(p["invested"] for p in result)
    total_value = sum(p["current_value"] for p in result)
    total_pnl = total_value - total_invested
    total_pnl_pct = (total_pnl / total_invested * 100) if total_invested > 0 else 0

    return {
        "positions": result,
        "summary": {
            "total_invested": round(total_invested, 2),
            "total_value": round(total_value, 2),
            "total_pnl": round(total_pnl, 2),
            "total_pnl_pct": round(total_pnl_pct, 2),
            "num_positions": len(result),
        },
    }


@router.post("/add")
def add_position(req: AddPositionRequest, db: Session = Depends(get_db)):
    symbol = req.symbol.upper().strip()
    existing = db.query(PortfolioPosition).filter(PortfolioPosition.symbol == symbol).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"המניה {symbol} כבר קיימת בתיק")

    # Validate date
    try:
        datetime.datetime.strptime(req.buy_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="תאריך לא תקין. השתמש בפורמט YYYY-MM-DD")

    name = req.name or symbol
    position = PortfolioPosition(
        symbol=symbol,
        name=name,
        buy_price=req.buy_price,
        buy_date=req.buy_date,
        quantity=req.quantity,
    )
    db.add(position)
    db.commit()
    db.refresh(position)
    return {"message": f"מניה {symbol} נוספה לתיק בהצלחה", "id": position.id}


@router.delete("/{symbol}")
def remove_position(symbol: str, db: Session = Depends(get_db)):
    symbol = symbol.upper()
    position = db.query(PortfolioPosition).filter(PortfolioPosition.symbol == symbol).first()
    if not position:
        raise HTTPException(status_code=404, detail=f"המניה {symbol} לא נמצאה בתיק")
    db.delete(position)
    db.commit()
    return {"message": f"מניה {symbol} הוסרה מהתיק"}
