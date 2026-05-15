from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import requests as _requests

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    symbol: str
    question: str
    history: Optional[List[ChatMessage]] = []
    context_data: Optional[Dict[str, Any]] = {}


def fmt_num(v, prefix='$', suffix='', decimals=2):
    if v is None: return '—'
    try:
        n = float(v)
        if abs(n) >= 1e12: return f"{prefix}{n/1e12:.2f}T{suffix}"
        if abs(n) >= 1e9:  return f"{prefix}{n/1e9:.2f}B{suffix}"
        if abs(n) >= 1e6:  return f"{prefix}{n/1e6:.1f}M{suffix}"
        return f"{prefix}{n:.{decimals}f}{suffix}"
    except:
        return str(v)


def build_context_str(symbol: str, ctx: Dict[str, Any]) -> str:
    lines = []

    # ── Basic ──
    lines.append(f"### מניה: {symbol}")
    if ctx.get("name"):        lines.append(f"שם חברה: {ctx['name']}")
    if ctx.get("sector"):      lines.append(f"סקטור: {ctx['sector']}")
    if ctx.get("industry"):    lines.append(f"תעשייה: {ctx['industry']}")
    if ctx.get("country"):     lines.append(f"מדינה: {ctx.get('country','—')}")
    if ctx.get("currency"):    lines.append(f"מטבע: {ctx.get('currency','USD')}")
    if ctx.get("website"):     lines.append(f"אתר: {ctx['website']}")

    # ── Description ──
    desc = ctx.get("description", "")
    if desc:
        lines.append(f"\n### תיאור העסק\n{desc[:800]}")

    # ── Price & Market ──
    lines.append("\n### מחיר ושוק")
    if ctx.get("current_price"):    lines.append(f"מחיר נוכחי: ${ctx['current_price']:.2f}")
    if ctx.get("market_cap"):       lines.append(f"שווי שוק: {fmt_num(ctx['market_cap'])}")
    if ctx.get("52w_high"):         lines.append(f"שיא 52 שבועות: ${ctx['52w_high']:.2f}")
    if ctx.get("52w_low"):          lines.append(f"שפל 52 שבועות: ${ctx['52w_low']:.2f}")
    if ctx.get("avg_volume"):       lines.append(f"נפח ממוצע: {fmt_num(ctx['avg_volume'], prefix='', suffix=' מניות')}")
    if ctx.get("beta") is not None: lines.append(f"בטא (סיכון): {ctx['beta']:.2f}")

    # ── Fundamentals ──
    lines.append("\n### יסודות (Fundamentals)")
    if ctx.get("pe_ratio"):         lines.append(f"מכפיל רווח P/E: {ctx['pe_ratio']:.1f}")
    if ctx.get("revenue"):          lines.append(f"הכנסות: {fmt_num(ctx['revenue'])}")
    if ctx.get("profit_margins") is not None:
        lines.append(f"מרווח רווח: {ctx['profit_margins']*100:.1f}%")
    if ctx.get("operating_margins") is not None:
        lines.append(f"מרווח תפעולי: {ctx['operating_margins']*100:.1f}%")
    if ctx.get("earnings_growth") is not None:
        lines.append(f"צמיחת רווחים: {ctx['earnings_growth']*100:.1f}%")
    if ctx.get("revenue_growth") is not None:
        lines.append(f"צמיחת הכנסות: {ctx['revenue_growth']*100:.1f}%")
    if ctx.get("return_on_equity") is not None:
        lines.append(f"תשואה על ההון (ROE): {ctx['return_on_equity']*100:.1f}%")
    if ctx.get("debt_to_equity") is not None:
        lines.append(f"יחס חוב להון: {ctx['debt_to_equity']:.2f}")
    if ctx.get("free_cashflow"):    lines.append(f"תזרים מזומנים חופשי: {fmt_num(ctx['free_cashflow'])}")
    if ctx.get("dividend_yield") is not None and ctx['dividend_yield']:
        lines.append(f"תשואת דיבידנד: {ctx['dividend_yield']*100:.2f}%")
    if ctx.get("payout_ratio") is not None:
        lines.append(f"יחס חלוקת דיבידנד: {ctx['payout_ratio']*100:.1f}%")
    if ctx.get("price_to_book") is not None:
        lines.append(f"מכפיל הון (P/B): {ctx['price_to_book']:.2f}")
    if ctx.get("price_to_sales") is not None:
        lines.append(f"מכפיל מכירות (P/S): {ctx['price_to_sales']:.2f}")
    if ctx.get("enterprise_value"): lines.append(f"שווי ארגוני (EV): {fmt_num(ctx['enterprise_value'])}")
    if ctx.get("employees"):        lines.append(f"עובדים: {int(ctx['employees']):,}")
    if ctx.get("next_earnings"):    lines.append(f"תאריך דוח רווחים הבא: {ctx['next_earnings']}")
    if ctx.get("analyst_rec"):      lines.append(f"המלצת אנליסטים: {ctx['analyst_rec']}")
    if ctx.get("analyst_count"):    lines.append(f"מספר אנליסטים: {ctx['analyst_count']}")
    if ctx.get("target_price"):     lines.append(f"מחיר יעד אנליסטים: ${ctx['target_price']:.2f}")
    if ctx.get("short_float") is not None:
        lines.append(f"שורט פלואט: {ctx['short_float']*100:.1f}%")
    if ctx.get("institutional_pct") is not None:
        lines.append(f"אחזקה מוסדית: {ctx['institutional_pct']*100:.1f}%")

    # ── Performance ──
    perf = ctx.get("performance", {})
    if perf:
        lines.append("\n### ביצועי מחיר")
        for k, label in [('1d','יום'), ('5d','שבוע'), ('1m','חודש'), ('3m','3 חודשים'), ('6m','6 חודשים'), ('1y','שנה')]:
            v = perf.get(k)
            if v is not None:
                sign = '+' if v >= 0 else ''
                lines.append(f"{label}: {sign}{v:.1f}%")

    # ── Technical ──
    lines.append("\n### ניתוח טכני")
    if ctx.get("signal"):           lines.append(f"איתות: {ctx['signal']}")
    if ctx.get("score") is not None: lines.append(f"ציון טכני: {ctx['score']}/100")
    if ctx.get("trend"):            lines.append(f"מגמה: {ctx['trend']}")
    for key, label in [
        ('rsi','RSI'), ('macd','MACD'), ('macd_signal','MACD Signal'),
        ('sma20','SMA20'), ('sma50','SMA50'), ('sma150','SMA150'), ('sma200','SMA200'),
        ('bb_upper','BB עליון'), ('bb_lower','BB תחתון'), ('stoch_k','Stoch %K'),
        ('adx','ADX'), ('atr','ATR'), ('williams_r','Williams %R'), ('cci','CCI'),
        ('vol_ratio','יחס נפח'),
    ]:
        v = ctx.get(key)
        if v is not None:
            lines.append(f"{label}: {v:.2f}" if isinstance(v, float) else f"{label}: {v}")
    if ctx.get("support"):          lines.append(f"תמיכה: ${ctx['support']}")
    if ctx.get("resistance"):       lines.append(f"התנגדות: ${ctx['resistance']}")

    # ── Fibonacci ──
    fib = ctx.get("fibonacci", {})
    if fib and fib.get("swing_high"):
        lines.append(f"\n### פיבונאצ'י\nשיא סווינג: ${fib['swing_high']:.2f} | שפל סווינג: ${fib['swing_low']:.2f}")
        for k, v in (fib.get("levels") or {}).items():
            lines.append(f"  {k}%: ${v:.2f}")

    # ── Reasons / Warnings ──
    if ctx.get("reasons"):
        lines.append("\n### סיבות חיוביות\n" + "\n".join(f"✅ {r}" for r in ctx["reasons"]))
    if ctx.get("warnings"):
        lines.append("\n### אזהרות\n" + "\n".join(f"⚠️ {w}" for w in ctx["warnings"]))

    return "\n".join(lines)


