import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Setup from './pages/Setup';
import Overview from './pages/Overview';
import Appointments from './pages/Appointments';
import Inbox from './pages/Inbox';
import Patients from './pages/Patients';
import PatientProfile from './pages/PatientProfile';
import Doctors from './pages/Doctors';
import BookingFlow from './pages/BookingFlow';
import Templates from './pages/Templates';
import WhatsAppNumbers from './pages/WhatsAppNumbers';
import Automations from './pages/Automations';
import Reports from './pages/Reports';
import Billing from './pages/Billing';
import SettingsPage from './pages/Settings';
import Simulator from './pages/Simulator';

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/setup" element={<Setup />} />
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="inbox/:id" element={<Inbox />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/:id" element={<PatientProfile />} />
        <Route path="doctors" element={<Doctors />} />
        <Route path="automations" element={<Automations />} />
        <Route path="booking-flow" element={<BookingFlow />} />
        <Route path="templates" element={<Templates />} />
        <Route path="whatsapp" element={<WhatsAppNumbers />} />
        <Route path="simulator" element={<Simulator />} />
        <Route path="reports" element={<Reports />} />
        <Route path="billing" element={<Billing />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/signup" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
