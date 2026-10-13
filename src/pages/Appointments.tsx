import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlarmClock, CalendarPlus, MessageCircle, CalendarX2 } from 'lucide-react';
import { api, qs } from '../api/client';
import type { AppointmentList, AppointmentRow, AppointmentStatus, Doctor } from '../api/types';
import { useFetch } from '../lib/useFetch';
import { useToast } from '../lib/toast';
import { BookedByPill, Empty, ErrorBox, Loading, Modal, StatusPill, statusAccent } from '../components/ui';
import BookVisitModal from '../components/BookVisitModal';
import AppointmentActions from '../components/AppointmentActions';
import QueuePanel from '../components/QueuePanel';
import { relativeDay } from '../lib/format';

type Tab = 'today' | 'week' | 'noshows' | 'cancelled';

export default function Appointments() {
  const nav = useNavigate();
  const { toast, error } = useToast();
  const [tab, setTab] = useState<Tab>('today');
  const [doctorId, setDoctorId] = useState('');
  const [status, setStatus] = useState('');
  const [bookedBy, setBookedBy] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [booking, setBooking] = useState(false);
  const [reschedule, setReschedule] = useState<AppointmentRow | null>(null);
  const [delayOpen, setDelayOpen] = useState(false);

  const path = '/api/appointments' + qs({ tab, doctorId, status, bookedBy });
  const { data, error: loadError, loading, reload } = useFetch<AppointmentList>(path, { pollMs: 20000 });
  const { data: doctors } = useFetch<Doctor[]>('/api/doctors');

  const items = data?.items ?? [];
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const toggle = (id: number) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const bulk = async (kind: 'checkin' | 'noshow') => {
    const rows = items.filter((i) => selected.has(i.id));
    let ok = 0;
    for (const r of rows) {
      try {
        if (kind === 'checkin' && r.status === 'CONFIRMED') { await api.post(`/api/queue/check-in/${r.id}`); ok++; }
        if (kind === 'noshow' && (r.status === 'CONFIRMED' || r.status === 'WAITING')) { await api.post(`/api/appointments/${r.id}/no-show`); ok++; }
      } catch (e) {
        error(e);
      }
    }
    toast(`${ok} updated`);
    setSelected(new Set());
    reload();
  };

  const counts = data?.counts;
  const tabs: { key: Tab; label: string; n?: number }[] = [
    { key: 'today', label: 'Today', n: counts?.today },
    { key: 'week', label: 'This week', n: counts?.thisWeek },
    { key: 'noshows', label: 'No-shows', n: counts?.noShows },
    { key: 'cancelled', label: 'Cancelled', n: counts?.cancelled },
  ];

  const statusOptions: AppointmentStatus[] = ['CONFIRMED', 'WAITING', 'IN_CONSULT', 'SEEN', 'NO_SHOW'];
  const showDate = tab !== 'today';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Appointments</h1>
          <div className="sub">{data?.dateLabel ?? ' '}</div>
        </div>
        <div className="actions">
          <button className="btn btn-outline" onClick={() => setDelayOpen(true)}><AlarmClock /> Announce delay</button>
          <button className="btn btn-primary" onClick={() => setBooking(true)}><CalendarPlus /> New appointment</button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => { setTab(t.key); setSelected(new Set()); }}>
            {t.label} {t.n !== undefined && <span className="n">{t.n}</span>}
          </button>
        ))}
      </div>

      {tab === 'today' && <QueuePanel onChanged={reload} />}

      <div className="filters">
        <select className="select" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
          <option value="">All doctors</option>
          {(doctors ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</option>)}
        </select>
        <select className="select" value={bookedBy} onChange={(e) => setBookedBy(e.target.value)}>
          <option value="">Booked by anyone</option>
          <option value="SILETRY">Siletry</option>
          <option value="FRONT_DESK">Front desk</option>
          <option value="WALK_IN">Walk-in</option>
        </select>
        {selected.size > 0 && (
          <div className="row right">
            <span className="muted">{selected.size} selected</span>
            <button className="btn btn-outline btn-sm" onClick={() => bulk('checkin')}>Check in</button>
            <button className="btn btn-danger btn-sm" onClick={() => bulk('noshow')}>Mark no-show</button>
          </div>
        )}
      </div>

      {loadError && !data && <ErrorBox message={loadError} onRetry={reload} />}
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="card table-card">
          {items.length === 0 ? (
            <Empty text="No appointments here." icon={<CalendarX2 />} />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>
                    <input type="checkbox" className="checkbox" checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))} />
                  </th>
                  <th>{showDate ? 'When' : 'Time'}</th>
                  <th>Patient</th>
                  <th>Reason</th>
                  <th>Doctor</th>
                  <th>Booked by</th>
                  <th>Status</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="clickable row-accent" style={{ ['--accent' as string]: statusAccent(r.status, r.emergency) }}
                    onClick={() => nav(`/patients/${r.patientId}`)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                    </td>
                    <td>
                      {showDate && <div className="sub" style={{ marginTop: 0 }}>{relativeDay(r.startAt)}</div>}
                      <div className="time">{r.time}</div>
                      {r.tokenNumber && <div className="sub">Token #{r.tokenNumber}</div>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 15 }}>{r.patientName}</div>
                      <div className="sub">{r.patientPhone}</div>
                    </td>
                    <td>
                      <div>{r.reason || <span className="faint">—</span>}</div>
                      {r.frontDeskNote && <div className="sub">Note: {r.frontDeskNote}</div>}
                    </td>
                    <td>{r.doctorName}</td>
                    <td><BookedByPill by={r.bookedBy} /></td>
                    <td>
                      <StatusPill status={r.status} emergency={r.emergency} />
                      {r.reminderResponse && <div className="sub">Reminder: {r.reminderResponse}</div>}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row" style={{ gap: 2 }}>
                        <button className="icon-btn" title="Open chat" disabled={!r.conversationId}
                          onClick={() => r.conversationId && nav(`/inbox/${r.conversationId}`)}
                          style={!r.conversationId ? { opacity: 0.35 } : undefined}>
                          <MessageCircle />
                        </button>
                        <AppointmentActions row={r} onChanged={reload} onReschedule={setReschedule} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {booking && <BookVisitModal onClose={() => setBooking(false)} onDone={() => { setBooking(false); reload(); }} />}
      {reschedule && (
        <BookVisitModal
          patient={{ id: reschedule.patientId, name: reschedule.patientName ?? '', phone: reschedule.patientPhone }}
          reschedule={{ appointmentId: reschedule.id, doctorId: reschedule.doctorId, startAt: reschedule.startAt }}
          onClose={() => setReschedule(null)}
          onDone={() => { setReschedule(null); reload(); }}
        />
      )}
      {delayOpen && <DelayModal doctors={doctors ?? []} onClose={() => setDelayOpen(false)} />}
    </>
  );
}

