import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, dateTime, statusLabel } from '../../lib/api';
import { ErrorMessage, Loading, SignInPrompt } from './shared';

export default function ComplaintsPage() {
  const { user, loading: authLoading } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState({ category: 'Chất lượng dịch vụ', tripId: '', content: '' });
  const [ratingForm, setRatingForm] = useState({ tripId: '', rating: 5, message: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ratingNotice, setRatingNotice] = useState('');
  const reload = useCallback(async () => {
    const [nextComplaints, nextFeedback, nextTickets] = await Promise.all([api('/complaints'), api('/feedback'), api('/tickets')]);
    setComplaints(nextComplaints); setFeedback(nextFeedback); setTickets(nextTickets);
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

  async function submitRating(event) {
    event.preventDefault(); setRatingBusy(true); setError(''); setRatingNotice('');
    try {
      await api('/feedback', { method: 'POST', body: { tripId: ratingForm.tripId, rating: Number(ratingForm.rating), message: ratingForm.message.trim() } });
      setRatingForm({ tripId: '', rating: 5, message: '' }); setRatingNotice('Đã gửi đánh giá chuyến đi. Cảm ơn bạn đã góp ý.'); await reload();
    } catch (err) { setError(err.message); }
    finally { setRatingBusy(false); }
  }

  if (authLoading) return <Loading/>;
  if (!user) return <SignInPrompt title="Đăng nhập để gửi phản ánh" from="/complaints"/>;
  const eligible = [...new Map(tickets.filter(ticket => ['paid', 'checked_in', 'cancelled'].includes(ticket.status)).map(ticket => [ticket.tripId, ticket])).values()];
  const ratedTripIds = new Set(feedback.map(item => item.tripId));
  const ratingEligible = [...new Map(tickets.filter(ticket => ['paid', 'checked_in'].includes(ticket.status) && !ratedTripIds.has(ticket.tripId)).map(ticket => [ticket.tripId, ticket])).values()];
  return <div className="passenger-page stack"><header className="page-heading"><span className="eyebrow">SMARTBUS LẮNG NGHE BẠN</span><h1>Gửi phản ánh</h1><p className="muted">Theo dõi nội dung và phản hồi từ bộ phận vận hành.</p></header><ErrorMessage error={error}/>{notice && <div className="alert alert-success" role="status">{notice}</div>}
    <section className="card stack"><h2>Nội dung phản ánh</h2><form className="stack" onSubmit={submit}><label className="field">Danh mục<select className="input" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}><option>Chất lượng dịch vụ</option><option>Thời gian và lịch trình</option><option>Thái độ phục vụ</option><option>Thanh toán và hoàn tiền</option><option>Khác</option></select></label><label className="field">Chuyến xe liên quan<select className="input" value={form.tripId} onChange={event => setForm({ ...form, tripId: event.target.value })}><option value="">Không liên quan chuyến cụ thể</option>{eligible.map(ticket => <option key={ticket.tripId} value={ticket.tripId}>{ticket.routeName} · {dateTime(ticket.departureTime)}</option>)}</select></label><label className="field">Mô tả<textarea className="input" required minLength={2} maxLength={3000} rows={5} value={form.content} onChange={event => setForm({ ...form, content: event.target.value })}/></label><button className="btn btn-primary" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi phản ánh'}</button></form></section>
    <section className="card stack"><h2>Đánh giá chuyến đi</h2><p className="muted">Chấm điểm từ 1 đến 5 sao cho chuyến bạn đã mua vé hoặc đã đi.</p>{ratingNotice && <div className="alert alert-success" role="status">{ratingNotice}</div>}{ratingEligible.length ? <form className="stack" onSubmit={submitRating}><label className="field">Chuyến xe<select className="input" required value={ratingForm.tripId} onChange={event => setRatingForm({ ...ratingForm, tripId: event.target.value })}><option value="">Chọn chuyến cần đánh giá</option>{ratingEligible.map(ticket => <option key={ticket.tripId} value={ticket.tripId}>{ticket.routeName} · {dateTime(ticket.departureTime)}</option>)}</select></label><label className="field">Điểm đánh giá<select className="input" value={ratingForm.rating} onChange={event => setRatingForm({ ...ratingForm, rating: Number(event.target.value) })}><option value={5}>5 sao - Rất tốt</option><option value={4}>4 sao - Tốt</option><option value={3}>3 sao - Bình thường</option><option value={2}>2 sao - Chưa tốt</option><option value={1}>1 sao - Không hài lòng</option></select></label><label className="field">Nhận xét<textarea className="input" required minLength={1} maxLength={2000} rows={4} value={ratingForm.message} onChange={event => setRatingForm({ ...ratingForm, message: event.target.value })}/></label><button className="btn btn-primary" disabled={ratingBusy || !ratingForm.tripId}>{ratingBusy ? 'Đang gửi…' : 'Gửi đánh giá'}</button></form> : <div className="empty-state">Bạn chưa có chuyến đủ điều kiện đánh giá hoặc đã đánh giá tất cả các chuyến.</div>}</section>
    <section className="card stack"><h2>Lịch sử đánh giá</h2>{loading ? <Loading/> : feedback.length ? feedback.map(item => <article className="notification-item" key={item.id}><div><div className="row spread"><strong>{item.routeName || 'Chuyến xe'}</strong><span className="badge">{item.rating}/5 sao</span></div><p className="ops-preserve">{item.message}</p><div className="row spread"><span className="badge">{statusLabel(item.status)}</span><time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time></div>{item.response && <p><strong>Phản hồi:</strong> {item.response}</p>}</div></article>) : <div className="empty-state">Bạn chưa đánh giá chuyến đi nào.</div>}</section>
    <section className="card stack"><h2>Lịch sử phản ánh</h2>{loading ? <Loading/> : complaints.length ? complaints.map(item => <article className="notification-item" key={item.id}><div><div className="row spread"><strong>{item.category}</strong><span className="badge">{statusLabel(item.status)}</span></div><p className="ops-preserve">{item.content}</p>{item.response && <p><strong>Phản hồi:</strong> {item.response}</p>}<time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time></div></article>) : <div className="empty-state">Bạn chưa gửi phản ánh nào.</div>}</section>
  </div>;
}
