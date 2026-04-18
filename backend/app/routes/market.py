from fastapi import APIRouter
import yfinance as yf
import logging

router = APIRouter(prefix="/market", tags=["market"])
logger = logging.getLogger(__name__)

INDICES = {
    "S&P 500":  "^GSPC",
    "NASDAQ":   "^IXIC",
    "Dow Jones":"^DJI",
    "Russell 2000": "IWM",
}

SECTORS = {
    "טכנולוגיה":    "XLK",
    "פיננסים":      "XLF",
    "בריאות":       "XLV",
    "אנרגיה":       "XLE",
    "תעשייה":       "XLI",
    "צרכנות מחזורית": "XLY",
    "צרכנות בסיסית": "XLP",
    "נדל\"ן":       "XLRE",
    "כלים":         "XLU",
}


def _fetch_perf(symbol: str):
    try:
        df = yf.Ticker(symbol).history(period="3mo")
        if df.empty or len(df) < 2:
            return None
        cur = float(df["Close"].iloc[-1])
        prev = float(df["Close"].iloc[-2])

        def pct(n):
            if len(df) <= n:
                return None
            return round((cur - float(df["Close"].iloc[-n])) / float(df["Close"].iloc[-n]) * 100, 2)

        return {
            "price": round(cur, 2),
            "1d": pct(1),
            "1w": pct(5),
            "1m": pct(21),
        }
    except Exception as e:
        logger.warning(f"Failed {symbol}: {e}")
        return None


def _fetch_vix():
    try:
        df = yf.Ticker("^VIX").history(period="5d")
        if df.empty:
            return None
        val = float(df["Close"].iloc[-1])
        prev = float(df["Close"].iloc[-2]) if len(df) > 1 else val
        change = round((val - prev) / prev * 100, 2)

        if val < 15:
            label = "שאננות קיצונית"
            color = "#00c896"
        elif val < 20:
            label = "שאנן"
            color = "#3b82f6"
        elif val < 30:
            label = "חרדה מתונה"
            color = "#f59e0b"
        elif val < 40:
            label = "פחד"
            color = "#f97316"
        else:
            label = "פחד קיצוני"
            color = "#f04060"

        return {
            "value": round(val, 2),
            "change_pct": change,
            "label": label,
            "color": color,
            "interpretation": (
                "VIX מתחת ל-20: שוק רגוע, סיכון נמוך. "
                "VIX 20-30: חוסר וודאות. "
                "VIX מעל 30: פחד בשוק — לעתים הזדמנות לרכישה בזול."
            ),
        }
    except Exception as e:
        logger.warning(f"VIX failed: {e}")
        return None


@router.get("/overview")
def get_market_overview():
    vix = _fetch_vix()

    indices = {}
    for name, sym in INDICES.items():
        data = _fetch_perf(sym)
        if data:
            indices[name] = data

    sectors = {}
    for name, sym in SECTORS.items():
        data = _fetch_perf(sym)
        if data:
            sectors[name] = {**data, "symbol": sym}

    # Best/worst sectors
    sector_1d = [(k, v["1d"]) for k, v in sectors.items() if v.get("1d") is not None]
    sector_1d.sort(key=lambda x: x[1], reverse=True)

    return {
        "vix": vix,
        "indices": indices,
        "sectors": sectors,
        "best_sector": sector_1d[0] if sector_1d else None,
        "worst_sector": sector_1d[-1] if sector_1d else None,
    }
