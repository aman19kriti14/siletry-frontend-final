import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BellRing, CalendarDays, CalendarPlus, MessageCircle, Pencil, Phone, Plus } from 'lucide-react';
import { api } from '../api/client';
import type { Doctor, PatientProfile as Profile } from '../api/types';
import { useFetch } from '../lib/useFetch';
import { useToast } from '../lib/toast';
import { Avatar, BookedByPill, Empty, ErrorBox, Loading, Modal, StatusPill } from '../components/ui';
import BookVisitModal from '../components/BookVisitModal';
import { CancelModal } from '../components/AppointmentActions';
import { PatientFormModal } from './Patients';
import { fmtDate, fmtTime, isoDate, addDays, langName, relativeDay } from '../lib/format';

export default function PatientProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: p, error, loading, reload } = useFetch<Profile>(`/api/patients/${id}`);
  const [tab, setTab] = useState<'overview' | 'visits' | 'messages'>('overview');
  const [booking, setBooking] = useState<null | { followUpId?: number; reason?: string }>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addFollowUp, setAddFollowUp] = useState(false);

  if (loading && !p) return <Loading />;
  if (error && !p) return <ErrorBox message={error} onRetry={reload} />;
  if (!p) return null;

  const next = p.nextAppointment;
  const bookPatient = { id: p.id, name: p.name, phone: p.phone, age: p.age, language: p.language, dueFollowUp: p.dueFollowUp };

  return (
    <>
      <button className="link-btn mb-24" onClick={() => nav('/patients')}><ArrowLeft size={18} /> All patients</button>

      <div className="row gap-16 mb-24" style={{ alignItems: 'flex-start' }}>
        <Avatar text={p.initials} size="xl" />
        <div className="grow">
          <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 30 }}>{p.name}</h1>
            {p.language && <span className="pill pill-gray">{langName(p.language)}</span>}
            {p.dueFollowUp && <span className="pill pill-peach">Due: {p.dueFollowUp}</span>}
            {p.details.optedOut && <span className="pill pill-red">Opted out</span>}
          </div>
          <div className="muted mt-8" style={{ fontSize: 15, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <span>{[p.age && `${p.age} years`, p.gender].filter(Boolean).join(' · ') || '—'}</span>
            <span>{p.phone}</span>
            <span>ID {p.patientNo}</span>
          </div>
        </div>
        <div className="row">
          <button className="btn btn-plain btn-icon" title="Edit" onClick={() => setEditing(true)}><Pencil /></button>
          <a className="btn btn-plain btn-icon" title="Call" href={`tel:${p.phone.replace(/\s/g, '')}`}><Phone /></a>
          <button className="btn btn-outline" disabled={!p.conversationId} onClick={() => nav(`/inbox/${p.conversationId}`)}><MessageCircle /> Open chat</button>
          <button className="btn btn-primary" onClick={() => setBooking({})}><CalendarPlus /> Book visit</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`tab ${tab === 'visits' ? 'active' : ''}`} onClick={() => setTab('visits')}>Visits <span className="n">{p.stats.visits}</span></button>
        <button className={`tab ${tab === 'messages' ? 'active' : ''}`} onClick={() => p.conversationId ? nav(`/inbox/${p.conversationId}`) : setTab('messages')}>Messages</button>
      </div>

      {tab === 'messages' && <Empty text="No WhatsApp conversation with this patient yet." />}

      {tab === 'visits' && <VisitTable p={p} />}

      {tab === 'overview' && (
        <div className="overview-grid">
          <div className="col gap-16">
            <div className="card card-pad" style={next ? { boxShadow: 'inset 5px 0 0 var(--primary)' } : undefined}>
              <div className="section-label">Next appointment</div>
              {next ? (
                <div className="row gap-16 mt-12" style={{ flexWrap: 'wrap' }}>
                  <div className="grow">
                    <div style={{ fontSize: 26, fontWeight: 600 }}>{relativeDay(next.startAt)}, {fmtTime(next.startAt)}</div>
                    <div className="muted mt-8">
                      {[next.doctorName, next.reason].filter(Boolean).join(' · ')} · booked {next.bookedBy === 'SILETRY' ? 'on WhatsApp' : 'by staff'} {relativeDay(next.bookedAt).toLowerCase() === 'today' ? `at ${fmtTime(next.bookedAt)}` : fmtDate(next.bookedAt)}
                    </div>
                  </div>
                  <StatusPill status={next.status} />
                  {next.status === 'CONFIRMED' && (
                    <>
                      <button className="btn btn-ghost" onClick={() => setRescheduling(true)}>Reschedule</button>
                      <button className="btn btn-danger" onClick={() => setCancelling(true)}>Cancel</button>
                    </>
                  )}
                </div>
              ) : (
                <div className="row mt-12"><span className="muted">Nothing booked.</span><button className="btn btn-outline btn-sm right" onClick={() => setBooking({})}>Book visit</button></div>
              )}
            </div>

            <div className="stat-grid compact" style={{ marginBottom: 0 }}>
              <div className="card stat"><div className="label">Visits</div><div className="value">{p.stats.visits}</div></div>
              <div className="card stat"><div className="label">No-shows</div><div className="value">{p.stats.noShows}</div></div>
              <div className="card stat"><div className="label">Booked by Siletry</div><div className="value">{p.stats.bookedBySiletry} of {p.stats.visits}</div></div>
              <div className="card stat"><div className="label">Patient since</div><div className="value">{fmtDate(p.stats.patientSince, { month: 'short', year: 'numeric' })}</div></div>
            </div>

            <div className="card">
              <div className="card-head"><h3>Visit history</h3></div>
              <VisitTable p={p} limit={6} flat />
            </div>
          </div>

          <div className="col gap-16">
            <div className="card card-pad">
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>Details</h3>
              <div className="kv"><span className="k">WhatsApp</span><span className="v">{p.details.optedOut ? 'Opted out (sent STOP)' : p.details.whatsappOptIn ? `Opted in${p.details.optInAt ? ' · ' + fmtDate(p.details.optInAt) : ''}` : 'Not opted in'}</span></div>
              <div className="kv"><span className="k">Preferred language</span><span className="v">{langName(p.details.preferredLanguage)}</span></div>
              <div className="kv"><span className="k">Preferred doctor</span><span className="v">{p.details.preferredDoctorName ?? '—'}</span></div>
              <div className="kv"><span className="k">Usual time</span><span className="v">{p.details.usualTime ?? '—'}</span></div>
              <div className="kv"><span className="k">Emergency contact</span><span className="v">{p.details.emergencyContactName ? `${p.details.emergencyContactName} · ${p.details.emergencyContactPhone ?? ''}` : '—'}</span></div>
              {p.details.notes && <div className="kv"><span className="k">Notes</span><span className="v">{p.details.notes}</span></div>}
            </div>

            <div className="card card-pad">
              <div className="row mb-16">
                <h3 style={{ fontSize: 20 }}>Follow-ups</h3>
                {p.followUps.filter((f) => f.dueLabel).length > 0 && <span className="pill pill-peach right">{p.followUps.filter((f) => f.dueLabel).length} due</span>}
              </div>
              {p.followUps.length === 0 && <div className="muted">No follow-ups.</div>}
              {p.followUps.map((f) => (
                <div key={f.id} className="kv" style={{ alignItems: 'center' }}>
                  <span className="row gap-8">{f.dueLabel ? <BellRing size={18} color="#b0632a" /> : <CalendarDays size={18} color="#6d746f" />}<span style={{ fontWeight: 500 }}>{f.title}</span></span>
                  <span className="row gap-8">
                    <span className={f.dueLabel ? '' : 'muted'} style={f.dueLabel ? { color: '#b0632a' } : undefined}>{f.dueLabel ?? fmtDate(f.dueDate)}</span>
                    {f.status === 'DUE' || f.status === 'OFFERED' ? (
                      <button className="btn btn-sm btn-ghost" onClick={() => setBooking({ followUpId: f.id, reason: f.title })}>Book</button>
                    ) : <span className="pill pill-gray pill-sm">{f.status.toLowerCase()}</span>}
                  </span>
                </div>
              ))}
              <p className="muted mt-12" style={{ fontSize: 13.5 }}>Siletry messages the patient on the due date with two open slots.</p>
              <button className="btn btn-plain btn-sm mt-12" onClick={() => setAddFollowUp(true)}><Plus /> Add follow-up</button>
            </div>
          </div>
        </div>
      )}

      {booking && (
        <BookVisitModal patient={bookPatient} followUpId={booking.followUpId} defaultReason={booking.reason}
          onClose={() => setBooking(null)} onDone={() => { setBooking(null); reload(); }} />
      )}
      {rescheduling && next && (
        <BookVisitModal patient={bookPatient} reschedule={{ appointmentId: next.appointmentId, doctorId: next.doctorId }}
          onClose={() => setRescheduling(false)} onDone={() => { setRescheduling(false); reload(); }} />
      )}
      {cancelling && next && (
        <CancelModal row={{ id: next.appointmentId, patientName: p.name }} onClose={() => setCancelling(false)} onDone={() => { setCancelling(false); reload(); }} />
      )}
      {editing && <PatientFormModal existing={p} onClose={() => setEditing(false)} onDone={() => { setEditing(false); reload(); }} />}
      {addFollowUp && <FollowUpModal patientId={p.id} onClose={() => setAddFollowUp(false)} onDone={() => { setAddFollowUp(false); reload(); }} />}
    </>
  );
}

