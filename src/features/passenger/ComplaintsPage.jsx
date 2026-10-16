import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, dateTime, statusLabel } from '../../lib/api';
import { ErrorMessage, Loading, SignInPrompt } from './shared';

export default function ComplaintsPage() {
  const { user, loading: authLoading } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState({ category: 'Chất lượng dịch vụ', tripId: '', content: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const reload = useCallback(async () => {
    const [nextComplaints, nextTickets] = await Promise.all([api('/complaints'), api('/tickets')]);
    setComplaints(nextComplaints); setTickets(nextTickets);
  }, []);

  useEffect(() => {
    if (!user) { if (!authLoading) setLoading(false); return; }
    let active = true;
    reload().catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, authLoading, reload]);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api('/complaints', { method: 'POST', body: { ...form, content: form.content.trim(), ...(form.tripId ? {} : { tripId: null }) } });
      setForm({ category: 'Chất lượng dịch vụ', tripId: '', content: '' }); setNotice('Đã gửi phản ánh đến bộ phận vận hành.'); await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (authLoading) return <Loading/>;
  if (!user) return <SignInPrompt title="Đăng nhập để gửi phản ánh" from="/complaints"/>;
  const eligible = [...new Map(tickets.filter(ticket => ['paid', 'checked_in', 'cancelled'].includes(ticket.status)).map(ticket => [ticket.tripId, ticket])).values()];
  return <div className="passenger-page stack"><header className="page-heading"><span className="eyebrow">SMARTBUS LẮNG NGHE BẠN</span><h1>Gửi phản ánh</h1><p className="muted">Theo dõi nội dung và phản hồi từ bộ phận vận hành.</p></header><ErrorMessage error={error}/>{notice && <div className="alert alert-success" role="status">{notice}</div>}
    <section className="card stack"><h2>Nội dung phản ánh</h2><form className="stack" onSubmit={submit}><label className="field">Danh mục<select className="input" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}><option>Chất lượng dịch vụ</option><option>Thời gian và lịch trình</option><option>Thái độ phục vụ</option><option>Thanh toán và hoàn tiền</option><option>Khác</option></select></label><label className="field">Chuyến xe liên quan<select className="input" value={form.tripId} onChange={event => setForm({ ...form, tripId: event.target.value })}><option value="">Không liên quan chuyến cụ thể</option>{eligible.map(ticket => <option key={ticket.tripId} value={ticket.tripId}>{ticket.routeName} · {dateTime(ticket.departureTime)}</option>)}</select></label><label className="field">Mô tả<textarea className="input" required minLength={2} maxLength={3000} rows={5} value={form.content} onChange={event => setForm({ ...form, content: event.target.value })}/></label><button className="btn btn-primary" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi phản ánh'}</button></form></section>
    <section className="card stack"><h2>Lịch sử phản ánh</h2>{loading ? <Loading/> : complaints.length ? complaints.map(item => <article className="notification-item" key={item.id}><div><div className="row spread"><strong>{item.category}</strong><span className="badge">{statusLabel(item.status)}</span></div><p className="ops-preserve">{item.content}</p>{item.response && <p><strong>Phản hồi:</strong> {item.response}</p>}<time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time></div></article>) : <div className="empty-state">Bạn chưa gửi phản ánh nào.</div>}</section>
  </div>;
}