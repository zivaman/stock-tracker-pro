import pandas as pd
import numpy as np
from typing import Dict, Any, Optional


def calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate all technical indicators on OHLCV dataframe."""
    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    volume = df["Volume"]

    # Moving Averages
    df["SMA20"] = close.rolling(20).mean()
    df["SMA50"] = close.rolling(50).mean()
    df["SMA200"] = close.rolling(200).mean()
    df["EMA12"] = close.ewm(span=12, adjust=False).mean()
    df["EMA26"] = close.ewm(span=26, adjust=False).mean()

    # MACD
    df["MACD"] = df["EMA12"] - df["EMA26"]
    df["MACD_Signal"] = df["MACD"].ewm(span=9, adjust=False).mean()
    df["MACD_Hist"] = df["MACD"] - df["MACD_Signal"]

    # RSI
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(14).mean()
    rs = gain / loss
    df["RSI"] = 100 - (100 / (1 + rs))

    # Bollinger Bands
    df["BB_Middle"] = close.rolling(20).mean()
    bb_std = close.rolling(20).std()
    df["BB_Upper"] = df["BB_Middle"] + 2 * bb_std
    df["BB_Lower"] = df["BB_Middle"] - 2 * bb_std

    # ATR
    tr1 = high - low
    tr2 = (high - close.shift()).abs()
    tr3 = (low - close.shift()).abs()
    df["ATR"] = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1).rolling(14).mean()

    # Volume MA
    df["Volume_MA20"] = volume.rolling(20).mean()

    # Stochastic
    low14 = low.rolling(14).min()
    high14 = high.rolling(14).max()
    df["Stoch_K"] = 100 * (close - low14) / (high14 - low14)
    df["Stoch_D"] = df["Stoch_K"].rolling(3).mean()

    return df


def compute_fibonacci(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Compute Fibonacci retracement levels based on 52-week high/low.
    Returns levels at 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%
    """
    if len(df) < 20:
        return {}
    try:
        period = df.tail(252)  # up to 1 year
        swing_high = float(period["High"].max())
        swing_low = float(period["Low"].min())
        diff = swing_high - swing_low

        levels = {
            "0":    round(swing_high, 2),
            "23.6": round(swing_high - 0.236 * diff, 2),
            "38.2": round(swing_high - 0.382 * diff, 2),
            "50":   round(swing_high - 0.500 * diff, 2),
            "61.8": round(swing_high - 0.618 * diff, 2),
            "78.6": round(swing_high - 0.786 * diff, 2),
            "100":  round(swing_low, 2),
        }
        return {
            "swing_high": round(swing_high, 2),
            "swing_low": round(swing_low, 2),
            "levels": levels,
        }
    except Exception:
        return {}


