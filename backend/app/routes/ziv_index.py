from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import datetime
from ..database import get_db, ZivIndexRecord
from ..services.stock_service import get_current_price

router = APIRouter(prefix="/ziv-index", tags=["ziv-index"])


class AddRecommendationRequest(BaseModel):
    symbol: str
    name: str
    signal_type: str        # "buy" or "sell"
    rec_price: float
    ta_score: Optional[int] = None
    rule40_score: Optional[float] = None
    notes: Optional[str] = None


class EvaluateRequest(BaseModel):
    record_id: int
    check_days: int = 5     # how many days to look back for evaluation


@router.get("")
def get_all(db: Session = Depends(get_db)):
    """All מדד זיו records, newest first."""
    records = db.query(ZivIndexRecord).order_by(ZivIndexRecord.rec_date.desc()).all()
    return [_to_dict(r) for r in records]


@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    """ציון מדד זיו — daily / weekly / monthly."""
    now = datetime.datetime.utcnow()

    def calc(cutoff):
        rows = db.query(ZivIndexRecord).filter(
            ZivIndexRecord.rec_date >= cutoff,
            ZivIndexRecord.outcome.isnot(None)
        ).all()
        if not rows:
            return {"total": 0, "success": 0, "accuracy": None}
        success = sum(1 for r in rows if r.outcome == 1)
        return {
            "total": len(rows),
            "success": success,
            "accuracy": round(success / len(rows) * 100, 1),
        }

    all_evaluated = db.query(ZivIndexRecord).filter(ZivIndexRecord.outcome.isnot(None)).all()
    pending = db.query(ZivIndexRecord).filter(ZivIndexRecord.outcome.is_(None)).count()

    return {
        "daily":   calc(now - datetime.timedelta(days=1)),
        "weekly":  calc(now - datetime.timedelta(days=7)),
        "monthly": calc(now - datetime.timedelta(days=30)),
        "all_time": {
            "total": len(all_evaluated),
            "success": sum(1 for r in all_evaluated if r.outcome == 1),
            "accuracy": round(sum(1 for r in all_evaluated if r.outcome == 1) / len(all_evaluated) * 100, 1) if all_evaluated else None,
        },
        "pending": pending,
    }


@router.post("/add")
def add_recommendation(req: AddRecommendationRequest, db: Session = Depends(get_db)):
    """רשום המלצה חדשה במדד זיו."""
    rec = ZivIndexRecord(
        symbol=req.symbol.upper(),
        name=req.name,
        signal_type=req.signal_type,
        rec_price=req.rec_price,
        ta_score=req.ta_score,
        rule40_score=req.rule40_score,
        notes=req.notes,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return {"message": f"המלצה על {req.symbol} נוספה למדד זיו", "id": rec.id}


@router.post("/evaluate/{record_id}")
def evaluate(record_id: int, db: Session = Depends(get_db)):
    """בדוק תוצאה של המלצה — 1=הצלחה, 0=כישלון."""
    rec = db.query(ZivIndexRecord).filter(ZivIndexRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="רשומה לא נמצאה")

    current = get_current_price(rec.symbol)
    if not current:
        raise HTTPException(status_code=400, detail="לא ניתן לקבל מחיר נוכחי")

    pct = (current - rec.rec_price) / rec.rec_price * 100
    # For buy rec: success if price went up; for sell: success if price went down
    if rec.signal_type == "buy":
        outcome = 1 if pct > 0 else 0
    else:
        outcome = 1 if pct < 0 else 0

    rec.check_date = datetime.datetime.utcnow()
    rec.result_price = round(current, 2)
    rec.result_pct = round(pct, 2)
    rec.outcome = outcome
    db.commit()
    return _to_dict(rec)


@router.post("/auto-evaluate")
def auto_evaluate_all(db: Session = Depends(get_db)):
    """הערך אוטומטית את כל ההמלצות הממתינות שעברו 5 ימים."""
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=5)
    pending = db.query(ZivIndexRecord).filter(
        ZivIndexRecord.outcome.is_(None),
        ZivIndexRecord.rec_date <= cutoff,
    ).all()

    updated = 0
    for rec in pending:
        current = get_current_price(rec.symbol)
        if not current:
            continue
        pct = (current - rec.rec_price) / rec.rec_price * 100
        outcome = 1 if (rec.signal_type == "buy" and pct > 0) or (rec.signal_type == "sell" and pct < 0) else 0
        rec.check_date = datetime.datetime.utcnow()
        rec.result_price = round(current, 2)
        rec.result_pct = round(pct, 2)
        rec.outcome = outcome
        updated += 1

    db.commit()
    return {"evaluated": updated}


@router.delete("/{record_id}")
def delete_record(record_id: int, db: Session = Depends(get_db)):
    rec = db.query(ZivIndexRecord).filter(ZivIndexRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="לא נמצא")
    db.delete(rec)
    db.commit()
    return {"ok": True}


def _to_dict(r: ZivIndexRecord):
    return {
        "id": r.id,
        "symbol": r.symbol,
        "name": r.name,
        "signal_type": r.signal_type,
        "rec_price": r.rec_price,
        "rec_date": r.rec_date.isoformat(),
        "check_date": r.check_date.isoformat() if r.check_date else None,
        "result_price": r.result_price,
        "result_pct": r.result_pct,
        "outcome": r.outcome,
        "notes": r.notes,
        "ta_score": r.ta_score,
        "rule40_score": r.rule40_score,
    }
