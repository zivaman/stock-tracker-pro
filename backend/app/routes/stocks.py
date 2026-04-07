from fastapi import APIRouter, HTTPException
from ..services.stock_service import get_stock_analysis, get_stock_news, get_stock_info

router = APIRouter(prefix="/stock", tags=["stocks"])


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
