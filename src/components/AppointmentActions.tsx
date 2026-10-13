import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { api } from '../api/client';
import type { AppointmentRow } from '../api/types';
import { useToast } from '../lib/toast';
import { Modal, Toggle } from './ui';
import { isoDate } from '../lib/format';

/** Kebab menu for one appointment: check in, no-show, reschedule, cancel, emergency. */
export default function AppointmentActions({
  row, onChanged, onReschedule,
}: {
  row: AppointmentRow;
  onChanged: () => void;
  onReschedule: (row: AppointmentRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { toast, error } = useToast();
  const isToday = row.startAt.startsWith(isoDate());

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setOpen(false);
    try {
      await fn();
      toast(msg);
      onChanged();
    } catch (e) {
      error(e);
    }
  };

  const canAct = row.status === 'CONFIRMED' || row.status === 'WAITING';

  return (
    <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Actions"><MoreVertical /></button>
      {open && (
        <div className="menu" onMouseLeave={() => setOpen(false)} style={{ top: 36 }}>
          {row.status === 'CONFIRMED' && isToday && (
            <button onClick={() => run(() => api.post(`/api/queue/check-in/${row.id}`), 'Checked in. Token sent on WhatsApp.')}>Check in</button>
          )}
          {row.status === 'CONFIRMED' && <button onClick={() => { setOpen(false); onReschedule(row); }}>Reschedule</button>}
          {canAct && (
            <button onClick={() => run(() => api.post(`/api/appointments/${row.id}/no-show`), 'Marked as no-show')}>Mark no-show</button>
          )}
          {row.status !== 'SEEN' && row.status !== 'CANCELLED' && (
            <button onClick={() => run(() => api.patch(`/api/appointments/${row.id}`, { emergency: !row.emergency }),
              row.emergency ? 'Emergency flag removed' : 'Marked as emergency. Moved to the front of the queue.')}>
              {row.emergency ? 'Remove emergency flag' : 'Mark as emergency'}
            </button>
          )}
          {canAct && <button className="danger" onClick={() => { setOpen(false); setCancelOpen(true); }}>Cancel appointment</button>}
        </div>
      )}
      {cancelOpen && <CancelModal row={row} onClose={() => setCancelOpen(false)} onDone={() => { setCancelOpen(false); onChanged(); }} />}
    </div>
  );
}

export function CancelModal({ row, onClose, onDone }: { row: { id: number; patientName?: string }; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast, error } = useToast();
  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/api/appointments/${row.id}/cancel`, { reason, notifyPatient: notify });
      toast('Appointment cancelled');
      onDone();
    } catch (e) {
      error(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title="Cancel appointment"
      sub={row.patientName ? `For ${row.patientName}` : undefined}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-plain" onClick={onClose}>Keep it</button>
          <button className="btn btn-danger" disabled={saving} onClick={submit}>Cancel appointment</button>
        </>
      }
    >
      <div className="field">
        <label>Reason (optional)</label>
        <input className="input" placeholder="Doctor unavailable" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="setting-row mt-12">
        <div className="txt"><b>Tell the patient on WhatsApp</b><span>They can reply to book another time</span></div>
        <Toggle checked={notify} onChange={setNotify} />
      </div>
    </Modal>
  );
}
