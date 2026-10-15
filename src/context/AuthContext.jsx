import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { let active = true; api('/auth/me').then((data) => { if (active) setUser(data.user); }).catch((err) => { if (active && err.status !== 401) setError(err.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  async function login(email, password) { const data = await api('/auth/login', { method: 'POST', body: { email, password } }); setUser(data.user); setError(''); return data.user; }
  async function register(form) { const data = await api('/auth/register', { method: 'POST', body: form }); setUser(data.user); setError(''); return data.user; }
  async function logout() { await api('/auth/logout', { method: 'POST' }); setUser(null); }
  async function refresh() { const data = await api('/auth/me'); setUser(data.user); return data.user; }
  return <AuthContext.Provider value={{ user, loading, error, login, register, logout, refresh }}>{children}</AuthContext.Provider>;
}
// oxlint-disable-next-line react/only-export-components
export const useAuth = () => useContext(AuthContext);