function DelayModal({ doctors, onClose }: { doctors: Doctor[]; onClose: () => void }) {
  const active = useMemo(() => doctors.filter((d) => d.active), [doctors]);
  const [doctorId, setDoctorId] = useState<number | undefined>(active[0]?.id);
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast, error } = useToast();
  const doctor = active.find((d) => d.id === doctorId);

  const submit = async () => {
    if (!doctorId) return;
    setSaving(true);
    try {
      const r = await api.post<{ patientsNotified: number }>(`/api/queue/doctors/${doctorId}/announce-delay`, { minutes, note });
      toast(`${r.patientsNotified} patient${r.patientsNotified === 1 ? '' : 's'} told on WhatsApp`);
      onClose();
    } catch (e) {
      error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Announce a delay"
      sub="Everyone waiting or still due today for this doctor gets a WhatsApp message."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-plain" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving || !doctorId} onClick={submit}>Send to patients</button>
        </>
      }
    >
      <div className="col gap-16">
        <div className="field">
          <label>Doctor</label>
          <select className="select" value={doctorId ?? ''} onChange={(e) => setDoctorId(Number(e.target.value))}>
            {active.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Running late by</label>
          <div className="chip-group">
            {[15, 30, 45, 60, 90].map((m) => (
              <button key={m} className={`chip ${minutes === m ? 'on' : ''}`} onClick={() => setMinutes(m)}>{m} min</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Add a note (optional)</label>
          <input className="input" placeholder="Stuck in an emergency at the hospital" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="wa-preview">
          <div className="bubble out">
            {`${doctor?.name ?? 'The doctor'} is running about ${minutes} minutes late today. Sorry for the wait.${note ? ' ' + note : ''}`}
          </div>
        </div>
      </div>
    </Modal>
  );
}
