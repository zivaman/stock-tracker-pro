from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./stock_tracker.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class PortfolioPosition(Base):
    __tablename__ = "portfolio_positions"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True)
    name = Column(String)
    buy_price = Column(Float)
    buy_date = Column(String)
    quantity = Column(Float)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String)
    signal_type = Column(String)  # "buy" or "sell"
    message = Column(String)
    score = Column(Float)
    price = Column(Float)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    read = Column(Boolean, default=False)


class ZivIndexRecord(Base):
    """מדד זיו — backtesting record for each recommendation."""
    __tablename__ = "ziv_index"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True)
    name = Column(String)
    signal_type = Column(String)          # "buy" or "sell"
    rec_price = Column(Float)             # price at recommendation
    rec_date = Column(DateTime, default=datetime.datetime.utcnow)
    check_date = Column(DateTime, nullable=True)    # when we evaluated result
    result_price = Column(Float, nullable=True)     # price at check_date
    result_pct = Column(Float, nullable=True)       # % change
    outcome = Column(Integer, nullable=True)        # 1=success, 0=fail, None=pending
    notes = Column(String, nullable=True)
    rule40_score = Column(Float, nullable=True)
    ta_score = Column(Integer, nullable=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
