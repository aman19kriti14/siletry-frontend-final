import { useEffect, useMemo, useState } from 'react';
import { api, qs } from '../api/client';
import type { AppointmentRow, DaySummary, Doctor, PatientRow, Slot } from '../api/types';
import { Avatar, Modal, Spinner, Toggle } from './ui';
import { useToast } from '../lib/toast';
import { fmtTime, isoDate, langName, parseLocal, relativeDay } from '../lib/format';
import { useFetch } from '../lib/useFetch';

export interface BookPatient { id: number; name: string; phone?: string; age?: number; language?: string; dueFollowUp?: string }

const COMMON_REASONS = ['Fever', 'Cough and cold', 'BP review', 'BP check-up', 'Diabetes review', 'Follow-up', 'Report reading',
  'Vaccination', 'Dressing change', 'Skin rash', 'Stomach pain', 'Routine check-up'];

export default function BookVisitModal({
  patient: initialPatient, reschedule, followUpId, defaultReason, onClose, onDone,
}: {
  patient?: BookPatient;
  reschedule?: { appointmentId: number; doctorId: number; startAt?: string };
  followUpId?: number;
  defaultReason?: string;
  onClose: () => void;
  onDone: (row: AppointmentRow) => void;
}) {
  const { toast, error } = useToast();
  const { data: doctors } = useFetch<Doctor[]>('/api/doctors');
  const activeDoctors = useMemo(() => (doctors ?? []).filter((d) => d.active), [doctors]);

  const [patient, setPatient] = useState<BookPatient | undefined>(initialPatient);
  const [newPatient, setNewPatient] = useState({ name: '', phone: '' });
  const [doctorId, setDoctorId] = useState<number | null>(reschedule?.doctorId ?? null);
  const [reason, setReason] = useState(defaultReason ?? initialPatient?.dueFollowUp ?? '');
  const [length, setLength] = useState<number | null>(null);
  const [date, setDate] = useState(isoDate());
  const [slot, setSlot] = useState<string | null>(null);
  const [sendConfirmation, setSendConfirmation] = useState(true);
  const [remind, setRemind] = useState(true);
  const [note, setNote] = useState('');
  const [days, setDays] = useState<DaySummary[]>([]);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const doctor = activeDoctors.find((d) => d.id === doctorId);

  useEffect(() => {
    if (doctorId === null && activeDoctors.length) setDoctorId(activeDoctors[0].id);
  }, [activeDoctors, doctorId]);

  useEffect(() => {
    if (doctor && length === null) setLength(doctor.slotMinutes);
  }, [doctor, length]);

  useEffect(() => {
    if (!doctorId) return;
    api.get<DaySummary[]>(`/api/doctors/${doctorId}/days` + qs({ from: isoDate(), days: 7 }))
      .then(setDays)
      .catch(() => setDays([]));
  }, [doctorId]);

  useEffect(() => {
    if (!doctorId) return;
    setSlots(null);
    setSlot(null);
    api.get<Slot[]>(`/api/doctors/${doctorId}/slots` + qs({ date }))
      .then(setSlots)
      .catch(() => setSlots([]));
  }, [doctorId, date]);

  useEffect(() => {
    if (!doctorId || !slot) {
      setPreview(null);
      return;
    }
    api.get<{ message: string }>('/api/appointments/confirmation-preview' + qs({ patientId: patient?.id, doctorId, startAt: slot }))
      .then((r) => setPreview(r.message))
      .catch(() => setPreview(null));
  }, [doctorId, slot, patient?.id]);

  const groups = useMemo(() => {
    const g: Record<string, Slot[]> = { Morning: [], Afternoon: [], Evening: [] };
    (slots ?? []).forEach((s) => {
      const h = parseLocal(s.startAt)!.getHours();
      g[h < 12 ? 'Morning' : h < 16 ? 'Afternoon' : 'Evening'].push(s);
    });
    return g;
  }, [slots]);

  const submit = async () => {
    if (!doctorId || !slot) return;
    setSaving(true);
    try {
      let row: AppointmentRow;
      if (reschedule) {
        row = await api.post<AppointmentRow>(`/api/appointments/${reschedule.appointmentId}/reschedule`, {
          startAt: slot, doctorId, notifyPatient: sendConfirmation,
        });
        toast('Appointment moved' + (sendConfirmation ? ' and patient informed' : ''));
      } else {
        if (!patient && (!newPatient.phone.trim() || !newPatient.name.trim())) {
          error('Pick a patient or enter the new patient’s name and phone');
          setSaving(false);
          return;
        }
        row = await api.post<AppointmentRow>('/api/appointments', {
          patientId: patient?.id,
          newPatient: patient ? undefined : newPatient,
          doctorId, startAt: slot, durationMinutes: length, reason, frontDeskNote: note,
          sendConfirmation, remindEveningBefore: remind, followUpId,
        });
        toast('Booked' + (sendConfirmation ? ' and confirmation sent' : ''));
      }
      onDone(row);
    } catch (e) {
      error(e);
      // Slot may have just been taken: refresh the grid
      api.get<Slot[]>(`/api/doctors/${doctorId}/slots` + qs({ date })).then(setSlots).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const summary = slot && doctor
    ? `${relativeDay(slot)}, ${parseLocal(slot)!.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(slot)} · ${length} min · ${doctor.name}`
    : 'Pick a time';

  return (
    <Modal
      wide
      title={reschedule ? 'Reschedule visit' : 'Book a visit'}
      sub="Slots come from the live clinic calendar. Held slots are being offered to another patient on WhatsApp right now."
      onClose={onClose}
      footer={
        <>
          <span className="summary">{summary}</span>
          <button className="btn btn-plain" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-lg" disabled={!slot || saving} onClick={submit}>
            {saving ? 'Saving…' : reschedule ? 'Move appointment' : sendConfirmation ? 'Book and send confirmation' : 'Book'}
          </button>
        </>
      }
    >
      <div className="book-layout">
        <div className="col gap-16">
          {patient ? (
            <div className="card" style={{ background: 'var(--surface-2)', padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
              <Avatar text={patient.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()} />
              <div className="grow">
                <div style={{ fontWeight: 600, fontSize: 16 }}>{patient.name}</div>
                <div className="muted">
                  {[patient.phone, patient.age, patient.language && langName(patient.language)].filter(Boolean).join(' · ')}
                </div>
              </div>
              {patient.dueFollowUp && <span className="pill pill-peach">Due: {patient.dueFollowUp}</span>}
              {!initialPatient && <button className="btn btn-sm btn-ghost" onClick={() => setPatient(undefined)}>Change</button>}
            </div>
          ) : (
            <PatientPicker onPick={setPatient} newPatient={newPatient} setNewPatient={setNewPatient} />
          )}

          <div className="grid-3">
            <div className="field">
              <label>Doctor</label>
              <select className="select" value={doctorId ?? ''} onChange={(e) => { setDoctorId(Number(e.target.value)); setLength(null); }}>
                {activeDoctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Reason</label>
              <input className="input" list="reasons" value={reason} placeholder="e.g. Fever, 3 days" onChange={(e) => setReason(e.target.value)} disabled={!!reschedule} />
              <datalist id="reasons">{COMMON_REASONS.map((r) => <option key={r} value={r} />)}</datalist>
            </div>
            <div className="field">
              <label>Length</label>
              <select className="select" value={length ?? ''} onChange={(e) => setLength(Number(e.target.value))} disabled={!!reschedule}>
                {[doctor?.slotMinutes ?? 15, 30, 45, 60].filter((v, i, a) => a.indexOf(v) === i).map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="label-sm" style={{ marginBottom: 10 }}>Day</div>
            <div className="day-strip">
              {days.map((d) => {
                const dt = parseLocal(d.date)!;
                return (
                  <button
                    key={d.date}
                    className={`day-btn ${d.date === date ? 'sel' : ''} ${d.closed ? 'closed' : ''}`}
                    disabled={d.closed}
                    onClick={() => setDate(d.date)}
                  >
                    <div className="dw">{d.label === 'Today' || d.label === 'Tomorrow' ? d.label : dt.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                    <div className="dn">{dt.getDate()}</div>
                    <div className="df">{d.closed ? 'Closed' : `${d.free} free`}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="row" style={{ marginBottom: 10 }}>
              <div className="label-sm">Time</div>
              <div className="legend-sm right">
                <span><i /> Free</span>
                <span><i style={{ background: '#fbf0d6', borderColor: '#f0d9a4' }} /> Held by Siletry</span>
                <span><i style={{ background: '#f1eee8' }} /> Booked</span>
              </div>
            </div>
            {slots === null ? (
              <Spinner />
            ) : slots.length === 0 ? (
              <div className="muted">No slots on this day.</div>
            ) : (
              Object.entries(groups).filter(([, s]) => s.length).map(([name, list]) => (
                <div key={name} style={{ marginBottom: 14 }}>
                  <div className="section-label" style={{ marginBottom: 8 }}>{name}</div>
                  <div className="slot-grid">
                    {list.map((s) => (
                      <button
                        key={s.startAt}
                        className={`slot ${s.state.toLowerCase()} ${slot === s.startAt ? 'sel' : ''}`}
                        disabled={s.state !== 'FREE'}
                        title={s.state === 'HELD' ? 'Being offered on WhatsApp right now' : undefined}
                        onClick={() => setSlot(s.startAt)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="col gap-16">
          <div className="setting-row" style={{ paddingTop: 0 }}>
            <div className="txt">
              <b>{reschedule ? 'Tell the patient' : 'Send confirmation'}</b>
              <span>On WhatsApp{patient?.language ? `, in ${langName(patient.language)}` : ''}</span>
            </div>
            <Toggle checked={sendConfirmation} onChange={setSendConfirmation} />
          </div>
          {!reschedule && (
            <div className="setting-row">
              <div className="txt">
                <b>Remind the evening before</b>
                <span>Patient replies YES or CHANGE</span>
              </div>
              <Toggle checked={remind} onChange={setRemind} />
            </div>
          )}
          {!reschedule && (
            <div className="field">
              <label>Note for the front desk</label>
              <input className="input" placeholder="Bring last blood report" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
          {sendConfirmation && (
            <div>
              <div className="section-label" style={{ margin: '8px 0 10px' }}>Patient will receive</div>
              <div className="wa-preview">
                <div className="sender-tag" style={{ textAlign: 'right', marginBottom: 8 }}>SILETRY</div>
                <div className="bubble out">{preview ?? 'Pick a time to see the message.'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function PatientPicker({
  onPick, newPatient, setNewPatient,
}: {
  onPick: (p: BookPatient) => void;
  newPatient: { name: string; phone: string };
  setNewPatient: (v: { name: string; phone: string }) => void;
}) {
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PatientRow[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.get<PatientRow[]>('/api/search' + qs({ q })).then(setResults).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="card" style={{ padding: 18, background: 'var(--surface-2)' }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="label-sm">Patient</div>
        <div className="chip-group right">
          <button className={`chip ${mode === 'search' ? 'on' : ''}`} onClick={() => setMode('search')}>Existing</button>
          <button className={`chip ${mode === 'new' ? 'on' : ''}`} onClick={() => setMode('new')}>New patient</button>
        </div>
      </div>
      {mode === 'search' ? (
        <>
          <input className="input" autoFocus placeholder="Search by name, phone or ID" value={q} onChange={(e) => setQ(e.target.value)} />
          {results.map((p) => (
            <div key={p.id} className="row" style={{ padding: '10px 4px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
              onClick={() => onPick({ id: p.id, name: p.name, phone: p.phone, age: p.age, language: p.language, dueFollowUp: p.dueFollowUp })}>
              <Avatar text={p.initials} size="sm" />
              <div className="grow">
                <b>{p.name}</b>
                <div className="muted" style={{ fontSize: 13 }}>{p.phone} · ID {p.patientNo}</div>
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="grid-2">
          <input className="input" placeholder="Full name" value={newPatient.name} onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })} />
          <div className="input-prefix">
            <span>+91</span>
            <input placeholder="98450 00000" value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
}
