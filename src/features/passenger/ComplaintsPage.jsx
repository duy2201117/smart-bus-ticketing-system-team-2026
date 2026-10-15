import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, dateTime, statusLabel } from '../../lib/api';
import { ErrorMessage, Loading, SignInPrompt } from './shared';

export default function ComplaintsPage() {
  const { user, loading: authLoading } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState({ category: 'Chất lượng dịch vụ', tripId: '', content: '' });
  const [review, setReview] = useState({ tripId: '', rating: '5', message: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    const [nextComplaints, nextTickets, nextFeedbacks] = await Promise.all([
      api('/complaints'),
      api('/tickets'),
      api('/feedback'),
    ]);
    setComplaints(nextComplaints);
    setTickets(nextTickets);
    setFeedbacks(nextFeedbacks);
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
      setForm({ category: 'Chất lượng dịch vụ', tripId: '', content: '' });
      setNotice('Đã gửi phản ánh đến bộ phận vận hành.');
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function submitReview(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api('/feedback', {
        method: 'POST',
        body: {
          tripId: review.tripId,
          rating: Number(review.rating),
          message: review.message.trim(),
        },
      });
      setReview({ tripId: '', rating: '5', message: '' });
      setNotice('Đã gửi đánh giá chuyến đi. Cảm ơn bạn đã chia sẻ trải nghiệm.');
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (authLoading) return <Loading/>;
  if (!user) return <SignInPrompt title="Đăng nhập để gửi phản ánh" from="/complaints"/>;

  const complaintTrips = [...new Map(
    tickets
      .filter(ticket => ['paid', 'checked_in', 'cancelled'].includes(ticket.status))
      .map(ticket => [String(ticket.tripId), ticket]),
  ).values()];
  const ratedTripIds = new Set(feedbacks.map(item => String(item.tripId)));
  const reviewTrips = [...new Map(
    tickets
      .filter(ticket => ['paid', 'checked_in'].includes(ticket.status) && !ratedTripIds.has(String(ticket.tripId)))
      .map(ticket => [String(ticket.tripId), ticket]),
  ).values()];
  const ticketByTripId = new Map(tickets.map(ticket => [String(ticket.tripId), ticket]));

  return <div className="passenger-page stack"><header className="page-heading"><span className="eyebrow">SMARTBUS LẮNG NGHE BẠN</span><h1>Phản ánh & đánh giá</h1><p className="muted">Gửi phản ánh, chấm điểm chuyến đã mua và theo dõi phản hồi từ bộ phận vận hành.</p></header><ErrorMessage error={error}/>{notice && <div className="alert alert-success" role="status">{notice}</div>}
    <div className="grid grid-2">
      <section className="card stack"><h2>Gửi phản ánh</h2><form className="stack" onSubmit={submit}><label className="field">Danh mục<select className="input" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}><option>Chất lượng dịch vụ</option><option>Thời gian và lịch trình</option><option>Thái độ phục vụ</option><option>Thanh toán và hoàn tiền</option><option>Khác</option></select></label><label className="field">Chuyến xe liên quan<select className="input" value={form.tripId} onChange={event => setForm({ ...form, tripId: event.target.value })}><option value="">Không liên quan chuyến cụ thể</option>{complaintTrips.map(ticket => <option key={ticket.tripId} value={ticket.tripId}>{ticket.routeName} · {dateTime(ticket.departureTime)}</option>)}</select></label><label className="field">Mô tả<textarea className="input" required minLength={2} maxLength={3000} rows={5} value={form.content} onChange={event => setForm({ ...form, content: event.target.value })}/></label><button className="btn btn-primary" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi phản ánh'}</button></form></section>

      <section className="card stack"><h2>Đánh giá chuyến đi</h2><p className="muted">Mỗi chuyến đã mua vé chỉ được đánh giá một lần, từ 1 đến 5 sao.</p>{reviewTrips.length ? <form className="stack" onSubmit={submitReview}><label className="field">Chuyến đã mua<select className="input" required value={review.tripId} onChange={event => setReview({ ...review, tripId: event.target.value })}><option value="">Chọn chuyến để đánh giá</option>{reviewTrips.map(ticket => <option key={ticket.tripId} value={ticket.tripId}>{ticket.routeName} · {dateTime(ticket.departureTime)}</option>)}</select></label><label className="field">Mức đánh giá<select className="input" value={review.rating} onChange={event => setReview({ ...review, rating: event.target.value })}><option value="5">★★★★★ · Rất tốt</option><option value="4">★★★★☆ · Tốt</option><option value="3">★★★☆☆ · Bình thường</option><option value="2">★★☆☆☆ · Chưa tốt</option><option value="1">★☆☆☆☆ · Không hài lòng</option></select></label><label className="field">Nhận xét<textarea className="input" required minLength={2} maxLength={2000} rows={5} value={review.message} onChange={event => setReview({ ...review, message: event.target.value })} placeholder="Chia sẻ trải nghiệm của bạn trên chuyến xe"/></label><button className="btn btn-primary" disabled={busy || !review.tripId}>{busy ? 'Đang gửi…' : 'Gửi đánh giá'}</button></form> : <div className="empty-state">Bạn chưa có chuyến đủ điều kiện đánh giá hoặc đã đánh giá tất cả chuyến đã mua.</div>}</section>
    </div>

    <section className="card stack"><h2>Lịch sử đánh giá</h2>{loading ? <Loading/> : feedbacks.length ? feedbacks.map(item => { const ticket = ticketByTripId.get(String(item.tripId)); return <article className="notification-item" key={item.id}><div><div className="row spread"><strong>{item.routeName || ticket?.routeName || `Chuyến #${item.tripId}`}</strong><span className="badge" aria-label={`${item.rating} trên 5 sao`}>{'★'.repeat(Number(item.rating) || 0)}{'☆'.repeat(Math.max(0, 5 - (Number(item.rating) || 0)))}</span></div>{ticket?.departureTime && <p className="muted">{dateTime(ticket.departureTime)}</p>}<p className="ops-preserve">{item.message}</p><time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time></div></article>; }) : <div className="empty-state">Bạn chưa đánh giá chuyến đi nào.</div>}</section>

    <section className="card stack"><h2>Lịch sử phản ánh</h2>{loading ? <Loading/> : complaints.length ? complaints.map(item => <article className="notification-item" key={item.id}><div><div className="row spread"><strong>{item.category}</strong><span className="badge">{statusLabel(item.status)}</span></div><p className="ops-preserve">{item.content}</p>{item.response && <p><strong>Phản hồi:</strong> {item.response}</p>}<time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time></div></article>) : <div className="empty-state">Bạn chưa gửi phản ánh nào.</div>}</section>
  </div>;
}
