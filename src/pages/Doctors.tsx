import { Fragment, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { api } from '../api/client';
import type { BookingRules, Day, Doctor, HoursUpdateResult, Leave } from '../api/types';
import { useFetch } from '../lib/useFetch';
import { useToast } from '../lib/toast';
import { Avatar, Empty, Loading, Modal, Toggle } from '../components/ui';
import { DAYS, LANGUAGES, fmtDate, fmtTime, langName, rupees, isoDate } from '../lib/format';

export default function Doctors() {
  const { data: doctors, loading, reload } = useFetch<Doctor[]>('/api/doctors');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<'hours' | 'leave' | 'rules'>('hours');

  useEffect(() => {
    if (doctors?.length && (selectedId === null || !doctors.find((d) => d.id === selectedId))) setSelectedId(doctors[0].id);
  }, [doctors, selectedId]);

  const d = doctors?.find((x) => x.id === selectedId);

  if (loading && !doctors) return <Loading />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Doctors & availability</h1>
          <div className="sub">Who sees patients, and when. Siletry only ever offers slots inside these hours, minus leave and existing bookings.</div>
        </div>
        <div className="actions"><button className="btn btn-primary" onClick={() => setAdding(true)}><UserPlus /> Add doctor</button></div>
      </div>

      <div className="doctors-layout">
        <div>
          {(doctors ?? []).map((x) => (
            <div key={x.id} className={`card doc-card ${x.id === selectedId ? 'active' : ''}`} onClick={() => setSelectedId(x.id)}>
              <Avatar text={x.initials} size="lg" />
              <div className="grow">
                <div style={{ fontWeight: 600, fontSize: 16 }}>{x.name}</div>
                <div className="muted">{x.speciality}</div>
                <div className="row gap-8 mt-8" style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {!x.active ? <><span className="dot gray" /> <span className="muted">Inactive</span></>
                    : x.todayStatus === 'IN_CLINIC' ? <><span className="dot" /> <span style={{ color: 'var(--green)' }}>In clinic</span></>
                    : x.todayStatus === 'ON_LEAVE' ? <><span className="dot amber" /> <span style={{ color: 'var(--amber)' }}>On leave today</span></>
                    : <><span className="dot gray" /> <span className="muted">Off today</span></>}
                </div>
              </div>
            </div>
          ))}
          <button className="add-dashed" onClick={() => setAdding(true)}><Plus size={18} style={{ verticalAlign: -3 }} /> Add doctor</button>
        </div>

        {d ? (
          <div className="card card-pad" style={{ padding: '26px 30px' }}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div className="row gap-8"><h2 style={{ fontSize: 24 }}>{d.name}</h2><button className="icon-btn" onClick={() => setEditing(true)} title="Edit"><Pencil size={17} /></button></div>
                <div className="muted mt-8" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 15 }}>
                  <span>{d.speciality || '—'}</span>
                  {d.registrationNo && <span>Reg. {d.registrationNo}</span>}
                  <span>{rupees(d.fee)} per visit</span>
                  <span>{d.slotsThisWeek} slots this week</span>
                </div>
              </div>
              <div className="chip-group">{d.languages.map((l) => <span key={l} className="pill pill-gray" style={{ fontWeight: 500, padding: '6px 14px' }}>{langName(l)}</span>)}</div>
            </div>

            <div className="tabs mt-24">
              <button className={`tab ${tab === 'hours' ? 'active' : ''}`} onClick={() => setTab('hours')}>Weekly hours</button>
              <button className={`tab ${tab === 'leave' ? 'active' : ''}`} onClick={() => setTab('leave')}>Leave & blocked time {d.upcomingLeaveCount > 0 && <span className="n">{d.upcomingLeaveCount}</span>}</button>
              <button className={`tab ${tab === 'rules' ? 'active' : ''}`} onClick={() => setTab('rules')}>Booking rules</button>
            </div>

            {tab === 'hours' && <HoursEditor key={d.id} doctor={d} onSaved={reload} />}
            {tab === 'leave' && <LeaveEditor key={d.id} doctor={d} onChanged={reload} />}
            {tab === 'rules' && <RulesEditor key={d.id} doctor={d} onSaved={reload} />}
          </div>
        ) : (
          <div className="card"><Empty text="Add your first doctor to start taking bookings." /></div>
        )}
      </div>

      {adding && <DoctorModal onClose={() => setAdding(false)} onDone={(doc) => { setAdding(false); reload(); setSelectedId(doc.id); setTab('hours'); }} />}
      {editing && d && <DoctorModal existing={d} onClose={() => setEditing(false)} onDone={() => { setEditing(false); reload(); }} />}
    </>
  );
}

