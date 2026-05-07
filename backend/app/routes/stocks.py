from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from ..services.stock_service import get_stock_analysis, get_stock_news, get_stock_info
import yfinance as yf
import numpy as np
import pandas as pd
import requests
import re
import xml.etree.ElementTree as ET
from typing import Optional, List, Dict, Any
import logging
import os
import json
import anthropic

logger = logging.getLogger(__name__)

# ── Known major SEC filers (CIK → display name) ──
MAJOR_FILERS: Dict[str, str] = {
    "0000102909": "Vanguard Group",
    "0000093751": "State Street",
    "0000315066": "Fidelity (FMR)",
    "0000019617": "JPMorgan Chase",
    "0001067983": "Berkshire Hathaway",
    "0001418009": "ARK Investment",
    "0001350694": "Bridgewater Associates",
    "0001037389": "Renaissance Technologies",
    "0001423298": "Citadel Advisors",
    "0001649339": "Coatue Management",
}
_SEC_HEADERS = {"User-Agent": "StockTracker research@example.com"}
_13F_NS = "http://www.sec.gov/edgar/document/thirteenf/informationtable"


def _classify_action(pct_change: Optional[float]) -> str:
    """Classify institutional action from quarter-over-quarter % change."""
    if pct_change is None:
        return "maintained"
    if pct_change >= 500:
        return "new_position"
    if pct_change >= 10:
        return "significantly_increased"
    if pct_change > 1:
        return "increased"
    if pct_change >= -1:
        return "maintained"
    if pct_change >= -10:
        return "decreased"
    return "significantly_decreased"


def _action_label(action: str) -> str:
    return {
        "new_position":             "🆕 פוזיציה חדשה",
        "significantly_increased":  "🚀 הגדיל משמעותית",
        "increased":                "▲ הגדיל",
        "maintained":               "● שמר",
        "decreased":                "▼ הקטין",
        "significantly_decreased":  "⚠ הקטין משמעותית",
    }.get(action, "●")


def _get_latest_13f_acc(cik: str) -> Optional[Dict]:
    """Fetch the latest 13F-HR accession number and date for a given CIK."""
    try:
        r = requests.get(
            f"https://data.sec.gov/submissions/CIK{cik}.json",
            headers=_SEC_HEADERS, timeout=8
        )
        if not r.ok:
            return None
        d = r.json()
        recent = d.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        dates = recent.get("filingDate", [])
        accs  = recent.get("accessionNumber", [])
        periods = recent.get("reportDate", [])
        for i, f in enumerate(forms):
            if f == "13F-HR":
                return {
                    "acc":    accs[i],
                    "date":   dates[i],
                    "period": periods[i] if i < len(periods) else "",
                    "cik":    cik.lstrip("0"),
                }
        return None
    except Exception:
        return None


def _parse_13f_for_names(cik: str, acc: str, search_names: List[str]) -> Optional[Dict]:
    """
    Fetch & parse 13F XML for a filer, return holdings matching any of search_names.
    search_names: list of uppercase strings to match against nameOfIssuer.
    Returns total shares held (summed across all sub-accounts).
    """
    try:
        acc_nd = acc.replace("-", "")
        idx_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc_nd}/"
        r = requests.get(idx_url, headers=_SEC_HEADERS, timeout=8)
        if not r.ok:
            return None

        files = re.findall(r'href="(/Archives/edgar/data/[^"]+\.xml)"', r.text, re.I)
        xml_file = next((f for f in files if "primary" not in f.lower()), None) or (files[0] if files else None)
        if not xml_file:
            return None

        r2 = requests.get(f"https://www.sec.gov{xml_file}", headers=_SEC_HEADERS, timeout=30)
        if not r2.ok:
            return None

        root = ET.fromstring(r2.content)
        rows = list(root.iter(f"{{{_13F_NS}}}infoTable"))
        if not rows:
            rows = list(root.iter("infoTable"))

        total_shares = 0
        total_value_k = 0
        matched_name = ""
        for h in rows:
            def g(tag: str) -> str:
                el = h.find(f"{{{_13F_NS}}}{tag}") or h.find(tag)
                return (el.text or "").strip() if el is not None else ""

            issuer = g("nameOfIssuer").upper()
            if not any(s.upper() in issuer for s in search_names):
                continue
            matched_name = g("nameOfIssuer")
            # Shares
            sha_block = h.find(f"{{{_13F_NS}}}shrsOrPrnAmt") or h.find("shrsOrPrnAmt")
            if sha_block is not None:
                ss = sha_block.find(f"{{{_13F_NS}}}sshPrnamt") or sha_block.find("sshPrnamt")
                if ss is not None and ss.text:
                    try:
                        total_shares += int(ss.text.strip().replace(",", ""))
                    except ValueError:
                        pass
            # Value (thousands USD)
            val_str = g("value").replace(",", "")
            if val_str.isdigit():
                total_value_k += int(val_str)

        if total_shares == 0:
            return None
        return {
            "name":       matched_name,
            "shares":     total_shares,
            "value_usd":  total_value_k * 1000,
        }
    except Exception as e:
        logger.debug(f"parse 13F error for CIK {cik}: {e}")
        return None

router = APIRouter(prefix="/stock", tags=["stocks"])


@router.get("/search")
def search_symbols(q: str = Query(..., min_length=1)):
    """Search for stock symbols by name or ticker using Yahoo Finance."""
    q = q.strip()
    if not q:
        return []
    try:
        results = yf.Search(q, max_results=10)
        quotes = results.quotes or []
        out = []
        for item in quotes:
            qtype = item.get("quoteType", "")
            if qtype not in ("EQUITY", "ETF", "MUTUALFUND"):
                continue
            symbol = item.get("symbol", "")
            if not symbol:
                continue
            out.append({
                "symbol":   symbol,
                "name":     item.get("longname") or item.get("shortname", symbol),
                "exchange": item.get("exchDisp", ""),
                "type":     qtype,
                "sector":   item.get("sectorDisp", ""),
            })
        return out
    except Exception as e:
        return []


