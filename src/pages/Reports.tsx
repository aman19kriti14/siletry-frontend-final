import { useState } from 'react';
import { qs } from '../api/client';
import type { Overview } from '../api/types';
import { useFetch } from '../lib/useFetch';
import { ErrorBox, Loading } from '../components/ui';
import { addDays, fmtDate, isoDate, pct, rupees } from '../lib/format';

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
];

export default function Reports() {
  const [days, setDays] = useState(7);
  const to = isoDate();
  const from = addDays(to, -(days - 1));
  const { data, error, loading, reload } = useFetch<Overview>('/api/overview' + qs({ from, to }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <div className="sub">How Siletry is doing for the clinic, compared with the period before.</div>
        </div>
        <div className="actions chip-group">
          {PRESETS.map((p) => <button key={p.days} className={`chip ${days === p.days ? 'on' : ''}`} onClick={() => setDays(p.days)}>{p.label}</button>)}
        </div>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? <Loading /> : data && (
        <>
          <div className="stat-grid">
            <Stat label="Messages answered" value={data.messagesAnswered.value.toLocaleString('en-IN')} change={data.messagesAnswered.changePercent} />
            <Stat label="Appointments booked" value={String(data.appointmentsBooked.value)} change={data.appointmentsBooked.changePercent}
              extra={`${data.appointmentsBooked.percentWithoutStaff}% without staff`} />
            <Stat label="Revenue booked" value={rupees(data.revenueBooked.value)} extra={`${data.revenueBooked.changeVsPrevious >= 0 ? '+' : '−'}${rupees(Math.abs(data.revenueBooked.changeVsPrevious))} vs before`} />
            <Stat label="No-show rate" value={data.noShows.ratePercent === undefined ? '—' : `${data.noShows.ratePercent}%`}
              extra={data.noShows.previousRatePercent === undefined ? 'Not enough data to compare' : `was ${data.noShows.previousRatePercent}%`} />
          </div>
          <div className="card table-card">
            <table className="table">
              <thead><tr><th>Day</th><th>Booked by Siletry</th><th>Booked by staff</th><th>Total</th><th>Share by Siletry</th></tr></thead>
              <tbody>
                {data.bookingsPerDay.map((b) => {
                  const total = b.siletry + b.staff;
                  return (
                    <tr key={b.date}>
                      <td>{fmtDate(b.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td>{b.siletry}</td>
                      <td>{b.staff}</td>
                      <td style={{ fontWeight: 600 }}>{total}</td>
                      <td>{total ? Math.round((100 * b.siletry) / total) + '%' : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function Stat({ label, value, change, extra }: { label: string; value: string; change?: number; extra?: string }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="foot">
        {change !== undefined && <span className={change >= 0 ? 'up' : 'down'}>{pct(change)}</span>}
        {extra && <span>{extra}</span>}
      </div>
    </div>
  );
}
