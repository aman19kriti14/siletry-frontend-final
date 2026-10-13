import { useState } from 'react';
import { BellRing, ChevronsUp, SkipForward, UserPlus, CheckCircle2, UserX } from 'lucide-react';
import { api } from '../api/client';
import type { Doctor, PatientRow, QueueView } from '../api/types';
import { useFetch } from '../lib/useFetch';
import { useToast } from '../lib/toast';
import { Modal, Toggle } from './ui';
import { qs } from '../api/client';

/** Live lobby queue per doctor: who's in, who's waiting, and the Call next button. */
export default function QueuePanel({ onChanged }: { onChanged: () => void }) {
  const { data, reload } = useFetch<QueueView[]>('/api/queue', { pollMs: 15000 });
  const { toast, error } = useToast();
  const [walkIn, setWalkIn] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const act = async (fn: () => Promise<unknown>, msg?: string, doctorId?: number) => {
    if (doctorId) setBusy(doctorId);
    try {
      await fn();
      if (msg) toast(msg);
      reload();
      onChanged();
    } catch (e) {
      error(e);
    } finally {
      setBusy(null);
    }
  };

  /** First miss: back in line + WhatsApp nudge. Second miss: no-show. The server calls the next patient either way. */
  const notHere = async (appointmentId: number, token: number | null | undefined, doctorId: number) => {
    setBusy(doctorId);
    try {
      const v = await api.post<QueueView>(`/api/queue/appointments/${appointmentId}/not-here`);
      const requeued = v.waiting.some((w) => w.appointmentId === appointmentId);
      const called = v.current ? ` Called #${v.current.tokenNumber}.` : '';
      toast(requeued
        ? `#${token} messaged to come to the desk. They're next in line.${called}`
        : `#${token} marked as no-show (missed twice).${called}`);
      reload();
      onChanged();
    } catch (e) {
      error(e);
    } finally {
      setBusy(null);
    }
  };

  const queues = (data ?? []).filter((q) => q.current || q.waiting.length || q.seenToday);

  return (
    <>
      <div className="row mb-16">
        <h3 style={{ fontSize: 18 }}>Lobby queue</h3>
        <span className="muted" style={{ fontSize: 13.5 }}>Tap Call next when you call a name. Patients get told on WhatsApp.</span>
        <button className="btn btn-outline btn-sm right" onClick={() => setWalkIn(true)}><UserPlus /> Add walk-in</button>
      </div>
      {queues.length === 0 ? (
        <div className="card card-pad muted mb-24">Nobody has checked in yet today. Patients scan the desk QR code or you can check them in from the list below.</div>
      ) : (
        <div className="queue-grid">
          {queues.map((q) => (
            <div key={q.doctorId} className="card queue-card">
              <div className="row">
                <b style={{ fontSize: 16 }}>{q.doctorName}</b>
                <span className="muted" style={{ fontSize: 13 }}>~{q.avgConsultMinutes} min each · {q.seenToday} seen</span>
              </div>
              {q.stale && <div className="banner warn mt-8" style={{ padding: '8px 12px' }}>No one has been called in a while. Still with #{q.current?.tokenNumber}?</div>}
              <div className="now">
                {q.current ? (
                  <>
                    <div className="token">#{q.current.tokenNumber}</div>
                    <div className="grow">
                      <div style={{ fontWeight: 600 }}>{q.current.patientName}</div>
                      <div className="muted" style={{ fontSize: 13 }}>With the doctor now{q.current.reason ? ` · ${q.current.reason}` : ''}</div>
                    </div>
                    <button
                      className="btn btn-sm btn-plain"
                      title="Called but didn't come in"
                      disabled={busy === q.doctorId}
                      onClick={() => notHere(q.current!.appointmentId, q.current!.tokenNumber, q.doctorId)}
                    >
                      <UserX /> Not here
                    </button>
                    {q.waiting.length === 0 && (
                      <button className="btn btn-sm btn-plain" onClick={() => act(() => api.post(`/api/queue/appointments/${q.current!.appointmentId}/done`), 'Marked as seen')}>
                        <CheckCircle2 /> Done
                      </button>
                    )}
                  </>
                ) : (
                  <div className="muted">Nobody with the doctor right now</div>
                )}
              </div>
              <div className="queue-list">
                {q.waiting.length === 0 && <div className="muted" style={{ padding: '6px 0' }}>No one waiting</div>}
                {q.waiting.map((w) => (
                  <div key={w.appointmentId} className="queue-item">
                    <span className="tk">#{w.tokenNumber}</span>
                    <div className="grow">
                      <div className="row gap-8">
                        <span style={{ fontWeight: 600 }}>{w.patientName}</span>
                        {w.emergency && <span className="pill pill-red pill-sm">Emergency</span>}
                        {w.bookedBy === 'WALK_IN' && <span className="pill pill-gray pill-sm">Walk-in</span>}
                      </div>
                      <div className="muted" style={{ fontSize: 12.5 }}>Waiting {w.waitedMinutes} min · in ~{w.etaMinutes} min</div>
                    </div>
                    <button className="icon-btn" title="Move to front" onClick={() => act(() => api.post(`/api/queue/appointments/${w.appointmentId}/move-to-front`))}><ChevronsUp /></button>
                    <button className="icon-btn" title="Stepped out: move to end" onClick={() => act(() => api.post(`/api/queue/appointments/${w.appointmentId}/skip`), 'Moved to the end of the line')}><SkipForward /></button>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-primary mt-12"
                style={{ width: '100%' }}
                disabled={busy === q.doctorId || (!q.current && q.waiting.length === 0)}
                onClick={() => act(() => api.post(`/api/queue/doctors/${q.doctorId}/call-next`),
                  q.waiting.length ? `Called #${q.waiting[0].tokenNumber}. They've been told on WhatsApp.` : 'Marked as seen', q.doctorId)}
              >
                <BellRing /> Call next{q.waiting.length ? ` (#${q.waiting[0].tokenNumber})` : ''}
              </button>
            </div>
          ))}
        </div>
      )}
      {walkIn && <WalkInModal onClose={() => setWalkIn(false)} onDone={() => { setWalkIn(false); reload(); onChanged(); }} />}
    </>
  );
}

function WalkInModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: doctors } = useFetch<Doctor[]>('/api/doctors');
  const [doctorId, setDoctorId] = useState<number | ''>('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PatientRow[]>([]);
  const [picked, setPicked] = useState<PatientRow | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [emergency, setEmergency] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast, error } = useToast();

  const search = async (v: string) => {
    setQ(v);
    setPicked(null);
    if (v.trim().length < 2) return setResults([]);
    try {
      setResults(await api.get<PatientRow[]>('/api/search' + qs({ q: v })));
    } catch {
      setResults([]);
    }
  };

  const docId = doctorId || doctors?.find((d) => d.active)?.id;
  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/api/queue/walk-in', {
        patientId: picked?.id, name: picked ? undefined : name, phone: picked ? undefined : phone,
        doctorId: docId, reason, emergency,
      });
      toast('Added to the queue. Token sent on WhatsApp.');
      onDone();
    } catch (e) {
      error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add a walk-in"
      sub="For patients who didn't scan the desk QR code."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-plain" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving || (!picked && !phone.trim())} onClick={submit}>Add to queue</button>
        </>
      }
    >
      <div className="col gap-16">
        <div className="field">
          <label>Existing patient</label>
          <input className="input" placeholder="Search name or phone" value={picked ? picked.name : q} onChange={(e) => search(e.target.value)} />
          {!picked && results.map((p) => (
            <div key={p.id} className="row" style={{ padding: '8px 4px', cursor: 'pointer' }} onClick={() => { setPicked(p); setResults([]); }}>
              <b>{p.name}</b><span className="muted">{p.phone}</span>
            </div>
          ))}
        </div>
        {!picked && (
          <div className="grid-2">
            <div className="field"><label>Or new: name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label>Mobile</label><div className="input-prefix"><span>+91</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div></div>
          </div>
        )}
        <div className="grid-2">
          <div className="field">
            <label>Doctor</label>
            <select className="select" value={docId ?? ''} onChange={(e) => setDoctorId(Number(e.target.value))}>
              {(doctors ?? []).filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Reason</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Fever" /></div>
        </div>
        <div className="setting-row">
          <div className="txt"><b>Emergency</b><span>Goes to the front of the queue</span></div>
          <Toggle checked={emergency} onChange={setEmergency} />
        </div>
      </div>
    </Modal>
  );
}