SYSTEM_PROMPT_TEMPLATE = """אתה אנליסט פיננסי מקצועי ומנוסה שמתמחה בשוק ההון האמריקאי והגלובלי.
אתה מסייע למשקיעים להבין לעומק את המניה {symbol}.

## ההנחיות שלך:
- ענה **תמיד בעברית** בלבד
- תן תשובות מעמיקות, מפורטות ואנליטיות — אל תקצר יתר על המידה
- **כיסוי מלא**: אתה יכול לענות על כל שאלה הקשורה למניה:
  * ניתוח טכני (TA) — RSI, MACD, ממוצעים נעים, תבניות גרף
  * ניתוח יסודי (FA) — הכנסות, רווחים, מרווחים, חוב, תזרים מזומנים
  * הערכת שווי — P/E, P/S, P/B, EV/EBITDA, מחיר יעד
  * הקשר ענפי — מתחרים, נתח שוק, מגמות בתעשייה
  * מאקרו — ריבית, אינפלציה, מחזור עסקי, גיאופוליטיקה
  * ניהול וממשל — מנכ"ל, אסטרטגיה, רכישות, הפצת מניות
  * קטליזטורים וסיכונים — דוחות רווחים, רגולציה, תחרות
  * השוואה לסקטור ולמתחרים
- השתמש בנתונים הספציפיים שסופקו — ציין מספרים ממשיים
- בשאלות על קנייה/מכירה: נתח מזוויות מרובות, ציין שזה לצורך מידע בלבד ולא המלצת השקעה
- השתמש בתבנית מסודרת עם כותרות (**כותרת**) כשהתשובה ארוכה
- אם חסר מידע ספציפי, ציין זאת ואז ענה על בסיס הידע הכללי שלך על החברה

## נתוני המניה הנוכחיים:
{context}
"""


def _call_gemini(api_key: str, system: str, history: list, question: str) -> str:
    """Call Gemini 1.5 Flash via REST API."""
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash-lite:generateContent?key={api_key}"
    )

    # Build contents list (history + current question)
    contents = []
    for msg in history[-16:]:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg["content"]}]})
    contents.append({"role": "user", "parts": [{"text": question}]})

    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": 1500,
            "temperature": 0.7,
        },
    }

    resp = _requests.post(url, json=payload, timeout=30)
    if resp.status_code != 200:
        err = resp.json().get("error", {}).get("message", resp.text)
        raise ValueError(err)

    data = resp.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


@router.post("")
def chat_with_stock(req: ChatRequest):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY לא מוגדר. הוסף אותו לקובץ .env"
        )

    context_str = build_context_str(req.symbol, req.context_data or {})
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        symbol=req.symbol,
        context=context_str,
    )

    history = [{"role": m.role, "content": m.content} for m in (req.history or [])]

    try:
        answer = _call_gemini(api_key, system_prompt, history, req.question)
        return {"answer": answer, "symbol": req.symbol}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"שגיאה: {str(e)}")
