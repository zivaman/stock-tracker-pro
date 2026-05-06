"""
AI Insights endpoint — uses Claude with prompt caching for efficiency.
System prompt is marked ephemeral → cached for 5 min → ~90% cheaper on repeat calls.
Returns structured JSON analysis for a given stock or a full portfolio.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import os, json, re, anthropic

router = APIRouter(prefix="/ai", tags=["ai"])


def _try_fix_json(raw: str) -> Optional[dict]:
    """Try to repair a truncated JSON string by closing open braces/brackets."""
    try:
        # Find the first '{' and try to close all open structures
        start = raw.find('{')
        if start == -1:
            return None
        text = raw[start:]
        # Count open braces/brackets and close them
        stack = []
        in_string = False
        escape_next = False
        result = []
        for ch in text:
            if escape_next:
                result.append(ch); escape_next = False; continue
            if ch == '\\' and in_string:
                result.append(ch); escape_next = True; continue
            if ch == '"' and not escape_next:
                in_string = not in_string
            if not in_string:
                if ch in '{[':
                    stack.append('}' if ch == '{' else ']')
                elif ch in '}]':
                    if stack and stack[-1] == ch:
                        stack.pop()
            result.append(ch)
        # Close any remaining open structures
        while stack:
            result.append(stack.pop())
        fixed = ''.join(result)
        return json.loads(fixed)
    except Exception:
        return None


# ── Cached Anthropic client (one per process) ──────────────────────────────
_client: Optional[anthropic.Anthropic] = None

def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not key or key == "your_api_key_here":
            raise HTTPException(
                status_code=503,
                detail="ANTHROPIC_API_KEY לא מוגדר — הוסף את המפתח לקובץ backend/.env",
            )
        _client = anthropic.Anthropic(api_key=key)
    return _client


# ── Request / Response models ─────────────────────────────────────────────
class InsightRequest(BaseModel):
    symbol: str
    name: str
    current_price: float
    sector: Optional[str] = None
    signal: Optional[Dict[str, Any]] = None
    info: Optional[Dict[str, Any]] = None
    performance: Optional[Dict[str, Any]] = None
    support_resistance: Optional[Dict[str, Any]] = None
    fibonacci: Optional[Dict[str, Any]] = None


# ── System prompt (will be cached by Anthropic) ───────────────────────────
SYSTEM_PROMPT = """אתה אנליסט מניות בכיר (CFA) עם 20+ שנות ניסיון בוול סטריט — מומחה לניתוח טכני ופונדמנטלי.

כללי ניתוח טכני:
• RSI <30 = Oversold | 30-45 = אזור קנייה | >70 = Overbought
• MACD Bullish Crossover = איתות קנייה חזק | Bearish Crossover = מכירה
• מחיר מעל SMA200 = מגמה ראשית עולה | מתחת = ירידה
• Golden Cross (SMA50>SMA200) = Bullish חזק | Death Cross = Bearish
• ADX>25 = מגמה ברורה | <25 = שוק צדדי
• OBV עולה = כסף מוסדי נכנס | יורד = יוצא
• MFI <20 = Oversold | >80 = Overbought
• Ichimoku: מחיר מעל ענן = Bullish | מתחת = Bearish
• Williams %R < -80 = Oversold | > -20 = Overbought
• CCI < -100 = Oversold | > 100 = Overbought
• Bollinger Squeeze (רוחב פס צר) = פריצה קרובה

כללי ניתוח פונדמנטלי:
• P/E <12 = זול מאוד | 12-18 = הוגן | >35 = יקר מאוד
• PEG <1 = צמיחה זולה | >2 = יקר ביחס לצמיחה
• P/B <1 = מניה מתחת לשווי נכסים | >10 = מתומחרת על ציפיות
• ROE >20% = ניהול מצוין | <0% = הפסדי
• Debt/Equity >200% = מינוף מסוכן
• EPS Growth >20% = מגמת רווח חזקה
• מרווח רווח >20% = חפיר תחרותי חזק

