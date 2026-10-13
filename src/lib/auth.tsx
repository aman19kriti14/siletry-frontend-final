import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../api/client';
import type { AuthResponse, ClinicSummary, OtpTicket, User } from '../api/types';

interface AuthState {
  user: User | null;
  clinic: ClinicSummary | null;
  ready: boolean;
  login: (identifier: string, password: string, remember: boolean) => Promise<AuthResponse>;
  requestCode: (identifier: string) => Promise<OtpTicket>;
  verifyCode: (ticket: string, code: string, remember: boolean) => Promise<AuthResponse>;
  signupStart: (body: { name: string; email: string; phone: string; clinicName: string; doctorCount: number }) => Promise<OtpTicket>;
  signupVerify: (ticket: string, code: string) => Promise<AuthResponse>;
  resend: (ticket: string) => Promise<OtpTicket>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState>(null as unknown as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [clinic, setClinic] = useState<ClinicSummary | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setClinic(null);
  }, []);

  const apply = (r: AuthResponse) => {
    if (r.token) setToken(r.token);
    setUser(r.user);
    setClinic(r.clinic);
    return r;
  };

  const refresh = useCallback(async () => {
    const r = await api.get<AuthResponse>('/api/auth/me');
    setUser(r.user);
    setClinic(r.clinic);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) {
      setReady(true);
      return;
    }
    refresh()
      .catch(() => logout())
      .finally(() => setReady(true));
  }, [logout, refresh]);

  const login = async (identifier: string, password: string, remember: boolean) =>
    apply(await api.post<AuthResponse>('/api/auth/login', { identifier, password, remember }));
  const requestCode = (identifier: string) => api.post<OtpTicket>('/api/auth/otp/request', { identifier });
  const verifyCode = async (ticket: string, code: string, remember: boolean) =>
    apply(await api.post<AuthResponse>('/api/auth/otp/verify', { ticket, code, remember }));
  const signupStart = (body: { name: string; email: string; phone: string; clinicName: string; doctorCount: number }) =>
    api.post<OtpTicket>('/api/auth/signup/start', body);
  const signupVerify = async (ticket: string, code: string) =>
    apply(await api.post<AuthResponse>('/api/auth/signup/verify', { ticket, code }));
  const resend = (ticket: string) => api.post<OtpTicket>('/api/auth/otp/resend', { ticket });

  return <Ctx.Provider value={{ user, clinic, ready, login, requestCode, verifyCode, signupStart, signupVerify, resend, logout, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
