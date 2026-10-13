import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlarmClock, BellRing, CalendarCheck, Check, ExternalLink, Plus, Repeat, Send, Siren, Star, Sunrise, Sunset, X,
} from 'lucide-react';
import { api } from '../api/client';
import type { Block, Day, SetupDoctor, SetupState } from '../api/types';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Loading, Toggle } from '../components/ui';
import WhatsAppConnectForm from '../components/WhatsAppConnectForm';
import Logo from '../components/Logo';
import { DAYS, fmtClock, langName } from '../lib/format';

const STEPS = [
  { title: 'Clinic', sub: 'Name, address, languages' },
  { title: 'Doctors & hours', sub: 'Who sees patients, and when' },
  { title: 'WhatsApp number', sub: 'The number patients already know' },
  { title: 'Automations', sub: 'What Siletry does on its own' },
  { title: 'Go live', sub: 'Test, then switch on' },
];
const CLINIC_TYPES = ['General practice', 'Paediatrics', 'Dental', 'Dermatology', 'Gynaecology', 'ENT', 'Eye care', 'Orthopaedics', 'Physiotherapy', 'Diagnostics', 'Other'];
const REPLY_LANGS = ['en', 'kn', 'hi', 'ta', 'te'];
const SUPPORT = import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined;

const hhmm = (t?: string) => (t ? t.slice(0, 5) : '');
const dayRange = (days: Day[]) => {
  if (!days.length) return 'No days';
  const idx = days.map((d) => DAYS.findIndex((x) => x.key === d)).sort((a, b) => a - b);
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  return contiguous && idx.length > 2 ? `${DAYS[idx[0]].label}–${DAYS[idx[idx.length - 1]].label}` : idx.map((i) => DAYS[i].label).join(', ');
};

