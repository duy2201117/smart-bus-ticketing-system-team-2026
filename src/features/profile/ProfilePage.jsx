import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ErrorMessage } from '../passenger/shared';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [discount, setDiscount] = useState({ discountType: 'student', discountEvidence: '' });
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event, path, body, success, method = 'POST') {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await api(path, { method, body }); await refresh(); setNotice(success); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function submitDiscount(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      let evidenceFileId = null;
      if (evidenceFile) {
        if (evidenceFile.size > 2 * 1024 * 1024) throw new Error('Tệp minh chứng phải nhỏ hơn hoặc bằng 2 MB.');
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Không thể đọc tệp minh chứng.'));
          reader.readAsDataURL(evidenceFile);
        });
        const dataBase64 = dataUrl.split(',', 2)[1] || '';
        const uploaded = await api('/profile/discount-evidence', { method: 'POST', body: { fileName: evidenceFile.name, mimeType: evidenceFile.type, dataBase64 } });
        evidenceFileId = uploaded.id;
      }
      await api('/profile/discount', { method: 'POST', body: { ...discount, evidenceFileId } });
      await refresh(); setEvidenceFile(null); setNotice('Đã gửi hồ sơ để xét duyệt.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="passenger-page stack"><header className="page-heading"><span className="eyebrow">TÀI KHOẢN CỦA BẠN</span><h1>Hồ sơ cá nhân</h1><p className="muted">Cập nhật thông tin liên hệ và quản lý bảo mật tài khoản.</p></header>
    <ErrorMessage error={error}/>{notice && <div className="alert alert-success" role="status">{notice}</div>}
    <section className="card stack"><h2>Thông tin cá nhân</h2><form className="stack" onSubmit={event => submit(event, '/profile', form, 'Đã cập nhật hồ sơ.', 'PATCH')}><label className="field">Họ và tên<input className="input" required minLength={2} maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}/></label><label className="field">Email<input className="input" value={user?.email || ''} readOnly/></label><label className="field">Số điện thoại<input className="input" type="tel" maxLength={20} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })}/></label><button className="btn btn-primary" disabled={busy}>Lưu thông tin</button></form></section>
    <div className="grid grid-2"><section className="card stack"><h2>Đổi mật khẩu</h2><form className="stack" onSubmit={event => submit(event, '/profile/password', password, 'Đã cập nhật mật khẩu.')}><label className="field">Mật khẩu hiện tại<input className="input" type="password" autoComplete="current-password" required value={password.currentPassword} onChange={event => setPassword({ ...password, currentPassword: event.target.value })}/></label><label className="field">Mật khẩu mới<input className="input" type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={password.newPassword} onChange={event => setPassword({ ...password, newPassword: event.target.value })}/></label><button className="btn btn-secondary" disabled={busy}>Cập nhật mật khẩu</button></form></section>
      <section className="card stack"><h2>Đăng ký ưu đãi</h2><p className="muted">Trạng thái hồ sơ: {user?.discountStatus || 'none'}</p><form className="stack" onSubmit={submitDiscount}><label className="field">Đối tượng<select className="input" value={discount.discountType} onChange={event => setDiscount({ ...discount, discountType: event.target.value })}><option value="student">Học sinh / sinh viên</option><option value="pupil">Học sinh phổ thông</option><option value="senior">Người cao tuổi</option></select></label><label className="field">Mô tả minh chứng<input className="input" maxLength={2000} value={discount.discountEvidence} onChange={event => setDiscount({ ...discount, discountEvidence: event.target.value })} placeholder="Mã sinh viên, trường/lớp hoặc thông tin đối chiếu"/></label><label className="field">Tệp minh chứng (JPG/PNG/WEBP/PDF, tối đa 2 MB)<input className="input" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" onChange={event => setEvidenceFile(event.target.files?.[0] || null)}/>{evidenceFile && <small>{evidenceFile.name} · {(evidenceFile.size / 1024).toFixed(1)} KB</small>}</label><p className="muted">Có thể nhập mô tả, tải tệp, hoặc dùng cả hai. Tệp được lưu riêng tư và chỉ bạn, Quản lý hoặc Admin được xem.</p><button className="btn btn-secondary" disabled={busy || (!discount.discountEvidence.trim() && !evidenceFile)}>{busy ? 'Đang gửi…' : 'Gửi hồ sơ'}</button></form></section></div>
  </div>;
}