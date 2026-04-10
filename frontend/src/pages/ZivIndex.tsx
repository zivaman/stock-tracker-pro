import { useEffect, useState } from 'react';
import { BarChart2, RefreshCw, CheckCircle, XCircle, Clock, Trash2, PlayCircle } from 'lucide-react';
import { getZivIndex, getZivSummary, autoEvaluateZiv, evaluateZivRecord, deleteZivRecord } from '../api/client';

interface ZivRecord {
  id: number; symbol: string; name: string; signal_type: string;
  rec_price: number; rec_date: string; check_date: string | null;
  result_price: number | null; result_pct: number | null; outcome: number | null;
  notes: string | null; ta_score: number | null; rule40_score: number | null;
}
interface Summary {
  daily: { total: number; success: number; accuracy: number | null };
  weekly: { total: number; success: number; accuracy: number | null };
  monthly: { total: number; success: number; accuracy: number | null };
  all_time: { total: number; success: number; accuracy: number | null };
  pending: number;
}

function AccuracyCard({ label, data }: { label: string; data: { total: number; success: number; accuracy: number | null } }) {
  const acc = data.accuracy;
  const color = acc == null ? 'var(--text-muted)' : acc >= 60 ? 'var(--green)' : acc >= 40 ? 'var(--yellow)' : 'var(--red)';
  return (
    <div className="card text-center">
      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-3xl font-black num" style={{ color }}>
        {acc != null ? `${acc}%` : '—'}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{data.success}/{data.total} הצלחות</p>
      {acc != null && (
        <div className="mt-2 rounded-full h-1.5 overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
          <div className="h-full rounded-full" style={{ width: `${acc}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

export default function ZivIndex() {
  const [records, setRecords] = useState<ZivRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  const fetch = async () => {
    try {
      const [recs, sum] = await Promise.all([getZivIndex(), getZivSummary()]);
      setRecords(recs); setSummary(sum);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleAutoEval = async () => {
    setEvaluating(true);
    try { await autoEvaluateZiv(); await fetch(); } finally { setEvaluating(false); }
  };

  const handleEval = async (id: number) => {
    await evaluateZivRecord(id); await fetch();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('למחוק רשומה זו?')) return;
    await deleteZivRecord(id); await fetch();
  };

  const pending = records.filter(r => r.outcome == null);
  const evaluated = records.filter(r => r.outcome != null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <BarChart2 size={28} style={{ color: 'var(--blue)' }} />
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>מדד זיו</h2>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            מעקב דיוק המלצות · Backtesting אוטומטי · 1=הצלחה, 0=כישלון
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAutoEval} disabled={evaluating} className="btn-primary flex items-center gap-2">
            {evaluating
              ? <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0a0e1a', borderTopColor: 'transparent' }} />
              : <PlayCircle size={15} />}
            הערך אוטומטית
          </button>
          <button onClick={fetch} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={14} /> רענן
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AccuracyCard label="יומי" data={summary.daily} />
          <AccuracyCard label="שבועי" data={summary.weekly} />
          <AccuracyCard label="חודשי" data={summary.monthly} />
          <AccuracyCard label="כל הזמן" data={summary.all_time} />
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2"
            style={{ color: 'var(--text-secondary)' }}>
            <Clock size={14} style={{ color: 'var(--yellow)' }} />
            ממתין להערכה ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map(r => (
              <div key={r.id} className="card flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="font-black text-lg num" style={{ color: 'var(--text-primary)' }}>{r.symbol}</span>
                  <span className={r.signal_type === 'buy' ? 'tag-buy' : 'tag-sell'}>
                    {r.signal_type === 'buy' ? 'קנייה' : 'מכירה'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm num">
                  <div className="text-center">
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>מחיר המלצה</p>
                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>${r.rec_price}</p>
                  </div>
                  {r.ta_score != null && (
                    <div className="text-center">
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>ציון TA</p>
                      <p className="font-bold" style={{ color: 'var(--blue)' }}>{r.ta_score}</p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>תאריך</p>
                    <p className="font-medium text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(r.rec_date).toLocaleDateString('he-IL')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEval(r.id)} className="btn-secondary text-xs flex items-center gap-1">
                    <PlayCircle size={13} /> הערך עכשיו
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="btn-danger text-xs">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evaluated */}
      {evaluated.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
            היסטוריה ({evaluated.length})
          </h3>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  <th className="px-4 py-3 text-right">מניה</th>
                  <th className="px-4 py-3 text-right">סיגנל</th>
                  <th className="px-4 py-3 text-right">מחיר המלצה</th>
                  <th className="px-4 py-3 text-right">מחיר בדיקה</th>
                  <th className="px-4 py-3 text-right">שינוי %</th>
                  <th className="px-4 py-3 text-right">TA</th>
                  <th className="px-4 py-3 text-right">תוצאה</th>
                  <th className="px-4 py-3 text-right">תאריך</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {evaluated.map(r => {
                  const isPos = (r.result_pct ?? 0) >= 0;
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:opacity-80 transition-opacity"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
                      <td className="px-4 py-3 font-bold num" style={{ color: 'var(--text-primary)' }}>{r.symbol}</td>
                      <td className="px-4 py-3">
                        <span className={r.signal_type === 'buy' ? 'tag-buy' : 'tag-sell'}>
                          {r.signal_type === 'buy' ? 'קנייה' : 'מכירה'}
                        </span>
                      </td>
                      <td className="px-4 py-3 num" style={{ color: 'var(--text-primary)' }}>${r.rec_price}</td>
                      <td className="px-4 py-3 num" style={{ color: 'var(--text-primary)' }}>
                        {r.result_price ? `$${r.result_price}` : '—'}
                      </td>
                      <td className="px-4 py-3 num font-bold" style={{ color: isPos ? 'var(--green)' : 'var(--red)' }}>
                        {r.result_pct != null ? `${isPos ? '+' : ''}${r.result_pct}%` : '—'}
                      </td>
                      <td className="px-4 py-3 num" style={{ color: 'var(--blue)' }}>
                        {r.ta_score ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {r.outcome === 1
                          ? <CheckCircle size={18} style={{ color: 'var(--green)' }} />
                          : <XCircle size={18} style={{ color: 'var(--red)' }} />}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {r.check_date ? new Date(r.check_date).toLocaleDateString('he-IL') : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={() => handleDelete(r.id)} style={{ color: 'var(--text-muted)' }}
                          className="hover:opacity-70 transition-opacity">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {records.length === 0 && !loading && (
        <div className="card text-center py-16">
          <BarChart2 size={48} className="mx-auto mb-4" style={{ color: 'var(--border)' }} />
          <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>אין רשומות עדיין</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            לחץ "הוסף למדד זיו" בדף מניה כדי להתחיל לעקוב אחר ההמלצות שלך
          </p>
        </div>
      )}
    </div>
  );
}
