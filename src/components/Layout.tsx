import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, CalendarDays, MessagesSquare, Users, Stethoscope, Workflow, CalendarCheck, FileText,
  Smartphone, BarChart3, ReceiptIndianRupee, Settings, Search, ChevronDown, LogOut, FlaskConical,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api, qs } from '../api/client';
import type { AppointmentList, InboxList, PatientRow } from '../api/types';
import { Avatar } from './ui';
import { useToast } from '../lib/toast';
import { initials } from '../lib/format';

const TITLES: Record<string, string> = {
  '/': 'Overview', '/appointments': 'Appointments', '/inbox': 'Inbox', '/patients': 'Patients',
  '/doctors': 'Doctors & availability', '/automations': 'Automations', '/booking-flow': 'Booking flow',
  '/templates': 'Message templates', '/whatsapp': 'WhatsApp numbers', '/reports': 'Reports',
  '/billing': 'Billing', '/settings': 'Settings', '/simulator': 'WhatsApp simulator',
};

export default function Layout() {
  const { user, clinic, logout, refresh } = useAuth();
  const { toast, error } = useToast();
  const loc = useLocation();
  const nav = useNavigate();
  const [counts, setCounts] = useState({ today: 0, inbox: 0 });
  const [menu, setMenu] = useState(false);

  // Sidebar counts, refreshed in the background
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [a, i] = await Promise.all([
          api.get<AppointmentList>('/api/appointments?tab=today'),
          api.get<InboxList>('/api/inbox?limit=1'),
        ]);
        if (alive) setCounts({ today: a.counts.today, inbox: i.needsYou });
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [loc.pathname]);

  const base = '/' + (loc.pathname.split('/')[1] || '');
  const title = TITLES[base] ?? '';

  const toggleBot = async () => {
    if (user?.role !== 'OWNER') return;
    try {
      await api.patch('/api/clinic', { botEnabled: !clinic?.botEnabled });
      await refresh();
      toast(clinic?.botEnabled ? 'Siletry paused. New messages go to your inbox.' : 'Siletry is replying again.');
    } catch (e) {
      error(e);
    }
  };

  const item = (to: string, label: string, Icon: typeof LayoutGrid, count?: number, tag?: string) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <Icon />
      <span>{label}</span>
      {!!count && <span className="nav-count">{count}</span>}
      {tag && <span className="nav-tag">{tag}</span>}
    </NavLink>
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">S</div>
          <div className="brand-name">Siletry</div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">Clinic</div>
          {item('/', 'Overview', LayoutGrid)}
          {item('/appointments', 'Appointments', CalendarDays, counts.today)}
          {item('/inbox', 'Inbox', MessagesSquare, counts.inbox)}
          {item('/patients', 'Patients', Users)}
          {item('/doctors', 'Doctors & hours', Stethoscope)}
          <div className="nav-section">Automation</div>
          {item('/automations', 'Automations', Workflow)}
          {item('/booking-flow', 'Booking flow', CalendarCheck)}
          {item('/templates', 'Message templates', FileText)}
          {item('/whatsapp', 'WhatsApp numbers', Smartphone)}
          {item('/simulator', 'Simulator', FlaskConical, undefined, 'TEST')}
          <div className="nav-section">Practice</div>
          {item('/reports', 'Reports', BarChart3)}
          {item('/billing', 'Billing', ReceiptIndianRupee)}
          {item('/settings', 'Settings', Settings)}
        </nav>
        <div className="sidebar-foot">
          <div className="wa-card" onClick={() => nav('/whatsapp')} style={{ cursor: 'pointer' }}>
            <div className="row">
              <span className={`dot ${clinic?.whatsappConnected ? '' : 'amber'}`} />
              {clinic?.whatsappConnected ? 'WhatsApp connected' : 'WhatsApp not connected'}
            </div>
            <div className="num">{clinic?.whatsappNumber || 'Connect your clinic number'}</div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumbs">
            {clinic?.name}
            <span className="sep">/</span>
            <b>{title}</b>
          </div>
          <GlobalSearch />
          <div className="status-chip" onClick={toggleBot} title={user?.role === 'OWNER' ? 'Click to pause or resume Siletry' : undefined}>
            <span className={`dot ${clinic?.botEnabled ? '' : 'gray'}`} />
            {clinic?.botEnabled ? 'Siletry active' : 'Siletry paused'}
          </div>
          <div className="user-chip" onClick={() => setMenu((m) => !m)}>
            <Avatar text={initials(user?.name)} size="sm" />
            <div className="who">
              <b>{user?.name}</b>
              <span>{clinic?.name}</span>
            </div>
            <ChevronDown size={16} color="#6d746f" />
            {menu && (
              <div className="menu" onMouseLeave={() => setMenu(false)}>
                <button onClick={() => nav('/settings')}><Settings size={16} /> Settings</button>
                <button className="danger" onClick={logout}><LogOut size={16} /> Log out</button>
              </div>
            )}
          </div>
        </header>
        <main className={`content ${base === '/inbox' ? 'flush' : ''}`}>
          {clinic && !clinic.live && base !== '/inbox' && (
            <div className="setup-banner">
              <span className="grow">
                <b>Finish setting up {clinic.name}.</b> You're on step {Math.min(clinic.onboardingStep, 5)} of 5. Siletry starts answering patients once you go live.
              </span>
              {user?.role === 'OWNER' && <button className="btn btn-primary btn-sm" onClick={() => nav('/setup')}>Continue setup</button>}
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PatientRow[]>([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setResults(await api.get<PatientRow[]>('/api/search' + qs({ q })));
        setSel(0);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const go = (p: PatientRow) => {
    nav(`/patients/${p.id}`);
    setQ('');
    setOpen(false);
    ref.current?.blur();
  };

  return (
    <div className="search-wrap">
      <div className="search">
        <Search size={18} />
        <input
          ref={ref}
          placeholder="Search patients, numbers, messages"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setSel((s) => Math.min(s + 1, results.length - 1));
            if (e.key === 'ArrowUp') setSel((s) => Math.max(s - 1, 0));
            if (e.key === 'Enter' && results[sel]) go(results[sel]);
          }}
        />
        <span className="kbd">⌘K</span>
      </div>
      {open && q.trim().length >= 2 && (
        <div className="search-results">
          {results.length === 0 ? (
            <div className="item muted">No patients found</div>
          ) : (
            results.map((p, i) => (
              <div key={p.id} className={`item ${i === sel ? 'sel' : ''}`} onMouseDown={() => go(p)}>
                <Avatar text={p.initials} size="sm" />
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{p.phone} · ID {p.patientNo}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