@router.get("/{symbol}/insider-recent")
def get_insider_recent(symbol: str, days: int = Query(default=90)):
    """
    Returns recent insider transactions (Form 4) for the last N days.
    Handles multiple yfinance column-name variants gracefully.
    """
    symbol = symbol.upper().strip()
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.insider_transactions
        if df is None or df.empty:
            return {"symbol": symbol, "transactions": [], "summary": {
                "total_txs": 0, "sales_count": 0, "purchase_count": 0,
                "total_sold_usd": 0, "total_bought_usd": 0, "net_sentiment": "neutral"
            }}

        cols = list(df.columns)

        # ── Normalize column names across yfinance versions ──
        def col(candidates: list) -> str | None:
            for c in candidates:
                if c in cols: return c
            return None

        date_col     = col(["Start Date", "Date", "startDate", "date"])
        insider_col  = col(["Insider", "insider", "Insider Trading"])
        position_col = col(["Position", "position", "Relationship"])
        shares_col   = col(["Shares", "shares", "#Shares", "Shares Traded"])
        value_col    = col(["Value", "value", "Value ($)", "Transaction Value"])
        text_col     = col(["Text", "text", "Transaction", "Transaction Description"])
        url_col      = col(["URL", "url", "SEC Form 4", "Sec Form 4"])
        ownership_col= col(["Ownership", "ownership", "Owner Type"])

        # ── Filter by date ──
        if date_col:
            try:
                df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
                cutoff = pd.Timestamp.now(tz=df[date_col].dt.tz) if df[date_col].dt.tz else pd.Timestamp.now()
                cutoff = cutoff - pd.Timedelta(days=days)
                df = df[df[date_col] >= cutoff].copy()
            except Exception:
                pass  # if date parsing fails, return all rows

        def classify_tx(text: str) -> str:
            t = str(text).lower()
            if "sale" in t or "sell" in t:        return "sale"
            if "purchase" in t or "buy" in t:     return "purchase"
            if "exercise" in t or "option" in t:  return "option_exercise"
            if "award" in t or "grant" in t:      return "award"
            if "gift" in t or "donation" in t:    return "gift"
            return "other"

        def safe_int(v) -> int:
            try: return int(float(str(v).replace(",", "").replace("$", "")))
            except: return 0

        def safe_str(v) -> str:
            s = str(v)
            return "" if s in ("nan", "None", "NaN") else s

        def safe_date(v) -> str:
            try:
                return pd.Timestamp(v).strftime("%Y-%m-%d")
            except:
                return str(v)[:10]

        txs = []
        for _, row in df.iterrows():
            text     = safe_str(row.get(text_col, "")) if text_col else ""
            insider  = safe_str(row.get(insider_col, "")) if insider_col else ""
            position = safe_str(row.get(position_col, "")) if position_col else ""
            shares   = safe_int(row.get(shares_col, 0)) if shares_col else 0
            value    = safe_int(row.get(value_col,  0)) if value_col else 0
            date_raw = row.get(date_col, "") if date_col else ""
            url      = safe_str(row.get(url_col, "")) if url_col else ""
            ownership= safe_str(row.get(ownership_col, "")) if ownership_col else ""

            kind  = classify_tx(text)
            price = round(value / shares, 2) if shares > 0 and value > 0 else 0

            txs.append({
                "insider":   insider,
                "position":  position,
                "kind":      kind,
                "label":     {"sale":"מכירה","purchase":"קנייה","option_exercise":"מימוש אופציה","award":"הקצאה","gift":"מתנה"}.get(kind,"אחר"),
                "shares":    shares,
                "value":     value,
                "price":     price,
                "text":      text[:100],
                "date":      safe_date(date_raw),
                "ownership": ownership,
                "url":       url,
            })

        # Sort newest first
        txs.sort(key=lambda t: t["date"], reverse=True)

        sales     = [t for t in txs if t["kind"] == "sale"]
        purchases = [t for t in txs if t["kind"] == "purchase"]
        total_sold   = sum(t["value"] for t in sales)
        total_bought = sum(t["value"] for t in purchases)

        # Cluster unique insiders
        unique_buyers  = len({t["insider"] for t in purchases})
        unique_sellers = len({t["insider"] for t in sales})

        return {
            "symbol":        symbol,
            "period_days":   days,
            "transactions":  txs,
            "summary": {
                "total_txs":        len(txs),
                "sales_count":      len(sales),
                "purchase_count":   len(purchases),
                "total_sold_usd":   total_sold,
                "total_bought_usd": total_bought,
                "unique_buyers":    unique_buyers,
                "unique_sellers":   unique_sellers,
                "net_sentiment":    "bullish" if total_bought > total_sold else "bearish" if total_sold > total_bought else "neutral",
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/institutional")
def get_institutional(symbol: str, edgar: bool = Query(default=False)):
    """
    Returns:
    - Institutional 13F holders (Yahoo Finance) with Q/Q change classification
    - Mutual fund holders
    - Major summary (% held)
    - Price + volume trend (90 days)
    - Smart money signals (buyers vs sellers ranking)
    - Optional: SEC EDGAR direct parse for top 5 filers (edgar=true)
    """
    symbol = symbol.upper().strip()
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}

        # ── Helper: safe row value ──
        def _safe_float(v) -> Optional[float]:
            try:
                f = float(v)
                return None if np.isnan(f) else f
            except Exception:
                return None

        def _parse_holder_row(row: pd.Series, df: pd.DataFrame) -> Dict:
            pct_chg_raw = _safe_float(row.get("pctChange")) if "pctChange" in df.columns else None
            pct_chg = round(pct_chg_raw * 100, 2) if pct_chg_raw is not None else None
            action   = _classify_action(pct_chg)
            return {
                "holder":      str(row.get("Holder", row.get("holder", "?"))),
                "shares":      int(row.get("Shares", row.get("shares", 0))),
                "value":       float(row.get("Value", row.get("value", 0))),
                "pct_held":    round(float(row.get("pctHeld", row.get("pct_held", 0))) * 100, 3),
                "pct_change":  pct_chg,
                "action":      action,
                "action_label": _action_label(action),
                "date":        str(row.get("Date Reported", row.get("dateReported", "")))[:10],
            }

        # ── Institutional holders ──
        inst_df: Optional[pd.DataFrame] = ticker.institutional_holders
        inst_list = []
        if inst_df is not None and not inst_df.empty:
            inst_list = [_parse_holder_row(row, inst_df) for _, row in inst_df.head(15).iterrows()]

        # ── Mutual fund holders ──
        mf_df: Optional[pd.DataFrame] = ticker.mutualfund_holders
        mf_list = []
        if mf_df is not None and not mf_df.empty:
            mf_list = [_parse_holder_row(row, mf_df) for _, row in mf_df.head(10).iterrows()]

        # ── Major holders summary ──
        major: Dict[str, Any] = {}
        mh_df: Optional[pd.DataFrame] = ticker.major_holders
        if mh_df is not None and not mh_df.empty:
            try:
                # yfinance returns: index=Breakdown, col[0]="Value"  (single-column)
                # OR older: col[0]=value, col[1]=label  (two-column)
                if len(mh_df.columns) >= 2:
                    mh = mh_df.set_index(mh_df.columns[1])[mh_df.columns[0]].to_dict()
                else:
                    # Single "Value" column, index is the key name
                    mh = mh_df.iloc[:, 0].to_dict()
                def _pct(key):
                    v = mh.get(key)
                    try: return round(float(v) * 100, 2)
                    except: return None
                major = {
                    "insiders_pct":       _pct("insidersPercentHeld"),
                    "institutions_pct":   _pct("institutionsPercentHeld"),
                    "float_held_pct":     _pct("institutionsFloatPercentHeld"),
                    "institutions_count": int(float(mh.get("institutionsCount", 0))) if mh.get("institutionsCount") else None,
                }
            except Exception as ex:
                logger.debug(f"major_holders parse error: {ex}")

        # ── Smart money signals: rank buyers vs sellers ──
        all_holders = inst_list + mf_list
        buyers    = sorted([h for h in all_holders if h["pct_change"] is not None and h["pct_change"] > 1],
                            key=lambda h: h["pct_change"], reverse=True)[:8]
        sellers   = sorted([h for h in all_holders if h["pct_change"] is not None and h["pct_change"] < -1],
                            key=lambda h: h["pct_change"])[:5]
        new_pos   = [h for h in all_holders if h["action"] == "new_position"]

        # Sentiment score: % of holders that increased vs decreased
        changed = [h for h in all_holders if h["pct_change"] is not None and abs(h["pct_change"]) > 1]
        n_up    = len([h for h in changed if h["pct_change"] > 0])
        n_down  = len([h for h in changed if h["pct_change"] < 0])
        sentiment_score = round(n_up / len(changed) * 100) if changed else 50

        # ── Price + Volume trend (90 days) ──
        df = ticker.history(period="6mo")
        trend = []
        if not df.empty:
            avg_vol_20 = df["Volume"].rolling(20).mean()
            avg_vol_50 = df["Volume"].rolling(50).mean()
            for ts, row in df.tail(90).iterrows():
                date_str = ts.strftime("%Y-%m-%d") if hasattr(ts, "strftime") else str(ts)[:10]
                av20 = _safe_float(avg_vol_20.loc[ts])
                av50 = _safe_float(avg_vol_50.loc[ts])
                vol  = int(row["Volume"])
                close_f = float(row["Close"])
                open_f  = float(row["Open"])
                trend.append({
                    "date":      date_str,
                    "close":     round(close_f, 2),
                    "volume":    vol,
                    "vol_ma20":  round(av20, 0) if av20 else None,
                    "vol_ma50":  round(av50, 0) if av50 else None,
                    "up_day":    close_f >= open_f,
                    "vol_ratio": round(vol / av20, 2) if av20 and av20 > 0 else None,
                })

        # ── Optional: SEC EDGAR direct parse for top 5 major filers ──
        edgar_data = []
        if edgar:
            # Names to search in 13F XML (company name fragments)
            company_name = (info.get("longName") or info.get("shortName") or symbol).upper()
            search_terms = [symbol, company_name.split(" ")[0]]  # e.g. ["NVDA", "NVIDIA"]

            for cik, filer_name in list(MAJOR_FILERS.items())[:6]:
                acc_info = _get_latest_13f_acc(cik)
                if not acc_info:
                    continue
                result = _parse_13f_for_names(acc_info["cik"], acc_info["acc"], search_terms)
                edgar_data.append({
                    "filer":       filer_name,
                    "filing_date": acc_info["date"],
                    "period":      acc_info["period"],
                    "shares":      result["shares"] if result else 0,
                    "value_usd":   result["value_usd"] if result else 0,
                    "found":       result is not None,
                })

        return {
            "symbol":             symbol,
            "name":               info.get("longName") or info.get("shortName", symbol),
            "institutional":      inst_list,
            "mutual_funds":       mf_list,
            "major_summary":      major,
            "smart_money": {
                "buyers":          buyers,
                "sellers":         sellers,
                "new_positions":   new_pos,
                "sentiment_score": sentiment_score,
                "n_increased":     n_up,
                "n_decreased":     n_down,
                "n_maintained":    len(changed) - n_up - n_down if changed else 0,
            },
            "edgar_major_filers": edgar_data,
            "price_volume_trend": trend,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


# ── Institution profiles for richer AI context ──
_INST_PROFILES: Dict[str, str] = {
    "vanguard":    "קרן אינדקס פסיבית — שינויים נובעים בעיקר מאיזון מחדש של מדדים וגידול/ירידה בנכסים מנוהלים",
    "blackrock":   "מנהל הנכסים הגדול בעולם — מנהל גם קרנות פסיביות (iShares) וגם קרנות אקטיביות",
    "state street": "מנהל ETF גדול (SPDR) — שינויים לרוב מדדיים בהתאם לזרימות השקעה",
    "fidelity":    "חברת השקעות אקטיבית הגדולה בארה\"ב — כוללת קרנות ניהול אקטיבי ופסיבי",
    "jpmorgan":    "בנק השקעות — קרנות ניהול אקטיבי ואסטרטגיות מגוונות",
    "berkshire":   "חברת ורן באפט — השקעות ערך ארוכות טווח, מסרב לספקולציות",
    "ark":         "קרן גדות ווד — מתמחה בחברות טכנולוגיה מתפרצת וחדשנות מוסטת",
    "bridgewater": "קרן גידור מאקרו גלובלי של ריי דאליו — אסטרטגיות מאקרו-כלכליות",
    "renaissance": "קרן גידור כמותית של ג'ים סימונס — מודלים מתמטיים ואלגוריתמים",
    "citadel":     "קרן גידור רב-אסטרטגית של קן גריפין — אלגו, אקויטי ומאקרו",
    "coatue":      "קרן גידור טכנולוגיה-ממוקדת — מתמחה בחברות tech צמיחה",
    "norges":      "קרן הון ריבונית של נורווגיה — פסיבית ברובה, משקיעה בכ-9,000 חברות ברחבי העולם",
    "price":       "T. Rowe Price — חברת השקעות אקטיבית, מתמחה בצמיחה ארוכת טווח",
    "invesco":     "מנהל ETF (QQQ) וקרנות אקטיביות — שינויים ב-QQQ משקפים זרימות משקיעים",
}

def _get_inst_profile(name: str) -> str:
    name_lower = name.lower()
    for k, v in _INST_PROFILES.items():
        if k in name_lower:
            return v
    return "מוסד השקעות — פרטי הפרופיל המדויקים אינם זמינים"


class ExplainRequest(BaseModel):
    institution: str
    action: str
    pct_change: Optional[float] = None
    stock_name: str
    symbol: str
    sector: Optional[str] = ""
    shares: Optional[int] = 0
    value_usd: Optional[float] = 0
    pct_held: Optional[float] = 0
    date: Optional[str] = ""
    sentiment_score: Optional[int] = 50
    n_increased: Optional[int] = 0
    n_decreased: Optional[int] = 0


@router.post("/{symbol}/institutional/explain")
def explain_institutional_action(symbol: str, req: ExplainRequest):
    """
    Generate an AI-powered Hebrew explanation for why an institution
    increased / decreased / opened a position in this stock.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY לא מוגדר")

    profile   = _get_inst_profile(req.institution)
    action_he = {
        "new_position":            "פתח פוזיציה חדשה",
        "significantly_increased": "הגדיל משמעותית",
        "increased":               "הגדיל",
        "maintained":              "שמר על אחזקה",
        "decreased":               "הקטין",
        "significantly_decreased": "הקטין משמעותית",
    }.get(req.action, req.action)

    change_str = f"{req.pct_change:+.1f}%" if req.pct_change is not None else "לא ידוע"
    val_str = (
        f"${req.value_usd / 1e9:.2f}B" if req.value_usd and req.value_usd >= 1e9
        else f"${req.value_usd / 1e6:.0f}M" if req.value_usd and req.value_usd >= 1e6
        else f"${req.value_usd:,.0f}" if req.value_usd else "לא ידוע"
    )

    prompt = f"""אתה אנליסט מוסדי בכיר. הסבר בעברית מדוע {req.institution} {action_he} את אחזקתו ב-{req.stock_name} ({req.symbol}).

פרטי הפעולה:
- פעולה: {action_he}
- שינוי כמות: {change_str}
- שווי אחזקה: {val_str}
- אחוז מהמניה: {req.pct_held:.2f}%
- תאריך דיווח: {req.date or "לא ידוע"}
- סקטור: {req.sector or "לא ידוע"}

פרופיל המוסד:
{profile}

סנטימנט כלל המוסדיים על המניה:
- {req.n_increased} מוסדות הגדילו, {req.n_decreased} הקטינו (רבעון אחרון)

כתוב הסבר קצר ומקצועי (3-4 משפטים) בעברית:
1. מה מניע בדרך כלל מוסד מסוג זה לבצע פעולה כזו
2. מה עשוי לומר הדבר על תפיסתם את המניה
3. כיצד להתייחס לפעולה זו בהקשר של מוסד מסוג זה

חשוב: אל תיתן המלצת קנייה/מכירה נחרצת. ציין שהמידע מבוסס על דיווחי 13F בעיכוב של עד 45 יום."""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        return {"explanation": response.content[0].text, "institution": req.institution}
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="ANTHROPIC_API_KEY לא תקין")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════
#  POLYMARKET SENTIMENT
# ══════════════════════════════════════════════════════════
_POLY_HEADERS = {"User-Agent": "StockTracker research@example.com"}
_POLY_BASE    = "https://gamma-api.polymarket.com"

# Macro keywords → shown as market context regardless of stock
_MACRO_KW = [
    "recession", "fed ", "interest rate", "rate cut", "rate hike",
    "inflation", "gdp", "s&p 500", "nasdaq", "stock market crash",
    "bear market", "bull market", "unemployment", "tariff", "trade war",
]

def _poly_parse_list(raw) -> List[str]:
    """Parse a JSON-encoded list or plain list from Polymarket."""
    if isinstance(raw, str):
        try: raw = json.loads(raw)
        except: return []
    return [str(x) for x in raw] if raw else []

def _poly_prices(raw) -> List[float]:
    items = _poly_parse_list(raw)
    try: return [float(x) for x in items]
    except: return []

def _fetch_events(tag: str, limit: int = 100) -> List[Dict]:
    try:
        r = requests.get(
            f"{_POLY_BASE}/events",
            params={"tag_slug": tag, "active": "true", "limit": limit},
            headers=_POLY_HEADERS, timeout=8,
        )
        return r.json() if r.ok and isinstance(r.json(), list) else []
    except Exception:
        return []

def _market_is_resolved(prices: List[float]) -> bool:
    """A market is resolved when one price is 1.0 and others are 0."""
    return bool(prices) and any(abs(p - 1.0) < 0.001 for p in prices)

def _resolved_winner(outcomes: List[str], prices: List[float]) -> Optional[str]:
    for o, p in zip(outcomes, prices):
        if abs(p - 1.0) < 0.001:
            return o
    return None


@router.get("/{symbol}/polymarket")
def get_polymarket_sentiment(symbol: str, company: str = Query(default="")):
    """
    Fetch Polymarket prediction market data for a stock.
    Returns company-specific markets + relevant macro markets.
    """
    symbol = symbol.upper().strip()
    company_name = company.strip() or symbol

    # ── 1. Gather events from all relevant tags ──
    all_events: Dict[str, Dict] = {}
    for tag in ["stocks", "tech", "technology", "business", "finance", "economics"]:
        for e in _fetch_events(tag):
            all_events[e["id"]] = e

    # Also fetch top overall events (for macro/high-volume)
    try:
        r = requests.get(
            f"{_POLY_BASE}/events",
            params={"active": "true", "limit": 200, "order": "volume", "ascending": "false"},
            headers=_POLY_HEADERS, timeout=10,
        )
        if r.ok and isinstance(r.json(), list):
            for e in r.json():
                all_events[e["id"]] = e
    except Exception:
        pass

    events = list(all_events.values())

    # ── 2. Build search terms ──
    terms = [symbol]
    for word in company_name.split():
        if len(word) >= 4:
            terms.append(word.upper())

    # ── 3. Separate company vs macro markets ──
    company_markets: List[Dict] = []
    macro_markets:   List[Dict] = []
    now_ts = pd.Timestamp.now(tz="UTC")

    for e in events:
        title = e.get("title", "").upper()
        slug  = e.get("slug",  "")

        is_company = any(t in title for t in terms)
        is_macro   = (not is_company) and any(k in e.get("title", "").lower() for k in _MACRO_KW)

        if not (is_company or is_macro):
            continue

        for m in e.get("markets", []):
            prices   = _poly_prices(m.get("outcomePrices", []))
            outcomes = _poly_parse_list(m.get("outcomes", []))
            vol      = float(m.get("volumeNum", 0) or 0)
            liq      = float(m.get("liquidityNum", 0) or 0)
            end_raw  = m.get("endDate", "")

            try:
                end_dt   = pd.Timestamp(end_raw, tz="UTC")
                is_future = end_dt > now_ts
                end_str  = end_dt.strftime("%Y-%m-%d")
            except Exception:
                is_future = False
                end_str   = end_raw[:10]

            resolved = _market_is_resolved(prices)
            winner   = _resolved_winner(outcomes, prices) if resolved else None

            entry = {
                "question":    m.get("question", ""),
                "outcomes":    outcomes,
                "prices":      prices,
                "volume":      vol,
                "liquidity":   liq,
                "end_date":    end_str,
                "is_active":   is_future and liq > 50,
                "resolved":    resolved,
                "winner":      winner,
                "slug":        slug,
                "event_title": e.get("title", ""),
                "poly_url":    f"https://polymarket.com/event/{slug}",
            }

            if is_company:
                company_markets.append(entry)
            elif is_macro and (is_future or liq > 1000):
                macro_markets.append(entry)

    # ── 4. Sort & limit ──
    # Company: active first, then by volume
    company_markets.sort(key=lambda m: (not m["is_active"], -m["volume"]))
    company_markets = company_markets[:20]

    # Macro: active with real liquidity first, then high-volume resolved
    macro_markets.sort(key=lambda m: (not m["is_active"], -m["liquidity"], -m["volume"]))
    macro_markets = macro_markets[:10]

    # ── 5. Sentiment summary ──
    # From company resolved Up/Down markets
    resolved_up_down = [
        m for m in company_markets
        if m["resolved"] and m["winner"] in ("Up", "Down", "Yes", "No")
        and any(o in ("Up", "Down") for o in m["outcomes"])
    ]
    bullish = sum(1 for m in resolved_up_down if m["winner"] == "Up")
    bearish = sum(1 for m in resolved_up_down if m["winner"] == "Down")
    total_vol = sum(m["volume"] for m in company_markets)
    active_count = sum(1 for m in company_markets if m["is_active"])

    # Sentiment from active company markets (prices[0] = first outcome probability)
    active_bull_pct: Optional[float] = None
    active_mkts = [m for m in company_markets if m["is_active"] and m["prices"]]
    if active_mkts:
        # If outcomes are ["Up","Down"] the first price is Up probability
        up_mkts = [m for m in active_mkts if m["outcomes"] and m["outcomes"][0] in ("Up", "Yes")]
        if up_mkts:
            active_bull_pct = round(
                sum(m["prices"][0] for m in up_mkts) / len(up_mkts) * 100, 1
            )

    # ── 6. Weekly activity: top markets by volume1wk across all finance tags ──
    week_markets: List[Dict] = []
    _WEEK_FIN_KW = [
        "fed", "rate", "inflation", "recession", "nasdaq", "s&p", "tariff",
        "gdp", "earnings", "stock", "market", "economy", "bitcoin", "crypto",
        "nvidia", "apple", "tesla", "microsoft", "amazon", "meta", "google",
        "openai", "ai ", "semiconductor", "chip", "tech",
        *[t.lower() for t in terms],        # add company-specific terms
    ]
    try:
        r_wk = requests.get(
            f"{_POLY_BASE}/markets",
            params={"active": "true", "limit": 200, "order": "volume1wk", "ascending": "false"},
            headers=_POLY_HEADERS, timeout=10,
        )
        if r_wk.ok and isinstance(r_wk.json(), list):
            for mkt in r_wk.json():
                q_low = mkt.get("question", "").lower()
                wk_vol = float(mkt.get("volume1wk", 0) or 0)
                if wk_vol < 5000:
                    break  # sorted desc — no point continuing
                if not any(k in q_low for k in _WEEK_FIN_KW):
                    continue
                prices   = _poly_prices(mkt.get("outcomePrices", []))
                outcomes = _poly_parse_list(mkt.get("outcomes", []))
                liq      = float(mkt.get("liquidityNum", 0) or 0)
                end_raw  = mkt.get("endDate", "")
                try:
                    end_dt   = pd.Timestamp(end_raw, tz="UTC")
                    is_future = end_dt > now_ts
                    end_str  = end_dt.strftime("%Y-%m-%d")
                except Exception:
                    is_future = False
                    end_str   = end_raw[:10]

                resolved = _market_is_resolved(prices)
                winner   = _resolved_winner(outcomes, prices) if resolved else None

                # Determine category
                q_up = mkt.get("question", "")
                cat = "company" if any(t in q_up.upper() for t in terms) else "macro"

                week_markets.append({
                    "question":    mkt.get("question", ""),
                    "outcomes":    outcomes,
                    "prices":      prices,
                    "volume":      float(mkt.get("volumeNum", 0) or 0),
                    "volume_1wk":  wk_vol,
                    "volume_24h":  float(mkt.get("volume24hr", 0) or 0),
                    "liquidity":   liq,
                    "end_date":    end_str,
                    "is_active":   is_future and liq > 10,
                    "resolved":    resolved,
                    "winner":      winner,
                    "slug":        mkt.get("slug", ""),
                    "poly_url":    f"https://polymarket.com/event/{mkt.get('slug','')}",
                    "category":    cat,
                })
                if len(week_markets) >= 15:
                    break
    except Exception as ex:
        logger.debug(f"Polymarket week activity error: {ex}")

    return {
        "symbol":          symbol,
        "company_name":    company_name,
        "company_markets": company_markets,
        "macro_markets":   macro_markets,
        "week_activity":   week_markets,
        "sentiment": {
            "bullish_days":    bullish,
            "bearish_days":    bearish,
            "active_count":    active_count,
            "total_volume":    total_vol,
            "active_bull_pct": active_bull_pct,
        },
    }


# ══════════════════════════════════════════════════════════
#  NEWS SENTIMENT (Google News RSS + CNBC RSS → Claude AI)
# ══════════════════════════════════════════════════════════
import urllib.request
from datetime import timezone, timedelta
from email.utils import parsedate_to_datetime

_NEWS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) StockTracker/1.0"
}

# Sources we consider "premium" for weighting
_PREMIUM_SOURCES = {
    "bloomberg", "reuters", "cnbc", "barron", "wall street journal", "wsj",
    "financial times", "ft", "marketwatch", "seeking alpha", "motley fool",
    "the street", "benzinga", "tipranks", "zacks",
}

def _source_label(source: str) -> str:
    sl = source.lower()
    if "bloomberg" in sl:  return "Bloomberg"
    if "reuters"   in sl:  return "Reuters"
    if "cnbc"      in sl:  return "CNBC"
    if "barron"    in sl:  return "Barron's"
    if "wsj" in sl or "wall street journal" in sl: return "WSJ"
    if "ft" in sl or "financial times" in sl:      return "FT"
    if "marketwatch" in sl: return "MarketWatch"
    if "seeking alpha" in sl: return "Seeking Alpha"
    if "motley fool"  in sl:  return "Motley Fool"
    if "tipranks" in sl:  return "TipRanks"
    if "zacks" in sl:     return "Zacks"
    if "benzinga" in sl:  return "Benzinga"
    if "yahoo" in sl:     return "Yahoo Finance"
    return source[:40]


def _fetch_gnews_rss(query: str, max_items: int = 30) -> List[Dict]:
    """Fetch articles from Google News RSS for a given query string."""
    import urllib.parse
    url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query)}&hl=en-US&gl=US&ceid=US:en"
    articles = []
    try:
        req = urllib.request.Request(url, headers=_NEWS_HEADERS)
        with urllib.request.urlopen(req, timeout=8) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
        root = ET.fromstring(raw)
        ns = {"media": "http://search.yahoo.com/mrss/"}
        channel = root.find("channel")
        if channel is None:
            return []
        for item in channel.findall("item")[:max_items]:
            title = (item.findtext("title") or "").strip()
            link  = (item.findtext("link")  or "").strip()
            pub   = (item.findtext("pubDate") or "").strip()
            src_el = item.find("source")
            source = src_el.text.strip() if src_el is not None and src_el.text else ""
            if not title:
                continue
            try:
                pub_dt = parsedate_to_datetime(pub)
                pub_dt = pub_dt.astimezone(timezone.utc) if pub_dt.tzinfo else pub_dt.replace(tzinfo=timezone.utc)
                pub_iso = pub_dt.isoformat()
            except Exception:
                pub_dt  = None
                pub_iso = ""
            articles.append({
                "title": title, "link": link, "source": source,
                "source_label": _source_label(source),
                "pub_dt": pub_dt, "pub_iso": pub_iso,
            })
    except Exception as ex:
        logger.debug(f"Google News RSS error ({query}): {ex}")
    return articles


def _fetch_cnbc_rss() -> List[Dict]:
    """Fetch from CNBC market + tech RSS feeds."""
    feeds = [
        "https://www.cnbc.com/id/100003114/device/rss/rss.html",  # Markets
        "https://www.cnbc.com/id/19854910/device/rss/rss.html",   # Tech
    ]
    articles = []
    for feed_url in feeds:
        try:
            req = urllib.request.Request(feed_url, headers=_NEWS_HEADERS)
            with urllib.request.urlopen(req, timeout=6) as resp:
                raw = resp.read().decode("utf-8", errors="ignore")
            root = ET.fromstring(raw)
            channel = root.find("channel")
            if channel is None:
                continue
            for item in channel.findall("item")[:25]:
                title = (item.findtext("title") or "").strip()
                link  = (item.findtext("link")  or "").strip()
                pub   = (item.findtext("pubDate") or "").strip()
                if not title:
                    continue
                try:
                    pub_dt = parsedate_to_datetime(pub)
                    pub_dt = pub_dt.astimezone(timezone.utc) if pub_dt.tzinfo else pub_dt.replace(tzinfo=timezone.utc)
                    pub_iso = pub_dt.isoformat()
                except Exception:
                    pub_dt  = None
                    pub_iso = ""
                articles.append({
                    "title": title, "link": link, "source": "CNBC",
                    "source_label": "CNBC",
                    "pub_dt": pub_dt, "pub_iso": pub_iso,
                })
        except Exception as ex:
            logger.debug(f"CNBC RSS error: {ex}")
    return articles


def _classify_session(pub_dt, et_offset: int = -4) -> str:
    """Classify article publish time by market session (US Eastern)."""
    if pub_dt is None:
        return "regular"
    et = pub_dt + timedelta(hours=et_offset)
    h, m = et.hour, et.minute
    minutes = h * 60 + m
    if 240 <= minutes < 570:   # 4:00 AM – 9:30 AM ET
        return "premarket"
    if 570 <= minutes < 960:   # 9:30 AM – 4:00 PM ET
        return "regular"
    return "afterhours"


def _dedupe(articles: List[Dict]) -> List[Dict]:
    seen: set = set()
    out = []
    for a in articles:
        key = a["title"][:60].lower()
        if key not in seen:
            seen.add(key)
            out.append(a)
    return out


@router.get("/{symbol}/news-sentiment")
def get_news_sentiment(symbol: str, company: str = Query(default="")):
    """
    Fetch news from Google News RSS + CNBC RSS, filter for stock mentions,
    classify by session, and use Claude to produce a Hebrew sentiment summary.
    """
    symbol = symbol.upper().strip()
    company_name = company.strip() or symbol

    # ── 1. Gather articles ──
    all_raw: List[Dict] = []

    # Multiple Google News queries
    queries = [
        f"{symbol} stock",
        f"{symbol} stock analyst rating price target",
        f'"{company_name}" premarket earnings',
    ]
    for q in queries:
        all_raw.extend(_fetch_gnews_rss(q, max_items=30))

    # CNBC RSS — filter mentions of symbol or company
    cnbc_arts = _fetch_cnbc_rss()
    search_terms = [symbol.lower()] + [w.lower() for w in company_name.split() if len(w) >= 4]
    for a in cnbc_arts:
        title_low = a["title"].lower()
        if any(t in title_low for t in search_terms):
            all_raw.append(a)

    # Deduplicate
    articles = _dedupe(all_raw)

    # ── 2. Sort by recency, keep top 50 ──
    def sort_key(a):
        if a["pub_dt"] is None:
            return 0
        return a["pub_dt"].timestamp()
    articles.sort(key=sort_key, reverse=True)
    articles = articles[:50]

    # ── 3. Add session classification ──
    # Detect current ET offset (rough: -5 EST, -4 EDT)
    import time as _time
    is_dst = bool(_time.daylight and _time.localtime().tm_isdst)
    et_offset = -4 if is_dst else -5

    for a in articles:
        a["session"] = _classify_session(a["pub_dt"], et_offset)

    # ── 4. Separate by session ──
    premarket  = [a for a in articles if a["session"] == "premarket"][:10]
    regular    = [a for a in articles if a["session"] == "regular"][:15]
    afterhours = [a for a in articles if a["session"] == "afterhours"][:5]

    # Premium source count
    premium = [a for a in articles if any(p in a["source_label"].lower() for p in _PREMIUM_SOURCES)]

    # ── 5. Build indexed headline list for Claude ──
    all_session_arts = (premarket + regular + afterhours)[:30]
    headlines_for_ai = []
    for i, a in enumerate(all_session_arts):
        headlines_for_ai.append(f"{i}. [{a['source_label']}] {a['title']}")

    # ── 6. Claude analysis — overall + per-article in one call ──
    ai_summary = None
    sentiment_score = 50
    direction = "neutral"
    key_themes: List[str] = []
    analyst_calls: List[str] = []
    pre_market_signal = None
    article_analysis: Dict[int, Dict] = {}   # idx → {sentiment, score, bottom_line}

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key and headlines_for_ai:
        try:
            headlines_text = "\n".join(headlines_for_ai)
            prompt = f"""אתה אנליסט שוק בכיר. נתח את הכותרות הבאות מהתקשורת הפיננסית לגבי המניה {symbol} ({company_name}).

כותרות (כל אחת מסומנת במספר אינדקס):
{headlines_text}

ענה בעברית. פלט JSON תקין בלבד עם המבנה הבא:

{{
  "sentiment_score": <0-100, 0=דובי קיצוני, 50=ניטרלי, 100=שורי קיצוני>,
  "direction": <"bullish"|"neutral"|"bearish">,
  "summary": "<סיכום 2-3 משפטים של הסנטימנט הכללי בתקשורת>",
  "key_themes": ["<נושא1>", "<נושא2>", "<נושא3>", "<נושא4>"],
  "analyst_calls": ["<המלצה1>", "<המלצה2>", "<המלצה3>"],
  "pre_market_signal": "<מה כותרות פרי-מרקט מרמזות, או null>",
  "articles": [
    {{
      "idx": <מספר האינדקס מהרשימה>,
      "sentiment": <"bullish"|"neutral"|"bearish">,
      "score": <0-100>,
      "bottom_line": "<שורה תחתונה — משפט אחד קצר בעברית: מה המשמעות למשקיע>"
    }}
  ]
}}

חשוב:
- כלול בשדה articles רשומה לכל אחד מהאינדקסים שניתנו
- bottom_line: משפט אחד קצר בלבד (עד 15 מילים) — מה המשמעות למשקיע
- ענה אך ורק ב-JSON תקין, ללא טקסט נוסף לפני או אחרי"""

            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
            raw_text = response.content[0].text.strip()
            # Strip markdown code fences if present
            if raw_text.startswith("```"):
                raw_text = re.sub(r"^```[a-z]*\n?", "", raw_text)
                raw_text = re.sub(r"\n?```$", "", raw_text)

            # Try full parse first; on failure attempt to extract top-level fields
            try:
                ai_result = json.loads(raw_text)
            except json.JSONDecodeError:
                # Truncated JSON — extract scalar fields with regex, skip articles
                def _re_str(key: str) -> Optional[str]:
                    m = re.search(rf'"{key}"\s*:\s*"([^"]*)"', raw_text)
                    return m.group(1) if m else None
                def _re_int(key: str) -> Optional[int]:
                    m = re.search(rf'"{key}"\s*:\s*(\d+)', raw_text)
                    return int(m.group(1)) if m else None
                ai_result = {
                    "sentiment_score": _re_int("sentiment_score") or 50,
                    "direction":       _re_str("direction") or "neutral",
                    "summary":         _re_str("summary") or "",
                    "key_themes":      [],
                    "analyst_calls":   [],
                    "pre_market_signal": _re_str("pre_market_signal"),
                    "articles":        [],
                }
                logger.warning("News-sentiment: truncated JSON, using partial extraction")

            sentiment_score   = int(ai_result.get("sentiment_score", 50))
            direction         = ai_result.get("direction", "neutral")
            ai_summary        = ai_result.get("summary", "")
            key_themes        = ai_result.get("key_themes", [])
            analyst_calls     = ai_result.get("analyst_calls", [])
            pre_market_signal = ai_result.get("pre_market_signal")
            # Build per-article lookup
            for art_item in ai_result.get("articles", []):
                idx = art_item.get("idx")
                if idx is not None:
                    article_analysis[int(idx)] = {
                        "sentiment":   art_item.get("sentiment", "neutral"),
                        "score":       int(art_item.get("score", 50)),
                        "bottom_line": art_item.get("bottom_line", ""),
                    }
        except Exception as ex:
            logger.warning(f"News-sentiment AI error: {ex}")

    # ── 7. Strip pub_dt (not JSON-serializable) and annotate ──
    def clean(arts, global_offset: int = 0):
        """Convert raw article dicts to JSON-safe form, injecting AI per-article data."""
        out = []
        for local_i, a in enumerate(arts):
            # Find global index in all_session_arts
            try:
                g_idx = all_session_arts.index(a)
            except ValueError:
                g_idx = -1
            ai_art = article_analysis.get(g_idx, {})
            out.append({
                "title":       a["title"],
                "link":        a["link"],
                "source":      a["source_label"],
                "published":   a["pub_iso"],
                "session":     a["session"],
                "sentiment":   ai_art.get("sentiment", "neutral"),
                "score":       ai_art.get("score", 50),
                "bottom_line": ai_art.get("bottom_line", ""),
            })
        return out

    return {
        "symbol": symbol,
        "company_name": company_name,
        "total_articles": len(articles),
        "premium_count": len(premium),
        "premarket":  clean(premarket),
        "regular":    clean(regular),
        "afterhours": clean(afterhours),
        "sentiment": {
            "score":     sentiment_score,
            "direction": direction,
            "summary":   ai_summary,
            "key_themes":      key_themes,
            "analyst_calls":   analyst_calls,
            "pre_market_signal": pre_market_signal,
        },
    }


# ══════════════════════════════════════════════════════════
#  CHART PATTERN DETECTION
# ══════════════════════════════════════════════════════════

def _find_pivots(closes: List[float], highs: List[float], lows: List[float],
                 window: int = 5) -> tuple:
    """Find swing highs and lows using a rolling window."""
    swing_highs = []  # (idx, price)
    swing_lows  = []  # (idx, price)
    for i in range(window, len(closes) - window):
        if highs[i] == max(highs[i-window:i+window+1]):
            swing_highs.append((i, highs[i]))
        if lows[i] == min(lows[i-window:i+window+1]):
            swing_lows.append((i, lows[i]))
    return swing_highs, swing_lows


@router.get("/{symbol}/chart-patterns")
def get_chart_patterns(symbol: str, period: str = Query(default="6m")):
    """Detect common chart patterns from recent price history."""
    symbol = symbol.upper().strip()
    period_map = {"1m": "1mo", "3m": "3mo", "6m": "6mo", "1y": "1y"}
    yf_period = period_map.get(period, "6mo")

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=yf_period)
        if df.empty or len(df) < 30:
            return {"symbol": symbol, "patterns": []}

        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
        closes = df["Close"].tolist()
        highs  = df["High"].tolist()
        lows   = df["Low"].tolist()
        dates  = [str(d)[:10] for d in df.index]
        n = len(closes)

        patterns = []
        tol = 0.03  # 3% tolerance for price similarity

        # ── Pivot detection ──
        swing_highs, swing_lows = _find_pivots(closes, highs, lows, window=5)

        # ── 1. Double Top ──
        if len(swing_highs) >= 2:
            for i in range(len(swing_highs) - 1):
                for j in range(i + 1, min(i + 6, len(swing_highs))):
                    ih, ph = swing_highs[i]
                    jh, pjh = swing_highs[j]
                    if abs(ph - pjh) / ph < tol and (jh - ih) >= 5:
                        # Find neckline (lowest low between the two tops)
                        neck = min(lows[ih:jh+1])
                        patterns.append({
                            "type": "double_top",
                            "name_he": "כפל שיא",
                            "implication": "bearish",
                            "confidence": 70,
                            "start_date": dates[ih],
                            "end_date": dates[min(jh + 3, n - 1)],
                            "key_prices": {
                                "top1": round(ph, 2),
                                "top2": round(pjh, 2),
                                "neckline": round(neck, 2),
                            },
                            "description_he": f"כפל שיא זוהה — שני שיאים קרובים ב-${ph:.2f} ו-${pjh:.2f}. פריצה מתחת לקו הצוואר (${neck:.2f}) מרמזת על ירידה.",
                        })

        # ── 2. Double Bottom ──
        if len(swing_lows) >= 2:
            for i in range(len(swing_lows) - 1):
                for j in range(i + 1, min(i + 6, len(swing_lows))):
                    il, pl = swing_lows[i]
                    jl, pjl = swing_lows[j]
                    if abs(pl - pjl) / pl < tol and (jl - il) >= 5:
                        neck = max(highs[il:jl+1])
                        patterns.append({
                            "type": "double_bottom",
                            "name_he": "כפל תחתית",
                            "implication": "bullish",
                            "confidence": 70,
                            "start_date": dates[il],
                            "end_date": dates[min(jl + 3, n - 1)],
                            "key_prices": {
                                "bottom1": round(pl, 2),
                                "bottom2": round(pjl, 2),
                                "neckline": round(neck, 2),
                            },
                            "description_he": f"כפל תחתית זוהה — שני שפלים קרובים ב-${pl:.2f} ו-${pjl:.2f}. פריצה מעל לקו הצוואר (${neck:.2f}) מרמזת על עלייה.",
                        })

        # ── 3. Head & Shoulders ──
        if len(swing_highs) >= 3:
            for i in range(len(swing_highs) - 2):
                il, pl   = swing_highs[i]       # left shoulder
                im, pm   = swing_highs[i + 1]   # head
                ir, pr   = swing_highs[i + 2]   # right shoulder
                if pm > pl and pm > pr and abs(pl - pr) / pl < 0.04 and (ir - il) >= 10:
                    neck = (lows[il] + lows[ir]) / 2
                    patterns.append({
                        "type": "head_and_shoulders",
                        "name_he": "ראש וכתפיים",
                        "implication": "bearish",
                        "confidence": 75,
                        "start_date": dates[il],
                        "end_date": dates[min(ir + 5, n - 1)],
                        "key_prices": {
                            "left_shoulder": round(pl, 2),
                            "head": round(pm, 2),
                            "right_shoulder": round(pr, 2),
                            "neckline": round(neck, 2),
                        },
                        "description_he": f"ראש וכתפיים — כתף שמאל ${pl:.2f}, ראש ${pm:.2f}, כתף ימין ${pr:.2f}. פריצה מתחת לצוואר (${neck:.2f}) = אות מכירה.",
                    })

        # ── 4. Inverse Head & Shoulders ──
        if len(swing_lows) >= 3:
            for i in range(len(swing_lows) - 2):
                il, pl   = swing_lows[i]
                im, pm   = swing_lows[i + 1]
                ir, pr   = swing_lows[i + 2]
                if pm < pl and pm < pr and abs(pl - pr) / pl < 0.04 and (ir - il) >= 10:
                    neck = (highs[il] + highs[ir]) / 2
                    patterns.append({
                        "type": "inv_head_and_shoulders",
                        "name_he": "ראש וכתפיים הפוך",
                        "implication": "bullish",
                        "confidence": 75,
                        "start_date": dates[il],
                        "end_date": dates[min(ir + 5, n - 1)],
                        "key_prices": {
                            "left_shoulder": round(pl, 2),
                            "head": round(pm, 2),
                            "right_shoulder": round(pr, 2),
                            "neckline": round(neck, 2),
                        },
                        "description_he": f"ראש וכתפיים הפוך — כתף שמאל ${pl:.2f}, ראש ${pm:.2f}, כתף ימין ${pr:.2f}. פריצה מעל הצוואר (${neck:.2f}) = אות קנייה.",
                    })

        # ── 5. Ascending Triangle ──
        if len(swing_highs) >= 2 and len(swing_lows) >= 2:
            recent_highs = swing_highs[-4:] if len(swing_highs) >= 4 else swing_highs
            recent_lows  = swing_lows[-4:]  if len(swing_lows)  >= 4 else swing_lows
            if len(recent_highs) >= 2 and len(recent_lows) >= 2:
                rh_prices = [p for _, p in recent_highs]
                rl_prices = [p for _, p in recent_lows]
                # Flat resistance (highs within 2%) + rising lows
                if (max(rh_prices) - min(rh_prices)) / max(rh_prices) < 0.02:
                    if rl_prices[-1] > rl_prices[0]:
                        resistance = sum(rh_prices) / len(rh_prices)
                        patterns.append({
                            "type": "ascending_triangle",
                            "name_he": "משולש עולה",
                            "implication": "bullish",
                            "confidence": 65,
                            "start_date": dates[recent_highs[0][0]],
                            "end_date": dates[min(recent_highs[-1][0] + 3, n - 1)],
                            "key_prices": {"resistance": round(resistance, 2), "support": round(rl_prices[-1], 2)},
                            "description_he": f"משולש עולה — התנגדות אופקית ב-${resistance:.2f} עם שפלים עולים. פריצה כלפי מעלה צפויה.",
                        })
                # Flat support + falling highs → Descending Triangle
                if (max(rl_prices) - min(rl_prices)) / max(rl_prices) < 0.02:
                    if rh_prices[-1] < rh_prices[0]:
                        support = sum(rl_prices) / len(rl_prices)
                        patterns.append({
                            "type": "descending_triangle",
                            "name_he": "משולש יורד",
                            "implication": "bearish",
                            "confidence": 65,
                            "start_date": dates[recent_lows[0][0]],
                            "end_date": dates[min(recent_lows[-1][0] + 3, n - 1)],
                            "key_prices": {"support": round(support, 2), "resistance": round(rh_prices[-1], 2)},
                            "description_he": f"משולש יורד — תמיכה אופקית ב-${support:.2f} עם שיאים יורדים. פריצה כלפי מטה צפויה.",
                        })

        # ── 6. Bull/Bear Flag ──
        if len(closes) >= 20:
            # Look for strong move + consolidation in last 20 bars
            last20 = closes[-20:]
            first10_move = (last20[9] - last20[0]) / last20[0]
            last10_range = (max(last20[10:]) - min(last20[10:])) / last20[9]
            if first10_move > 0.08 and last10_range < 0.04:  # bull flag
                patterns.append({
                    "type": "bull_flag",
                    "name_he": "דגל שורי",
                    "implication": "bullish",
                    "confidence": 68,
                    "start_date": dates[max(0, n - 20)],
                    "end_date": dates[n - 1],
                    "key_prices": {
                        "pole_start": round(last20[0], 2),
                        "pole_top":   round(last20[9], 2),
                        "flag_low":   round(min(last20[10:]), 2),
                    },
                    "description_he": f"דגל שורי — עמוד חזק של {first10_move*100:.1f}% ואחריו איחוד. פריצה כלפי מעלה צפויה.",
                })
            elif first10_move < -0.08 and last10_range < 0.04:  # bear flag
                patterns.append({
                    "type": "bear_flag",
                    "name_he": "דגל דובי",
                    "implication": "bearish",
                    "confidence": 68,
                    "start_date": dates[max(0, n - 20)],
                    "end_date": dates[n - 1],
                    "key_prices": {
                        "pole_start": round(last20[0], 2),
                        "pole_bottom": round(last20[9], 2),
                        "flag_high":   round(max(last20[10:]), 2),
                    },
                    "description_he": f"דגל דובי — ירידה חדה של {abs(first10_move)*100:.1f}% ואחריו איחוד. פריצה כלפי מטה צפויה.",
                })

        # Deduplicate: keep only most recent of each type
        seen_types = set()
        deduped = []
        for p in sorted(patterns, key=lambda x: x["end_date"], reverse=True):
            if p["type"] not in seen_types:
                seen_types.add(p["type"])
                deduped.append(p)

        return {
            "symbol": symbol,
            "period": period,
            "patterns": deduped[:8],
            "pivot_highs": [(dates[i], round(p, 2)) for i, p in swing_highs[-10:]],
            "pivot_lows":  [(dates[i], round(p, 2)) for i, p in swing_lows[-10:]],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
