import yfinance as yf
import pandas as pd
import numpy as np
from typing import List, Dict, Any
from .technical_analysis import calculate_indicators, compute_signal
from .stock_service import safe_val, get_current_price
import logging

logger = logging.getLogger(__name__)

# US-only curated universe for medium-risk investor
SCAN_UNIVERSE = [
    # US Tech - Large Cap
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "AMD", "CRM", "ORCL", "INTC",
    # US Finance
    "JPM", "GS", "MS", "V", "MA", "BAC",
    # US Healthcare
    "JNJ", "PFE", "ABBV", "MRK", "UNH",
    # US Consumer / Retail
    "WMT", "COST", "MCD", "NKE",
    # US Energy
    "XOM", "CVX",
    # US Industrial / Entertainment / Other
    "DIS", "NFLX", "TSLA", "PYPL", "SBUX",
    # ETFs / Broad market
    "SPY", "QQQ", "IWM",
]

# Currency pairs to track (USD base for Israeli investor)
CURRENCY_PAIRS = {
    "USD/ILS": "ILS=X",       # Dollar → Shekel
    "EUR/USD": "EURUSD=X",    # Euro → Dollar
    "GBP/USD": "GBPUSD=X",    # Pound → Dollar
    "USD/JPY": "JPY=X",       # Dollar → Yen
    "BTC/USD": "BTC-USD",     # Bitcoin
    "ETH/USD": "ETH-USD",     # Ethereum
}


def score_stock(symbol: str) -> Dict[str, Any]:
    """Score a single stock based on technical analysis."""
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="1y")

        if df.empty or len(df) < 60:
            return None

        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
        if df.index.tz is not None:
            df.index = df.index.tz_localize(None)

        df = calculate_indicators(df)
        signal_data = compute_signal(df)

        info = ticker.info
        name = info.get("longName") or info.get("shortName", symbol)
        market_cap = safe_val(info.get("marketCap"))
        beta = safe_val(info.get("beta"))
        avg_vol = safe_val(info.get("averageVolume"))
        sector = info.get("sector", "N/A")
        currency = info.get("currency", "USD")

        # Filter: medium risk — skip micro-caps and extreme beta
        if market_cap and market_cap < 1_000_000_000:  # < $1B
            return None
        if beta and (beta < 0.3 or beta > 2.5):
            return None
        if avg_vol and avg_vol < 500_000:  # low liquidity
            return None

        latest = df.iloc[-1]
        current_price = float(latest["Close"])

        # 1-day and 5-day change
        day_chg = None
        week_chg = None
        if len(df) > 1:
            day_chg = round((float(df["Close"].iloc[-1]) - float(df["Close"].iloc[-2])) / float(df["Close"].iloc[-2]) * 100, 2)
        if len(df) > 5:
            week_chg = round((float(df["Close"].iloc[-1]) - float(df["Close"].iloc[-6])) / float(df["Close"].iloc[-6]) * 100, 2)

        # Hot signal: check for immediate opportunity
        hot_signal = None
        rsi = signal_data.get("rsi")
        macd_val = signal_data.get("macd")
        macd_sig_val = signal_data.get("macd_signal")
        if signal_data["signal"] == "strong_buy" and rsi and rsi < 40:
            hot_signal = f"RSI={rsi:.1f} — oversold + MACD חיובי. הזדמנות כניסה מיידית!"
        elif (macd_val and macd_sig_val and
              macd_val > macd_sig_val and
              abs(macd_val - macd_sig_val) < 0.05 * abs(macd_val)):
            hot_signal = "חציית MACD זה עתה — איתות חם! שקול כניסה"

        # Additional fundamental fields
        description = (info.get("longBusinessSummary", "") or "")[:200]
        pe_ratio = safe_val(info.get("trailingPE"))
        target_price = safe_val(info.get("targetMeanPrice"))
        analyst_rec = info.get("recommendationKey", "")
        analyst_count = safe_val(info.get("numberOfAnalystOpinions"))
        w52_high = safe_val(info.get("fiftyTwoWeekHigh"))
        w52_low = safe_val(info.get("fiftyTwoWeekLow"))
        avg_volume = safe_val(info.get("averageVolume"))
        volume = safe_val(info.get("volume"))

        # Period performance
        def _perf(n: int):
            try:
                if len(df) <= n:
                    return None
                return round((float(df["Close"].iloc[-1]) - float(df["Close"].iloc[-n])) / float(df["Close"].iloc[-n]) * 100, 2)
            except Exception:
                return None

        perf_1m = _perf(21)
        perf_3m = _perf(63)
        perf_6m = _perf(126)
        perf_1y = _perf(min(252, len(df) - 1)) if len(df) > 1 else None

        return {
            "symbol": symbol,
            "name": name,
            "sector": sector,
            "current_price": round(current_price, 2),
            "currency": "USD",
            "market_cap": market_cap,
            "beta": round(beta, 2) if beta else None,
            "score": signal_data["score"],
            "signal": signal_data["signal"],
            "rsi": signal_data.get("rsi"),
            "macd": signal_data.get("macd"),
            "macd_signal": signal_data.get("macd_signal"),
            "sma50": signal_data.get("sma50"),
            "sma200": signal_data.get("sma200"),
            "reasons": signal_data.get("reasons", []),
            "warnings": signal_data.get("warnings", []),
            "day_change": day_chg,
            "week_change": week_chg,
            "hot_signal": hot_signal,
            "description": description,
            "pe_ratio": pe_ratio,
            "target_price": target_price,
            "analyst_rec": analyst_rec,
            "analyst_count": analyst_count,
            "52w_high": w52_high,
            "52w_low": w52_low,
            "avg_volume": avg_volume,
            "volume": volume,
            "perf_1m": perf_1m,
            "perf_3m": perf_3m,
            "perf_6m": perf_6m,
            "perf_1y": perf_1y,
        }
    except Exception as e:
        logger.warning(f"Failed to score {symbol}: {e}")
        return None