קריטריון תשובה:
ענה אך ורק ב-JSON תקני — ללא תוספות טקסט. פורמט:
{
  "summary": "תקציר מנהלים 2-3 משפטים בעברית — מה מצב המניה כולל טכני ופונדמנטלי",
  "recommendation": "קנייה חזקה | קנייה | המתן | מכירה | מכירה חזקה",
  "confidence": <0-100>,
  "price_target_3m": <מחיר יעד ל-3 חודשים>,
  "upside_pct": <פוטנציאל עלייה/ירידה %>,
  "trend_assessment": "Bullish חזק | Bullish | ניטראלי | Bearish | Bearish חזק",
  "opportunity": "הזדמנות עיקרית — משפט אחד",
  "risk": "סיכון עיקרי — משפט אחד",
  "catalysts": ["קטליסטור 1", "קטליסטור 2", "קטליסטור 3"],
  "technical_view": "ניתוח טכני מקיף 2-3 משפטים — אזכר ADX, OBV, Ichimoku אם רלוונטי",
  "fundamental_view": "ניתוח פונדמנטלי 2-3 משפטים — EPS, מרווחים, ROE, חוב",
  "eps_analysis": "ניתוח EPS ספציפי — TTM vs Forward, צמיחה, צפי",
  "valuation_grade": "A (זול מאוד) | B (הוגן) | C (ניטראלי) | D (יקר) | F (יקר מאוד)",
  "time_horizon": "קצר (ימים-שבועות) | בינוני (3-6 חודשים) | ארוך (12+ חודשים)",
  "sector_context": "הקשר סקטוריאלי — משפט אחד"
}"""


def build_user_prompt(req: InsightRequest) -> str:
    sig  = req.signal or {}
    info = req.info   or {}
    perf = req.performance or {}
    sr   = req.support_resistance or {}
    fib  = req.fibonacci or {}

    def v(val, prefix="", suffix="", decimals=2):
        if val is None or val == "N/A":
            return "N/A"
        try:
            return f"{prefix}{round(float(val), decimals)}{suffix}"
        except Exception:
            return str(val)

    lines = [
        f"מניה: {req.symbol} ({req.name})",
        f"מחיר: ${req.current_price} | סקטור: {req.sector or info.get('sector','?')}",
        "",
        "══ ניתוח טכני ══",
        f"ציון: {sig.get('score','N/A')}/100 | איתות: {sig.get('signal','N/A')} | מגמה: {sig.get('trend_label','N/A')} ({sig.get('bull_pct','N/A')}% Bullish)",
        f"RSI(14): {v(sig.get('rsi'))} | Williams%R: {v(sig.get('williams_r'))} | CCI: {v(sig.get('cci'),decimals=0)}",
        f"MACD: {v(sig.get('macd'),decimals=4)} | Signal: {v(sig.get('macd_signal'),decimals=4)} | Hist: {v(sig.get('macd_hist'),decimals=4)}",
        f"Stoch K/D: {v(sig.get('stoch_k'),decimals=1)}/{v(sig.get('stoch_d'),decimals=1)} | MFI: {v(sig.get('mfi'),decimals=1)} | OBV vs EMA: {'Bullish' if (sig.get('obv') or 0) > 0 else 'Bearish'}",
        f"ADX: {v(sig.get('adx'),decimals=1)} | +DI: {v(sig.get('plus_di'),decimals=1)} | -DI: {v(sig.get('minus_di'),decimals=1)}",
        f"EMA9: ${v(sig.get('ema9'))} | EMA21: ${v(sig.get('ema21'))} | SMA50: ${v(sig.get('sma50'))} | SMA150: ${v(sig.get('sma150'))} | SMA200: ${v(sig.get('sma200'))}",
        f"Ichimoku Tenkan: ${v(sig.get('tenkan'))} | Kijun: ${v(sig.get('kijun'))}",
        f"BB Upper: ${v(sig.get('bb_upper'))} | BB Lower: ${v(sig.get('bb_lower'))} | BB Width: {v(sig.get('bb_width'),decimals=4)}",
        f"ATR: ${v(sig.get('atr'))} ({v(sig.get('atr_pct'))}%) | Volume Ratio: {v(sig.get('vol_ratio'),decimals=2)}x",
        f"תמיכה: ${sr.get('support','N/A')} | התנגדות: ${sr.get('resistance','N/A')}",
    ]

    if fib.get("levels"):
        lvl = fib["levels"]
        lines.append(f"פיבונאצ׳י — 23.6%: ${lvl.get('23.6','N/A')} | 38.2%: ${lvl.get('38.2','N/A')} | 61.8%: ${lvl.get('61.8','N/A')}")

    # Fundamentals
    eps_ttm  = info.get("eps_ttm")
    eps_fwd  = info.get("eps_forward")
    eps_g    = info.get("earnings_growth")
    rev_g    = info.get("revenue_growth")
    roe      = info.get("return_on_equity")
    roa      = info.get("return_on_assets")
    de       = info.get("debt_to_equity")
    pm       = info.get("profit_margins")
    om       = info.get("operating_margins")
    pe       = info.get("pe_ratio")
    fpe      = info.get("forward_pe")
    peg      = info.get("peg_ratio")
    pb       = info.get("price_to_book")
    cr       = info.get("current_ratio")
    mc       = info.get("market_cap")
    mc_str   = f"${mc/1e9:.1f}B" if mc and mc >= 1e9 else (f"${mc/1e6:.0f}M" if mc else "N/A")

    def pct(x):
        return f"{round(x*100,1)}%" if x is not None else "N/A"

    lines += [
        "",
        "══ ניתוח פונדמנטלי ══",
        f"EPS TTM: ${v(eps_ttm)} | EPS Forward: ${v(eps_fwd)} | EPS Growth YoY: {pct(eps_g)}",
        f"P/E: {v(pe,decimals=1)} | Forward P/E: {v(fpe,decimals=1)} | PEG: {v(peg,decimals=2)} | P/B: {v(pb,decimals=2)}",
        f"ROE: {pct(roe)} | ROA: {pct(roa)} | מרווח רווח: {pct(pm)} | מרווח תפעולי: {pct(om)}",
        f"Debt/Equity: {v(de,decimals=1)}% | Current Ratio: {v(cr,decimals=2)}",
        f"צמיחת הכנסות: {pct(rev_g)} | שווי שוק: {mc_str} | Beta: {v(info.get('beta'),decimals=2)}",
        f"דיבידנד: {pct(info.get('dividend_yield'))} | יעד אנליסטים: ${v(info.get('target_price'))} | המלצה: {info.get('recommendation','N/A')}",
        f"52W High: ${v(info.get('52w_high'))} | 52W Low: ${v(info.get('52w_low'))}",
        "",
        "══ ביצועים ══",
        f"1D: {perf.get('1d','N/A')}% | 5D: {perf.get('5d','N/A')}% | 1M: {perf.get('1m','N/A')}% | 3M: {perf.get('3m','N/A')}% | 6M: {perf.get('6m','N/A')}% | 1Y: {perf.get('1y','N/A')}%",
        "",
        "══ איתותי אלגוריתם ══",
    ]
    for r in (sig.get("reasons") or [])[:5]:
        lines.append(f"✓ {r}")
    for w in (sig.get("warnings") or [])[:4]:
        lines.append(f"⚠ {w}")

    lines.append("\nנתח את כל הנתונים לעומק והחזר JSON בלבד.")
    return "\n".join(lines)


@router.post("/insights")
def get_ai_insights(req: InsightRequest):
    client = get_client()
    user_prompt = build_user_prompt(req)

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},   # ← cached for ~5 min
                }
            ],
            messages=[{"role": "user", "content": user_prompt}],
        )
    except anthropic.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e.message}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    raw = response.content[0].text.strip()

    # Strip markdown code fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw.strip())

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Try to salvage truncated JSON by closing open braces/brackets
        salvaged = _try_fix_json(raw)
        if salvaged:
            data = salvaged
        else:
            data = {"summary": raw, "recommendation": "N/A", "confidence": 0}

    # Attach token usage for transparency
    usage = response.usage
    data["_tokens"] = {
        "input": usage.input_tokens,
        "output": usage.output_tokens,
        "cache_read": getattr(usage, "cache_read_input_tokens", 0),
        "cache_write": getattr(usage, "cache_creation_input_tokens", 0),
    }
    return data


# ── Portfolio Analysis ────────────────────────────────────────────────────────

PORTFOLIO_SYSTEM_PROMPT = """אתה מנהל תיק השקעות ראשי (CIO) עם 25+ שנות ניסיון.
אתה מנתח תיקי השקעות ומספק המלצות מקצועיות לאיזון ואופטימיזציה.

