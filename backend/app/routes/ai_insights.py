"""
AI Insights endpoint — uses Claude with prompt caching for efficiency.
System prompt is marked ephemeral → cached for 5 min → ~90% cheaper on repeat calls.
Returns structured JSON analysis for a given stock.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os, json, re, anthropic

router = APIRouter(prefix="/ai", tags=["ai"])

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
SYSTEM_PROMPT = """אתה אנליסט מניות מקצועי בכיר עם 20+ שנות ניסיון בוול סטריט.
אתה מנתח נתונים טכניים ופונדמנטליים ומספק תובנות AI מבוססות-נתונים.

כללי ניתוח:
• RSI < 30 = Oversold | RSI 30-45 = אזור קנייה | RSI > 70 = Overbought
• MACD מעל קו האות = מומנטום חיובי
• מחיר מעל SMA200 = מגמה ארוכת-טווח חיובית
• Golden Cross (SMA50>SMA200) = אות קנייה חזק | Death Cross = אות מכירה
• P/E < 15 = זול | 15-25 = הוגן | > 35 = יקר
• מחיר ליד תמיכה = הזדמנות | ליד התנגדות = זהירות

קריטריון תשובה:
ענה אך ורק ב-JSON תקני — ללא תוספות טקסט. פורמט:
{
  "summary": "תקציר מנהלים 2-3 משפטים בעברית",
  "recommendation": "קנייה חזקה | קנייה | המתן | מכירה | מכירה חזקה",
  "confidence": <0-100>,
  "price_target_3m": <מחיר יעד לשלושה חודשים, מספר בלבד>,
  "upside_pct": <אחוז פוטנציאל עלייה מהמחיר הנוכחי>,
  "opportunity": "הזדמנות עיקרית — משפט אחד",
  "risk": "סיכון עיקרי — משפט אחד",
  "catalysts": ["קטליסטור 1", "קטליסטור 2", "קטליסטור 3"],
  "technical_view": "ניתוח טכני קצר 1-2 משפטים",
  "fundamental_view": "ניתוח פונדמנטלי קצר 1-2 משפטים",
  "time_horizon": "קצר (ימים-שבועות) | בינוני (3-6 חודשים) | ארוך (12+ חודשים)",
  "sector_context": "הקשר סקטוריאלי — משפט אחד"
}"""


def build_user_prompt(req: InsightRequest) -> str:
    sig = req.signal or {}
    info = req.info or {}
    perf = req.performance or {}
    sr = req.support_resistance or {}
    fib = req.fibonacci or {}

    lines = [
        f"מניה: {req.symbol} ({req.name})",
        f"מחיר נוכחי: ${req.current_price}",
        f"סקטור: {req.sector or info.get('sector', 'לא ידוע')}",
        "",
        "── נתונים טכניים ──",
        f"ציון איתות: {sig.get('score', 'N/A')}/100 | איתות: {sig.get('signal', 'N/A')}",
        f"RSI(14): {sig.get('rsi', 'N/A')}",
        f"MACD: {sig.get('macd', 'N/A')} | Signal: {sig.get('macd_signal', 'N/A')}",
        f"SMA20: ${sig.get('sma20', 'N/A')} | SMA50: ${sig.get('sma50', 'N/A')} | SMA150: ${sig.get('sma150', 'N/A')} | SMA200: ${sig.get('sma200', 'N/A')}",
        f"Stochastic K: {sig.get('stoch_k', 'N/A')} | D: {sig.get('stoch_d', 'N/A')}",
        f"Bollinger Upper: ${sig.get('bb_upper', 'N/A')} | Lower: ${sig.get('bb_lower', 'N/A')}",
        f"תמיכה: ${sr.get('support', 'N/A')} | התנגדות: ${sr.get('resistance', 'N/A')}",
    ]

    if fib.get("levels"):
        lines.append(f"פיבונאצ׳י 38.2%: ${fib['levels'].get('38.2', 'N/A')} | 61.8%: ${fib['levels'].get('61.8', 'N/A')}")

    lines += [
        "",
        "── נתונים פונדמנטליים ──",
        f"P/E: {info.get('pe_ratio', sig.get('pe_ratio', 'N/A'))}",
        f"שווי שוק: {info.get('market_cap', 'N/A')}",
        f"Beta: {info.get('beta', 'N/A')}",
        f"תשואת דיבידנד: {info.get('dividend_yield', 'N/A')}",
        f"52W High: ${info.get('52w_high', 'N/A')} | Low: ${info.get('52w_low', 'N/A')}",
        "",
        "── ביצועים ──",
        f"1Y: {perf.get('1y', 'N/A')}% | 6M: {perf.get('6m', 'N/A')}% | 3M: {perf.get('3m', 'N/A')}% | 1M: {perf.get('1m', 'N/A')}% | 5D: {perf.get('5d', 'N/A')}%",
        "",
        "── AI Reasons from Algorithm ──",
    ]
    for r in (sig.get("reasons") or [])[:4]:
        lines.append(f"✓ {r}")
    for w in (sig.get("warnings") or [])[:3]:
        lines.append(f"⚠ {w}")

    lines.append("\nבצע ניתוח מקיף והחזר JSON בלבד.")
    return "\n".join(lines)


@router.post("/insights")
def get_ai_insights(req: InsightRequest):
    client = get_client()
    user_prompt = build_user_prompt(req)

    try:
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=900,
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
    raw = re.sub(r"\s*```$", "", raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Best-effort: return raw text in summary field
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
