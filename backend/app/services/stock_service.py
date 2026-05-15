import yfinance as yf
import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, List
from .technical_analysis import calculate_indicators, compute_signal, get_support_resistance, compute_fibonacci
import datetime


def safe_val(v):
    if v is None:
        return None
    if isinstance(v, float) and np.isnan(v):
        return None
    if hasattr(v, "item"):
        return v.item()
    return v


def get_stock_info(symbol: str) -> Dict[str, Any]:
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
            "forward_pe": safe_val(info.get("forwardPE")),
            "dividend_yield": safe_val(info.get("dividendYield")),
            "beta": safe_val(info.get("beta")),
            "52w_high": safe_val(info.get("fiftyTwoWeekHigh")),
            "52w_low": safe_val(info.get("fiftyTwoWeekLow")),
            "avg_volume": safe_val(info.get("averageVolume")),
            "website": info.get("website", ""),
            "country": info.get("country", ""),
            "currency": info.get("currency", "USD"),
            "employees": safe_val(info.get("fullTimeEmployees")),
            "revenue": safe_val(info.get("totalRevenue")),
            "revenue_growth": safe_val(info.get("revenueGrowth")),
            "gross_margins": safe_val(info.get("grossMargins")),
            "operating_margins": safe_val(info.get("operatingMargins")),
            "profit_margins": safe_val(info.get("profitMargins")),
            "ebitda": safe_val(info.get("ebitda")),
            "free_cashflow": safe_val(info.get("freeCashflow")),
            "earnings_growth": safe_val(info.get("earningsGrowth")),
            "recommendation": info.get("recommendationKey", ""),
            "target_price": safe_val(info.get("targetMeanPrice")),
            "analyst_count": safe_val(info.get("numberOfAnalystOpinions")),
            "short_ratio": safe_val(info.get("shortRatio")),
            "held_percent_institutions": safe_val(info.get("heldPercentInstitutions")),
            # ── Extended fundamentals ──
            "forward_pe":      safe_val(info.get("forwardPE")),
            "peg_ratio":       safe_val(info.get("pegRatio")),
            "price_to_book":   safe_val(info.get("priceToBook")),
            "return_on_equity": safe_val(info.get("returnOnEquity")),
            "return_on_assets": safe_val(info.get("returnOnAssets")),
            "debt_to_equity":  safe_val(info.get("debtToEquity")),
            "current_ratio":   safe_val(info.get("currentRatio")),
            "quick_ratio":     safe_val(info.get("quickRatio")),
            "eps_ttm":         safe_val(info.get("trailingEps")),
            "eps_forward":     safe_val(info.get("forwardEps")),
            "price_to_sales":  safe_val(info.get("priceToSalesTrailing12Months")),
            "ev_to_ebitda":    safe_val(info.get("enterpriseToEbitda")),
            "payout_ratio":    safe_val(info.get("payoutRatio")),
            "book_value":      safe_val(info.get("bookValue")),
        }
    except Exception as e:
        return {"symbol": symbol.upper(), "name": symbol, "error": str(e)}


def get_price_ranges(df: pd.DataFrame) -> Dict[str, Any]:
    """Calculate High/Low ranges for 52W, 1M, 1W, 1D."""
    if df.empty:
        return {}

    now = df.index[-1]

    def hl(days):
        sub = df[df.index >= now - pd.Timedelta(days=days)]
        if sub.empty:
            return None, None
        return round(float(sub["Low"].min()), 2), round(float(sub["High"].max()), 2)

    # 52 week
    lo_52w, hi_52w = hl(365)
    # 1 month
    lo_1m, hi_1m = hl(30)
    # 1 week
    lo_1w, hi_1w = hl(7)
    # today (last trading day)
    today_row = df.iloc[-1]
    lo_1d = round(float(today_row["Low"]), 2)
    hi_1d = round(float(today_row["High"]), 2)

    current = round(float(df["Close"].iloc[-1]), 2)
    # position within 52w range (0=low, 100=high)
    pos_52w = None
    if hi_52w and lo_52w and hi_52w != lo_52w:
        pos_52w = round((current - lo_52w) / (hi_52w - lo_52w) * 100, 1)

    return {
        "52w": {"low": lo_52w, "high": hi_52w},
        "1m":  {"low": lo_1m,  "high": hi_1m},
        "1w":  {"low": lo_1w,  "high": hi_1w},
        "1d":  {"low": lo_1d,  "high": hi_1d},
        "position_52w": pos_52w,
    }


