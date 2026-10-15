import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import Icon from '../../components/Icon';
import Mascot from '../../components/Mascot';
export default function LoginPage() {
  const { user, login, register } = useAuth(); const [mode, setMode] = useState('login'); const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' }); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [demo, setDemo] = useState(false); const location = useLocation(); const navigate = useNavigate();
  useEffect(() => { api('/config').then((config) => setDemo(config.demoMode)).catch(() => {}); }, []);
  const requested = location.state?.from;
  const redirect = typeof requested === 'string' && requested.startsWith('/') && !requested.startsWith('//') && requested !== '/login' ? requested : null;
  const destination = (account) => redirect || (['admin','manager'].includes(account.role) ? '/manage' : account.role === 'driver' ? '/driver' : '/');
  if (user) return <Navigate to={destination(user)} replace/>;
  const field = (key) => ({ value: form[key], onChange: (event) => setForm({ ...form, [key]: event.target.value }) });
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { const account = mode === 'login' ? await login(form.email,form.password) : await register(form); navigate(destination(account), { replace:true }); } catch(err) { setError(err.message); } finally { setBusy(false); } }
  return <div className="auth-layout">
    <div className="auth-story">
      <Mascot size="auth" label="Chào bạn! Bubu chờ bạn nè ✨" />
      <span className="eyebrow">CHÀO MỪNG ĐẾN VỚI BUBUBUS</span>
      <h1>Mỗi hành trình,<br/><span>một niềm vui mới.</span></h1>
      <p>Tìm chuyến phù hợp, đặt chỗ trong vài bước và luôn biết xe của bạn đang ở đâu.</p>
      <div className="auth-feature"><Icon name="ticket"/>Vé điện tử, luôn sẵn trong tay</div>
      <div className="auth-feature"><Icon name="map"/>Chủ động đón xe tại trạm</div>
      <div className="auth-feature"><Icon name="shield"/>Tài khoản riêng cho từng vai trò</div>
    </div>
    <section className="panel auth-panel">
      <div className="tabs">
        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>Đăng nhập</button>
        <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>Tạo tài khoản</button>
      </div>
      <h2>{mode === 'login' ? 'Rất vui được gặp lại bạn' : 'Bắt đầu hành trình của bạn'}</h2>
      <p className="muted">{mode === 'login' ? 'Đăng nhập để quản lý vé và hành trình.' : 'Tài khoản hành khách được tạo miễn phí.'}</p>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <form className="stack" onSubmit={submit}>
        {mode === 'register' && <label className="field">Họ và tên<input required autoComplete="name" maxLength={100} {...field('name')}/></label>}
        <label className="field">Email<input required type="email" autoComplete="email" {...field('email')} placeholder="ban@example.com"/></label>
        {mode === 'register' && <label className="field">Số điện thoại<input type="tel" autoComplete="tel" maxLength={20} {...field('phone')}/></label>}
        <label className="field">Mật khẩu<input type="password" required minLength={8} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} {...field('password')} placeholder="Tối thiểu 8 ký tự"/></label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}<Icon name="arrow" size={17}/></button>
      </form>
      {mode === 'login' && <Link className="passenger-text-link" to="/forgot-password">Quên mật khẩu?</Link>}
      {demo && <div className="demo-accounts"><strong>Khám phá với tài khoản demo</strong><p>Mật khẩu chung: <code>SmartBus@123</code></p><div className="row wrap">{[['passenger','Hành khách'],['driver','Tài xế'],['manager','Quản lý'],['admin','Admin']].map(([role,label]) => <button type="button" className="btn btn-secondary btn-sm" key={role} disabled={busy} onClick={() => { setMode('login'); setForm({ ...form,email:`${role}@smartbus.demo`,password:'SmartBus@123' }); }}>{label}</button>)}</div></div>}
    </section>
  </div>;
}