def get_currency_rates() -> Dict[str, Any]:
    """Fetch current currency exchange rates relevant for US market investors."""
    rates = {}
    for label, ticker_sym in CURRENCY_PAIRS.items():
        try:
            t = yf.Ticker(ticker_sym)
            df = t.history(period="5d")
            if df.empty:
                continue
            current = float(df["Close"].iloc[-1])
            prev = float(df["Close"].iloc[-2]) if len(df) > 1 else current
            change_pct = (current - prev) / prev * 100
            # 1-month change
            df_1m = t.history(period="1mo")
            month_chg = None
            if len(df_1m) > 5:
                month_chg = round((float(df_1m["Close"].iloc[-1]) - float(df_1m["Close"].iloc[0])) / float(df_1m["Close"].iloc[0]) * 100, 2)

            rates[label] = {
                "rate": round(current, 4),
                "change_pct": round(change_pct, 3),
                "month_change": month_chg,
            }
        except Exception as e:
            logger.warning(f"Currency {label} failed: {e}")
    return rates


def run_scanner(top_n: int = 10) -> List[Dict[str, Any]]:
    """Scan all stocks and return top N by score."""
    results = []
    for symbol in SCAN_UNIVERSE:
        scored = score_stock(symbol)
        if scored:
            results.append(scored)

    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_n]


def check_portfolio_signals(symbols: List[str]) -> List[Dict[str, Any]]:
    """Check buy/sell signals for portfolio positions."""
    alerts = []
    for symbol in symbols:
        result = score_stock(symbol)
        if not result:
            continue
        signal = result.get("signal", "neutral")
        score = result.get("score", 0)
        hot = result.get("hot_signal")

        if signal in ("buy", "strong_buy") and score >= 50:
            msg = f"איתות קנייה חזק עבור {result['name']} — ציון {score}/100"
            if hot:
                msg += f" 🔥 {hot}"
            alerts.append({
                "symbol": symbol,
                "signal_type": "buy",
                "score": score,
                "price": result.get("current_price"),
                "message": msg,
                "hot_signal": hot,
                "reasons": result.get("reasons", []),
            })
        elif signal == "sell" or score < 15:
            alerts.append({
                "symbol": symbol,
                "signal_type": "sell",
                "score": score,
                "price": result.get("current_price"),
                "message": f"שקול מכירה של {result['name']} — ציון {score}/100",
                "hot_signal": None,
                "warnings": result.get("warnings", []),
            })
    return alerts
