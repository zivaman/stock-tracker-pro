from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import anthropic

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    symbol: str
    question: str
    history: Optional[List[ChatMessage]] = []
    context_data: Optional[Dict[str, Any]] = {}


def build_context_str(symbol: str, ctx: Dict[str, Any]) -> str:
    parts = [f"מניה: {symbol}"]
    if ctx.get("current_price"):
        parts.append(f"מחיר נוכחי: ${ctx['current_price']}")
    if ctx.get("signal"):
        parts.append(f"איתות: {ctx['signal']}")
    if ctx.get("score") is not None:
        parts.append(f"ציון טכני: {ctx['score']}/100")
    if ctx.get("rsi") is not None:
        parts.append(f"RSI: {ctx['rsi']}")
    if ctx.get("macd") is not None:
        parts.append(f"MACD: {ctx['macd']}")
    if ctx.get("sma50") is not None:
        parts.append(f"SMA50: ${ctx['sma50']}")
    if ctx.get("sma200") is not None:
        parts.append(f"SMA200: ${ctx['sma200']}")
    if ctx.get("pe_ratio") is not None:
        parts.append(f"מכפיל רווח (P/E): {ctx['pe_ratio']}")
    if ctx.get("reasons"):
        parts.append("סיבות חיוביות: " + " | ".join(ctx["reasons"][:3]))
    if ctx.get("warnings"):
        parts.append("אזהרות: " + " | ".join(ctx["warnings"][:3]))
    if ctx.get("sector"):
        parts.append(f"סקטור: {ctx['sector']}")
    if ctx.get("name"):
        parts.append(f"שם החברה: {ctx['name']}")
    return "\n".join(parts)


@router.post("")
def chat_with_stock(req: ChatRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY לא מוגדר בסביבה. הגדר את המשתנה ונסה שוב."
        )

    client = anthropic.Anthropic(api_key=api_key)

    context_str = build_context_str(req.symbol, req.context_data or {})

    system_prompt = f"""אתה עוזר ניתוח מניות מקצועי שעונה בעברית.
המשתמש שואל אותך על המניה {req.symbol}.

נתוני המניה הנוכחיים:
{context_str}

הנחיות:
- ענה תמיד בעברית בלבד
- תן תשובות מפורטות אך קצרות (3-5 משפטים)
- הסתמך על הנתונים הטכניים שסופקו
- אל תיתן המלצות השקעה נחרצות — ציין תמיד שהניתוח הוא לצורך לימוד בלבד
- השתמש במספרים ספציפיים מהנתונים שסופקו
- אם שואלים על קנייה/מכירה — הסתמך על הציון הטכני והאיתותים שסופקו"""

    # Build message history
    messages = []
    for msg in (req.history or [])[-10:]:  # last 10 messages for context
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": req.question})

    try:
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=600,
            system=system_prompt,
            messages=messages,
        )
        answer = response.content[0].text
        return {"answer": answer, "symbol": req.symbol}
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="ANTHROPIC_API_KEY לא תקין")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"שגיאה בשאילת המודל: {str(e)}")