def get_rule_of_40(info: Dict) -> Optional[Dict]:
    """Calculate Rule of 40 = Revenue Growth % + Operating Margin %."""
    rev_growth = info.get("revenue_growth")
    op_margin = info.get("operating_margins")
    if rev_growth is None or op_margin is None:
        return None
    rg_pct = round(rev_growth * 100, 1)
    om_pct = round(op_margin * 100, 1)
    score = round(rg_pct + om_pct, 1)
    return {
        "revenue_growth_pct": rg_pct,
        "operating_margin_pct": om_pct,
        "score": score,
        "rating": "מצוין" if score >= 40 else "טוב" if score >= 20 else "חלש",
        "pass": score >= 40,
    }


def get_company_details(symbol: str, info: Dict) -> Dict[str, Any]:
    """Build rich company detail block: key events, recent news factors."""
    try:
        ticker = yf.Ticker(symbol)
        news_raw = ticker.news or []

        # Upcoming earnings date
        cal = None
        try:
            cal = ticker.calendar
        except Exception:
            pass

        next_earnings = None
        if cal is not None and not (isinstance(cal, dict) and not cal):
            try:
                if hasattr(cal, 'columns') and 'Earnings Date' in cal.columns:
                    ed = cal['Earnings Date'].iloc[0] if not cal.empty else None
                    if ed is not None:
                        next_earnings = str(ed)
            except Exception:
                pass

        # Key financial metrics
        rev = info.get("revenue")
        rev_str = None
        if rev:
            if rev >= 1e9:
                rev_str = f"${rev/1e9:.1f}B"
            elif rev >= 1e6:
                rev_str = f"${rev/1e6:.0f}M"
            else:
                rev_str = f"${rev:,.0f}"

        fcf = info.get("free_cashflow")
        fcf_str = None
        if fcf:
            fcf_str = f"${fcf/1e9:.1f}B" if abs(fcf) >= 1e9 else f"${fcf/1e6:.0f}M"

        # Recent news as key factors
        factors = []
        for item in news_raw[:6]:
            title = item.get("title", "")
            if title:
                factors.append({
                    "title": title,
                    "publisher": item.get("publisher", ""),
                    "link": item.get("link", ""),
                    "published": item.get("providerPublishTime", 0),
                })

        # Analyst consensus
        rec = info.get("recommendation", "")
        target = info.get("target_price")
        analyst_count = info.get("analyst_count")

        rec_map = {
            "strongBuy": "קנייה חזקה",
            "buy": "קנייה",
            "hold": "החזק",
            "sell": "מכירה",
            "strongSell": "מכירה חזקה",
        }

        return {
            "revenue_str": rev_str,
            "free_cashflow_str": fcf_str,
            "next_earnings": next_earnings,
            "analyst_consensus": rec_map.get(rec, rec),
            "analyst_target": round(target, 2) if target else None,
            "analyst_count": analyst_count,
            "key_factors": factors,
            "gross_margin_pct": round(info.get("gross_margins", 0) * 100, 1) if info.get("gross_margins") else None,
            "operating_margin_pct": round(info.get("operating_margins", 0) * 100, 1) if info.get("operating_margins") else None,
            "profit_margin_pct": round(info.get("profit_margins", 0) * 100, 1) if info.get("profit_margins") else None,
            "held_institutions_pct": round(info.get("held_percent_institutions", 0) * 100, 1) if info.get("held_percent_institutions") else None,
            "short_ratio": info.get("short_ratio"),
            "employees": info.get("employees"),
        }
    except Exception as e:
        return {"error": str(e)}


def get_historical_data(symbol: str, period: str = "1y") -> pd.DataFrame:
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period)
    if df.empty:
        return df
    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
    df.index = pd.to_datetime(df.index)
    if df.index.tz is not None:
        df.index = df.index.tz_localize(None)
    return df


def get_current_price(symbol: str) -> Optional[float]:
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="2d")
        if df.empty:
            return None
        return float(df["Close"].iloc[-1])
    except Exception:
        return None


