import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { ErrorMessage } from '../passenger/shared';
import Mascot from '../../components/Mascot';

export default function PasswordRecoveryPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = token
        ? await api('/auth/reset-password', { method: 'POST', body: { token, password } })
        : await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } });
      setNotice(result.message);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="auth-layout"><div className="auth-story"><Mascot size="auth" label={token ? 'Bubu giữ tài khoản an toàn nhé 🔐' : 'Đừng lo, Bubu giúp bạn ✨'} /><span className="eyebrow">BẢO MẬT TÀI KHOẢN</span><h1>{token ? 'Đặt mật khẩu mới.' : 'Khôi phục quyền truy cập.'}</h1><p>{token ? 'Liên kết chỉ sử dụng một lần và sẽ hết hạn sau 30 phút.' : 'Nhập email đã đăng ký. Hướng dẫn sẽ được gửi qua hộp thư hệ thống.'}</p></div><section className="panel auth-panel"><h2>{token ? 'Tạo mật khẩu mới' : 'Quên mật khẩu'}</h2><ErrorMessage error={error}/>{notice && <div className="alert alert-success" role="status">{notice}</div>}<form className="stack" onSubmit={submit}>{token ? <label className="field">Mật khẩu mới<input className="input" type="password" required minLength={10} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)}/></label> : <label className="field">Email<input className="input" type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)}/></label>}<button className="btn btn-primary" disabled={busy}>{busy ? 'Đang xử lý…' : token ? 'Đặt lại mật khẩu' : 'Gửi hướng dẫn'}</button></form><Link className="passenger-text-link" to="/login">Quay lại đăng nhập</Link></section></div>;
}