def compute_signal(df: pd.DataFrame, pe_ratio: Optional[float] = None) -> Dict[str, Any]:
    """Compute buy/sell signal score (0-100) with detailed Hebrew reasoning."""
    if len(df) < 60:
        return {"score": 0, "signal": "neutral", "reasons": [], "warnings": []}

    latest = df.iloc[-1]
    prev = df.iloc[-2]
    score = 0
    reasons = []
    warnings = []

    # ── RSI ──
    rsi = latest.get("RSI", 50)
    if pd.isna(rsi):
        rsi = 50
    if rsi < 30:
        score += 18
        reasons.append(f"RSI = {rsi:.1f} — המניה ב-Oversold קיצוני. היסטורית, RSI מתחת ל-30 מסמן הזדמנות קנייה פוטנציאלית כאשר לחץ המכירה מתמתן")
    elif rsi < 45:
        score += 22
        reasons.append(f"RSI = {rsi:.1f} — אזור קנייה (30-45). המניה יוצאת מ-Oversold — מומנטום חיובי מתפתח")
    elif rsi < 55:
        score += 10
        reasons.append(f"RSI = {rsi:.1f} — ניטראלי-חיובי. ערך RSI בין 45-55 מעיד על שיווי משקל בשוק")
    elif rsi >= 70:
        score -= 15
        warnings.append(f"RSI = {rsi:.1f} — Overbought. ערכים מעל 70 מעידים שהמניה מוערכת יתר על המידה לטווח קצר — שקול מכירה חלקית")
    else:
        score += 5

    # ── MACD ──
    macd = latest.get("MACD", 0)
    macd_sig = latest.get("MACD_Signal", 0)
    prev_macd = prev.get("MACD", 0)
    prev_sig = prev.get("MACD_Signal", 0)
    if pd.isna(macd): macd = 0
    if pd.isna(macd_sig): macd_sig = 0
    if pd.isna(prev_macd): prev_macd = 0
    if pd.isna(prev_sig): prev_sig = 0

    if macd > macd_sig and prev_macd <= prev_sig:
        score += 25
        reasons.append("חציית MACD מעלה (Bullish Crossover) — איתות קנייה חזק. MACD חצה את קו האות כלפי מעלה, מה שמעיד על שינוי מגמה לחיובי")
    elif macd > macd_sig:
        score += 12
        reasons.append(f"MACD ({macd:.3f}) מעל קו האות ({macd_sig:.3f}) — מומנטום חיובי. הפרש חיובי מעיד על כוח עולה")
    elif macd < macd_sig and prev_macd >= prev_sig:
        score -= 20
        warnings.append("חציית MACD מטה (Bearish Crossover) — איתות מכירה. MACD חצה את קו האות כלפי מטה — מגמת ירידה מתפתחת")
    elif macd < macd_sig:
        score -= 8
        warnings.append(f"MACD ({macd:.3f}) מתחת לקו האות ({macd_sig:.3f}) — לחץ שלילי. ממליץ להמתין לחציה חיובית לפני כניסה")

    # ── Moving Averages ──
    close = latest["Close"]
    sma20 = latest.get("SMA20")
    sma50 = latest.get("SMA50")
    sma200 = latest.get("SMA200")

    if sma50 and not pd.isna(sma50):
        if close > sma50:
            score += 12
            reasons.append(f"מחיר (${close:.2f}) מעל ממוצע 50 יום (${sma50:.2f}) — מגמה עולה לטווח בינוני. SMA50 משמש כרמת תמיכה")
        else:
            score -= 8
            warnings.append(f"מחיר (${close:.2f}) מתחת לממוצע 50 יום (${sma50:.2f}) — חולשה לטווח בינוני. SMA50 הפך להתנגדות")

    if sma200 and not pd.isna(sma200):
        if close > sma200:
            score += 10
            reasons.append(f"מחיר מעל ממוצע 200 יום (${sma200:.2f}) — מגמה ראשית עולה. מנהלי קרנות רבים קונים רק מניות מעל SMA200")
        else:
            score -= 10
            warnings.append(f"מחיר מתחת לממוצע 200 יום (${sma200:.2f}) — מגמה ראשית יורדת. זהירות: רוב המוסדיים נמנעים מרכישה")

    if sma50 and sma200 and not pd.isna(sma50) and not pd.isna(sma200):
        if sma50 > sma200:
            score += 10
            reasons.append(f"Golden Cross: SMA50 (${sma50:.2f}) > SMA200 (${sma200:.2f}) — אחד מאיתותי הקנייה החזקים ביותר בניתוח טכני")
        else:
            score -= 5
            warnings.append(f"Death Cross: SMA50 < SMA200 — איתות שלילי ארוך-טווח. היסטורית, Death Cross קדם לירידות משמעותיות")

    # ── Bollinger Bands ──
    bb_upper = latest.get("BB_Upper")
    bb_lower = latest.get("BB_Lower")
    bb_middle = latest.get("BB_Middle")

    if bb_lower and bb_upper and not pd.isna(bb_lower) and not pd.isna(bb_upper):
        band_range = bb_upper - bb_lower
        if band_range > 0:
            bb_pos = (close - bb_lower) / band_range
            if bb_pos < 0.2:
                score += 10
                reasons.append(f"מחיר ליד הבנד התחתון של בולינגר (${bb_lower:.2f}) — אזור קנייה פוטנציאלי. מחיר בתחתית 2 סטיות תקן")
            elif bb_pos > 0.8:
                score -= 5
                warnings.append(f"מחיר ליד הבנד העליון של בולינגר (${bb_upper:.2f}) — מחיר מתוח. שקול המתנה לפני כניסה")

    # ── Stochastic ──
    stoch_k = latest.get("Stoch_K")
    stoch_d = latest.get("Stoch_D")
    if stoch_k and not pd.isna(stoch_k):
        if stoch_k < 20:
            score += 10
            reasons.append(f"Stochastic K = {stoch_k:.1f} — Oversold. ערכים מתחת ל-20 מסמנים לחץ מכירה מוגזם — הזדמנות")
        elif stoch_k > 80:
            score -= 8
            warnings.append(f"Stochastic K = {stoch_k:.1f} — Overbought. ערכים מעל 80 מסמנים קנייה מוגזמת — שקול מכירה")

    # ── Volume ──
    volume = latest.get("Volume", 0)
    vol_ma = latest.get("Volume_MA20", 1)
    if vol_ma and not pd.isna(vol_ma) and vol_ma > 0:
        vol_ratio = volume / vol_ma
        if vol_ratio > 1.5:
            score += 8
            reasons.append(f"נפח מסחר {vol_ratio:.1f}x מעל הממוצע — עניין מוסדי גבוה. נפח גבוה מאשר את תנועת המחיר")
        elif vol_ratio < 0.5:
            warnings.append("נפח מסחר נמוך מהממוצע — תנועת מחיר ללא ביסוס נפח, פחות אמינה")

    # ── P/E Ratio (Fundamental) ──
    pe_score_val = None
    if pe_ratio and not pd.isna(pe_ratio) and pe_ratio > 0:
        pe_score_val = round(pe_ratio, 1)
        if pe_ratio < 12:
            score += 15
            reasons.append(f"מכפיל רווח (P/E) = {pe_ratio:.1f} — זול מאוד. מחיר נמוך ביחס לרווחים. שווי הוגן היסטורי: 15-20. כדאי לבחון קנייה")
        elif pe_ratio < 18:
            score += 10
            reasons.append(f"מכפיל רווח (P/E) = {pe_ratio:.1f} — שווי הוגן. הנייר מתומחר בצורה סבירה. טווח קנייה טוב: 12-18")
        elif pe_ratio < 25:
            score += 3
            reasons.append(f"מכפיל רווח (P/E) = {pe_ratio:.1f} — ניטראלי. מחיר הוגן אך לא זול. ייתכן שיש הזדמנויות טובות יותר")
        elif pe_ratio < 35:
            score -= 5
            warnings.append(f"מכפיל רווח (P/E) = {pe_ratio:.1f} — יקר יחסית. מחיר גבוה מהשווי ההוגן. שקול המתנה לירידת מחיר")
        else:
            score -= 12
            warnings.append(f"מכפיל רווח (P/E) = {pe_ratio:.1f} — יקר מאוד. P/E מעל 35 מסמן ציפיות גבוהות שעלולות לא להתממש. סיכון גבוה")

    # ── Cap score ──
    score = max(0, min(100, score))

    if score >= 65:
        signal = "strong_buy"
    elif score >= 45:
        signal = "buy"
    elif score >= 30:
        signal = "watch"
    elif score >= 15:
        signal = "neutral"
    else:
        signal = "sell"

    result = {
        "score": round(score),
        "signal": signal,
        "buy_signal": score >= 55,
        "sell_signal": score < 20,
        "rsi": round(rsi, 1) if not pd.isna(rsi) else None,
        "macd": round(macd, 4) if not pd.isna(pd.Series([macd])).iloc[0] else None,
        "macd_signal": round(macd_sig, 4) if not pd.isna(pd.Series([macd_sig])).iloc[0] else None,
        "sma20": round(sma20, 2) if sma20 is not None and not pd.isna(sma20) else None,
        "sma50": round(sma50, 2) if sma50 is not None and not pd.isna(sma50) else None,
        "sma200": round(sma200, 2) if sma200 is not None and not pd.isna(sma200) else None,
        "bb_upper": round(bb_upper, 2) if bb_upper is not None and not pd.isna(bb_upper) else None,
        "bb_lower": round(bb_lower, 2) if bb_lower is not None and not pd.isna(bb_lower) else None,
        "bb_middle": round(bb_middle, 2) if bb_middle is not None and not pd.isna(bb_middle) else None,
        "stoch_k": round(float(stoch_k), 1) if stoch_k is not None and not pd.isna(stoch_k) else None,
        "stoch_d": round(float(stoch_d), 1) if stoch_d is not None and not pd.isna(stoch_d) else None,
        "pe_ratio": pe_score_val,
        "reasons": reasons,
        "warnings": warnings,
    }
    return result


def get_support_resistance(df: pd.DataFrame, window: int = 20) -> Dict[str, float]:
    """Simple support/resistance based on recent swing highs/lows."""
    recent = df.tail(60)
    highs = recent["High"].rolling(window, center=True).max()
    lows = recent["Low"].rolling(window, center=True).min()
    return {
        "resistance": round(float(highs.dropna().iloc[-1]), 2) if not highs.dropna().empty else None,
        "support": round(float(lows.dropna().iloc[-1]), 2) if not lows.dropna().empty else None,
    }