def get_premarket_data(symbol: str) -> Optional[Dict]:
    """Fetch pre-market price and change if available."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        pre_price = safe_val(info.get("preMarketPrice"))
        prev_close = safe_val(info.get("regularMarketPreviousClose")) or safe_val(info.get("previousClose"))
        if pre_price and prev_close:
            chg = round((pre_price - prev_close) / prev_close * 100, 2)
            return {"price": pre_price, "change_pct": chg, "prev_close": prev_close}
        return None
    except Exception:
        return None


def get_stock_analysis(symbol: str) -> Dict[str, Any]:
    try:
        df = get_historical_data(symbol, period="2y")
        if df.empty or len(df) < 50:
            return {"error": "Insufficient data"}

        df_ind = calculate_indicators(df)
        # Pass P/E for fundamental scoring
        raw_info = yf.Ticker(symbol).info
        pe_ratio = safe_val(raw_info.get("trailingPE"))
        fundamentals = {
            "forward_pe":       safe_val(raw_info.get("forwardPE")),
            "peg_ratio":        safe_val(raw_info.get("pegRatio")),
            "price_to_book":    safe_val(raw_info.get("priceToBook")),
            "earnings_growth":  safe_val(raw_info.get("earningsGrowth")),
            "revenue_growth":   safe_val(raw_info.get("revenueGrowth")),
            "profit_margins":   safe_val(raw_info.get("profitMargins")),
            "operating_margins":safe_val(raw_info.get("operatingMargins")),
            "return_on_equity": safe_val(raw_info.get("returnOnEquity")),
            "return_on_assets": safe_val(raw_info.get("returnOnAssets")),
            "debt_to_equity":   safe_val(raw_info.get("debtToEquity")),
            "current_ratio":    safe_val(raw_info.get("currentRatio")),
            "eps_ttm":          safe_val(raw_info.get("trailingEps")),
            "eps_forward":      safe_val(raw_info.get("forwardEps")),
        }
        signal_data = compute_signal(df_ind, pe_ratio=pe_ratio, fundamentals=fundamentals)
        fibonacci = compute_fibonacci(df_ind)
        sr = get_support_resistance(df_ind)
        price_ranges = get_price_ranges(df)

        latest = df_ind.iloc[-1]
        current_price = float(latest["Close"])

        # Chart data (last 1 year)
        chart_df = df_ind.tail(252).copy()
        price_history = []
        for ts, row in chart_df.iterrows():
            def r(v):
                return round(float(v), 2) if not np.isnan(float(v)) else None
            price_history.append({
                "date": ts.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
                "sma20":  r(row.get("SMA20", float("nan"))),
                "sma50":  r(row.get("SMA50", float("nan"))),
                "sma150": r(row.get("SMA150", float("nan"))),
                "sma200": r(row.get("SMA200", float("nan"))),
                "bb_upper": r(row.get("BB_Upper", float("nan"))),
                "bb_lower": r(row.get("BB_Lower", float("nan"))),
                "rsi":      r(row.get("RSI", float("nan"))),
                "macd":     round(float(row.get("MACD", 0)), 4) if not np.isnan(float(row.get("MACD", float("nan")))) else None,
                "macd_signal": round(float(row.get("MACD_Signal", 0)), 4) if not np.isnan(float(row.get("MACD_Signal", float("nan")))) else None,
                "macd_hist":   round(float(row.get("MACD_Hist", 0)), 4) if not np.isnan(float(row.get("MACD_Hist", float("nan")))) else None,
            })

        # Last 7 trading days (for weekly panel in UI)
        week_df = df.tail(7)
        avg_vol_20d = float(df["Volume"].tail(20).mean())
        week_data = []
        for ts, row in week_df.iterrows():
            wclose = float(row["Close"])
            wprev_idx = df.index.get_loc(ts) - 1
            wprev = float(df["Close"].iloc[wprev_idx]) if wprev_idx >= 0 else wclose
            week_data.append({
                "date":       ts.strftime("%Y-%m-%d"),
                "open":       round(float(row["Open"]), 2),
                "close":      round(wclose, 2),
                "high":       round(float(row["High"]), 2),
                "low":        round(float(row["Low"]), 2),
                "volume":     int(row["Volume"]),
                "change_pct": round((wclose - wprev) / wprev * 100, 2) if wprev else 0,
                "above_avg":  int(row["Volume"]) > avg_vol_20d,
            })

        def pct_change(days):
            if len(df) < days + 1:
                return None
            start = float(df["Close"].iloc[-(days + 1)])
            return round((current_price - start) / start * 100, 2)

        info = get_stock_info(symbol)
        rule40 = get_rule_of_40(info)
        company_details = get_company_details(symbol, info)
        premarket = get_premarket_data(symbol)

        return {
            "symbol": symbol.upper(),
            "name": info.get("name", symbol),
            "current_price": round(current_price, 2),
            "info": info,
            "signal": signal_data,
            "fibonacci": fibonacci,
            "support_resistance": sr,
            "price_ranges": price_ranges,
            "price_history": price_history,
            "rule_of_40": rule40,
            "company_details": company_details,
            "premarket": premarket,
            "performance": {
                "1d": pct_change(1),
                "5d": pct_change(5),
                "1m": pct_change(21),
                "3m": pct_change(63),
                "6m": pct_change(126),
                "1y": pct_change(252),
            },
            "week_data":       week_data,
            "avg_volume_20d":  round(avg_vol_20d),
        }
    except Exception as e:
        return {"error": str(e), "symbol": symbol}


def get_stock_news(symbol: str) -> List[Dict]:
    try:
        ticker = yf.Ticker(symbol)
        news = ticker.news or []
        return [
            {
                "title": item.get("title", ""),
                "publisher": item.get("publisher", ""),
                "link": item.get("link", ""),
                "published": item.get("providerPublishTime", 0),
            }
            for item in news[:8]
        ]
    except Exception:
        return []
