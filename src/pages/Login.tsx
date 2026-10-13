import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, MessageCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import AuthShell, { CodeInput, TestCodeBanner } from '../components/AuthShell';
import { useCountdown } from '../lib/useCountdown';
import type { AuthResponse, OtpTicket } from '../api/types';

const SHOW_SSO = import.meta.env.VITE_SHOW_SSO === 'true';

export default function Login() {
  const { login, requestCode, verifyCode, resend } = useAuth();
  const { toast, error } = useToast();
  const nav = useNavigate();
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState<OtpTicket | null>(null);
  const [code, setCode] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const timer = useCountdown(0);

  const done = (r: AuthResponse) => nav(r.clinic.live ? '/' : '/setup', { replace: true });

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      done(await login(identifier, password, remember));
    } catch (err) {
      error(err);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const t = await requestCode(identifier);
      setTicket(t);
      setCode('');
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
      done(await verifyCode(ticket.ticket, c, remember));
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
    <AuthShell topRight={<><span className="muted">New to Siletry?</span><Link className="btn btn-outline" to="/signup">Create an account</Link></>}>
      {ticket ? (
        <div className="col gap-16">
          <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setTicket(null)}><ArrowLeft size={16} /> Back</button>
          <div>
            <h1 className="auth2-title">Check your WhatsApp</h1>
            <p className="auth2-sub">We sent a 6-digit code to {ticket.maskedPhone}. It expires in {Math.round(ticket.expiresInSeconds / 60)} minutes.</p>
          </div>
          <TestCodeBanner code={ticket.devCode} />
          <CodeInput value={code} onChange={setCode} onComplete={(v) => verify(v)} />
          <div className="row muted">
            {timer.left > 0 ? <span>Didn't get it? Resend in {timer.label}</span> : <button className="link-btn" onClick={again}>Resend code</button>}
          </div>
          <button className="btn btn-primary btn-xl" disabled={busy || code.length !== 6} onClick={() => verify()}>{busy ? 'Checking…' : 'Verify and sign in'}</button>
        </div>
      ) : (
        <div className="col gap-20">
          <div>
            <h1 className="auth2-title">Sign in to your clinic</h1>
            <p className="auth2-sub">Use the email or mobile number you registered with.</p>
          </div>
          <div className="segmented">
            <button className={mode === 'password' ? 'on' : ''} onClick={() => setMode('password')}>Password</button>
            <button className={mode === 'otp' ? 'on' : ''} onClick={() => setMode('otp')}>OTP on WhatsApp</button>
          </div>
          {hint && <div className="banner info">{hint}</div>}
          <form className="col gap-20" onSubmit={mode === 'password' ? submitPassword : sendCode}>
            <div className="field">
              <label>Email or mobile</label>
              <input className="input input-lg" required autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                placeholder="anitha@nandiniclinic.in" autoComplete="username" />
            </div>
            {mode === 'password' ? (
              <div className="field">
                <div className="row">
                  <label>Password</label>
                  <button type="button" className="link-btn right" onClick={() => {
                    setMode('otp');
                    setHint('Sign in with a WhatsApp code instead. Then set a new password in Settings.');
                  }}>Forgot password?</button>
                </div>
                <div className="input-suffix">
                  <input type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                  <button type="button" onClick={() => setShow((s) => !s)}>{show ? 'Hide' : 'Show'}</button>
                </div>
              </div>
            ) : (
              <div className="banner info" style={{ alignItems: 'flex-start' }}>
                <MessageCircle size={20} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>We'll send a 6-digit code to your WhatsApp. No password needed.</span>
              </div>
            )}
            <label className="row" style={{ cursor: 'pointer', fontSize: 15 }}>
              <input type="checkbox" className="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Keep me signed in on this computer for 30 days
            </label>
            <button className="btn btn-primary btn-xl" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'password' ? 'Sign in' : 'Send code'}
            </button>
          </form>
          {SHOW_SSO && (
            <>
              <div className="or"><span>OR</span></div>
              <div className="grid-2">
                <button className="btn btn-outline btn-xl sso" onClick={() => toast('Google sign-in is coming soon')}><span className="g">G</span> Google</button>
                <button className="btn btn-outline btn-xl sso" onClick={() => toast('Hospital SSO is coming soon')}><Building2 /> Hospital SSO</button>
              </div>
            </>
          )}
        </div>
      )}
    </AuthShell>
  );
}
