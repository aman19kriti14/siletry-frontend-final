import type { ReactNode } from 'react';
import { CheckCircle2, Clock, Languages, Sparkles } from 'lucide-react';

/** Two-column frame for sign in / sign up: story on the left, form on the right. */
export default function AuthShell({ topRight, children }: { topRight: ReactNode; children: ReactNode }) {
  const now = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  return (
    <div className="auth2">
      <div className="auth2-side">
        <div className="row gap-12">
          <div className="brand-mark lg">S</div>
          <div className="brand-name" style={{ fontSize: 22 }}>Siletry</div>
        </div>
        <div className="auth2-story">
          <h1>Never miss a patient on WhatsApp again.</h1>
          <p>Siletry is a WhatsApp receptionist for your clinic. It replies to patients and books appointments 24/7, even when your staff is busy or the clinic is closed.</p>
          <div className="demo-chat">
            <div className="demo-head"><span className="dot" /> Nandini Clinic · {now} · clinic closed</div>
            <div className="demo-in">Doctor available tomorrow evening?</div>
            <div className="demo-out">Yes. Dr. Anitha Rao has 5:30 pm and 6:15 pm free tomorrow. Which suits you?</div>
            <div className="demo-in">5:30 ಸರಿ</div>
            <div className="demo-foot"><CheckCircle2 size={17} /> Booked in 41 seconds</div>
          </div>
        </div>
        <div className="auth2-perks">
          <span><Languages size={18} /> English, हिन्दी, ಕನ್ನಡ</span>
          <span><Clock size={18} /> Replies 24/7</span>
          <span><Sparkles size={18} /> Setup is free</span>
        </div>
      </div>
      <div className="auth2-main">
        <div className="auth2-top">{topRight}</div>
        <div className="auth2-form">{children}</div>
        <div className="auth2-footer">
          <span>© {new Date().getFullYear()} Siletry</span>
          <span className="right row gap-16">
            <a href="mailto:hello@siletry.com">Help</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Status</a>
          </span>
        </div>
      </div>
    </div>
  );
}

/** One wide box for a 6-digit code. Submits itself when full. */
export function CodeInput({ value, onChange, onComplete }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void }) {
  return (
    <input
      className="code-input"
      autoFocus
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="••••••"
      value={value}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 6);
        onChange(v);
        if (v.length === 6) onComplete?.(v);
      }}
    />
  );
}

export function TestCodeBanner({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <div className="banner warn">
      Test mode: WhatsApp isn't connected yet, so here's your code: <b style={{ letterSpacing: 2 }}>{code}</b>
    </div>
  );
}
