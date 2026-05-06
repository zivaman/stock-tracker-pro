import pandas as pd
import numpy as np
from typing import Dict, Any, Optional


def calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate all technical indicators on OHLCV dataframe."""
    close  = df["Close"]
    high   = df["High"]
    low    = df["Low"]
    volume = df["Volume"]

    # ── Moving Averages ────────────────────────────────────────────────────────
    df["SMA20"]  = close.rolling(20).mean()
    df["SMA50"]  = close.rolling(50).mean()
    df["SMA150"] = close.rolling(150).mean()
    df["SMA200"] = close.rolling(200).mean()
    df["EMA9"]   = close.ewm(span=9,  adjust=False).mean()
    df["EMA21"]  = close.ewm(span=21, adjust=False).mean()
    df["EMA12"]  = close.ewm(span=12, adjust=False).mean()
    df["EMA26"]  = close.ewm(span=26, adjust=False).mean()

    # ── MACD ──────────────────────────────────────────────────────────────────
    df["MACD"]        = df["EMA12"] - df["EMA26"]
    df["MACD_Signal"] = df["MACD"].ewm(span=9, adjust=False).mean()
    df["MACD_Hist"]   = df["MACD"] - df["MACD_Signal"]

    # ── RSI ───────────────────────────────────────────────────────────────────
    delta = close.diff()
    gain  = delta.where(delta > 0, 0.0).rolling(14).mean()
    loss  = (-delta.where(delta < 0, 0.0)).rolling(14).mean()
    df["RSI"] = 100 - (100 / (1 + gain / loss))

    # ── Bollinger Bands ───────────────────────────────────────────────────────
    df["BB_Middle"] = close.rolling(20).mean()
    bb_std          = close.rolling(20).std()
    df["BB_Upper"]  = df["BB_Middle"] + 2 * bb_std
    df["BB_Lower"]  = df["BB_Middle"] - 2 * bb_std
    df["BB_Width"]  = (df["BB_Upper"] - df["BB_Lower"]) / df["BB_Middle"]

    # ── ATR ───────────────────────────────────────────────────────────────────
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low  - close.shift()).abs(),
    ], axis=1).max(axis=1)
    df["ATR"] = tr.rolling(14).mean()
    df["ATR_Pct"] = df["ATR"] / close * 100   # ATR as % of price

    # ── Stochastic (14,3) ─────────────────────────────────────────────────────
    low14   = low.rolling(14).min()
    high14  = high.rolling(14).max()
    df["Stoch_K"] = 100 * (close - low14) / (high14 - low14)
    df["Stoch_D"] = df["Stoch_K"].rolling(3).mean()

    # ── Williams %R ───────────────────────────────────────────────────────────
    df["WilliamsR"] = -100 * (high.rolling(14).max() - close) / (high.rolling(14).max() - low.rolling(14).min())

    # ── CCI (Commodity Channel Index) ─────────────────────────────────────────
    typical = (high + low + close) / 3
    cci_ma  = typical.rolling(20).mean()
    cci_md  = typical.rolling(20).apply(lambda x: np.mean(np.abs(x - x.mean())), raw=True)
    df["CCI"] = (typical - cci_ma) / (0.015 * cci_md)

    # ── OBV (On Balance Volume) ───────────────────────────────────────────────
    obv = [0]
    for i in range(1, len(close)):
        if close.iloc[i] > close.iloc[i - 1]:
            obv.append(obv[-1] + volume.iloc[i])
        elif close.iloc[i] < close.iloc[i - 1]:
            obv.append(obv[-1] - volume.iloc[i])
        else:
            obv.append(obv[-1])
    df["OBV"]        = obv
    df["OBV_EMA20"]  = pd.Series(obv, index=df.index).ewm(span=20, adjust=False).mean()

    # ── MFI (Money Flow Index) ────────────────────────────────────────────────
    tp     = (high + low + close) / 3
    mf     = tp * volume
    pos_mf = mf.where(tp > tp.shift(1), 0.0).rolling(14).sum()
    neg_mf = mf.where(tp < tp.shift(1), 0.0).rolling(14).sum()
    df["MFI"] = 100 - (100 / (1 + pos_mf / neg_mf.replace(0, np.nan)))

    # ── ADX (Average Directional Index) ───────────────────────────────────────
    plus_dm  = high.diff().clip(lower=0)
    minus_dm = (-low.diff()).clip(lower=0)
    plus_dm  = plus_dm.where(plus_dm > minus_dm, 0)
    minus_dm = minus_dm.where(minus_dm > plus_dm, 0)

    atr14     = tr.rolling(14).mean()
    plus_di   = 100 * plus_dm.rolling(14).mean()  / atr14.replace(0, np.nan)
    minus_di  = 100 * minus_dm.rolling(14).mean() / atr14.replace(0, np.nan)
    dx        = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    df["ADX"]       = dx.rolling(14).mean()
    df["Plus_DI"]   = plus_di
    df["Minus_DI"]  = minus_di

    # ── Ichimoku (Tenkan / Kijun / Senkou A & B) ──────────────────────────────
    df["Tenkan"]   = (high.rolling(9).max()  + low.rolling(9).min())  / 2
    df["Kijun"]    = (high.rolling(26).max() + low.rolling(26).min()) / 2
    df["SenkouA"]  = ((df["Tenkan"] + df["Kijun"]) / 2).shift(26)
    df["SenkouB"]  = ((high.rolling(52).max() + low.rolling(52).min()) / 2).shift(26)
    df["Chikou"]   = close.shift(-26)

    # ── Volume MA ─────────────────────────────────────────────────────────────
    df["Volume_MA20"] = volume.rolling(20).mean()
    df["Volume_Ratio"] = volume / df["Volume_MA20"]

    return df


def compute_fibonacci(df: pd.DataFrame) -> Dict[str, Any]:
    if len(df) < 20:
        return {}
    try:
        period     = df.tail(252)
        swing_high = float(period["High"].max())
        swing_low  = float(period["Low"].min())
        diff       = swing_high - swing_low
        levels = {
            "0":    round(swing_high, 2),
            "23.6": round(swing_high - 0.236 * diff, 2),
            "38.2": round(swing_high - 0.382 * diff, 2),
            "50":   round(swing_high - 0.500 * diff, 2),
            "61.8": round(swing_high - 0.618 * diff, 2),
            "78.6": round(swing_high - 0.786 * diff, 2),
            "100":  round(swing_low, 2),
        }
        return {"swing_high": round(swing_high, 2), "swing_low": round(swing_low, 2), "levels": levels}
    except Exception:
        return {}


def _s(v) -> Optional[float]:
    """Safe float — return None if NaN/None."""
    try:
        f = float(v)
        return None if np.isnan(f) else f
    except Exception:
        return None


def compute_signal(df: pd.DataFrame,
                   pe_ratio: Optional[float] = None,
                   fundamentals: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Full scoring engine (0-100) covering:
    • Technical: RSI, MACD, SMAs (20/50/150/200), EMA9/21, BB, Stoch,
                 Williams %R, CCI, OBV, MFI, ADX, Ichimoku, ATR, Volume
    • Fundamental: P/E, Forward P/E, PEG, P/B, EPS growth, Revenue growth,
                   Profit margin, Debt/Equity, ROE, ROA, Current ratio
    • Trend: multi-timeframe trend score → bearish/bullish label
    """
    if len(df) < 60:
        return {"score": 0, "signal": "neutral", "reasons": [], "warnings": []}

    latest = df.iloc[-1]
    prev   = df.iloc[-2]
    fund   = fundamentals or {}
    score  = 0
    reasons   = []
    warnings  = []
    bull_count = 0   # for trend meter
    bear_count = 0

    def add(pts, msg):
        nonlocal score, bull_count
        score += pts
        bull_count += 1
        reasons.append(msg)

    def sub(pts, msg):
        nonlocal score, bear_count
        score -= pts
        bear_count += 1
        warnings.append(msg)

    close = _s(latest["Close"]) or 0

    # ══════════════════════════════════════════════════════════════════════════
    # 1. RSI  (weight ~18)
    # ══════════════════════════════════════════════════════════════════════════
    rsi = _s(latest.get("RSI")) or 50
    if rsi < 25:
        add(18, f"RSI={rsi:.1f} — Oversold קיצוני. לחץ מכירה מוגזם — הזדמנות כניסה היסטורית")
    elif rsi < 40:
        add(14, f"RSI={rsi:.1f} — אזור Oversold. מומנטום שלילי מתמתן — סיגנל קנייה מתפתח")
    elif rsi < 55:
        add(7,  f"RSI={rsi:.1f} — ניטראלי. שיווי משקל בין קונים ומוכרים")
    elif rsi > 80:
        sub(18, f"RSI={rsi:.1f} — Overbought קיצוני. סיכון גבוה לתיקון — שקול מכירה")
    elif rsi > 70:
        sub(10, f"RSI={rsi:.1f} — Overbought. מחיר מתוח, המתן לתיקון לפני כניסה")
    else:
        add(4,  f"RSI={rsi:.1f} — ניטראלי-חיובי")

    # ══════════════════════════════════════════════════════════════════════════
    # 2. MACD  (weight ~20)
    # ══════════════════════════════════════════════════════════════════════════
    macd     = _s(latest.get("MACD"))     or 0
    macd_sig = _s(latest.get("MACD_Signal")) or 0
    prev_m   = _s(prev.get("MACD"))       or 0
    prev_s   = _s(prev.get("MACD_Signal")) or 0
    macd_hist = _s(latest.get("MACD_Hist")) or 0

    if macd > macd_sig and prev_m <= prev_s:
        add(20, "Bullish Crossover MACD — חציה מעלה: מגמה מתהפכת לחיובי (אחד האיתותים החזקים ביותר)")
    elif macd > macd_sig and macd_hist > 0:
        add(10, f"MACD ({macd:.3f}) מעל קו האות — מומנטום חיובי מתחזק")
    elif macd < macd_sig and prev_m >= prev_s:
        sub(20, "Bearish Crossover MACD — חציה מטה: מגמה מתהפכת לשלילי — איתות מכירה חזק")
    elif macd < macd_sig:
        sub(8,  f"MACD ({macd:.3f}) מתחת לקו האות — מומנטום שלילי, המתן לחציה חיובית")

    # ══════════════════════════════════════════════════════════════════════════
    # 3. EMA9 / EMA21 מהיר  (weight ~8)
    # ══════════════════════════════════════════════════════════════════════════
    ema9  = _s(latest.get("EMA9"))
    ema21 = _s(latest.get("EMA21"))
    if ema9 and ema21:
        prev_e9  = _s(prev.get("EMA9"))
        prev_e21 = _s(prev.get("EMA21"))
        if ema9 > ema21 and prev_e9 and prev_e21 and prev_e9 <= prev_e21:
            add(8, f"EMA9 חצה מעל EMA21 (${ema9:.2f} > ${ema21:.2f}) — Bullish crossover מהיר")
        elif ema9 < ema21 and prev_e9 and prev_e21 and prev_e9 >= prev_e21:
            sub(8, f"EMA9 חצה מתחת EMA21 — Bearish crossover מהיר")
        elif ema9 > ema21:
            add(4, f"EMA9 (${ema9:.2f}) מעל EMA21 (${ema21:.2f}) — מומנטום קצר-טווח חיובי")
        else:
            sub(4, f"EMA9 (${ema9:.2f}) מתחת EMA21 (${ema21:.2f}) — מומנטום קצר-טווח שלילי")

    # ══════════════════════════════════════════════════════════════════════════
    # 4. ממוצעים ארוכים SMA50/150/200 + Golden/Death Cross  (weight ~28)
    # ══════════════════════════════════════════════════════════════════════════
    sma20  = _s(latest.get("SMA20"))
    sma50  = _s(latest.get("SMA50"))
    sma150 = _s(latest.get("SMA150"))
    sma200 = _s(latest.get("SMA200"))

    if sma50:
        if close > sma50:
            add(10, f"מחיר (${close:.2f}) מעל SMA50 (${sma50:.2f}) — תמיכה בינונית-טווח")
        else:
            sub(8,  f"מחיר (${close:.2f}) מתחת SMA50 (${sma50:.2f}) — SMA50 הפך להתנגדות")

    if sma150:
        if close > sma150:
            add(6,  f"מחיר מעל SMA150 (${sma150:.2f}) — מגמה בינונית-ארוכה חיובית")
        else:
            sub(5,  f"מחיר מתחת SMA150 (${sma150:.2f}) — חולשה לטווח בינוני-ארוך")

    if sma200:
        if close > sma200:
            add(10, f"מחיר מעל SMA200 (${sma200:.2f}) — מגמה ראשית עולה. מוסדיים קונים מעל SMA200")
        else:
            sub(10, f"מחיר מתחת SMA200 (${sma200:.2f}) — מגמה ראשית יורדת. מוסדיים נמנעים")

    if sma50 and sma200:
        if sma50 > sma200:
            add(10, f"Golden Cross: SMA50 (${sma50:.2f}) > SMA200 (${sma200:.2f}) — איתות Bullish חזק")
        else:
            sub(8,  f"Death Cross: SMA50 < SMA200 — איתות Bearish ארוך-טווח")

    # ══════════════════════════════════════════════════════════════════════════
    # 5. Bollinger Bands  (weight ~10)
    # ══════════════════════════════════════════════════════════════════════════
    bb_upper = _s(latest.get("BB_Upper"))
    bb_lower = _s(latest.get("BB_Lower"))
    bb_mid   = _s(latest.get("BB_Middle"))
    bb_width = _s(latest.get("BB_Width"))

    if bb_lower and bb_upper:
        rng = bb_upper - bb_lower
        if rng > 0:
            bb_pos = (close - bb_lower) / rng
            if bb_pos < 0.15:
                add(10, f"מחיר ליד Bollinger Lower (${bb_lower:.2f}) — 2SD מתחת לממוצע, אזור קנייה")
            elif bb_pos < 0.30:
                add(5,  f"מחיר בתחתית Bollinger — אזור עניין לרכישה")
            elif bb_pos > 0.85:
                sub(8,  f"מחיר ליד Bollinger Upper (${bb_upper:.2f}) — מתוח, סיכון תיקון")
            elif bb_pos > 0.70:
                sub(4,  "מחיר בעליית Bollinger — זהירות, קרוב להתנגדות עליונה")
        if bb_width and bb_width < 0.05:
            add(4, "Bollinger Squeeze — רוחב פס צר, לחץ שמצביע על פריצה קרובה")

    # ══════════════════════════════════════════════════════════════════════════
    # 6. Stochastic  (weight ~8)
    # ══════════════════════════════════════════════════════════════════════════
    stoch_k = _s(latest.get("Stoch_K"))
    stoch_d = _s(latest.get("Stoch_D"))
    if stoch_k is not None:
        if stoch_k < 20:
            add(8, f"Stochastic K={stoch_k:.1f} — Oversold, איתות קנייה")
        elif stoch_k > 80:
            sub(8, f"Stochastic K={stoch_k:.1f} — Overbought, איתות מכירה")
        if stoch_d and stoch_k > stoch_d and stoch_k < 30:
            add(5, "Stochastic Bullish Crossover מאזור Oversold — חיזוק איתות קנייה")
        elif stoch_d and stoch_k < stoch_d and stoch_k > 70:
            sub(5, "Stochastic Bearish Crossover מאזור Overbought — חיזוק איתות מכירה")

    # ══════════════════════════════════════════════════════════════════════════
    # 7. Williams %R  (weight ~6)
    # ══════════════════════════════════════════════════════════════════════════
    wr = _s(latest.get("WilliamsR"))
    if wr is not None:
        if wr < -80:
            add(6,  f"Williams %R={wr:.1f} — Oversold קיצוני, מועמד לקנייה")
        elif wr > -20:
            sub(6,  f"Williams %R={wr:.1f} — Overbought קיצוני, זהירות")

    # ══════════════════════════════════════════════════════════════════════════
    # 8. CCI  (weight ~6)
    # ══════════════════════════════════════════════════════════════════════════
    cci = _s(latest.get("CCI"))
    if cci is not None:
        if cci < -150:
            add(6,  f"CCI={cci:.0f} — Oversold עמוק, לחץ מכירה מוגזם")
        elif cci < -100:
            add(4,  f"CCI={cci:.0f} — Oversold, אזור עניין")
        elif cci > 150:
            sub(6,  f"CCI={cci:.0f} — Overbought חזק, שקול מכירה")
        elif cci > 100:
            sub(3,  f"CCI={cci:.0f} — Overbought, זהירות")

    # ══════════════════════════════════════════════════════════════════════════
    # 9. OBV (On Balance Volume)  (weight ~8)
    # ══════════════════════════════════════════════════════════════════════════
    obv     = _s(latest.get("OBV"))
    obv_ema = _s(latest.get("OBV_EMA20"))
    if obv is not None and obv_ema is not None:
        if obv > obv_ema:
            add(8, "OBV מעל EMA20 שלו — כסף מוסדי זורם פנימה (Accumulation), Bullish")
        else:
            sub(6, "OBV מתחת EMA20 — לחץ מכירה מוסדי (Distribution), Bearish")

    # ══════════════════════════════════════════════════════════════════════════
    # 10. MFI (Money Flow Index)  (weight ~6)
    # ══════════════════════════════════════════════════════════════════════════
    mfi = _s(latest.get("MFI"))
    if mfi is not None:
        if mfi < 20:
            add(6,  f"MFI={mfi:.1f} — Oversold. כסף חוזר למניה — הזדמנות")
        elif mfi > 80:
            sub(6,  f"MFI={mfi:.1f} — Overbought. יציאת כסף קרובה")

    # ══════════════════════════════════════════════════════════════════════════
    # 11. ADX — חוזק המגמה  (weight ~8)
    # ══════════════════════════════════════════════════════════════════════════
    adx      = _s(latest.get("ADX"))
    plus_di  = _s(latest.get("Plus_DI"))
    minus_di = _s(latest.get("Minus_DI"))
    if adx is not None:
        trend_strong = adx > 25
        if adx > 40:
            trend_label = "מגמה חזקה מאוד"
        elif adx > 25:
            trend_label = "מגמה ברורה"
        else:
            trend_label = "מגמה חלשה/צדדית"
        if trend_strong and plus_di and minus_di:
            if plus_di > minus_di:
                add(8,  f"ADX={adx:.1f} — {trend_label} עולה (+DI>{minus_di:.1f}): Bullish מאושר")
            else:
                sub(8,  f"ADX={adx:.1f} — {trend_label} יורדת (-DI>{plus_di:.1f}): Bearish מאושר")
        elif not trend_strong:
            warnings.append(f"ADX={adx:.1f} — מגמה חלשה, שוק צדדי — קשה לזהות כיוון ברור")

    # ══════════════════════════════════════════════════════════════════════════
    # 12. Ichimoku Cloud  (weight ~8)
    # ══════════════════════════════════════════════════════════════════════════
    tenkan  = _s(latest.get("Tenkan"))
    kijun   = _s(latest.get("Kijun"))
    senkou_a = _s(latest.get("SenkouA"))
    senkou_b = _s(latest.get("SenkouB"))
    if tenkan and kijun:
        if close > max(senkou_a or 0, senkou_b or 0):
            add(8, f"מחיר מעל ענן Ichimoku — אזור Bullish ברור (Kumo Breakout)")
        elif close < min(senkou_a or float("inf"), senkou_b or float("inf")):
            sub(8, "מחיר מתחת לענן Ichimoku — אזור Bearish (מחיר מתחת לענן)")
        else:
            warnings.append("מחיר בתוך ענן Ichimoku — אזור ניטראלי, המתן לפריצה")
        if tenkan > kijun:
            add(4, f"Tenkan (${tenkan:.2f}) > Kijun (${kijun:.2f}) — מומנטום Bullish לפי Ichimoku")
        else:
            sub(4, f"Tenkan (${tenkan:.2f}) < Kijun (${kijun:.2f}) — מומנטום Bearish לפי Ichimoku")

    # ══════════════════════════════════════════════════════════════════════════
    # 13. Volume  (weight ~6)
    # ══════════════════════════════════════════════════════════════════════════
    vol_ratio = _s(latest.get("Volume_Ratio"))
    if vol_ratio:
        if vol_ratio > 2.0:
            add(6, f"נפח מסחר {vol_ratio:.1f}x — פעילות חריגה מאוד, עניין מוסדי גבוה")
        elif vol_ratio > 1.5:
            add(4, f"נפח מסחר {vol_ratio:.1f}x מהממוצע — מאשר את תנועת המחיר")
        elif vol_ratio < 0.5:
            warnings.append("נפח מסחר נמוך מהממוצע — תנועת מחיר חלשה, פחות אמינה")

    # ══════════════════════════════════════════════════════════════════════════
    # 14. ATR — תנודתיות  (informational)
    # ══════════════════════════════════════════════════════════════════════════
    atr_pct = _s(latest.get("ATR_Pct"))
    if atr_pct:
        if atr_pct > 4:
            warnings.append(f"ATR={atr_pct:.1f}% — תנודתיות גבוהה מאוד. סיכון גדול, הגדל שולי ביטחון")
        elif atr_pct > 2.5:
            warnings.append(f"ATR={atr_pct:.1f}% — תנודתיות בינונית-גבוהה")

    # ══════════════════════════════════════════════════════════════════════════
    # 15. P/E  (weight ~12)
    # ══════════════════════════════════════════════════════════════════════════
    pe_val = pe_ratio
    if pe_val and pe_val > 0:
        if pe_val < 12:
            add(12, f"P/E={pe_val:.1f} — זול מאוד (היסטורי: 15-20). הזדמנות ערך")
        elif pe_val < 18:
            add(8,  f"P/E={pe_val:.1f} — שווי הוגן. תמחור סביר, אזור כניסה טוב")
        elif pe_val < 25:
            add(3,  f"P/E={pe_val:.1f} — ניטראלי, מחיר הוגן אך לא זול")
        elif pe_val < 40:
            sub(6,  f"P/E={pe_val:.1f} — יקר. תומחר מעל הממוצע ההיסטורי")
        else:
            sub(12, f"P/E={pe_val:.1f} — יקר מאוד. ציפיות גבוהות מאוד — סיכון גבוה")

    # ══════════════════════════════════════════════════════════════════════════
    # 16. Forward P/E  (weight ~6)
    # ══════════════════════════════════════════════════════════════════════════
    fwd_pe = fund.get("forward_pe")
    if fwd_pe and fwd_pe > 0 and pe_val and pe_val > 0:
        if fwd_pe < pe_val * 0.85:
            add(6, f"Forward P/E={fwd_pe:.1f} < Trailing P/E={pe_val:.1f} — צפי שיפור רווח משמעותי")
        elif fwd_pe > pe_val * 1.15:
            sub(4, f"Forward P/E={fwd_pe:.1f} > Trailing — צפי לירידה ברווח")

    # ══════════════════════════════════════════════════════════════════════════
    # 17. PEG Ratio  (weight ~8)
    # ══════════════════════════════════════════════════════════════════════════
    peg = fund.get("peg_ratio")
    if peg and peg > 0:
        if peg < 0.8:
            add(8, f"PEG={peg:.2f} — זול ביחס לצמיחה. מניית Growth מתומחרת בחסר")
        elif peg < 1.5:
            add(4, f"PEG={peg:.2f} — הוגן ביחס לצמיחה")
        elif peg > 3:
            sub(8, f"PEG={peg:.2f} — יקר מאוד ביחס לצמיחה. שקול אלטרנטיבות")
        elif peg > 2:
            sub(4, f"PEG={peg:.2f} — יקר ביחס לצמיחה")

    # ══════════════════════════════════════════════════════════════════════════
    # 18. P/B Ratio  (weight ~4)
    # ══════════════════════════════════════════════════════════════════════════
    pb = fund.get("price_to_book")
    if pb and pb > 0:
        if pb < 1.0:
            add(6, f"P/B={pb:.2f} — מניה נסחרת מתחת לשווי נכסיה. הזדמנות ערך")
        elif pb < 3.0:
            add(2, f"P/B={pb:.2f} — שווי נכסי סביר")
        elif pb > 10:
            sub(4, f"P/B={pb:.2f} — גבוה מאוד. מניה מתומחרת על ציפיות ולא על נכסים")

    # ══════════════════════════════════════════════════════════════════════════
    # 19. EPS Growth  (weight ~8)
    # ══════════════════════════════════════════════════════════════════════════
    eps_growth = fund.get("earnings_growth")
    if eps_growth is not None:
        eg_pct = eps_growth * 100
        if eg_pct > 30:
            add(8, f"צמיחת EPS={eg_pct:.1f}% — צמיחה מרשימה. הרווח גדל במהירות")
        elif eg_pct > 10:
            add(4, f"צמיחת EPS={eg_pct:.1f}% — צמיחה בריאה")
        elif eg_pct < -20:
            sub(8, f"צמיחת EPS={eg_pct:.1f}% — ירידה חדה ברווח. דגל אדום פונדמנטלי")
        elif eg_pct < 0:
            sub(4, f"צמיחת EPS={eg_pct:.1f}% — ירידה ברווח. יש לבחון סיבות")

    # ══════════════════════════════════════════════════════════════════════════
    # 20. Revenue Growth  (weight ~6)
    # ══════════════════════════════════════════════════════════════════════════
    rev_growth = fund.get("revenue_growth")
    if rev_growth is not None:
        rg_pct = rev_growth * 100
        if rg_pct > 20:
            add(6, f"צמיחת הכנסות={rg_pct:.1f}% — צמיחה גבוהה. חברה מרחיבה נתח שוק")
        elif rg_pct > 8:
            add(3, f"צמיחת הכנסות={rg_pct:.1f}% — צמיחה סבירה")
        elif rg_pct < -10:
            sub(6, f"צמיחת הכנסות={rg_pct:.1f}% — ירידת הכנסות. דגל אדום")
        elif rg_pct < 0:
            sub(3, f"צמיחת הכנסות={rg_pct:.1f}% — הכנסות דועכות")

    # ══════════════════════════════════════════════════════════════════════════
    # 21. ROE  (weight ~6)
    # ══════════════════════════════════════════════════════════════════════════
    roe = fund.get("return_on_equity")
    if roe is not None:
        roe_pct = roe * 100
        if roe_pct > 20:
            add(6, f"ROE={roe_pct:.1f}% — תשואה גבוהה על ההון. ניהול מצוין")
        elif roe_pct > 10:
            add(3, f"ROE={roe_pct:.1f}% — תשואה סבירה על ההון")
        elif roe_pct < 0:
            sub(6, f"ROE={roe_pct:.1f}% — תשואה שלילית על ההון. חברה מפסידה")

    # ══════════════════════════════════════════════════════════════════════════
    # 22. Debt/Equity  (weight ~4)
    # ══════════════════════════════════════════════════════════════════════════
    de = fund.get("debt_to_equity")
    if de is not None:
        if de < 30:
            add(4, f"Debt/Equity={de:.1f}% — מינוף נמוך. מאזן חזק")
        elif de > 200:
            sub(6, f"Debt/Equity={de:.1f}% — מינוף גבוה מאוד. סיכון פיננסי")
        elif de > 100:
            sub(3, f"Debt/Equity={de:.1f}% — מינוף גבוה. בחן יכולת שירות חוב")

    # ══════════════════════════════════════════════════════════════════════════
    # 23. Profit Margin  (weight ~4)
    # ══════════════════════════════════════════════════════════════════════════
    pm = fund.get("profit_margins")
    if pm is not None:
        pm_pct = pm * 100
        if pm_pct > 20:
            add(4, f"מרווח רווח={pm_pct:.1f}% — רווחיות גבוהה, חפיר תחרותי")
        elif pm_pct > 10:
            add(2, f"מרווח רווח={pm_pct:.1f}% — רווחיות בריאה")
        elif pm_pct < 0:
            sub(4, f"מרווח רווח={pm_pct:.1f}% — חברה הפסדית")

    # ══════════════════════════════════════════════════════════════════════════
    # Clamp + Signal Label
    # ══════════════════════════════════════════════════════════════════════════
    score = max(0, min(100, score))

    if   score >= 72: signal = "strong_buy"
    elif score >= 52: signal = "buy"
    elif score >= 35: signal = "watch"
    elif score >= 20: signal = "neutral"
    else:             signal = "sell"

    # ── Trend Direction (Bearish→Bullish meter) ────────────────────────────
    total = bull_count + bear_count
    bull_pct = (bull_count / total * 100) if total else 50
    if   bull_pct >= 75: trend = "strong_bullish"
    elif bull_pct >= 58: trend = "bullish"
    elif bull_pct >= 42: trend = "neutral"
    elif bull_pct >= 25: trend = "bearish"
    else:                trend = "strong_bearish"

    TREND_LABELS = {
        "strong_bullish": "Bullish חזק 📈",
        "bullish":        "Bullish 🟢",
        "neutral":        "ניטראלי ⚖",
        "bearish":        "Bearish 🔴",
        "strong_bearish": "Bearish חזק 📉",
    }

    def _r(v):
        try:
            f = float(v)
            return None if np.isnan(f) else round(f, 4)
        except Exception:
            return None

    return {
        "score": round(score),
        "signal": signal,
        "buy_signal":  score >= 55,
        "sell_signal": score < 20,
        # trend meter
        "trend": trend,
        "trend_label": TREND_LABELS[trend],
        "bull_pct": round(bull_pct, 1),
        # indicators
        "rsi":         round(rsi, 1),
        "macd":        _r(macd),
        "macd_signal": _r(macd_sig),
        "macd_hist":   _r(macd_hist),
        "sma20":  round(sma20, 2)  if sma20  else None,
        "sma50":  round(sma50, 2)  if sma50  else None,
        "sma150": round(sma150, 2) if sma150 else None,
        "sma200": round(sma200, 2) if sma200 else None,
        "ema9":   round(ema9, 2)   if ema9   else None,
        "ema21":  round(ema21, 2)  if ema21  else None,
        "bb_upper":  round(bb_upper, 2)  if bb_upper  else None,
        "bb_lower":  round(bb_lower, 2)  if bb_lower  else None,
        "bb_middle": round(bb_mid, 2)    if bb_mid    else None,
        "bb_width":  round(bb_width, 4)  if bb_width  else None,
        "stoch_k":   round(stoch_k, 1)   if stoch_k is not None else None,
        "stoch_d":   round(stoch_d, 1)   if stoch_d is not None else None,
        "williams_r": round(wr, 1)        if wr is not None else None,
        "cci":        round(cci, 1)       if cci is not None else None,
        "obv":        _r(obv),
        "mfi":        round(mfi, 1)       if mfi is not None else None,
        "adx":        round(adx, 1)       if adx is not None else None,
        "plus_di":    round(plus_di, 1)   if plus_di is not None else None,
        "minus_di":   round(minus_di, 1)  if minus_di is not None else None,
        "tenkan":     round(tenkan, 2)    if tenkan else None,
        "kijun":      round(kijun, 2)     if kijun  else None,
        "atr":        _r(latest.get("ATR")),
        "atr_pct":    round(atr_pct, 2)  if atr_pct else None,
        "vol_ratio":  round(vol_ratio, 2) if vol_ratio else None,
        "pe_ratio": round(pe_val, 1) if pe_val else None,
        "reasons":  reasons,
        "warnings": warnings,
    }


def get_support_resistance(df: pd.DataFrame, window: int = 20) -> Dict[str, float]:
    recent = df.tail(60)
    highs  = recent["High"].rolling(window, center=True).max()
    lows   = recent["Low"].rolling(window,  center=True).min()
    return {
        "resistance": round(float(highs.dropna().iloc[-1]), 2) if not highs.dropna().empty else None,
        "support":    round(float(lows.dropna().iloc[-1]),  2) if not lows.dropna().empty  else None,
    }
