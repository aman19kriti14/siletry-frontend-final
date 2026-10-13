import { useState } from 'react';
import { Smartphone, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import type { ClinicView, TemplateSync, UsageView } from '../api/types';
import { useFetch } from '../lib/useFetch';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { Loading } from '../components/ui';
import WhatsAppConnectForm from '../components/WhatsAppConnectForm';
import { fmtDate } from '../lib/format';

export default function WhatsAppNumbers() {
  const { data: clinic, reload } = useFetch<ClinicView>('/api/clinic');
  const { data: usage } = useFetch<UsageView>('/api/clinic/usage');
  const { refresh, user } = useAuth();
  const { toast, error } = useToast();
  const [busy, setBusy] = useState(false);

  if (!clinic) return <Loading />;
  const owner = user?.role === 'OWNER';

  const disconnect = async () => {
    if (!confirm('Disconnect WhatsApp? Siletry will stop sending and receiving messages for this clinic.')) return;
    try {
      await api.post('/api/clinic/whatsapp/disconnect');
      reload();
      refresh();
    } catch (e) {
      error(e);
    }
  };

  const templates = async (path: 'submit-all' | 'sync') => {
    setBusy(true);
    try {
      const r = await api.post<TemplateSync>(`/api/templates/${path}`);
      toast(`${path === 'submit-all' ? `${r.submitted} sent for approval. ` : ''}${r.approved} approved, ${r.pending} pending, ${r.rejected} rejected`);
      if (r.errors.length) error(r.errors.join(' · '));
    } catch (e) {
      error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>WhatsApp numbers</h1>
          <div className="sub">Patients message your clinic's own number. Siletry answers on it through WhatsApp's official Cloud API.</div>
        </div>
      </div>

      <div className="overview-grid">
        <div className="col gap-16">
          <div className="card card-pad">
            <div className="row gap-16">
              <div className="avatar lg" style={{ borderRadius: 14 }}><Smartphone /></div>
              <div className="grow">
                <div className="section-label">Clinic number</div>
                <div style={{ fontSize: 24, fontWeight: 600, marginTop: 6 }}>{clinic.whatsappNumber ?? 'Not connected'}</div>
                {clinic.verifiedName && <div className="muted mt-8">Shown to patients as “{clinic.verifiedName}”</div>}
              </div>
              {clinic.apiConnected
                ? <span className="pill pill-green"><span className="d" />Live on WhatsApp</span>
                : clinic.whatsappConnected
                  ? <span className="pill pill-amber"><span className="d" />Test mode</span>
                  : <span className="pill pill-amber"><span className="d" />Not connected</span>}
            </div>
            {clinic.apiConnected && (
              <>
                <div className="divider" />
                <div className="kv"><span className="k">Phone number ID</span><span className="v">{clinic.phoneNumberId}</span></div>
                <div className="kv"><span className="k">WhatsApp Business Account ID</span><span className="v">{clinic.businessAccountId}</span></div>
                <div className="kv"><span className="k">Connected</span><span className="v">{fmtDate(clinic.apiConnectedAt)}</span></div>
                {owner && (
                  <div className="row mt-16">
                    <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => templates('submit-all')}>Send templates for approval</button>
                    <button className="btn btn-plain btn-sm" disabled={busy} onClick={() => templates('sync')}><RefreshCw /> Refresh template status</button>
                    <button className="btn btn-danger btn-sm right" onClick={disconnect}>Disconnect</button>
                  </div>
                )}
              </>
            )}
            {!clinic.apiConnected && owner && (
              <>
                <div className="divider" />
                <WhatsAppConnectForm endpoint="/api/clinic/whatsapp/credentials" onConnected={() => { reload(); refresh(); }} />
              </>
            )}
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: 18 }}>Doctors and staff</h3>
            <p className="muted mt-8" style={{ lineHeight: 1.5 }}>
              Doctors and the front desk message the central Siletry number from their own phones: <b>NEXT</b> calls the next patient,
              <b> QUEUE</b> shows who's waiting, <b>TODAY</b> gives today's count, <b>LATE 30</b> tells today's patients you're running late.
              Emergency alerts come from this number too. Set each doctor's alert mobile under Doctors & hours.
            </p>
          </div>
        </div>

        <div className="card card-pad">
          <h3 style={{ fontSize: 18 }}>Messages this month</h3>
          {usage ? (
            <>
              <div style={{ fontSize: 30, fontWeight: 500, margin: '14px 0 6px' }}>{usage.businessInitiated} <span className="muted" style={{ fontSize: 16 }}>of {usage.cap}</span></div>
              <div className="lang-track" style={{ height: 10 }}>
                <div className="lang-fill" style={{ width: `${Math.min(usage.percentUsed, 100)}%`, background: usage.percentUsed > 85 ? '#c2402f' : 'var(--primary)' }} />
              </div>
              <p className="muted mt-12" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                Only messages Siletry sends first count here: reminders, follow-ups, updates to patients who haven't written in 24 hours.
                Replies to patients are included free.
              </p>
              <div className="divider" />
              <div className="kv"><span className="k">Replies to patients</span><span className="v">{usage.serviceReplies}</span></div>
              <div className="kv"><span className="k">Messages received</span><span className="v">{usage.inbound}</span></div>
            </>
          ) : <Loading />}
        </div>
      </div>
    </>
  );
}