function VisitTable({ p, limit, flat }: { p: Profile; limit?: number; flat?: boolean }) {
  const rows = limit ? p.visits.slice(0, limit) : p.visits;
  if (rows.length === 0) return <Empty text="No visits yet." />;
  const table = (
    <table className="table">
      <thead><tr><th>Date</th><th>Reason</th><th>Doctor</th><th>Booked by</th><th>Status</th></tr></thead>
      <tbody>
        {rows.map((v) => (
          <tr key={v.appointmentId}>
            <td><div style={{ fontWeight: 500 }}>{fmtDate(v.startAt)}</div><div className="sub">{fmtTime(v.startAt)}</div></td>
            <td>{v.reason ?? '—'}</td>
            <td>{v.doctorName}</td>
            <td><BookedByPill by={v.bookedBy} /></td>
            <td>{v.status === 'SEEN' ? <span className="muted">Seen</span> : <StatusPill status={v.status} />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return flat ? table : <div className="card table-card">{table}</div>;
}

function FollowUpModal({ patientId, onClose, onDone }: { patientId: number; onClose: () => void; onDone: () => void }) {
  const { data: doctors } = useFetch<Doctor[]>('/api/doctors');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(addDays(isoDate(), 7));
  const [doctorId, setDoctorId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const { toast, error } = useToast();
  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/api/follow-ups', { patientId, title, dueDate: due, doctorId: doctorId ? Number(doctorId) : undefined });
      toast('Follow-up added');
      onDone();
    } catch (e) {
      error(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Add a follow-up" sub="On the due date, Siletry messages the patient with two open slots." onClose={onClose}
      footer={<><button className="btn btn-plain" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={saving || !title.trim()} onClick={submit}>Add</button></>}>
      <div className="col gap-16">
        <div className="field"><label>What for</label><input className="input" placeholder="BP review" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field">
          <label>Due</label>
          <div className="chip-group mb-16">
            {[7, 14, 30, 90].map((d) => (
              <button key={d} className={`chip ${due === addDays(isoDate(), d) ? 'on' : ''}`} onClick={() => setDue(addDays(isoDate(), d))}>
                {d < 30 ? `${d / 7} week${d > 7 ? 's' : ''}` : `${d / 30} month${d > 30 ? 's' : ''}`}
              </button>
            ))}
          </div>
          <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="field">
          <label>Doctor</label>
          <select className="select" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Patient's usual doctor</option>
            {(doctors ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}
