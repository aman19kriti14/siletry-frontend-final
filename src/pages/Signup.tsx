import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import AuthShell, { CodeInput, TestCodeBanner } from '../components/AuthShell';
import { useCountdown } from '../lib/useCountdown';
import type { OtpTicket } from '../api/types';

const COUNTS: { label: string; value: number }[] = [
  { label: 'Just me', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4+', value: 4 },
];

export default function Signup() {
  const { signupStart, signupVerify, resend } = useAuth();
  const { toast, error } = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', phone: '', clinicName: '', doctorCount: 1 });
  const [ticket, setTicket] = useState<OtpTicket | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useCountdown(0);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const t = await signupStart(f);
      setTicket(t);
      timer.reset(t.resendInSeconds);
    } catch (err) {
      error(err);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (c = code) => {
    if (!ticket || c.length !== 6) return;
    setBusy(true);
    try {
      await signupVerify(ticket.ticket, c);
      nav('/setup', { replace: true });
    } catch (err) {
      error(err);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const again = async () => {
    if (!ticket) return;
    try {
      const t = await resend(ticket.ticket);
      setTicket(t);
      timer.reset(t.resendInSeconds);
      toast('New code sent');
    } catch (err) {
      error(err);
    }
  };

  return (
    <AuthShell topRight={<><span className="muted">Already have an account?</span><Link className="btn btn-outline" to="/login">Sign in</Link></>}>
      {!ticket ? (
        <form className="col gap-20" onSubmit={start}>
          <div>
            <div className="step-kicker">Step 1 of 2 · Your account</div>
            <h1 className="auth2-title">Set up Siletry for your clinic</h1>
            <p className="auth2-sub">About six minutes. We're early stage, so setup is free.</p>
          </div>
          <div className="field"><label>Your full name</label><input className="input input-lg" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Dr. Anitha Rao" /></div>
          <div className="field"><label>Work email</label><input className="input input-lg" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@yourclinic.in" /></div>
          <div className="field">
            <label>Your mobile (WhatsApp)</label>
            <div className="input-prefix lg"><span>+91</span><input required inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="98450 00000" /></div>
            <span className="hint">For login codes and emergency alerts. Not shown to patients.</span>
          </div>
          <div className="field"><label>Clinic name</label><input className="input input-lg" required value={f.clinicName} onChange={(e) => setF({ ...f, clinicName: e.target.value })} placeholder="Nandini Clinic" /></div>
          <div className="field">
            <label>Doctors at the clinic</label>
            <div className="choice-row">
              {COUNTS.map((c) => (
                <button type="button" key={c.value} className={`choice ${f.doctorCount === c.value ? 'on' : ''}`} onClick={() => setF({ ...f, doctorCount: c.value })}>{c.label}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-xl" disabled={busy}>{busy ? 'Sending code…' : 'Continue'}</button>
          <p className="muted" style={{ textAlign: 'center' }}>By continuing you agree to the <a href="#">Terms</a> and <a href="#">Privacy policy</a>.</p>
        </form>
      ) : (
        <div className="col gap-20">
          <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setTicket(null)}><ArrowLeft size={16} /> Change details</button>
          <div>
            <div className="step-kicker">Step 2 of 2 · Verify</div>
            <h1 className="auth2-title">Check your WhatsApp</h1>
            <p className="auth2-sub">We sent a 6-digit code to {ticket.maskedPhone}. It expires in {Math.round(ticket.expiresInSeconds / 60)} minutes.</p>
          </div>
          <TestCodeBanner code={ticket.devCode} />
          <CodeInput value={code} onChange={setCode} onComplete={(v) => verify(v)} />
          <div className="row muted">
            {timer.left > 0 ? <span>Didn't get it? Resend in {timer.label}</span> : <button className="link-btn" onClick={again}>Resend code</button>}
          </div>
          <button className="btn btn-primary btn-xl" disabled={busy || code.length !== 6} onClick={() => verify()}>{busy ? 'Setting up…' : 'Verify and set up clinic'}</button>
        </div>
      )}
    </AuthShell>
  );
}
