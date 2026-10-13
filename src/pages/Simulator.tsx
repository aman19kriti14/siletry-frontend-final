import { useEffect, useRef, useState } from 'react';
import { Play, Send, QrCode } from 'lucide-react';
import { api, qs } from '../api/client';
import type { Doctor, MessageView, QrView, SimResult, User } from '../api/types';
import { useFetch } from '../lib/useFetch';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { fmtTime } from '../lib/format';

/** Test the WhatsApp experience without a real WhatsApp account (mock mode only). */
export default function Simulator() {
  const { clinic } = useAuth();
  const { toast, error } = useToast();
  const { data: qrs } = useFetch<QrView[]>('/api/qr');
  const [phone, setPhone] = useState('9876543210');
  const [name, setName] = useState('Ravi Kumar');
  const [msgs, setMsgs] = useState<MessageView[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [off, setOff] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const loadThread = async (p = phone) => {
    try {
      setMsgs(await api.get<MessageView[]>('/api/dev/whatsapp/thread' + qs({ phone: p })));
    } catch (e) {
      setMsgs([]);
      // 404 with "No static resource" / "not found" for the route itself means dev tools are off
      if (e instanceof Error && /static resource|No endpoint|dev\/whatsapp/i.test(e.message)) setOff(true);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => loadThread(phone), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  // Pick up messages sent from elsewhere (staff replies, Call next)
  useEffect(() => {
    const t = setInterval(() => loadThread(), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [msgs.length]);

  const send = async (body: string) => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api.post<SimResult>('/api/dev/whatsapp/patient-message', { phone, name, text: body });
      setText('');
      await loadThread();
    } catch (e) {
      error(e);
    } finally {
      setBusy(false);
    }
  };

  const scan = async (q: QrView) => {
    setBusy(true);
    try {
      await api.post<SimResult>('/api/dev/whatsapp/scan', { phone, name, qrId: q.id });
      await loadThread();
    } catch (e) {
      error(e);
    } finally {
      setBusy(false);
    }
  };

  const runJob = async (job: 'reminders' | 'follow-ups') => {
    try {
      const r = await api.post<{ sent: number }>(`/api/dev/jobs/${job}`);
      toast(`${r.sent} ${job === 'reminders' ? 'reminder' : 'follow-up'} message${r.sent === 1 ? '' : 's'} sent`);
      loadThread();
    } catch (e) {
      error(e);
    }
  };

  if (off) {
    return (
      <>
        <div className="page-head"><div><h1>WhatsApp simulator</h1></div></div>
        <div className="banner warn">The simulator is switched off on the backend. Set <b>DEV_TOOLS=true</b> in Railway to use it while testing, and switch it off again before real clinics use Siletry.</div>
      </>
    );
  }

  const last = msgs[msgs.length - 1];
  const buttons = last && last.direction === 'OUT' ? last.buttons : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>WhatsApp simulator</h1>
          <div className="sub">Be a patient and see exactly what Siletry replies. It shows up in Inbox and Appointments, but nothing is sent on real WhatsApp, even if the clinic is connected.</div>
        </div>
      </div>
      <div className="sim-layout">
        <div className="phone">
          <div className="phone-head">
            <div className="avatar sm" style={{ background: '#fff', color: '#1f5c50' }}>S</div>
            <div>
              <div style={{ fontWeight: 600 }}>{clinic?.name}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{clinic?.whatsappNumber}</div>
            </div>
          </div>
          <div className="phone-msgs" ref={box}>
            {msgs.length === 0 && <div className="muted" style={{ textAlign: 'center', marginTop: 40, fontSize: 13 }}>Say hi, or scan a QR code from the right.</div>}
            {msgs.map((m) => (
              <div key={m.id} className={`bubble ${m.direction === 'IN' ? 'in' : 'out'}`}>
                {m.body}
                <div className="meta">{fmtTime(m.createdAt)}{m.status === 'FAILED' ? ' · not sent' : ''}</div>
              </div>
            ))}
            {buttons.length > 0 && (
              <div className="phone-btns">
                {buttons.map((b) => <button key={b} disabled={busy} onClick={() => send(b)}>{b}</button>)}
              </div>
            )}
          </div>
          <form className="phone-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input placeholder="Message" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn btn-primary btn-icon" style={{ borderRadius: 999 }} disabled={busy || !text.trim()}><Send /></button>
          </form>
        </div>

        <div className="col gap-16">
          <div className="card card-pad">
            <h3 style={{ fontSize: 18, marginBottom: 14 }}>Patient</h3>
            <div className="grid-2">
              <div className="field"><label>Phone</label><div className="input-prefix"><span>+91</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div></div>
              <div className="field"><label>WhatsApp name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            </div>
            <p className="muted mt-12" style={{ fontSize: 13.5 }}>Use a new number to test a first-time patient. Try: “hi”, “Doctor available today evening?”, “what are the fees”, “cancel”, “chest pain since morning”.</p>
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: 18, marginBottom: 14 }}>Scan a QR code</h3>
            <div className="chip-group">
              {(qrs ?? []).filter((q) => q.active).map((q) => (
                <button key={q.id} className="chip" disabled={busy} onClick={() => scan(q)}><QrCode size={14} style={{ verticalAlign: -2 }} /> {q.label}</button>
              ))}
            </div>
          </div>

          <StaffPanel />

          <div className="card card-pad">
            <h3 style={{ fontSize: 18, marginBottom: 6 }}>Run scheduled jobs now</h3>
            <p className="muted" style={{ fontSize: 13.5 }}>Normally these run on their own (reminders at the clinic's reminder time, follow-ups during the day).</p>
            <div className="row mt-12">
              <button className="btn btn-outline btn-sm" onClick={() => runJob('reminders')}><Play /> Send tomorrow's reminders</button>
              <button className="btn btn-outline btn-sm" onClick={() => runJob('follow-ups')}><Play /> Send due follow-ups</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StaffPanel() {
  const { data: doctors } = useFetch<Doctor[]>('/api/doctors');
  const { data: staff } = useFetch<User[]>('/api/staff');
  const { error } = useToast();
  const [from, setFrom] = useState('');
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);

  const phones = [
    ...(doctors ?? []).filter((d) => d.alertMobile).map((d) => ({ label: `${d.name} (doctor)`, phone: d.alertMobile! })),
    ...(staff ?? []).filter((u) => u.phone && u.role === 'RECEPTIONIST').map((u) => ({ label: `${u.name}`, phone: u.phone! })),
  ];
  useEffect(() => { if (!from && phones.length) setFrom(phones[0].phone); }, [phones, from]);

  const send = async (text: string) => {
    try {
      const r = await api.post<{ reply: string }>('/api/dev/whatsapp/admin-message', { phone: from, text });
      setLog((l) => [{ q: text, a: r.reply }, ...l].slice(0, 6));
    } catch (e) {
      error(e);
    }
  };

  return (
    <div className="card card-pad">
      <h3 style={{ fontSize: 18, marginBottom: 6 }}>Doctor / front desk on WhatsApp</h3>
      <p className="muted" style={{ fontSize: 13.5 }}>What staff send to the central Siletry number.</p>
      <div className="row mt-12" style={{ flexWrap: 'wrap' }}>
        <select className="select" style={{ width: 260 }} value={from} onChange={(e) => setFrom(e.target.value)}>
          {phones.map((p) => <option key={p.phone} value={p.phone}>{p.label}</option>)}
        </select>
        {['NEXT', 'QUEUE', 'TODAY'].map((c) => <button key={c} className="btn btn-plain btn-sm" disabled={!from} onClick={() => send(c)}>{c}</button>)}
      </div>
      {log.map((l, i) => (
        <div key={i} className="mt-12" style={{ fontSize: 13.5 }}>
          <b>{l.q}</b>
          <div className="bubble out mt-8" style={{ maxWidth: '100%', fontSize: 13.5 }}>{l.a}</div>
        </div>
      ))}
    </div>
  );
}
