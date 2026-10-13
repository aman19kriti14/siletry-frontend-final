import type { ClinicView, UsageView } from '../api/types';
import { useFetch } from '../lib/useFetch';
import { Loading } from '../components/ui';
import { fmtDate, parseLocal } from '../lib/format';

export default function Billing() {
  const { data: clinic } = useFetch<ClinicView>('/api/clinic');
  const { data: usage } = useFetch<UsageView>('/api/clinic/usage');
  if (!clinic) return <Loading />;

  const trialEnds = parseLocal(clinic.trialEndsAt);
  const daysLeft = trialEnds ? Math.ceil((trialEnds.getTime() - Date.now()) / 86400000) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Billing</h1>
          <div className="sub">One plan, everything included.</div>
        </div>
      </div>
      <div className="overview-grid">
        <div className="card card-pad">
          <div className="row">
            <div>
              <div className="section-label">Current plan</div>
              <div style={{ fontSize: 26, fontWeight: 600, marginTop: 8 }}>Siletry Clinic</div>
            </div>
            <span className={`pill right ${clinic.plan === 'ACTIVE' ? 'pill-green' : clinic.plan === 'TRIAL' ? 'pill-amber' : 'pill-red'}`}>
              {clinic.plan === 'TRIAL' ? 'Free trial' : clinic.plan === 'ACTIVE' ? 'Active' : 'Paused'}
            </span>
          </div>
          <div style={{ fontSize: 34, fontWeight: 500, margin: '22px 0 4px' }}>₹4,999 <span className="muted" style={{ fontSize: 16 }}>/ month</span></div>
          {clinic.plan === 'TRIAL' && trialEnds && (
            <div className="muted">{daysLeft !== null && daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your trial` : 'Trial ended'} · ends {fmtDate(clinic.trialEndsAt)}</div>
          )}
          <div className="divider" />
          {['Unlimited replies to patients on WhatsApp', 'Booking, check-in and live queue updates', `Up to ${clinic.messageCap.toLocaleString('en-IN')} reminders and follow-ups a month`,
            'Emergency alerts to doctors', 'All doctors and staff logins'].map((t) => (
            <div key={t} className="row gap-8" style={{ padding: '6px 0' }}><span className="dot" /> {t}</div>
          ))}
          <div className="banner info mt-16">Online payments are coming soon. For now we'll send you a payment link when your trial ends. Setup is free while we're early.</div>
        </div>
        <div className="card card-pad">
          <h3 style={{ fontSize: 18 }}>This month</h3>
          {usage ? (
            <>
              <div className="kv mt-12"><span className="k">Reminders and follow-ups</span><span className="v">{usage.businessInitiated} / {usage.cap}</span></div>
              <div className="kv"><span className="k">Replies to patients</span><span className="v">{usage.serviceReplies}</span></div>
              <div className="kv"><span className="k">Messages received</span><span className="v">{usage.inbound}</span></div>
            </>
          ) : <Loading />}
        </div>
      </div>
    </>
  );
}
