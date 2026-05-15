from fastapi import APIRouter
from typing import Optional
import yfinance as yf
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

router = APIRouter(prefix="/market", tags=["market"])
logger = logging.getLogger(__name__)

# ── Sector stock lists ──────────────────────────────────────────────
SECTOR_STOCKS = {
    "שבבים 🔲": {
        "emoji": "🔲",
        "color": "#3b82f6",
        "symbols": ["NVDA", "AMD", "INTC", "QCOM", "AVGO", "TSM", "ASML", "LRCX", "AMAT", "KLAC", "MRVL", "ON", "TXN", "NXPI", "WOLF"],
    },
    "מעבדים ⚡": {
        "emoji": "⚡",
        "color": "#8b5cf6",
        "symbols": ["NVDA", "AMD", "INTC", "ARM", "QCOM", "MRVL", "AMZN", "GOOGL", "AAPL"],
    },
    "זכרונות 💾": {
        "emoji": "💾",
        "color": "#06b6d4",
        "symbols": ["MU", "WDC", "STX", "KIOXIA", "NAND"],
    },
    "פוטוניקה 💡": {
        "emoji": "💡",
        "color": "#f59e0b",
        "symbols": ["IPGP", "COHR", "VIAV", "LITE", "AAOI", "NPTN", "IIVI", "II-VI"],
    },
    "נחושת 🟤": {
        "emoji": "🟤",
        "color": "#b45309",
        "symbols": ["FCX", "SCCO", "BHP", "RIO", "TECK", "HBM", "ERO", "CMCLF"],
    },
    "AI & ענן ☁️": {
        "emoji": "☁️",
        "color": "#00c896",
        "symbols": ["NVDA", "MSFT", "GOOGL", "AMZN", "META", "ORCL", "CRM", "NOW", "SNOW", "PLTR"],
    },
    "אנרגיה ירוקה 🌱": {
        "emoji": "🌱",
        "color": "#22c55e",
        "symbols": ["ENPH", "SEDG", "FSLR", "RUN", "PLUG", "BE", "BLDP", "CHPT", "BLNK"],
    },
    "ביו-טכנולוגיה 🧬": {
        "emoji": "🧬",
        "color": "#ec4899",
        "symbols": ["MRNA", "BNTX", "REGN", "GILD", "BIIB", "VRTX", "ALNY", "SGEN", "RARE"],
    },
}


def _fetch_stock_snapshot(symbol: str) -> Optional[dict]:
    """Fetch key metrics for a single stock."""
    try:
        tk = yf.Ticker(symbol)
        hist = tk.history(period="1y")
        if hist.empty or len(hist) < 5:
            return None

        price = float(hist["Close"].iloc[-1])
        prev  = float(hist["Close"].iloc[-2])
        high_52w = float(hist["High"].max())
        low_52w  = float(hist["Low"].min())
        vol   = float(hist["Volume"].iloc[-1])
        avg_vol = float(hist["Volume"].tail(20).mean())

        pct_from_high = round((price / high_52w - 1) * 100, 1)
        pct_from_low  = round((price / low_52w  - 1) * 100, 1)
        change_1d     = round((price / prev - 1) * 100, 2)
        change_1m     = round((price / float(hist["Close"].iloc[-21]) - 1) * 100, 1) if len(hist) >= 21 else None
        change_3m     = round((price / float(hist["Close"].iloc[-63]) - 1) * 100, 1) if len(hist) >= 63 else None

        info = tk.fast_info
        mkt_cap = getattr(info, "market_cap", None)
        name    = getattr(info, "company_long_name", symbol) or symbol

        # ── Last 5 trading days (week) price + volume ──
        week = hist.tail(5)
        week_prices  = [round(float(v), 2) for v in week["Close"].tolist()]
        week_volumes = [int(v)             for v in week["Volume"].tolist()]

        # ── Trend signal: price direction × volume conviction ──
        price_up = week_prices[-1] > week_prices[0] if len(week_prices) >= 2 else True
        prev_vol_avg = float(hist["Volume"].iloc[-10:-5].mean()) if len(hist) >= 10 else avg_vol
        vol_up = float(hist["Volume"].tail(5).mean()) > prev_vol_avg if prev_vol_avg > 0 else True

        if   price_up and vol_up:      trend_signal = "bullish"
        elif price_up and not vol_up:  trend_signal = "weak_up"
        elif not price_up and vol_up:  trend_signal = "bearish"
        else:                          trend_signal = "weak_down"

        return {
            "symbol":        symbol,
            "name":          name[:30],
            "price":         round(price, 2),
            "change_1d":     change_1d,
            "change_1m":     change_1m,
            "change_3m":     change_3m,
            "high_52w":      round(high_52w, 2),
            "low_52w":       round(low_52w,  2),
            "pct_from_high": pct_from_high,
            "pct_from_low":  pct_from_low,
            "volume":        int(vol),
            "avg_volume":    int(avg_vol),
            "vol_ratio":     round(vol / avg_vol, 2) if avg_vol > 0 else 1,
            "market_cap":    int(mkt_cap) if mkt_cap else None,
            "week_prices":   week_prices,
            "week_volumes":  week_volumes,
            "trend_signal":  trend_signal,
        }
    except Exception as e:
        logger.debug(f"Snapshot failed {symbol}: {e}")
        return None