type DaySessions = Record<Day, { start: string; end: string }[]>;
const hhmm = (t: string) => t.slice(0, 5);

function HoursEditor({ doctor, onSaved }: { doctor: Doctor; onSaved: () => void }) {
  const initial = useMemo(() => {
    const m = {} as DaySessions;
    DAYS.forEach((d) => (m[d.key] = []));
    doctor.sessions.forEach((s) => m[s.day].push({ start: hhmm(s.start), end: hhmm(s.end) }));
    return m;
  }, [doctor]);
  const [days, setDays] = useState<DaySessions>(initial);
  const [saving, setSaving] = useState(false);
  const [needToMove, setNeedToMove] = useState<HoursUpdateResult['needToMove']>([]);
  const { toast, error } = useToast();
  const dirty = JSON.stringify(days) !== JSON.stringify(initial);

  const update = (day: Day, fn: (list: { start: string; end: string }[]) => { start: string; end: string }[]) =>
    setDays((d) => ({ ...d, [day]: fn([...d[day]]) }));

  const save = async () => {
    setSaving(true);
    try {
      const sessions = DAYS.flatMap((d) => days[d.key].map((s) => ({ day: d.key, start: s.start, end: s.end })));
      const r = await api.put<HoursUpdateResult>(`/api/doctors/${doctor.id}/hours`, { sessions });
      setNeedToMove(r.needToMove);
      toast('Hours saved');
      onSaved();
    } catch (e) {
      error(e);
    } finally {
      setSaving(false);
    }
  };

  const blocks = [8, 10, 12, 14, 16, 18, 20];
  const on = (day: Day, h: number) => days[day].some((s) => {
    const [sh, sm] = s.start.split(':').map(Number);
    const [eh, em] = s.end.split(':').map(Number);
    return sh + sm / 60 < h + 2 && eh + em / 60 > h;
  });

  return (
    <div className="hours-layout">
      <div>
        {DAYS.map((d) => {
          const list = days[d.key];
          return (
            <div key={d.key} className="day-row">
              <input type="checkbox" className="checkbox" style={{ marginTop: 11 }} checked={list.length > 0}
                onChange={(e) => update(d.key, () => (e.target.checked ? [{ start: '09:30', end: '13:00' }] : []))} />
              <b style={{ marginTop: 9 }}>{d.label}</b>
              <div>
                {list.length === 0 && <div className="muted" style={{ marginTop: 9 }}>Closed</div>}
                {list.map((s, i) => (
                  <div key={i} className="sess">
                    <input className="input" type="time" value={s.start} onChange={(e) => update(d.key, (l) => { l[i] = { ...l[i], start: e.target.value }; return l; })} />
                    <span className="muted">to</span>
                    <input className="input" type="time" value={s.end} onChange={(e) => update(d.key, (l) => { l[i] = { ...l[i], end: e.target.value }; return l; })} />
                    <button className="icon-btn" onClick={() => update(d.key, (l) => l.filter((_, j) => j !== i))}><X /></button>
                  </div>
                ))}
                {list.length > 0 && (
                  <button className="link-btn" style={{ fontWeight: 500 }} onClick={() => update(d.key, (l) => [...l, { start: '16:30', end: '20:00' }])}><Plus size={16} /> Session</button>
                )}
              </div>
            </div>
          );
        })}
        <div className="row mt-16">
          <button className="btn btn-primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save hours'}</button>
          {dirty && <button className="btn btn-plain" onClick={() => setDays(initial)}>Discard</button>}
        </div>
        {needToMove.length > 0 && (
          <div className="banner warn mt-16" style={{ display: 'block' }}>
            <b>{needToMove.length} booked patient{needToMove.length > 1 ? 's are' : ' is'} now outside these hours.</b> Siletry won't cancel them on its own. Please move them:
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {needToMove.map((a) => <li key={a.appointmentId}>{a.patientName} · {fmtDate(a.startAt)} {fmtTime(a.startAt)} · {a.patientPhone}</li>)}
            </ul>
          </div>
        )}
      </div>
      <div>
        <div className="section-label" style={{ marginBottom: 14 }}>Week at a glance</div>
        <div className="week-grid">
          <div />
          {DAYS.map((d) => <div key={d.key} className="h">{d.short}</div>)}
          {blocks.map((h) => (
            <Fragment key={h}>
              <div className="t">{h > 12 ? h - 12 : h}</div>
              {DAYS.map((d) => <div key={`${d.key}${h}`} className={`cell ${on(d.key, h) ? 'on' : ''}`} />)}
            </Fragment>
          ))}
        </div>
        <div className="banner info mt-24" style={{ display: 'block', lineHeight: 1.5 }}>
          Changes apply to new bookings. Patients already booked outside the new hours are listed for you to move; Siletry won't cancel them on its own.
        </div>
      </div>
    </div>
  );
}

