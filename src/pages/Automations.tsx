import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { ClinicView } from '../api/types';
import { useFetch } from '../lib/useFetch';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { Loading, Toggle } from '../components/ui';

export default function Automations() {
  const { data, setData } = useFetch<ClinicView>('/api/clinic');
  const { user, refresh } = useAuth();
  const { toast, error } = useToast();
  const [review, setReview] = useState('');
  const owner = user?.role === 'OWNER';

  useEffect(() => { if (data) setReview(data.googleReviewLink ?? ''); }, [data]);
  if (!data) return <Loading />;

  const patch = async (body: Partial<ClinicView>, msg = 'Saved') => {
    try {
      setData(await api.patch<ClinicView>('/api/clinic', body));
      toast(msg);
      if ('botEnabled' in body) refresh();
    } catch (e) {
      error(e);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Automations</h1>
          <div className="sub">What Siletry does on its own. {owner ? '' : 'Only the clinic owner can change these.'}</div>
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 820 }}>
        <div className="setting-row">
          <div className="txt"><b>Answer patients on WhatsApp</b><span>Books appointments, checks patients in, answers fees and timings. When off, every message goes to your inbox.</span></div>
          <Toggle checked={data.botEnabled} disabled={!owner} onChange={(v) => patch({ botEnabled: v }, v ? 'Siletry is replying' : 'Siletry paused')} />
        </div>
        <div className="setting-row">
          <div className="txt"><b>Evening-before reminders</b><span>Patients reply YES, CHANGE or CANCEL. This is what brings no-shows down.</span></div>
          <input className="input" type="time" style={{ width: 130 }} disabled={!owner || !data.remindersEnabled} value={data.reminderTime.slice(0, 5)}
            onChange={(e) => patch({ reminderTime: e.target.value }, 'Reminder time saved')} />
          <Toggle checked={data.remindersEnabled} disabled={!owner} onChange={(v) => patch({ remindersEnabled: v })} />
        </div>
        <div className="setting-row">
          <div className="txt"><b>Live queue updates</b><span>Token number at check-in, "you're next", and "please come in" when the desk taps Call next.</span></div>
          <Toggle checked={data.queueUpdatesEnabled} disabled={!owner} onChange={(v) => patch({ queueUpdatesEnabled: v })} />
        </div>
        <div className="setting-row">
          <div className="txt"><b>Follow-up messages</b><span>On the due date, Siletry offers the patient two open slots. Sent between 9 am and 7 pm.</span></div>
          <Toggle checked={data.followupsEnabled} disabled={!owner} onChange={(v) => patch({ followupsEnabled: v })} />
        </div>
        <div className="setting-row">
          <div className="txt"><b>Emergency handling</b><span>Messages about chest pain, breathing trouble and similar get an instant "call 108" reply, and your doctors are alerted on their phones. Always on.</span></div>
          <span className="pill pill-green">Always on</span>
        </div>
        <div className="setting-row" style={{ flexWrap: 'wrap' }}>
          <div className="txt"><b>Google review link</b><span>Used for review requests after visits (coming soon).</span></div>
          <input className="input" style={{ width: 320 }} disabled={!owner} placeholder="https://g.page/r/..." value={review} onChange={(e) => setReview(e.target.value)} />
          <button className="btn btn-outline btn-sm" disabled={!owner || review === (data.googleReviewLink ?? '')} onClick={() => patch({ googleReviewLink: review })}>Save</button>
        </div>
      </div>
    </>
  );
}
