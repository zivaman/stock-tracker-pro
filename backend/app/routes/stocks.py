from fastapi import APIRouter, HTTPException, Query
from ..services.stock_service import get_stock_analysis, get_stock_news, get_stock_info
import yfinance as yf
import numpy as np

router = APIRouter(prefix="/stock", tags=["stocks"])


@router.get("/{symbol}")
def get_stock_detail(symbol: str):
    symbol = symbol.upper().strip()
    data = get_stock_analysis(symbol)
    if "error" in data and "symbol" not in data:
        raise HTTPException(status_code=404, detail=data["error"])
    return data


@router.get("/{symbol}/news")
def get_news(symbol: str):
    symbol = symbol.upper().strip()
    news = get_stock_news(symbol)
    return {"symbol": symbol, "news": news}


@router.get("/{symbol}/info")
def get_info(symbol: str):
    symbol = symbol.upper().strip()
    info = get_stock_info(symbol)
    return info


@router.get("/{symbol}/intraday")
def get_intraday(symbol: str, interval: str = Query(default="1h", regex="^(15m|30m|1h)$")):
    """Return intraday OHLCV data. interval: 15m (7d), 30m (60d), 1h (60d)."""
    symbol = symbol.upper().strip()
    period_map = {"15m": "7d", "30m": "60d", "1h": "60d"}
    period = period_map.get(interval, "7d")

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        if df.empty:
            raise HTTPException(status_code=404, detail=f"אין נתוני {interval} עבור {symbol}")

        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()

        # Compute SMA on intraday (shorter windows)
        df["SMA20"] = df["Close"].rolling(20).mean()
        df["SMA50"] = df["Close"].rolling(50).mean()

        result = []
        for ts, row in df.iterrows():
            def rv(v):
                try:
                    f = float(v)
                    return None if np.isnan(f) else round(f, 4)
                except Exception:
                    return None

            result.append({
                "date": ts.strftime("%Y-%m-%d %H:%M"),
                "open":  rv(row["Open"]),
                "high":  rv(row["High"]),
                "low":   rv(row["Low"]),
                "close": rv(row["Close"]),
                "volume": int(row["Volume"]) if not np.isnan(float(row["Volume"])) else 0,
                "sma20":  rv(row["SMA20"]),
                "sma50":  rv(row["SMA50"]),
                "sma200": None,
                "bb_upper": None,
                "bb_lower": None,
                "rsi": None,
                "macd": None,
                "macd_signal": None,
                "macd_hist": None,
            })

        return {"symbol": symbol, "interval": interval, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
