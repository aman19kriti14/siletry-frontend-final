import { useNavigate } from 'react-router-dom';
import { ArrowRight, Download, Megaphone } from 'lucide-react';
import { useFetch } from '../lib/useFetch';
import type { Overview as OverviewData } from '../api/types';
import { Avatar, ConvStatePill, ErrorBox, Loading } from '../components/ui';
import { fmtDate, langName, pct, rupees } from '../lib/format';
import { useToast } from '../lib/toast';

export default function Overview() {
  const { data, error, loading, reload } = useFetch<OverviewData>('/api/overview', { pollMs: 60000 });
  const nav = useNavigate();
  const { toast } = useToast();

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const exportCsv = () => {
    const rows = [['Date', 'Booked by Siletry', 'Booked by staff'], ...data.bookingsPerDay.map((b) => [b.date, b.siletry, b.staff])];
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `siletry-bookings-${data.from}-to-${data.to}.csv`;
    a.click();
  };

  const max = Math.max(1, ...data.bookingsPerDay.map((b) => b.siletry + b.staff));
  const range = `${fmtDate(data.from, { day: 'numeric' })} – ${fmtDate(data.to, { day: 'numeric', month: 'short' })}`;
  const noShow = data.noShows;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <div className="sub">Everything Siletry handled on your WhatsApp line, and what still needs a human.</div>
        </div>
        <div className="actions">
          <button className="btn btn-outline" onClick={exportCsv}><Download /> Export</button>
          <button className="btn btn-primary" onClick={() => toast('Broadcasts are coming soon. They need opt-in and approved marketing templates.')}>
            <Megaphone /> Broadcast
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="card stat">
          <div className="label">Messages answered</div>
          <div className="value">{data.messagesAnswered.value.toLocaleString('en-IN')}</div>
          <div className="foot"><Change v={data.messagesAnswered.changePercent} /> this week</div>
        </div>
        <div className="card stat">
          <div className="label">Appointments booked</div>
          <div className="value">{data.appointmentsBooked.value}</div>
          <div className="foot"><Change v={data.appointmentsBooked.changePercent} /> {data.appointmentsBooked.percentWithoutStaff}% without staff</div>
        </div>
        <div className="card stat">
          <div className="label">Revenue booked</div>
          <div className="value">{rupees(data.revenueBooked.value)}</div>
          <div className="foot">
            <span className={data.revenueBooked.changeVsPrevious >= 0 ? 'up' : 'down'}>
              {data.revenueBooked.changeVsPrevious >= 0 ? '+' : '−'}{rupees(Math.abs(data.revenueBooked.changeVsPrevious))}
            </span>
            vs last week
          </div>
        </div>
        <div className="card stat">
          <div className="label">No-show rate</div>
          <div className="value">{noShow.ratePercent === undefined ? '—' : `${noShow.ratePercent}%`}</div>
          <div className="foot">
            {noShow.ratePercent === undefined ? (
              'Not enough visits yet'
            ) : (
              <>
                <Change v={noShow.changePercent} invert /> {noShow.noShows} no-shows this week
              </>
            )}
          </div>
        </div>
      </div>

      <div className="overview-grid">
        <div className="card card-pad">
          <div className="row">
            <h3 style={{ fontSize: 20 }}>Appointments booked per day</h3>
            <span className="pill pill-gray right" style={{ background: '#fff', fontWeight: 500, padding: '6px 14px' }}>{range}</span>
          </div>
          <div className="bars">
            {data.bookingsPerDay.map((b) => {
              const total = b.siletry + b.staff;
              const h = (total / max) * 190;
              return (
                <div key={b.date} className="bar-col">
                  <div className="total">{total}</div>
                  <div className="bar" style={{ height: Math.max(h, total ? 8 : 2) }}>
                    {b.staff > 0 && <div className="staff" style={{ flex: b.staff }} />}
                    {b.siletry > 0 && <div className="bot" style={{ flex: b.siletry }} />}
                    {total === 0 && <div className="bot" style={{ flex: 1, opacity: 0.4 }} />}
                  </div>
                  <div className="lbl">{b.label}</div>
                </div>
              );
            })}
          </div>
          <div className="legend">
            <span><i style={{ background: 'var(--teal-bar)', border: '1.5px solid var(--teal-border)' }} /> Booked by Siletry</span>
            <span><i style={{ background: 'var(--peach)', border: '1.5px solid var(--peach-border)' }} /> Booked by staff</span>
          </div>
        </div>

        <div className="col gap-16">
          <div className="card">
            <div className="card-head">
              <h3 style={{ fontSize: 20 }}>Needs a human</h3>
              {data.needsHumanCount > 0 && <span className="pill pill-peach right">{data.needsHumanCount} open</span>}
            </div>
            <div style={{ padding: '0 24px' }}>
              {data.needsHuman.length === 0 && <div className="muted" style={{ padding: '18px 0 22px' }}>Nothing waiting. Siletry has it covered.</div>}
              {data.needsHuman.map((c) => (
                <div key={c.id} className="human-row" onClick={() => nav(`/inbox/${c.id}`)}>
                  <Avatar text={c.initials} tone={c.emergency ? 'peach' : undefined} />
                  <div className="grow">
                    <b>{c.name}</b>
                    <div className="muted ellipsis" style={{ marginTop: 3 }}>{c.handoffReason || c.preview}</div>
                  </div>
                  <ConvStatePill state={c.state} emergency={c.emergency} />
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 24px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: '0 0 16px 16px' }}>
              <button className="link-btn" onClick={() => nav('/inbox')}>Open inbox <ArrowRight size={16} /></button>
            </div>
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: 20, marginBottom: 10 }}>Languages used</h3>
            {data.languages.length === 0 && <div className="muted">No conversations yet.</div>}
            {data.languages.map((l, i) => (
              <div key={l.language} className="lang-row">
                <span>{langName(l.language)}</span>
                <div className="lang-track">
                  <div className="lang-fill" style={{ width: `${l.percent}%`, background: ['#1A6650', '#7fb0a5', '#dcae7f', '#b9c7c2'][i % 4] }} />
                </div>
                <span className="muted" style={{ textAlign: 'right' }}>{l.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Change({ v, invert }: { v?: number; invert?: boolean }) {
  if (v === undefined || v === null) return <span className="faint">—</span>;
  const good = invert ? v <= 0 : v >= 0;
  return <span className={good ? 'up' : 'down'}>{pct(v)}</span>;
}
