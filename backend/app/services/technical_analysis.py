import pandas as pd
import numpy as np
from typing import Dict, Any


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


def compute_signal(df: pd.DataFrame) -> Dict[str, Any]:
    """Compute buy/sell signal score (0-100) and reasoning for medium-risk investor."""
    if len(df) < 200:
        return {"score": 0, "signal": "neutral", "reasons": [], "warnings": []}

    latest = df.iloc[-1]
    prev = df.iloc[-2]
    score = 0
    reasons = []
    warnings = []

    # --- RSI ---
    rsi = latest.get("RSI", 50)
    if 30 < rsi < 45:
        score += 20
        reasons.append(f"RSI = {rsi:.1f} — אזור קנייה (oversold recovery)")
    elif 45 <= rsi < 55:
        score += 10
        reasons.append(f"RSI = {rsi:.1f} — ניטראלי-חיובי")
    elif rsi >= 70:
        score -= 15
        warnings.append(f"RSI = {rsi:.1f} — אזור מכירה (overbought)")
    elif rsi <= 30:
        score += 5
        warnings.append(f"RSI = {rsi:.1f} — oversold קיצוני, סיכון גבוה")

    # --- MACD ---
    macd = latest.get("MACD", 0)
    macd_signal = latest.get("MACD_Signal", 0)
    prev_macd = prev.get("MACD", 0)
    prev_signal = prev.get("MACD_Signal", 0)

    # Bullish crossover
    if macd > macd_signal and prev_macd <= prev_signal:
        score += 25
        reasons.append("חציית MACD מעלה — איתות קנייה חזק")
    elif macd > macd_signal:
        score += 12
        reasons.append("MACD מעל קו האות — מומנטום חיובי")
    elif macd < macd_signal and prev_macd >= prev_signal:
        score -= 20
        warnings.append("חציית MACD מטה — איתות מכירה")
    elif macd < macd_signal:
        score -= 8
        warnings.append("MACD מתחת לקו האות — לחץ מטה")

    # --- Moving Averages ---
    close = latest["Close"]
    sma20 = latest.get("SMA20")
    sma50 = latest.get("SMA50")
    sma200 = latest.get("SMA200")

    if sma50 and close > sma50:
        score += 12
        reasons.append(f"מחיר מעל ממוצע 50 יום ({sma50:.2f})")
    elif sma50 and close < sma50:
        score -= 8
        warnings.append(f"מחיר מתחת לממוצע 50 יום ({sma50:.2f})")

    if sma200 and close > sma200:
        score += 10
        reasons.append(f"מחיר מעל ממוצע 200 יום — מגמה עולה ארוכת טווח")
    elif sma200 and close < sma200:
        score -= 10
        warnings.append(f"מחיר מתחת לממוצע 200 יום — מגמה יורדת")

    # Golden Cross
    if sma50 and sma200 and sma50 > sma200:
        score += 10
        reasons.append("Golden Cross (SMA50 > SMA200) — מגמת עלייה")
    elif sma50 and sma200 and sma50 < sma200:
        score -= 5
        warnings.append("Death Cross (SMA50 < SMA200)")

    # --- Bollinger Bands ---
    bb_upper = latest.get("BB_Upper")
    bb_lower = latest.get("BB_Lower")
    bb_middle = latest.get("BB_Middle")

    if bb_lower and bb_middle:
        bb_pos = (close - bb_lower) / (bb_upper - bb_lower) if (bb_upper - bb_lower) != 0 else 0.5
        if bb_pos < 0.2:
            score += 10
            reasons.append("מחיר קרוב לבנד תחתון — הזדמנות כניסה")
        elif bb_pos > 0.8:
            score -= 5
            warnings.append("מחיר קרוב לבנד עליון — מחיר מתוח")

    # --- Volume ---
    volume = latest.get("Volume", 0)
    vol_ma = latest.get("Volume_MA20", 1)
    if vol_ma and vol_ma > 0:
        vol_ratio = volume / vol_ma
        if vol_ratio > 1.5:
            score += 8
            reasons.append(f"נפח מסחר {vol_ratio:.1f}x מעל הממוצע — עניין מוסדי")

    # --- Cap score ---
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

    return {
        "score": round(score),
        "signal": signal,
        "rsi": round(rsi, 1) if not np.isnan(rsi) else None,
        "macd": round(macd, 4) if not np.isnan(macd) else None,
        "macd_signal": round(macd_signal, 4) if not np.isnan(macd_signal) else None,
        "sma20": round(sma20, 2) if sma20 and not np.isnan(sma20) else None,
        "sma50": round(sma50, 2) if sma50 and not np.isnan(sma50) else None,
        "sma200": round(sma200, 2) if sma200 and not np.isnan(sma200) else None,
        "bb_upper": round(bb_upper, 2) if bb_upper and not np.isnan(bb_upper) else None,
        "bb_lower": round(bb_lower, 2) if bb_lower and not np.isnan(bb_lower) else None,
        "bb_middle": round(bb_middle, 2) if bb_middle and not np.isnan(bb_middle) else None,
        "reasons": reasons,
        "warnings": warnings,
    }


def get_support_resistance(df: pd.DataFrame, window: int = 20) -> Dict[str, float]:
    """Simple support/resistance based on recent swing highs/lows."""
    recent = df.tail(60)
    highs = recent["High"].rolling(window, center=True).max()
    lows = recent["Low"].rolling(window, center=True).min()
    return {
        "resistance": round(float(highs.dropna().iloc[-1]), 2) if not highs.dropna().empty else None,
        "support": round(float(lows.dropna().iloc[-1]), 2) if not lows.dropna().empty else None,
    }
