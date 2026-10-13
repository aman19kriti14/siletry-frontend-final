import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Users } from 'lucide-react';
import { api, qs } from '../api/client';
import type { PageResult, PatientProfile, PatientRow } from '../api/types';
import { useFetch } from '../lib/useFetch';
import { useToast } from '../lib/toast';
import { Avatar, Empty, ErrorBox, Loading, Modal } from '../components/ui';
import { LANGUAGES, fmtDate, langName, relativeDay, fmtTime } from '../lib/format';

export default function Patients() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(q); setPage(0); }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, error, loading, reload } = useFetch<PageResult<PatientRow>>('/api/patients' + qs({ q: debounced, page, size: 25 }));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Patients</h1>
          <div className="sub">{data ? `${data.total} patients` : ' '} · everyone who has messaged or visited the clinic.</div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setAdding(true)}><UserPlus /> Add patient</button>
        </div>
      </div>

      <div className="search mb-16" style={{ maxWidth: 440, background: '#fff', padding: '10px 12px' }}>
        <Search size={18} />
        <input placeholder="Search by name, phone or patient ID" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? <Loading /> : (
        <div className="card table-card">
          {!data || data.items.length === 0 ? <Empty text="No patients found." icon={<Users />} /> : (
            <table className="table">
              <thead>
                <tr><th>Patient</th><th>ID</th><th>Language</th><th>Last visit</th><th>Next appointment</th><th>Visits</th><th>Follow-up</th></tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => nav(`/patients/${p.id}`)}>
                    <td>
                      <div className="row gap-12">
                        <Avatar text={p.initials} size="sm" />
                        <div>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <div className="sub">{p.phone}{p.age ? ` · ${p.age}` : ''}{p.gender ? ` · ${p.gender}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted">{p.patientNo}</td>
                    <td>{langName(p.language)}</td>
                    <td>{p.lastVisitAt ? fmtDate(p.lastVisitAt) : <span className="faint">—</span>}</td>
                    <td>{p.nextAppointmentAt ? `${relativeDay(p.nextAppointmentAt)}, ${fmtTime(p.nextAppointmentAt)}` : <span className="faint">—</span>}</td>
                    <td>{p.visits}</td>
                    <td>{p.dueFollowUp ? <span className="pill pill-peach pill-sm">{p.dueFollowUp}</span> : <span className="faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {pages > 1 && (
        <div className="row mt-16">
          <span className="muted">Page {page + 1} of {pages}</span>
          <button className="btn btn-plain btn-sm right" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <button className="btn btn-plain btn-sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
      {adding && <PatientFormModal onClose={() => setAdding(false)} onDone={(p) => nav(`/patients/${p.id}`)} />}
    </>
  );
}

export function PatientFormModal({ existing, onClose, onDone }: { existing?: PatientProfile; onClose: () => void; onDone: (p: PatientProfile) => void }) {
  const [f, setF] = useState({
    name: existing?.name ?? '',
    phone: existing?.phone?.replace(/^\+91\s?/, '').replace(/\s/g, '') ?? '',
    age: existing?.age?.toString() ?? '',
    gender: existing?.gender ?? '',
    preferredLanguage: existing?.details.preferredLanguage ?? '',
    emergencyContactName: existing?.details.emergencyContactName ?? '',
    emergencyContactPhone: existing?.details.emergencyContactPhone?.replace(/^\+91\s?/, '').replace(/\s/g, '') ?? '',
    notes: existing?.details.notes ?? '',
    whatsappOptIn: existing?.details.whatsappOptIn ?? true,
  });
  const [saving, setSaving] = useState(false);
  const { toast, error } = useToast();
  const set = (k: keyof typeof f, v: string | boolean) => setF({ ...f, [k]: v });

  const submit = async () => {
    setSaving(true);
    try {
      const body = { ...f, age: f.age ? Number(f.age) : undefined, preferredLanguage: f.preferredLanguage || undefined };
      const p = existing
        ? await api.patch<PatientProfile>(`/api/patients/${existing.id}`, body)
        : await api.post<PatientProfile>('/api/patients', body);
      toast(existing ? 'Saved' : 'Patient added');
      onDone(p);
    } catch (e) {
      error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={existing ? 'Edit patient' : 'Add a patient'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-plain" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving || !f.name.trim() || !f.phone.trim()} onClick={submit}>Save</button>
        </>
      }
    >
      <div className="grid-2">
        <div className="field"><label>Full name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field"><label>Mobile (WhatsApp)</label><div className="input-prefix"><span>+91</span><input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div></div>
        <div className="field"><label>Age</label><input className="input" type="number" value={f.age} onChange={(e) => set('age', e.target.value)} /></div>
        <div className="field">
          <label>Gender</label>
          <select className="select" value={f.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">—</option><option>Female</option><option>Male</option><option>Other</option>
          </select>
        </div>
        <div className="field">
          <label>Preferred language</label>
          <select className="select" value={f.preferredLanguage} onChange={(e) => set('preferredLanguage', e.target.value)}>
            <option value="">—</option>
            {LANGUAGES.map((l) => <option key={l} value={l}>{langName(l)}</option>)}
          </select>
        </div>
        <div className="field"><label>Emergency contact name</label><input className="input" value={f.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} /></div>
        <div className="field"><label>Emergency contact phone</label><div className="input-prefix"><span>+91</span><input value={f.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} /></div></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label>Notes</label><textarea className="textarea" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      <label className="row mt-16" style={{ cursor: 'pointer' }}>
        <input type="checkbox" className="checkbox" checked={f.whatsappOptIn} onChange={(e) => set('whatsappOptIn', e.target.checked)} />
        Patient agreed to get WhatsApp messages from the clinic
      </label>
    </Modal>
  );
}
