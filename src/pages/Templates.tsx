import { useState } from 'react';
import { FileText, RefreshCw, Send } from 'lucide-react';
import { api } from '../api/client';
import type { ClinicView, TemplateSync, TemplateView } from '../api/types';
import { useFetch } from '../lib/useFetch';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { Empty, Loading } from '../components/ui';
import { langName } from '../lib/format';

const STATUS_PILL: Record<string, string> = { DRAFT: 'pill-gray', SUBMITTED: 'pill-amber', APPROVED: 'pill-green', REJECTED: 'pill-red' };
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Not sent yet', SUBMITTED: 'Waiting for Meta', APPROVED: 'Approved', REJECTED: 'Rejected' };

/** Siletry's standard templates in the clinic's WhatsApp account, with Meta's approval status. */
export default function Templates() {
  const { data, loading, reload } = useFetch<TemplateView[]>('/api/templates');
  const { data: clinic } = useFetch<ClinicView>('/api/clinic');
  const { user } = useAuth();
  const { toast, error } = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (path: 'submit-all' | 'sync') => {
    setBusy(true);
    try {
      const r = await api.post<TemplateSync>(`/api/templates/${path}`);
      toast(`${path === 'submit-all' ? `${r.submitted} sent for approval. ` : ''}${r.approved} approved, ${r.pending} waiting, ${r.rejected} rejected`);
      if (r.errors.length) error(r.errors.join(' · '));
      reload();
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
          <h1>Message templates</h1>
          <div className="sub">WhatsApp only lets Siletry message a patient first (reminders, follow-ups, queue updates for walk-ins) with wording Meta has approved. Replies within 24 hours don't need one.</div>
        </div>
        {clinic?.apiConnected && user?.role === 'OWNER' && (
          <div className="actions">
            <button className="btn btn-outline" disabled={busy} onClick={() => run('sync')}><RefreshCw /> Refresh status</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => run('submit-all')}><Send /> Send missing for approval</button>
          </div>
        )}
      </div>
      {clinic && !clinic.apiConnected && <div className="banner info mb-16">Connect the clinic's WhatsApp first. Siletry then sends these to Meta for approval automatically; it usually takes minutes to a day.</div>}
      {loading && !data ? <Loading /> : (
        <div className="card table-card">
          {!data?.length ? <Empty text="No templates yet." icon={<FileText />} /> : (
            <table className="table">
              <thead><tr><th>Name</th><th>Message</th><th>Language</th><th>Status</th></tr></thead>
              <tbody>
                {data.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{t.name}</td>
                    <td className="muted" style={{ maxWidth: 560, lineHeight: 1.45 }}>{t.body}</td>
                    <td>{langName(t.language)}</td>
                    <td>
                      <span className={`pill pill-sm ${STATUS_PILL[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                      {t.rejectionReason && <div className="sub">{t.rejectionReason}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
