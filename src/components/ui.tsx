import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Inbox as InboxIcon } from 'lucide-react';
import type { AppointmentStatus, BookedBy, ConversationState } from '../api/types';
import { BOOKED_BY_LABEL, STATUS_LABEL } from '../lib/format';

export function Spinner() {
  return <div className="spinner" />;
}

export function Loading() {
  return (
    <div className="center-pad">
      <Spinner />
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="banner error">
      <span className="grow">{message}</span>
      {onRetry && (
        <button className="btn btn-sm btn-danger" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ text, icon }: { text: string; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <InboxIcon />}
      <div>{text}</div>
    </div>
  );
}

/** Open dialogs, so only the top one reacts to Escape and the page stays locked until the last closes. */
let openModals = 0;

export function Modal({
  title, sub, onClose, children, footer, wide,
}: {
  title: string; sub?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const depth = useRef(0);

  useEffect(() => {
    depth.current = ++openModals;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const returnFocus = document.activeElement as HTMLElement | null;
    // Focus the first field (or the dialog itself) so keyboard users land inside it
    const first = box.current?.querySelector<HTMLElement>('input, select, textarea');
    (first ?? box.current)?.focus({ preventScroll: true });
    return () => {
      openModals--;
      if (openModals === 0) document.body.style.overflow = prevOverflow;
      returnFocus?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && depth.current === openModals) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} tabIndex={-1} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-grip" aria-hidden />
        <div className="modal-head">
          <div className="grow">
            <h2>{title}</h2>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <button className="icon-btn x" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="toggle" style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      <span className="knob" />
    </label>
  );
}

export function Avatar({ text, tone, size }: { text?: string; tone?: 'peach'; size?: 'sm' | 'lg' | 'xl' }) {
  return <div className={`avatar ${tone ?? ''} ${size ?? ''}`}>{text || '?'}</div>;
}

export function StatusPill({ status, emergency }: { status: AppointmentStatus; emergency?: boolean }) {
  if (emergency && status !== 'SEEN' && status !== 'CANCELLED') {
    return <span className="pill pill-red"><span className="d" />Emergency</span>;
  }
  const cls: Record<AppointmentStatus, string> = {
    CONFIRMED: 'pill-green', WAITING: 'pill-amber', IN_CONSULT: 'pill-teal', SEEN: 'pill-gray',
    NO_SHOW: 'pill-red', CANCELLED: 'pill-gray',
  };
  return <span className={`pill ${cls[status]}`}><span className="d" />{STATUS_LABEL[status]}</span>;
}

export function BookedByPill({ by }: { by: BookedBy }) {
  if (by === 'SILETRY') return <span className="pill pill-teal"><span className="d" />Siletry</span>;
  return <span className="pill pill-gray">{BOOKED_BY_LABEL[by]}</span>;
}

export function ConvStatePill({ state, emergency }: { state: ConversationState; emergency: boolean }) {
  if (emergency) return <span className="pill pill-red pill-sm">Emergency</span>;
  switch (state) {
    case 'NEEDS_YOU': return <span className="pill pill-amber pill-sm">Needs you</span>;
    case 'YOU_REPLIED': return <span className="pill pill-peach pill-sm">You replied</span>;
    case 'BOT': return <span className="pill pill-teal pill-sm">Siletry replying</span>;
    default: return <span className="pill pill-green pill-sm">Handled</span>;
  }
}

/** Colored left edge for appointment rows. */
export function statusAccent(status: AppointmentStatus, emergency: boolean): string {
  if (emergency && status !== 'SEEN') return '#c2402f';
  switch (status) {
    case 'WAITING': return '#c98a2b';
    case 'IN_CONSULT': return '#1A6650';
    case 'NO_SHOW': return '#a45a50';
    case 'CANCELLED': return '#cfc9bf';
    case 'SEEN': return '#b8c3be';
    default: return '#3f7a4f';
  }
}