function LeaveEditor({ doctor, onChanged }: { doctor: Doctor; onChanged: () => void }) {
  const { data, reload } = useFetch<Leave[]>(`/api/doctors/${doctor.id}/leave`);
  const [from, setFrom] = useState(`${isoDate()}T09:00`);
  const [to, setTo] = useState(`${isoDate()}T21:00`);
  const [reason, setReason] = useState('');
  const { toast, error } = useToast();

  const add = async () => {
    try {
      await api.post(`/api/doctors/${doctor.id}/leave`, { startAt: from, endAt: to, reason });
      toast('Blocked. Siletry won’t offer these times.');
      setReason('');
      reload();
      onChanged();
    } catch (e) {
      error(e);
    }
  };
  const del = async (id?: number) => {
    try {
      await api.del(`/api/doctors/${doctor.id}/leave/${id}`);
      reload();
      onChanged();
    } catch (e) {
      error(e);
    }
  };

  return (
    <div>
      <div className="grid-3" style={{ gridTemplateColumns: '1fr 1fr 1.2fr auto', alignItems: 'end' }}>
        <div className="field"><label>From</label><input className="input" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label>To</label><input className="input" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="field"><label>Reason</label><input className="input" placeholder="Conference" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={add}>Block time</button>
      </div>
      <p className="muted mt-12" style={{ fontSize: 13.5 }}>Patients already booked in this time aren't cancelled automatically. Check Appointments and move them.</p>
      <div className="mt-16">
        {(data ?? []).length === 0 ? <div className="muted">No upcoming leave.</div> : (data ?? []).map((l) => (
          <div key={l.id} className="kv" style={{ alignItems: 'center' }}>
            <span><b>{fmtDate(l.startAt)} {fmtTime(l.startAt)}</b> → <b>{fmtDate(l.endAt)} {fmtTime(l.endAt)}</b> <span className="muted">{l.reason}</span></span>
            <button className="icon-btn" onClick={() => del(l.id)}><Trash2 /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RulesEditor({ doctor, onSaved }: { doctor: Doctor; onSaved: () => void }) {
  const [r, setR] = useState<BookingRules>(doctor.bookingRules);
  const { toast, error } = useToast();
  const save = async () => {
    try {
      await api.patch(`/api/doctors/${doctor.id}`, { bookingRules: r });
      toast('Booking rules saved');
      onSaved();
    } catch (e) {
      error(e);
    }
  };
  return (
    <div style={{ maxWidth: 620 }}>
      <div className="setting-row">
        <div className="txt"><b>Bookable on WhatsApp</b><span>Siletry offers this doctor's slots to patients.</span></div>
        <Toggle checked={r.bookableOnWhatsapp} onChange={(v) => setR({ ...r, bookableOnWhatsapp: v })} />
      </div>
      <div className="setting-row">
        <div className="txt"><b>Minimum notice</b><span>Don't offer slots starting sooner than this.</span></div>
        <select className="select" style={{ width: 160 }} value={r.minNoticeMinutes} onChange={(e) => setR({ ...r, minNoticeMinutes: Number(e.target.value) })}>
          {[0, 15, 30, 60, 120, 240].map((m) => <option key={m} value={m}>{m === 0 ? 'None' : m < 60 ? `${m} min` : `${m / 60} hour${m > 60 ? 's' : ''}`}</option>)}
        </select>
      </div>
      <div className="setting-row">
        <div className="txt"><b>Book up to</b><span>How far ahead patients can book on WhatsApp.</span></div>
        <select className="select" style={{ width: 160 }} value={r.maxAdvanceDays} onChange={(e) => setR({ ...r, maxAdvanceDays: Number(e.target.value) })}>
          {[3, 7, 14, 30, 60].map((d) => <option key={d} value={d}>{d} days</option>)}
        </select>
      </div>
      <div className="setting-row">
        <div className="txt"><b>WhatsApp bookings per day</b><span>Keep some slots for walk-ins and staff bookings. Leave empty for no limit.</span></div>
        <input className="input" style={{ width: 160 }} type="number" min={1} value={r.maxBotBookingsPerDay ?? ''}
          onChange={(e) => setR({ ...r, maxBotBookingsPerDay: e.target.value ? Number(e.target.value) : null })} placeholder="No limit" />
      </div>
      <button className="btn btn-primary mt-16" onClick={save}>Save rules</button>
    </div>
  );
}

function DoctorModal({ existing, onClose, onDone }: { existing?: Doctor; onClose: () => void; onDone: (d: Doctor) => void }) {
  const [f, setF] = useState({
    name: existing?.name ?? '',
    speciality: existing?.speciality ?? '',
    registrationNo: existing?.registrationNo ?? '',
    fee: existing?.fee?.toString() ?? '',
    alertMobile: existing?.alertMobile?.replace(/^\+91\s?/, '').replace(/\s/g, '') ?? '',
    slotMinutes: existing?.slotMinutes ?? 15,
    languages: existing?.languages ?? ['en'],
    active: existing?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const { toast, error } = useToast();
  const toggleLang = (l: string) => setF({ ...f, languages: f.languages.includes(l) ? f.languages.filter((x) => x !== l) : [...f.languages, l] });

  const submit = async () => {
    setSaving(true);
    try {
      const body = { ...f, fee: Number(f.fee || 0) };
      const d = existing ? await api.patch<Doctor>(`/api/doctors/${existing.id}`, body) : await api.post<Doctor>('/api/doctors', body);
      toast(existing ? 'Saved' : 'Doctor added. Now set their weekly hours.');
      onDone(d);
    } catch (e) {
      error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      wide
      title={existing ? 'Edit doctor' : 'Add a doctor'}
      sub={existing ? undefined : "You'll set weekly hours next. Siletry won't offer this doctor to patients until hours are saved."}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-plain" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-lg" disabled={saving || !f.name.trim()} onClick={submit}>{existing ? 'Save' : 'Continue to hours'}</button>
        </>
      }
    >
      <div className="grid-2">
        <div className="field"><label>Full name</label><input className="input" placeholder="Dr. Priya Shetty" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label>Speciality</label><input className="input" placeholder="Dermatology" value={f.speciality} onChange={(e) => setF({ ...f, speciality: e.target.value })} /></div>
        <div className="field"><label>Registration number</label><input className="input" placeholder="KMC 00000" value={f.registrationNo} onChange={(e) => setF({ ...f, registrationNo: e.target.value })} /></div>
        <div className="field"><label>Consultation fee</label><div className="input-prefix"><span>₹</span><input placeholder="500" type="number" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} /></div></div>
        <div className="field">
          <label>Mobile (for alerts)</label>
          <div className="input-prefix"><span>+91</span><input placeholder="98450 00000" value={f.alertMobile} onChange={(e) => setF({ ...f, alertMobile: e.target.value })} /></div>
          <span className="hint">Emergency escalations and the daily digest</span>
        </div>
        <div className="field">
          <label>Slot length</label>
          <select className="select" value={f.slotMinutes} onChange={(e) => setF({ ...f, slotMinutes: Number(e.target.value) })}>
            {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </div>
      </div>
      <div className="field mt-24">
        <label>Languages spoken</label>
        <div className="chip-group">
          {LANGUAGES.map((l) => <button key={l} className={`chip ${f.languages.includes(l) ? 'on' : ''}`} onClick={() => toggleLang(l)}>{langName(l)}</button>)}
        </div>
      </div>
      {existing && (
        <div className="setting-row mt-16">
          <div className="txt"><b>Active</b><span>Inactive doctors aren't offered to patients.</span></div>
          <Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} />
        </div>
      )}
    </Modal>
  );
}
