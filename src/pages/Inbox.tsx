import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bot, CalendarPlus, MoreVertical, Phone, Send, Siren, UserRound, MessagesSquare } from 'lucide-react';
import { api, qs } from '../api/client';
import type { ChatThread, InboxList, MessageView, PatientProfile } from '../api/types';
import { useFetch } from '../lib/useFetch';
import { useToast } from '../lib/toast';
import { Avatar, ConvStatePill, Empty, Loading, StatusPill } from '../components/ui';
import BookVisitModal from '../components/BookVisitModal';
import { fmtDate, fmtTime, fmtWhen, langName, relativeDay } from '../lib/format';

export default function Inbox() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<'needs' | 'all'>('needs');
  const { data: list, reload: reloadList } = useFetch<InboxList>('/api/inbox' + qs({ tab }), { pollMs: 10000 });

  // Open the first conversation when none is selected
  useEffect(() => {
    if (!id && list?.items.length) nav(`/inbox/${list.items[0].id}`, { replace: true });
  }, [id, list, nav]);

  return (
    <div className="inbox">
      <div className="inbox-list">
        <div className="tabs" style={{ paddingTop: 14 }}>
          <button className={`tab ${tab === 'needs' ? 'active' : ''}`} onClick={() => setTab('needs')}>
            Needs you <span className="n">{list?.needsYou ?? 0}</span>
          </button>
          <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
            All <span className="n">{list?.all ?? 0}</span>
          </button>
        </div>
        <div className="inbox-items">
          {!list ? <Loading /> : list.items.length === 0 ? (
            <Empty text={tab === 'needs' ? 'Nothing needs you right now.' : 'No conversations yet.'} icon={<MessagesSquare />} />
          ) : list.items.map((c) => (
            <div key={c.id} className={`conv ${String(c.id) === id ? 'active' : ''}`} onClick={() => nav(`/inbox/${c.id}`)}>
              <Avatar text={c.initials} tone={c.emergency ? 'peach' : undefined} />
              <div className="grow">
                <div className="top">
                  <span className="name ellipsis">{c.name}</span>
                  <span className="when">{fmtWhen(c.lastMessageAt)}</span>
                </div>
                <div className="prev ellipsis">{c.preview}</div>
                <div className="row gap-8">
                  <ConvStatePill state={c.state} emergency={c.emergency} />
                  {c.unreadCount > 0 && <span className="count-badge">{c.unreadCount}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {id ? <Thread key={id} id={Number(id)} onChanged={reloadList} /> : <div className="thread"><Empty text="Pick a conversation" /></div>}
    </div>
  );
}

function Thread({ id, onChanged }: { id: number; onChanged: () => void }) {
  const nav = useNavigate();
  const { toast, error } = useToast();
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [booking, setBooking] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const { data: patient, reload: reloadPatient } = useFetch<PatientProfile>(thread ? `/api/patients/${thread.conversation.patientId}` : null);

  const load = async () => {
    try {
      setThread(await api.get<ChatThread>(`/api/inbox/${id}`));
      onChanged();
    } catch (e) {
      error(e);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Poll for new messages
  useEffect(() => {
    if (!thread) return;
    const t = setInterval(async () => {
      const last = thread.messages[thread.messages.length - 1]?.id ?? 0;
      try {
        const fresh = await api.get<MessageView[]>(`/api/inbox/${id}/messages` + qs({ after: last }));
        if (fresh.length) load();
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, id]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [thread?.messages.length]);

  const action = async (path: string, msg: string) => {
    setMenu(false);
    try {
      setThread(await api.post<ChatThread>(`/api/inbox/${id}/${path}`));
      toast(msg);
      onChanged();
    } catch (e) {
      error(e);
    }
  };

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post(`/api/inbox/${id}/reply`, { text });
      setText('');
      await load();
    } catch (e) {
      error(e);
    } finally {
      setSending(false);
    }
  };

  if (!thread) return <div className="thread"><Loading /></div>;
  const c = thread.conversation;

  let lastDay = '';
  return (
    <>
      <div className="thread">
        <div className="thread-head">
          <Avatar text={c.initials} tone={c.emergency ? 'peach' : undefined} />
          <div className="grow">
            <div style={{ fontWeight: 600, fontSize: 16 }}>{c.name}</div>
            <div className="muted" style={{ fontSize: 13.5 }}>{c.phone} · WhatsApp</div>
          </div>
          <button className="btn btn-outline" onClick={() => setBooking(true)}><CalendarPlus /> Book</button>
          <a className="icon-btn" href={`tel:${c.phone?.replace(/\s/g, '')}`} title="Call"><Phone /></a>
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" onClick={() => setMenu((m) => !m)}><MoreVertical /></button>
            {menu && (
              <div className="menu" onMouseLeave={() => setMenu(false)}>
                <button onClick={() => action('resolve', 'Marked as resolved')}>Mark resolved</button>
                {c.takenOver && <button onClick={() => action('hand-back', 'Siletry is handling this chat again')}>Hand back to Siletry</button>}
                <button onClick={() => nav(`/patients/${c.patientId}`)}><UserRound size={16} /> Open patient</button>
              </div>
            )}
          </div>
        </div>

        {c.emergency ? (
          <div className="thread-banner emergency">
            <Siren size={20} />
            <span className="grow">Emergency. Siletry told the patient to call 108 and alerted the doctors. Please call them now.</span>
            <button className="btn btn-sm btn-danger" onClick={() => action('resolve', 'Marked as resolved')}>Mark resolved</button>
          </div>
        ) : c.takenOver ? (
          <div className="thread-banner staff">
            <UserRound size={20} />
            <span className="grow">{thread.takenOverByName ? `${thread.takenOverByName} is` : 'You are'} handling this chat. Siletry is paused for this patient.</span>
            <button className="btn btn-sm btn-plain" onClick={() => action('hand-back', 'Siletry is handling this chat again')}>Hand back</button>
          </div>
        ) : (
          <div className="thread-banner">
            <Bot size={20} />
            <span className="grow">Siletry is replying automatically. Messages send from the clinic number.</span>
            <button className="btn btn-sm btn-ghost" onClick={() => action('take-over', 'You took over. Siletry will stay quiet.')}>Take over</button>
          </div>
        )}

        <div className="messages" ref={scroller}>
          {thread.messages.map((m) => {
            const day = relativeDay(m.createdAt);
            const sep = day !== lastDay ? <div className="day-sep">{day}</div> : null;
            lastDay = day;
            const out = m.direction === 'OUT';
            return (
              <div key={m.id} style={{ display: 'contents' }}>
                {sep}
                {out && <div className="sender-tag">{m.sender === 'STAFF' ? (m.sentByName || 'STAFF').toUpperCase() : 'SILETRY'}</div>}
                <div className={`bubble ${out ? 'out' : 'in'} ${m.sender === 'STAFF' ? 'staff' : ''} ${m.status === 'FAILED' ? 'failed' : ''}`}>
                  {m.body}
                  <div className="meta">
                    {m.templateName && <span>Template · </span>}
                    {fmtTime(m.createdAt)}
                    {out && m.status !== 'FAILED' && ` · ${m.status.charAt(0) + m.status.slice(1).toLowerCase()}`}
                  </div>
                  {m.status === 'FAILED' && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 4 }}>Not sent: {m.error}</div>}
                </div>
                {out && m.buttons.length > 0 && (
                  <div className="msg-buttons">{m.buttons.map((b) => <span key={b}>{b}</span>)}</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="composer">
          <textarea
            className="textarea"
            placeholder={c.takenOver ? (thread.windowOpen ? 'Type a reply' : 'More than 24 hours since their last message. Only templates can be sent.') : 'Take over the thread to reply'}
            disabled={!c.takenOver || !thread.windowOpen}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          {c.takenOver ? (
            <button className="btn btn-primary btn-lg" disabled={sending || !text.trim() || !thread.windowOpen} onClick={send}>Send <Send /></button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={() => action('take-over', 'You took over. Siletry will stay quiet.')}>Take over</button>
          )}
        </div>
      </div>

      <aside className="side">
        {!patient ? <Loading /> : (
          <>
            <div className="row gap-12 mb-24">
              <Avatar text={patient.initials} size="lg" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{patient.name}</div>
                <div className="muted">{[patient.age, patient.gender, `ID ${patient.patientNo}`].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <div className="section-label">Next appointment</div>
            {patient.nextAppointment ? (
              <div style={{ margin: '12px 0 24px' }}>
                <div className="row">
                  <b style={{ fontSize: 16 }}>{relativeDay(patient.nextAppointment.startAt)}, {fmtTime(patient.nextAppointment.startAt)}</b>
                  <StatusPill status={patient.nextAppointment.status} />
                </div>
                <div className="muted mt-8">{[patient.nextAppointment.doctorName, patient.nextAppointment.reason].filter(Boolean).join(' · ')}</div>
              </div>
            ) : <div className="muted" style={{ margin: '10px 0 24px' }}>None booked</div>}
            <div className="section-label">Details</div>
            <div className="mb-24">
              <div className="kv"><span className="k">Language</span><span className="v">{langName(patient.language)}</span></div>
              <div className="kv"><span className="k">First seen</span><span className="v">{fmtDate(patient.stats.patientSince)}</span></div>
              <div className="kv"><span className="k">Visits</span><span className="v">{patient.stats.visits}</span></div>
              <div className="kv"><span className="k">No-shows</span><span className="v">{patient.stats.noShows}</span></div>
              <div className="kv"><span className="k">Consent</span><span className="v">{patient.details.optedOut ? 'Opted out (STOP)' : patient.details.whatsappOptIn ? 'WhatsApp opted in' : 'Not recorded'}</span></div>
            </div>
            <div className="section-label">Recent visits</div>
            <div className="mb-24">
              {patient.visits.filter((v) => v.status === 'SEEN').slice(0, 3).map((v) => (
                <div key={v.appointmentId} className="kv"><span>{fmtDate(v.startAt)}</span><span className="muted">{v.reason}</span></div>
              ))}
              {patient.visits.filter((v) => v.status === 'SEEN').length === 0 && <div className="muted mt-8">No past visits</div>}
            </div>
            <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => nav(`/patients/${patient.id}`)}>Open full patient record</button>
          </>
        )}
      </aside>

      {booking && patient && (
        <BookVisitModal
          patient={{ id: patient.id, name: patient.name, phone: patient.phone, age: patient.age, language: patient.language, dueFollowUp: patient.dueFollowUp }}
          onClose={() => setBooking(false)}
          onDone={() => { setBooking(false); reloadPatient(); load(); }}
        />
      )}
    </>
  );
}