קריטריון תשובה:
ענה אך ורק ב-JSON תקני — ללא תוספות טקסט. פורמט:
{
  "overall_health": "מצוין | טוב | בינוני | חלש",
  "health_score": <0-100>,
  "summary": "תקציר מנהלים 2-3 משפטים על מצב התיק הכולל",
  "diversification": "ניתוח פיזור: האם התיק מפוזר מספיק? אזהרות ריכוזיות?",
  "top_picks": [
    {"symbol": "XXX", "action": "הגדל | שמור | הקטן | מכור", "reason": "סיבה קצרה"}
  ],
  "sector_insights": "תובנות על הרכב הסקטורים — אילו לחזק ואילו להקטין",
  "risk_level": "נמוך | בינוני | גבוה | גבוה מאוד",
  "risk_comment": "הסבר קצר על רמת הסיכון",
  "opportunities": ["הזדמנות 1", "הזדמנות 2"],
  "warnings": ["אזהרה 1", "אזהרה 2"],
  "rebalance_suggestion": "האם מומלץ לאזן? מה לקנות ומה למכור?",
  "market_context": "הקשר שוק כללי משפט אחד"
}"""


class PortfolioPositionInput(BaseModel):
    symbol: str
    name: str
    sector: Optional[str] = None
    buy_price: float
    current_price: float
    quantity: float
    pnl_pct: float
    invested: float
    current_value: float
    ta_score: Optional[int] = None
    ta_signal: Optional[str] = None
    rsi: Optional[float] = None


class PortfolioAnalysisRequest(BaseModel):
    positions: List[PortfolioPositionInput]
    total_invested: float
    total_value: float
    total_pnl_pct: float


@router.post("/portfolio-analysis")
def get_portfolio_analysis(req: PortfolioAnalysisRequest):
    client = get_client()

    # Build prompt
    lines = [
        f"תיק השקעות — {len(req.positions)} פוזיציות",
        f"שווי כולל: ${req.total_value:,.0f} | השקעה: ${req.total_invested:,.0f} | ביצוע: {req.total_pnl_pct:+.2f}%",
        "",
        "── פוזיציות ──",
    ]
    for p in req.positions:
        alloc = (p.current_value / req.total_value * 100) if req.total_value > 0 else 0
        lines.append(
            f"{p.symbol} ({p.sector or 'לא ידוע'}) | הקצאה: {alloc:.1f}% | "
            f"P&L: {p.pnl_pct:+.1f}% | TA: {p.ta_score or 'N/A'}/100 ({p.ta_signal or 'N/A'}) | RSI: {p.rsi or 'N/A'}"
        )

    # Sector breakdown
    sector_map: Dict[str, float] = {}
    for p in req.positions:
        s = p.sector or "אחר"
        sector_map[s] = sector_map.get(s, 0) + p.current_value
    lines += ["", "── הרכב סקטורים ──"]
    for sec, val in sorted(sector_map.items(), key=lambda x: -x[1]):
        pct = val / req.total_value * 100 if req.total_value > 0 else 0
        lines.append(f"{sec}: {pct:.1f}%")

    lines.append("\nבצע ניתוח תיק מקיף והחזר JSON בלבד.")
    user_prompt = "\n".join(lines)

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1800,
            system=[
                {
                    "type": "text",
                    "text": PORTFOLIO_SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user_prompt}],
        )
    except anthropic.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e.message}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    raw = response.content[0].text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw.strip())

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        salvaged = _try_fix_json(raw)
        if salvaged:
            data = salvaged
        else:
            data = {"summary": raw, "overall_health": "N/A", "health_score": 0}

    usage = response.usage
    data["_tokens"] = {
        "input": usage.input_tokens,
        "output": usage.output_tokens,
        "cache_read": getattr(usage, "cache_read_input_tokens", 0),
        "cache_write": getattr(usage, "cache_creation_input_tokens", 0),
    }
    return data
