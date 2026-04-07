from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db, Notification, PortfolioPosition
from ..services.scanner import run_scanner, check_portfolio_signals, get_currency_rates
import datetime

router = APIRouter(prefix="/radar", tags=["radar"])

_cached_radar = {"data": None, "timestamp": None}
_CACHE_MINUTES = 30


@router.get("")
def get_radar():
    """Get top 10 recommended stocks based on technical analysis."""
    now = datetime.datetime.utcnow()
    if (
        _cached_radar["data"] is not None
        and _cached_radar["timestamp"] is not None
        and (now - _cached_radar["timestamp"]).total_seconds() < _CACHE_MINUTES * 60
    ):
        return {"stocks": _cached_radar["data"], "cached": True, "last_updated": _cached_radar["timestamp"].isoformat()}

    stocks = run_scanner(top_n=10)
    _cached_radar["data"] = stocks
    _cached_radar["timestamp"] = now
    return {"stocks": stocks, "cached": False, "last_updated": now.isoformat()}


@router.post("/refresh")
def refresh_radar():
    """Force refresh the radar cache."""
    _cached_radar["data"] = None
    _cached_radar["timestamp"] = None
    stocks = run_scanner(top_n=10)
    _cached_radar["data"] = stocks
    _cached_radar["timestamp"] = datetime.datetime.utcnow()
    return {"stocks": stocks, "last_updated": _cached_radar["timestamp"].isoformat()}


@router.get("/currencies")
def get_currencies():
    """Get current currency exchange rates."""
    rates = get_currency_rates()
    return {"rates": rates, "timestamp": datetime.datetime.utcnow().isoformat()}


@router.get("/notifications")
def get_notifications(db: Session = Depends(get_db)):
    """Get all notifications."""
    notifications = db.query(Notification).order_by(Notification.created_at.desc()).limit(50).all()
    return [
        {
            "id": n.id,
            "symbol": n.symbol,
            "signal_type": n.signal_type,
            "message": n.message,
            "score": n.score,
            "price": n.price,
            "created_at": n.created_at.isoformat(),
            "read": n.read,
        }
        for n in notifications
    ]


@router.post("/notifications/read/{notification_id}")
def mark_read(notification_id: int, db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if n:
        n.read = True
        db.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.read == False).update({"read": True})
    db.commit()
    return {"ok": True}


@router.post("/scan-portfolio")
def scan_portfolio(db: Session = Depends(get_db)):
    """Scan portfolio positions and generate buy/sell notifications."""
    positions = db.query(PortfolioPosition).all()
    symbols = [p.symbol for p in positions]
    if not symbols:
        return {"alerts": [], "message": "אין מניות בתיק"}

    alerts = check_portfolio_signals(symbols)

    # Save new notifications to DB
    saved = 0
    for alert in alerts:
        # Check if similar notification exists in last 24 hours
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
        existing = (
            db.query(Notification)
            .filter(
                Notification.symbol == alert["symbol"],
                Notification.signal_type == alert["signal_type"],
                Notification.created_at >= cutoff,
            )
            .first()
        )
        if not existing:
            n = Notification(
                symbol=alert["symbol"],
                signal_type=alert["signal_type"],
                message=alert["message"],
                score=alert.get("score", 0),
                price=alert.get("price"),
            )
            db.add(n)
            saved += 1

    db.commit()
    return {"alerts": alerts, "saved": saved}
