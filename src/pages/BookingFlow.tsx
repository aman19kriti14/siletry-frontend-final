import { useEffect, useState } from 'react';
import { Copy, Download, Plus, QrCode as QrIcon, ScanLine } from 'lucide-react';
import { api, fetchImage } from '../api/client';
import type { Doctor, QrView } from '../api/types';
import { useFetch } from '../lib/useFetch';
import { useToast } from '../lib/toast';
import { Loading, Modal } from '../components/ui';
import { useAuth } from '../lib/auth';

export default function BookingFlow() {
  const { data, loading, reload } = useFetch<QrView[]>('/api/qr');
  const { clinic } = useAuth();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Booking flow</h1>
          <div className="sub">Patients scan, WhatsApp opens with a message ready, Siletry does the rest. Every code is tracked so you know where bookings come from.</div>
        </div>
        <div className="actions"><button className="btn btn-primary" onClick={() => setAdding(true)}><Plus /> New QR code</button></div>
      </div>

      <div className="grid-3 mb-24">
        {[
          ['1', 'Scan to book', 'Poster outside, prescription slips, visiting cards. Patient picks a day and time with buttons, no typing.'],
          ['2', 'Scan to check in', 'QR at the reception desk. Patient gets a token and live updates on when to walk in.'],
          ['3', 'Siletry follows up', 'Reminder the evening before, follow-up on the due date, and a nudge if they miss it.'],
        ].map(([n, t, d]) => (
          <div key={n} className="card card-pad">
            <div className="row gap-12"><span className="count-badge">{n}</span><b style={{ fontSize: 16 }}>{t}</b></div>
            <p className="muted mt-12" style={{ lineHeight: 1.5 }}>{d}</p>
          </div>
        ))}
      </div>

      {!clinic?.whatsappConnected && <div className="banner warn mb-16">Connect the clinic's WhatsApp number under WhatsApp numbers to generate scannable codes.</div>}

      {loading && !data ? <Loading /> : (
        <div className="qr-grid">
          {(data ?? []).map((q) => <QrCard key={q.id} q={q} onChanged={reload} />)}
        </div>
      )}
      {adding && <NewQrModal onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />}
    </>
  );
}

function QrCard({ q, onChanged }: { q: QrView; onChanged: () => void }) {
  const [img, setImg] = useState<string | null>(null);
  const { toast, error } = useToast();

  useEffect(() => {
    if (!q.waLink) return;
    let url: string | null = null;
    fetchImage(`/api/qr/${q.id}/image.png?size=600`).then((u) => { url = u; setImg(u); }).catch(() => setImg(null));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [q.id, q.waLink]);

  const download = async () => {
    try {
      const u = await fetchImage(`/api/qr/${q.id}/image.png?size=1200`);
      const a = document.createElement('a');
      a.href = u;
      a.download = `siletry-${q.code}.png`;
      a.click();
    } catch (e) {
      error(e);
    }
  };

  const toggle = async () => {
    try {
      await api.post(`/api/qr/${q.id}/${q.active ? 'deactivate' : 'activate'}`);
      onChanged();
    } catch (e) {
      error(e);
    }
  };

  return (
    <div className="card qr-card" style={q.active ? undefined : { opacity: 0.6 }}>
      <div className="row">
        <span className={`pill pill-sm ${q.type === 'BOOKING' ? 'pill-teal' : 'pill-peach'}`}>{q.type === 'BOOKING' ? <><QrIcon size={13} /> Book</> : <><ScanLine size={13} /> Check in</>}</span>
        <span className="muted right" style={{ fontSize: 13 }}>{q.scans} scan{q.scans === 1 ? '' : 's'}</span>
      </div>
      <div>
        <b style={{ fontSize: 16 }}>{q.label}</b>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 2 }}>{q.code}</div>
      </div>
      <div className="qr-img">{img ? <img src={img} alt={q.code} /> : <QrIcon size={48} color="#c9c4ba" />}</div>
      <div className="muted" style={{ fontSize: 13, fontStyle: 'italic' }}>“{q.prefilledText}”</div>
      <div className="row">
        <button className="btn btn-outline btn-sm" disabled={!q.waLink} onClick={download}><Download /> PNG</button>
        <button className="btn btn-plain btn-sm" disabled={!q.waLink} onClick={() => { navigator.clipboard.writeText(q.waLink!); toast('Link copied. Use it on Google Maps, Instagram or your website.'); }}><Copy /> Link</button>
        <button className="btn btn-ghost btn-sm right" onClick={toggle}>{q.active ? 'Disable' : 'Enable'}</button>
      </div>
    </div>
  );
}

function NewQrModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: doctors } = useFetch<Doctor[]>('/api/doctors');
  const [type, setType] = useState<'BOOKING' | 'CHECKIN'>('BOOKING');
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const { toast, error } = useToast();
  const submit = async () => {
    try {
      await api.post('/api/qr', { type, label, code: code || undefined, doctorId: doctorId ? Number(doctorId) : undefined });
      toast('QR code created');
      onDone();
    } catch (e) {
      error(e);
    }
  };
  return (
    <Modal title="New QR code" onClose={onClose}
      footer={<><button className="btn btn-plain" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!label.trim()} onClick={submit}>Create</button></>}>
      <div className="col gap-16">
        <div className="field">
          <label>What it does</label>
          <div className="chip-group">
            <button className={`chip ${type === 'BOOKING' ? 'on' : ''}`} onClick={() => setType('BOOKING')}>Book an appointment</button>
            <button className={`chip ${type === 'CHECKIN' ? 'on' : ''}`} onClick={() => setType('CHECKIN')}>Check in at the desk</button>
          </div>
        </div>
        <div className="field"><label>Where it goes</label><input className="input" placeholder="Pharmacy counter next door" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        <div className="field"><label>Short code (optional)</label><input className="input" placeholder="PHARMACY" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /><span className="hint">Used to track scans. Letters and numbers only.</span></div>
        {type === 'BOOKING' && (
          <div className="field">
            <label>Send straight to a doctor (optional)</label>
            <select className="select" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">Let the patient choose</option>
              {(doctors ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}
