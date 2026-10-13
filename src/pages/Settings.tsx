import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { api } from '../api/client';
import type { ClinicView, Doctor, Role, User } from '../api/types';
import { useFetch } from '../lib/useFetch';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { Avatar, Loading, Modal } from '../components/ui';
import { initials } from '../lib/format';

export default function Settings() {
  const { data: clinic, setData } = useFetch<ClinicView>('/api/clinic');
  const { data: staff, reload: reloadStaff } = useFetch<User[]>('/api/staff');
  const { user, refresh, logout } = useAuth();
  const { toast, error } = useToast();
  const owner = user?.role === 'OWNER';
  const [f, setF] = useState({ name: '', area: '', city: '', address: '', phone: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (clinic) setF({ name: clinic.name, area: clinic.area ?? '', city: clinic.city ?? '', address: clinic.address ?? '', phone: clinic.phone ?? '' });
  }, [clinic]);

  if (!clinic) return <Loading />;

  const save = async () => {
    try {
      setData(await api.patch<ClinicView>('/api/clinic', f));
      refresh();
      toast('Clinic details saved');
    } catch (e) {
      error(e);
    }
  };

  const setActive = async (u: User, active: boolean) => {
    try {
      await api.post(`/api/staff/${u.id}/${active ? 'activate' : 'deactivate'}`);
      reloadStaff();
    } catch (e) {
      error(e);
    }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Settings</h1><div className="sub">Clinic details and who can log in.</div></div>
      </div>

      <div className="overview-grid">
        <div className="card card-pad">
          <h3 style={{ fontSize: 18, marginBottom: 18 }}>Clinic details</h3>
          <div className="grid-2">
            <div className="field"><label>Clinic name</label><input className="input" disabled={!owner} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="field"><label>Phone</label><input className="input" disabled={!owner} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div className="field"><label>Area</label><input className="input" disabled={!owner} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></div>
            <div className="field"><label>City</label><input className="input" disabled={!owner} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Address</label>
              <textarea className="textarea" disabled={!owner} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
              <span className="hint">Siletry shares this when patients ask for directions.</span>
            </div>
          </div>
          {owner && <button className="btn btn-primary mt-16" onClick={save}>Save</button>}
        </div>

        <div className="col gap-16">
          <div className="card card-pad">
            <div className="row mb-16">
              <h3 style={{ fontSize: 18 }}>Team</h3>
              {owner && <button className="btn btn-outline btn-sm right" onClick={() => setAdding(true)}><UserPlus /> Add</button>}
            </div>
            {(staff ?? []).map((u) => (
              <div key={u.id} className="row gap-12" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', opacity: u.active ? 1 : 0.5 }}>
                <Avatar text={initials(u.name)} size="sm" />
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{u.email}</div>
                </div>
                <span className="pill pill-gray pill-sm">{u.role.toLowerCase()}</span>
                {owner && u.id !== user?.id && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setActive(u, !u.active)}>{u.active ? 'Remove' : 'Restore'}</button>
                )}
              </div>
            ))}
          </div>
          <div className="card card-pad">
            <h3 style={{ fontSize: 18 }}>Your account</h3>
            <div className="kv mt-8"><span className="k">Name</span><span className="v">{user?.name}</span></div>
            <div className="kv"><span className="k">Email</span><span className="v">{user?.email}</span></div>
            <div className="kv"><span className="k">Role</span><span className="v">{user?.role.toLowerCase()}</span></div>
            <button className="btn btn-danger mt-16" onClick={logout}>Log out</button>
          </div>
          <PasswordCard />
        </div>
      </div>
      {adding && <StaffModal onClose={() => setAdding(false)} onDone={() => { setAdding(false); reloadStaff(); }} />}
    </>
  );
}

function StaffModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: doctors } = useFetch<Doctor[]>('/api/doctors');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', role: 'RECEPTIONIST' as Role, doctorId: '' });
  const { toast, error } = useToast();
  const submit = async () => {
    try {
      await api.post('/api/staff', { ...f, doctorId: f.doctorId ? Number(f.doctorId) : undefined });
      toast('Login created. Share the email and password with them.');
      onDone();
    } catch (e) {
      error(e);
    }
  };
  return (
    <Modal title="Add a team member" onClose={onClose}
      footer={<><button className="btn btn-plain" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!f.name || !f.email || f.password.length < 8} onClick={submit}>Create login</button></>}>
      <div className="grid-2">
        <div className="field"><label>Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label>Mobile</label><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /><span className="hint">Lets them send NEXT on WhatsApp</span></div>
        <div className="field"><label>Email</label><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label>Temporary password</label><input className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><span className="hint">At least 8 characters</span></div>
        <div className="field">
          <label>Role</label>
          <select className="select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            <option value="RECEPTIONIST">Receptionist</option>
            <option value="DOCTOR">Doctor</option>
            <option value="OWNER">Owner</option>
          </select>
        </div>
        {f.role === 'DOCTOR' && (
          <div className="field">
            <label>Which doctor</label>
            <select className="select" value={f.doctorId} onChange={(e) => setF({ ...f, doctorId: e.target.value })}>
              <option value="">—</option>
              {(doctors ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PasswordCard() {
  const { data, reload } = useFetch<{ hasPassword: boolean }>('/api/auth/password');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const { toast, error } = useToast();
  if (!data) return null;
  const save = async () => {
    try {
      await api.post('/api/auth/password', { currentPassword: current || undefined, newPassword: next });
      toast(data.hasPassword ? 'Password changed' : 'Password set. You can now sign in with it too.');
      setCurrent('');
      setNext('');
      reload();
    } catch (e) {
      error(e);
    }
  };
  return (
    <div className="card card-pad">
      <h3 style={{ fontSize: 18 }}>{data.hasPassword ? 'Change password' : 'Set a password'}</h3>
      <p className="muted mt-8" style={{ fontSize: 13.5 }}>
        {data.hasPassword ? 'You can also sign in with a WhatsApp code any time.' : 'You sign in with WhatsApp codes. Add a password if you also want to sign in without your phone.'}
      </p>
      <div className="col gap-12 mt-12">
        {data.hasPassword && <input className="input" type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />}
        <input className="input" type="password" placeholder="New password (8+ characters)" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={next.length < 8} onClick={save}>Save password</button>
      </div>
    </div>
  );
}
