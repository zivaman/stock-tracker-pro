import yfinance as yf
import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, List
from .technical_analysis import calculate_indicators, compute_signal, get_support_resistance
import datetime


def safe_val(v):
    """Convert numpy/pandas types to Python native, handling NaN."""
    if v is None:
        return None
    if isinstance(v, float) and np.isnan(v):
        return None
    if hasattr(v, "item"):
        return v.item()
    return v


def get_stock_info(symbol: str) -> Dict[str, Any]:
    """Fetch company info from yfinance."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        return {
            "symbol": symbol.upper(),
            "name": info.get("longName") or info.get("shortName", symbol),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "description": info.get("longBusinessSummary", ""),
            "market_cap": safe_val(info.get("marketCap")),
            "pe_ratio": safe_val(info.get("trailingPE")),
            "dividend_yield": safe_val(info.get("dividendYield")),
            "beta": safe_val(info.get("beta")),
            "52w_high": safe_val(info.get("fiftyTwoWeekHigh")),
            "52w_low": safe_val(info.get("fiftyTwoWeekLow")),
            "avg_volume": safe_val(info.get("averageVolume")),
            "website": info.get("website", ""),
            "country": info.get("country", ""),
            "currency": info.get("currency", "USD"),
        }
    except Exception as e:
        return {"symbol": symbol.upper(), "name": symbol, "error": str(e)}


def get_historical_data(symbol: str, period: str = "1y") -> pd.DataFrame:
    """Fetch historical OHLCV data."""
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period)
    if df.empty:
        return df
    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
    df.index = pd.to_datetime(df.index)
    # Remove timezone info
    if df.index.tz is not None:
        df.index = df.index.tz_localize(None)
    return df


def get_current_price(symbol: str) -> Optional[float]:
    """Get latest price."""
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="2d")
        if df.empty:
            return None
        return float(df["Close"].iloc[-1])
    except Exception:
        return None


def get_stock_analysis(symbol: str) -> Dict[str, Any]:
    """Full technical analysis for a stock."""
    try:
        df = get_historical_data(symbol, period="2y")
        if df.empty or len(df) < 50:
            return {"error": "Insufficient data"}

        df = calculate_indicators(df)
        signal_data = compute_signal(df)
        sr = get_support_resistance(df)

        latest = df.iloc[-1]
        current_price = float(latest["Close"])

        # Price history for chart (last 1 year)
        chart_df = df.tail(252).copy()
        price_history = []
        for ts, row in chart_df.iterrows():
            price_history.append({
                "date": ts.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
                "sma20": round(float(row["SMA20"]), 2) if not np.isnan(row["SMA20"]) else None,
                "sma50": round(float(row["SMA50"]), 2) if not np.isnan(row["SMA50"]) else None,
                "sma200": round(float(row["SMA200"]), 2) if not np.isnan(row["SMA200"]) else None,
                "bb_upper": round(float(row["BB_Upper"]), 2) if not np.isnan(row["BB_Upper"]) else None,
                "bb_lower": round(float(row["BB_Lower"]), 2) if not np.isnan(row["BB_Lower"]) else None,
                "rsi": round(float(row["RSI"]), 1) if not np.isnan(row.get("RSI", float("nan"))) else None,
                "macd": round(float(row["MACD"]), 4) if not np.isnan(row.get("MACD", float("nan"))) else None,
                "macd_signal": round(float(row["MACD_Signal"]), 4) if not np.isnan(row.get("MACD_Signal", float("nan"))) else None,
                "macd_hist": round(float(row["MACD_Hist"]), 4) if not np.isnan(row.get("MACD_Hist", float("nan"))) else None,
            })

        # Performance
        def pct_change(days):
            if len(df) < days + 1:
                return None
            start_price = float(df["Close"].iloc[-(days + 1)])
            return round((current_price - start_price) / start_price * 100, 2)

        info = get_stock_info(symbol)

        return {
            "symbol": symbol.upper(),
            "name": info.get("name", symbol),
            "current_price": round(current_price, 2),
            "info": info,
            "signal": signal_data,
            "support_resistance": sr,
            "price_history": price_history,
            "performance": {
                "1d": pct_change(1),
                "5d": pct_change(5),
                "1m": pct_change(21),
                "3m": pct_change(63),
                "6m": pct_change(126),
                "1y": pct_change(252),
            },
        }
    except Exception as e:
        return {"error": str(e), "symbol": symbol}


def get_stock_news(symbol: str) -> List[Dict]:
    """Fetch latest news from yfinance."""
    try:
        ticker = yf.Ticker(symbol)
        news = ticker.news or []
        result = []
        for item in news[:8]:
            result.append({
                "title": item.get("title", ""),
                "publisher": item.get("publisher", ""),
                "link": item.get("link", ""),
                "published": item.get("providerPublishTime", 0),
            })
        return result
    except Exception:
        return []