def _fetch_sector_batch(symbols: list[str]) -> list[dict]:
    results = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(_fetch_stock_snapshot, s): s for s in symbols}
        for f in as_completed(futures):
            r = f.result()
            if r:
                results.append(r)
    results.sort(key=lambda x: x.get("market_cap") or 0, reverse=True)
    return results

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


@router.get("/vix")
def get_vix_fast():
    """Lightweight VIX endpoint — current value + 7-day channel for sparkline."""
    try:
        df = yf.Ticker("^VIX").history(period="10d")
        if df.empty or len(df) < 2:
            return {"value": None}
        closes = [round(float(v), 2) for v in df["Close"].tail(7).tolist()]
        val    = closes[-1]
        prev   = closes[-2] if len(closes) > 1 else val
        change = round((val - prev) / prev * 100, 2)
        trend_5d = round((closes[-1] - closes[0]) / closes[0] * 100, 2) if len(closes) > 1 else 0

        if   val < 15: label, color = "שאנן מאוד",    "#00c896"
        elif val < 20: label, color = "שאנן",          "#3b82f6"
        elif val < 25: label, color = "חוסר וודאות",  "#a78bfa"
        elif val < 30: label, color = "חרדה",          "#f59e0b"
        elif val < 40: label, color = "פחד",           "#f97316"
        else:          label, color = "פחד קיצוני",   "#f04060"

        return {
            "value":     val,
            "change_pct": change,
            "trend_5d":  trend_5d,
            "channel":   closes,       # 7 days for sparkline
            "label":     label,
            "color":     color,
        }
    except Exception as e:
        logger.warning(f"VIX fast failed: {e}")
        return {"value": None}


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


@router.get("/sectors")
def get_sector_stocks():
    """Fetch stock data for all predefined sector lists + attractive screener."""
    # Collect all unique symbols
    all_symbols = list({s for sec in SECTOR_STOCKS.values() for s in sec["symbols"]})
    all_data: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=12) as ex:
        futures = {ex.submit(_fetch_stock_snapshot, s): s for s in all_symbols}
        for f in as_completed(futures):
            r = f.result()
            if r:
                all_data[r["symbol"]] = r

    # Build per-sector result
    result = {}
    for sector_name, cfg in SECTOR_STOCKS.items():
        stocks = [all_data[s] for s in cfg["symbols"] if s in all_data]
        stocks.sort(key=lambda x: x.get("market_cap") or 0, reverse=True)
        result[sector_name] = {
            "emoji": cfg["emoji"],
            "color": cfg["color"],
            "stocks": stocks,
        }

    # Attractive screener: price ≥30% below 52w high, across ALL symbols
    attractive = [
        s for s in all_data.values()
        if s.get("pct_from_high") is not None and s["pct_from_high"] <= -25
    ]
    attractive.sort(key=lambda x: x["pct_from_high"])

    return {
        "sectors": result,
        "attractive": attractive,
    }