export default function Setup() {
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const { toast, error } = useToast();
  const [s, setS] = useState<SetupState | null>(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [showApi, setShowApi] = useState(false);

  // Step forms
  const [clinic, setClinic] = useState({ name: '', clinicType: 'General practice', city: '', address: '', landmark: '', languages: ['en'] as string[] });
  const [doctors, setDoctors] = useState<SetupDoctor[]>([]);
  const [days, setDays] = useState<Day[]>(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']);
  const [morning, setMorning] = useState<Block | null>({ start: '09:30', end: '13:00' });
  const [evening, setEvening] = useState<Block | null>({ start: '16:30', end: '20:00' });
  const [wa, setWa] = useState({ choice: 'CURRENT', number: '' });
  const [auto, setAuto] = useState({ reminders: true, followups: true, delayAnnouncements: true, googleReviews: false });

  useEffect(() => {
    api.get<SetupState>('/api/setup').then((st) => {
      setS(st);
      setStep(Math.min(Math.max(st.step, 1), 5));
      setClinic({
        name: st.name, clinicType: st.clinicType || 'General practice', city: st.city || 'Bengaluru',
        address: st.address || '', landmark: st.landmark || '', languages: st.languages?.length ? st.languages : ['en'],
      });
      if (st.doctors.length) {
        setDoctors(st.doctors);
      } else {
        const n = Math.max(1, Math.min(st.doctorCountHint || 1, 6));
        const first = user?.name && /^dr/i.test(user.name) ? user.name : '';
        setDoctors(Array.from({ length: n }, (_, i) => ({ name: i === 0 ? first : '', speciality: '', fee: undefined, slotMinutes: 15 })));
      }
      if (st.days.length) setDays(st.days);
      if (st.morning || st.evening) {
        setMorning(st.morning ? { start: hhmm(st.morning.start), end: hhmm(st.morning.end) } : null);
        setEvening(st.evening ? { start: hhmm(st.evening.start), end: hhmm(st.evening.end) } : null);
      }
      setWa({ choice: st.whatsappNumberChoice || 'CURRENT', number: (st.whatsappNumber || '').replace(/^\+91\s?/, '') });
      setAuto({ reminders: st.reminders, followups: st.followups, delayAnnouncements: st.delayAnnouncements, googleReviews: st.googleReviews });
    }).catch(error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (path: string, body: unknown, next: number) => {
    setSaving(true);
    try {
      const st = await api.put<SetupState>(`/api/setup/${path}`, body);
      setS(st);
      if (path === 'doctors') setDoctors(st.doctors);
      setStep(next);
      window.scrollTo(0, 0);
    } catch (e) {
      error(e);
    } finally {
      setSaving(false);
    }
  };

  const goLive = async () => {
    setSaving(true);
    try {
      setS(await api.post<SetupState>('/api/setup/go-live'));
      await refresh();
      setDone(true);
    } catch (e) {
      error(e);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    try {
      const r = await api.post<{ sentTo: string; testMode: boolean }>('/api/setup/test-message');
      toast(r.testMode ? `Test mode: message logged for ${r.sentTo}. It'll arrive for real once WhatsApp is connected.` : `Test sent to ${r.sentTo}`);
    } catch (e) {
      error(e);
    }
  };

  const connectMeta = async () => {
    setSaving(true);
    try {
      await api.put<SetupState>('/api/setup/whatsapp', wa);
      setS(await api.post<SetupState>('/api/setup/whatsapp/connect'));
      toast('Marked connected (test mode)');
      refresh();
    } catch (e) {
      error(e);
    } finally {
      setSaving(false);
    }
  };

  const maxStep = Math.max(step, Math.min(s?.step ?? 1, 5));
  const clinicName = clinic.name || s?.name || 'Your clinic';
  const docName = doctors.find((d) => d.name.trim())?.name.trim() || 'the doctor';

  if (!s) return <Loading />;
  if (done) return <Live name={clinicName} connected={s.apiConnected} onOpen={() => nav('/', { replace: true })} onSim={() => nav('/simulator')} />;

  const hoursText = [morning && `${fmtClock(morning.start)} – ${fmtClock(morning.end)}`, evening && `${fmtClock(evening.start)} – ${fmtClock(evening.end)}`]
    .filter(Boolean).join(' and ');
  const where = [clinic.address || s.address, clinic.landmark && `(${clinic.landmark})`].filter(Boolean).join(' ') || 'your address';

  const preview: Record<number, { messages: { from: 'patient' | 'bot'; text: string }[]; caption: string }> = {
    1: {
      messages: [
        { from: 'patient', text: 'Hi, where is the clinic and what are the timings?' },
        { from: 'bot', text: `${clinicName} is at ${where}${clinic.city && !where.toLowerCase().includes(clinic.city.toLowerCase()) ? ', ' + clinic.city : ''}. We are open ${dayRange(days)}, ${hoursText || 'during clinic hours'}. Would you like to book a visit?` },
      ],
      caption: 'Updates as you type.',
    },
    2: {
      messages: [
        { from: 'patient', text: 'Doctor available tomorrow evening?' },
        { from: 'bot', text: `Yes. ${docName} has ${evening ? fmtClock(evening.start) : '5:30 pm'} and ${evening ? fmtClock(addMin(evening.start, 45)) : '6:15 pm'} free tomorrow. Which suits you?` },
        { from: 'patient', text: `${evening ? fmtClock(evening.start).replace(' pm', '') : '5:30'} ಸರಿ` },
        { from: 'bot', text: `Booked. ${docName} will see you tomorrow at ${evening ? fmtClock(evening.start) : '5:30 pm'}.` },
      ],
      caption: 'Slots offered come from these hours, minus bookings and leave.',
    },
    3: {
      messages: [
        { from: 'patient', text: 'Is this the clinic number?' },
        { from: 'bot', text: `Yes, this is ${clinicName}. I can book, move or cancel a visit for you, any time of day.` },
      ],
      caption: 'Messages come from your own number, under your clinic name.',
    },
    4: {
      messages: [
        { from: 'bot', text: `Reminder: ${docName} tomorrow at ${evening ? fmtClock(evening.start) : '5:30 pm'}. Reply YES to keep it, CHANGE to move it.` },
        { from: 'patient', text: 'YES' },
      ],
      caption: 'Patients answer with one tap.',
    },
    5: {
      messages: [{ from: 'bot', text: 'This is a test from Siletry. Your clinic is ready to go live.' }],
      caption: 'The test goes to your own WhatsApp, not to patients.',
    },
  };

  const activeDoctors = doctors.filter((d) => d.name.trim());
  const autoOn = 2 + [auto.reminders, auto.followups, auto.delayAnnouncements, auto.googleReviews].filter(Boolean).length;

  return (
    <div className="setup">
      <header className="setup-top">
        <div className="row gap-12">
          <Logo size={28} />
          <span className="setup-divider" />
          <span className="muted">Setting up <b style={{ color: 'var(--text)' }}>{clinicName}</b></span>
        </div>
        <div className="row gap-16 right">
          <div className="progress"><div style={{ width: `${(step / 5) * 100}%` }} /></div>
          <span className="muted" style={{ fontSize: 13.5 }}>Step {step} of 5</span>
          <button className="btn btn-plain" onClick={() => nav('/')}>Save and exit</button>
        </div>
      </header>

      <div className="setup-body">
        <aside className="setup-nav">
          <div className="section-label" style={{ margin: '4px 0 18px 8px' }}>Clinic setup</div>
          {STEPS.map((st, i) => {
            const n = i + 1;
            const complete = n < maxStep && n !== step;
            return (
              <button key={n} className={`setup-step ${n === step ? 'on' : ''}`} disabled={n > maxStep} onClick={() => setStep(n)}>
                <span className={`num ${complete ? 'done' : ''}`}>{complete ? <Check size={16} /> : n}</span>
                <span className="col" style={{ textAlign: 'left' }}>
                  <b>{st.title}</b>
                  <span>{st.sub}</span>
                </span>
              </button>
            );
          })}
          <div className="help-card">
            <b>Need a hand?</b>
            <p>Our team can finish setup with you on a 15-minute call.</p>
            <a href={SUPPORT ? `https://wa.me/${SUPPORT}?text=${encodeURIComponent(`Hi, I need help setting up ${clinicName} on Siletry`)}` : `mailto:hello@siletry.com?subject=${encodeURIComponent('Setup call for ' + clinicName)}`}
              target="_blank" rel="noreferrer">Book a call</a>
          </div>
        </aside>

        <main className="setup-main">
          {step === 1 && (
            <StepFrame n={1} title="Tell us about the clinic" sub="Siletry uses these details when patients ask where you are, what you charge and when you open."
              footer={<button className="btn btn-primary btn-lg" disabled={saving || !clinic.name.trim()} onClick={() => save('clinic', clinic, 2)}>Continue</button>}>
              <div className="field">
                <label>Clinic name</label>
                <input className="input input-lg" value={clinic.name} onChange={(e) => setClinic({ ...clinic, name: e.target.value })} />
                <span className="hint">Patients see this in every message.</span>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Clinic type</label>
                  <select className="select input-lg" value={clinic.clinicType} onChange={(e) => setClinic({ ...clinic, clinicType: e.target.value })}>
                    {CLINIC_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="field"><label>City</label><input className="input input-lg" value={clinic.city} onChange={(e) => setClinic({ ...clinic, city: e.target.value })} /></div>
              </div>
              <div className="field"><label>Address</label><input className="input input-lg" placeholder="42, 11th Main, Jayanagar 4th Block, 560011" value={clinic.address} onChange={(e) => setClinic({ ...clinic, address: e.target.value })} /></div>
              <div className="field">
                <label>Landmark</label>
                <input className="input input-lg" placeholder="Above Apollo Pharmacy" value={clinic.landmark} onChange={(e) => setClinic({ ...clinic, landmark: e.target.value })} />
                <span className="hint">Added to every confirmation so patients find you.</span>
              </div>
              <div className="field">
                <label>Languages Siletry should reply in</label>
                <div className="chip-group">
                  {REPLY_LANGS.map((l) => {
                    const on = clinic.languages.includes(l);
                    return (
                      <button key={l} className={`chip ${on ? 'on' : ''}`} onClick={() => setClinic({ ...clinic, languages: on ? clinic.languages.filter((x) => x !== l) : [...clinic.languages, l] })}>
                        {on && <Check size={14} style={{ verticalAlign: -2, marginRight: 4 }} />}{langName(l)}
                      </button>
                    );
                  })}
                </div>
                <span className="hint">Siletry understands patients writing in any of these. Replies are in English for now; Kannada and Hindi replies are coming next.</span>
              </div>
            </StepFrame>
          )}

          {step === 2 && (
            <StepFrame n={2} title="Add your doctors" sub="Siletry only offers slots inside these hours. Existing bookings and leave are always respected."
              back={() => setStep(1)}
              footer={<button className="btn btn-primary btn-lg" disabled={saving || activeDoctors.length === 0 || days.length === 0 || (!morning && !evening)}
                onClick={() => save('doctors', { doctors: activeDoctors.map((d) => ({ ...d, fee: d.fee ?? 0 })), days, morning, evening }, 3)}>Continue</button>}>
              <div className="doc-rows">
                <div className="doc-row head"><span>Name</span><span>Speciality</span><span>Fee (₹)</span><span>Slot</span><span /></div>
                {doctors.map((d, i) => (
                  <div key={i} className="doc-row">
                    <input className="input" placeholder="Dr. Anitha Rao" value={d.name} onChange={(e) => setDoctors(doctors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <input className="input" placeholder="General physician" value={d.speciality ?? ''} onChange={(e) => setDoctors(doctors.map((x, j) => (j === i ? { ...x, speciality: e.target.value } : x)))} />
                    <input className="input" type="number" min={0} placeholder="400" value={d.fee ?? ''} onChange={(e) => setDoctors(doctors.map((x, j) => (j === i ? { ...x, fee: e.target.value ? Number(e.target.value) : undefined } : x)))} />
                    <select className="select" value={d.slotMinutes ?? 15} onChange={(e) => setDoctors(doctors.map((x, j) => (j === i ? { ...x, slotMinutes: Number(e.target.value) } : x)))}>
                      {[10, 15, 20, 30].map((m) => <option key={m} value={m}>{m} min</option>)}
                    </select>
                    <button className="icon-btn" disabled={doctors.length === 1} onClick={() => setDoctors(doctors.filter((_, j) => j !== i))} aria-label="Remove"><X /></button>
                  </div>
                ))}
              </div>
              <button className="add-dashed" style={{ width: 'auto', alignSelf: 'flex-start', padding: '10px 18px' }}
                onClick={() => setDoctors([...doctors, { name: '', speciality: '', slotMinutes: 15 }])}><Plus size={17} style={{ verticalAlign: -3 }} /> Add another doctor</button>
              <div className="divider" />
              <div className="field">
                <label>Usual working days</label>
                <div className="day-toggles">
                  {DAYS.map((d) => {
                    const on = days.includes(d.key);
                    return <button key={d.key} className={on ? 'on' : ''} onClick={() => setDays(on ? days.filter((x) => x !== d.key) : [...days, d.key])}>{d.label}</button>;
                  })}
                </div>
              </div>
              <div className="grid-2">
                <HoursCard icon={<Sunrise color="#c0763a" />} label="Morning" value={morning} fallback={{ start: '09:30', end: '13:00' }} onChange={setMorning} />
                <HoursCard icon={<Sunset color="#1A6650" />} label="Evening" value={evening} fallback={{ start: '16:30', end: '20:00' }} onChange={setEvening} />
              </div>
              <span className="hint">You can set different hours per doctor, and add leave, later in Doctors & hours.</span>
            </StepFrame>
          )}

          {step === 3 && (
            <StepFrame n={3} title="Connect your WhatsApp number" sub="Keep the number patients already message. You log in with Meta once; nothing changes for patients."
              back={() => setStep(2)}
              skip={() => save('whatsapp', { choice: wa.choice, number: '' }, 4)}
              footer={<button className="btn btn-primary btn-lg" disabled={saving} onClick={() => save('whatsapp', wa, 4)}>Continue</button>}>
              <div className="grid-2">
                <RadioCard on={wa.choice === 'CURRENT'} onClick={() => setWa({ ...wa, choice: 'CURRENT' })} title="Use our current number"
                  text="The number already printed on your board and cards." tag="Recommended" />
                <RadioCard on={wa.choice === 'NEW'} onClick={() => setWa({ ...wa, choice: 'NEW' })} title="Get a new number"
                  text="We issue a fresh business number for the clinic." tag="Ready in about a day" />
              </div>
              {wa.choice === 'CURRENT' ? (
                <>
                  <div className="field">
                    <label>Clinic WhatsApp number</label>
                    <div className="input-prefix lg"><span>+91</span><input value={wa.number} onChange={(e) => setWa({ ...wa, number: e.target.value })} placeholder="80 4718 2200" /></div>
                  </div>
                  <div className="checklist">
                    {[
                      ['Clinic\'s Meta Business account', 'Owned by the clinic. We set it up together.'],
                      ['Number on the WhatsApp Cloud API', 'Verified with a code by SMS or call to the clinic phone'],
                      ['Connected to Siletry', s.apiConnected ? `Live as “${s.verifiedName ?? clinicName}”` : 'Paste the API details below'],
                    ].map(([t, d], i) => {
                      const ok = s.apiConnected || (i < 2 && s.whatsappConnected);
                      return (
                        <div key={t} className="check-item">
                          <span className={`tick ${ok ? 'done' : ''}`}>{ok ? <Check size={14} /> : '·'}</span>
                          <div className="grow"><b>{t}</b><div className="muted" style={{ fontSize: 13.5 }}>{d}</div></div>
                          <span className={ok ? 'up' : 'muted'} style={{ fontSize: 13, fontWeight: 600 }}>{ok ? 'Done' : 'To do'}</span>
                        </div>
                      );
                    })}
                    <div className="check-foot">
                      <span className="muted grow" style={{ fontSize: 13.5 }}>Patients keep messaging the same number. We connect it with you on a short call; nothing changes for patients.</span>
                      {!s.apiConnected && !showApi && (
                        <button className="btn btn-outline" onClick={() => setShowApi(true)}><ExternalLink /> Connect WhatsApp</button>
                      )}
                    </div>
                  </div>
                  {showApi && !s.apiConnected && (
                    <div className="card" style={{ padding: 20, background: 'var(--surface-2)' }}>
                      <WhatsAppConnectForm endpoint="/api/setup/whatsapp/credentials" onConnected={() => { api.get<SetupState>('/api/setup').then(setS); refresh(); }} />
                    </div>
                  )}
                  {s.testMode && !s.apiConnected && (
                    <div className="banner warn">
                      <span className="grow">Test mode: skip Meta and mark this number connected, so you can try everything with the simulator.</span>
                      <button className="btn btn-sm btn-plain" disabled={saving || !wa.number.trim() || s.whatsappConnected} onClick={connectMeta}>
                        {s.whatsappConnected ? 'Marked connected' : 'Mark connected'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="banner info">We'll set up a new business number for {clinicName} and message you on {s.ownerPhone ?? 'your mobile'} when it's ready. Carry on with the rest meanwhile.</div>
              )}
            </StepFrame>
          )}

          {step === 4 && (
            <StepFrame n={4} title="Choose what Siletry handles" sub="Two rules stay on for safety. You can change the rest any time under Automations."
              back={() => setStep(3)}
              skip={() => setStep(5)}
              footer={<button className="btn btn-primary btn-lg" disabled={saving} onClick={() => save('automations', auto, 5)}>Continue</button>}>
              <div className="auto-list">
                <AutoRow icon={<CalendarCheck />} title="Book appointments" sub="Offers real free slots and confirms them" always />
                <AutoRow icon={<BellRing />} title="Visit reminders" sub="6 pm the evening before; patient replies YES or CHANGE" on={auto.reminders} set={(v) => setAuto({ ...auto, reminders: v })} />
                <AutoRow icon={<Repeat />} title="Repeat-visit follow-ups" sub="Check-ups, vaccinations and dressings when due" on={auto.followups} set={(v) => setAuto({ ...auto, followups: v })} />
                <AutoRow icon={<AlarmClock />} title="Doctor running late" sub="You send “late 30” to Siletry, every patient waiting is told" on={auto.delayAnnouncements} set={(v) => setAuto({ ...auto, delayAnnouncements: v })} />
                <AutoRow icon={<Star />} title="Google review requests" sub="Only to patients whose visit went well" soon on={auto.googleReviews} set={(v) => setAuto({ ...auto, googleReviews: v })} />
                <AutoRow icon={<Siren />} title="Emergency escalation" sub="Chest pain, bleeding, breathlessness: tells them to call 108 and alerts you" always />
              </div>
            </StepFrame>
          )}

          {step === 5 && (
            <StepFrame n={5} title="Check and go live" sub="Send yourself a test first. You can pause Siletry at any time from the console."
              back={() => setStep(4)}
              footer={<button className="btn btn-primary btn-lg" disabled={saving} onClick={goLive}>Go live</button>}>
              <div className="summary">
                <SummaryRow ok title="Clinic" value={`${clinicName} · ${(s.languages ?? clinic.languages).map(langName).join(', ')}`} onEdit={() => setStep(1)} />
                <SummaryRow ok={s.doctors.length > 0} title="Doctors" value={s.doctors.length ? `${s.doctors.length} doctor${s.doctors.length > 1 ? 's' : ''} · ${dayRange(s.days)}` : 'None added yet'} onEdit={() => setStep(2)} />
                <SummaryRow ok={s.apiConnected || s.whatsappConnected} title="WhatsApp"
                  value={s.whatsappNumberChoice === 'NEW' ? 'New number requested · ready in about a day' : s.whatsappNumber ? `${s.whatsappNumber} · ${s.apiConnected ? 'connected' : s.whatsappConnected ? 'test mode' : 'not connected yet'}` : 'Not added yet'}
                  onEdit={() => setStep(3)} />
                <SummaryRow ok title="Automations" value={`${autoOn} of 6 on`} onEdit={() => setStep(4)} />
              </div>
              <div className="test-box">
                <Send color="#1A6650" />
                <div className="grow">
                  <b>Send yourself a test message</b>
                  <div className="muted" style={{ fontSize: 14 }}>It arrives on your own WhatsApp{s.ownerPhone ? ` (${s.ownerPhone})` : ''} from the clinic number.</div>
                </div>
                <button className="btn btn-outline" onClick={sendTest}>Send test</button>
              </div>
            </StepFrame>
          )}
        </main>

        <aside className="setup-preview">
          <div className="section-label" style={{ marginBottom: 16 }}>What patients will see</div>
          <div className="wa-phone">
            <div className="wa-phone-head">
              <div className="avatar sm" style={{ background: '#2b5d53', color: '#fff', borderColor: '#3e7669' }}>{initialsOf(clinicName)}</div>
              <div><b>{clinicName}</b><div style={{ fontSize: 12, opacity: 0.75 }}>Business account</div></div>
            </div>
            <div className="wa-phone-body">
              {preview[step].messages.map((m, i) => (
                <div key={i} className={`col ${m.from === 'bot' ? 'bot' : 'pt'}`}>
                  {m.from === 'bot' && (i === 0 || preview[step].messages[i - 1].from !== 'bot') && <div className="sender-tag">SILETRY</div>}
                  <div className={`wa-bubble ${m.from}`}>{m.text}</div>
                </div>
              ))}
            </div>
          </div>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 14, lineHeight: 1.5 }}>{preview[step].caption}</p>
        </aside>
      </div>
    </div>
  );
}

function StepFrame({ n, title, sub, children, footer, back, skip }: {
  n: number; title: string; sub: string; children: ReactNode; footer: ReactNode; back?: () => void; skip?: () => void;
}) {
  return (
    <div className="setup-frame">
      <div className="step-kicker">Step {n} · {STEPS[n - 1].title}</div>
      <h1 style={{ fontSize: 32 }}>{title}</h1>
      <p className="auth2-sub" style={{ marginBottom: 26 }}>{sub}</p>
      <div className="card setup-card">{children}</div>
      <div className="row mt-24">
        {back && <button className="btn btn-plain btn-lg" style={{ background: '#fff' }} onClick={back}>Back</button>}
        <span className="muted" style={{ fontSize: 14 }}>Progress saves automatically.</span>
        <span className="right row gap-12">
          {skip && <button className="btn btn-ghost btn-lg" style={{ color: 'var(--muted)' }} onClick={skip}>Skip for now</button>}
          {footer}
        </span>
      </div>
    </div>
  );
}

function HoursCard({ icon, label, value, fallback, onChange }: {
  icon: ReactNode; label: string; value: Block | null; fallback: Block; onChange: (b: Block | null) => void;
}) {
  const [edit, setEdit] = useState(false);
  return (
    <div className={`hours-card ${value ? '' : 'off'}`}>
      <div className="row" onClick={() => setEdit((e) => !e)} style={{ cursor: 'pointer' }}>
        {icon}
        <b>{label}</b>
        <span className="right muted">{value ? `${fmtClock(value.start)} – ${fmtClock(value.end)}` : 'Closed'}</span>
      </div>
      {edit && (
        <div className="row mt-12" style={{ flexWrap: 'wrap' }}>
          <label className="row gap-8" style={{ fontSize: 13.5 }}>
            <input type="checkbox" className="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked ? fallback : null)} /> Open
          </label>
          {value && (
            <>
              <input className="input" type="time" style={{ width: 120 }} value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} />
              <span className="muted">to</span>
              <input className="input" type="time" style={{ width: 120 }} value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RadioCard({ on, onClick, title, text, tag }: { on: boolean; onClick: () => void; title: string; text: string; tag: string }) {
  return (
    <button className={`radio-card ${on ? 'on' : ''}`} onClick={onClick}>
      <div className="row"><b>{title}</b><span className={`radio ${on ? 'on' : ''}`} /></div>
      <p>{text}</p>
      <span className="tag">{tag}</span>
    </button>
  );
}

function AutoRow({ icon, title, sub, on, set, always, soon }: {
  icon: ReactNode; title: string; sub: string; on?: boolean; set?: (v: boolean) => void; always?: boolean; soon?: boolean;
}) {
  return (
    <div className="auto-row">
      <span className="auto-icon">{icon}</span>
      <div className="grow">
        <div className="row gap-8"><b>{title}</b>{always && <span className="pill pill-gray pill-sm">Always on</span>}{soon && <span className="pill pill-peach pill-sm">Coming soon</span>}</div>
        <div className="muted" style={{ fontSize: 14, marginTop: 3 }}>{sub}</div>
      </div>
      <Toggle checked={always ? true : !!on} disabled={always} onChange={(v) => set?.(v)} />
    </div>
  );
}

function SummaryRow({ ok, title, value, onEdit }: { ok: boolean; title: string; value: string; onEdit: () => void }) {
  return (
    <div className="summary-row">
      <span className={`tick ${ok ? 'done' : 'warn'}`}>{ok ? <Check size={14} /> : '!'}</span>
      <b style={{ width: 130 }}>{title}</b>
      <span className="grow">{value}</span>
      <button className="link-btn" onClick={onEdit}>Edit</button>
    </div>
  );
}

function Live({ name, connected, onOpen, onSim }: { name: string; connected: boolean; onOpen: () => void; onSim: () => void }) {
  return (
    <div className="live-page">
      <div className="card live-card">
        <div className="live-check"><Check size={30} /></div>
        <h1 style={{ fontSize: 30 }}>{name} is live</h1>
        <p className="muted" style={{ fontSize: 16, lineHeight: 1.6, margin: '14px 0 26px' }}>
          {connected
            ? 'Siletry is now answering patients on your WhatsApp number. You can pause it any time from the console.'
            : 'Everything is set. Siletry starts answering patients as soon as your WhatsApp number is connected. Until then, try it in the simulator.'}
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={onOpen}>Open clinic console</button>
          <button className="btn btn-plain btn-lg" style={{ background: '#fff' }} onClick={onSim}>Try the simulator</button>
        </div>
      </div>
    </div>
  );
}

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'S';
}

function addMin(t: string, m: number) {
  const [h, mm] = t.split(':').map(Number);
  const total = h * 60 + mm + m;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

