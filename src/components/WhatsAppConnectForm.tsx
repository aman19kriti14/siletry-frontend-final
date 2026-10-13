import { useState } from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { api } from '../api/client';
import type { ConnectResult } from '../api/types';
import { useToast } from '../lib/toast';

/**
 * Paste the clinic's WhatsApp Cloud API details (from the clinic's own Meta account).
 * Posts to /api/setup/whatsapp/credentials or /api/clinic/whatsapp/credentials.
 */
export default function WhatsAppConnectForm({ endpoint, onConnected }: { endpoint: string; onConnected: () => void }) {
  const [f, setF] = useState({ phoneNumberId: '', businessAccountId: '', accessToken: '', appSecret: '', pin: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ConnectResult | null>(null);
  const { toast, error } = useToast();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value.trim() });

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.post<ConnectResult | { result: ConnectResult }>(endpoint, { ...f, appSecret: f.appSecret || undefined, pin: f.pin || undefined });
      const res = 'result' in r ? r.result : r;
      setResult(res);
      toast(`Connected ${res.verifiedName ?? ''} ${res.displayNumber ?? ''}`.trim());
      onConnected();
    } catch (e) {
      error(e);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="col gap-12">
        <div className="banner info"><CheckCircle2 size={18} /> Connected{result.verifiedName ? ` as “${result.verifiedName}”` : ''} on {result.displayNumber}. {result.templatesSubmitted > 0 && `${result.templatesSubmitted} message templates sent to Meta for approval.`}</div>
        {result.warnings.length > 0 && (
          <div className="banner warn" style={{ display: 'block' }}>
            <b>Check these:</b>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="col gap-16">
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
        Set up together with the clinic in their Meta account (WhatsApp Manager / the Meta app's WhatsApp → API Setup page), then paste the details here.
        They're checked with Meta and stored encrypted.
      </p>
      <div className="grid-2">
        <div className="field"><label>Phone number ID</label><input className="input" value={f.phoneNumberId} onChange={set('phoneNumberId')} placeholder="1234567890123456" /></div>
        <div className="field"><label>WhatsApp Business Account ID</label><input className="input" value={f.businessAccountId} onChange={set('businessAccountId')} placeholder="9876543210987654" /></div>
      </div>
      <div className="field">
        <label>Permanent access token</label>
        <input className="input" type="password" value={f.accessToken} onChange={set('accessToken')} placeholder="EAAG…" autoComplete="off" />
        <span className="hint">From a System User in the clinic's Business Settings, with whatsapp_business_messaging and whatsapp_business_management. Temporary tokens stop working after 24 hours.</span>
      </div>
      <div className="grid-2">
        <div className="field">
          <label>App secret <span className="muted" style={{ fontWeight: 400 }}>(if it's the clinic's own Meta app)</span></label>
          <input className="input" type="password" value={f.appSecret} onChange={set('appSecret')} autoComplete="off" />
        </div>
        <div className="field">
          <label>Two-step PIN <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <input className="input" inputMode="numeric" maxLength={6} value={f.pin} onChange={set('pin')} placeholder="6 digits, registers the number" />
        </div>
      </div>
      <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy || !f.phoneNumberId || !f.businessAccountId || !f.accessToken} onClick={submit}>
        <KeyRound /> {busy ? 'Checking with Meta…' : 'Connect WhatsApp'}
      </button>
    </div>
  );
}
