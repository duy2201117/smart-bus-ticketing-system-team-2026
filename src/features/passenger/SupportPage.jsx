import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, dateTime, statusLabel } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { ErrorMessage, Loading, SignInPrompt, Status } from './shared'

function DiscountForm() {
  const { user, refresh } = useAuth()
  const [type, setType] = useState(user.discountType && user.discountType !== 'none' ? user.discountType : 'student')
  const [evidence, setEvidence] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      await api('/profile/discount', { method: 'POST', body: { discountType: type, discountEvidence: evidence.trim() } })
      await refresh(); setNotice('Đã gửi hồ sơ. Bộ phận quản lý sẽ kiểm tra và thông báo kết quả xét duyệt.'); setEvidence('')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <section className="card stack"><div className="row spread"><div><span className="eyebrow">ĐỒNG HÀNH CÙNG BẠN</span><h2>Hồ sơ ưu đãi</h2></div><Status value={user.discountStatus || 'none'} /></div><p className="muted">Gửi thông tin xác minh để đăng ký mức giảm dành cho học sinh, sinh viên hoặc người cao tuổi.</p>{user.discountStatus === 'approved' && <div className="alert alert-success">Ưu đãi {statusLabel(user.discountType)} đã được kích hoạt. Giá cuối cùng được xác nhận khi giữ ghế hoặc đăng ký vé tháng.</div>}<ErrorMessage error={error} />{notice && <div className="alert alert-success" role="status">{notice}</div>}<form className="stack" onSubmit={submit}><label className="field">Đối tượng ưu đãi<select required value={type} disabled={busy} onChange={event => setType(event.target.value)}><option value="pupil">Học sinh</option><option value="student">Sinh viên</option><option value="senior">Người cao tuổi</option></select></label><label className="field">Thông tin và minh chứng<textarea required minLength={10} maxLength={2000} rows={4} value={evidence} disabled={busy} onChange={event => setEvidence(event.target.value)} placeholder="Họ tên, trường học / năm sinh, mã thẻ và đường dẫn tài liệu xác minh (nếu có)…" /></label><p className="discount-evidence-help">Nhập thông tin để quản lý đối chiếu; có thể kèm đường dẫn tài liệu được chia sẻ cho người duyệt. Không gửi mật khẩu hoặc thông tin thẻ ngân hàng. Gửi lại hồ sơ sẽ chuyển về trạng thái chờ duyệt.</p><button className="btn btn-primary" disabled={busy}>{busy ? 'Đang gửi hồ sơ…' : user.discountStatus === 'none' ? 'Gửi hồ sơ xét duyệt' : 'Gửi lại hồ sơ xét duyệt'}</button></form></section>
}

export default function SupportPage() {
  const { user, loading: authLoading } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [feedback, setFeedback] = useState([])
  const [tickets, setTickets] = useState([])
  const [form, setForm] = useState({ tripId: '', rating: 5, message: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const reload = useCallback(async () => {
    const results = await Promise.all([api('/notifications'), api('/feedback'), api('/tickets')])
    setNotifications(results[0]); setFeedback(results[1]); setTickets(results[2])
  }, [])
  useEffect(() => {
    if (!user) { if (!authLoading) setLoading(false); return }
    let active = true
    reload().catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user, authLoading, reload])
  async function submit(event) {
    event.preventDefault(); setBusy('feedback'); setError(''); setNotice('')
    try { await api('/feedback', { method: 'POST', body: { ...form, message: form.message.trim() } }); setForm({ tripId: '', rating: 5, message: '' }); await reload(); setNotice('Cảm ơn bạn. Phản ánh đã được gửi đến bộ phận vận hành.') }
    catch (err) { setError(err.message) } finally { setBusy('') }
  }
  async function markRead(id) {
    setBusy(`notification-${id}`); setError('')
    try { await api(`/notifications/${id}/read`, { method: 'POST' }); setNotifications(items => items.map(item => item.id === id ? { ...item, read: true } : item)) }
    catch (err) { setError(err.message) } finally { setBusy('') }
  }
  if (authLoading) return <Loading />
  if (!user) return <SignInPrompt from="/support" title="Đăng nhập để nhận hỗ trợ" />
  const eligible = [...new Map(tickets.filter(ticket => ['paid', 'checked_in'].includes(ticket.status)).map(ticket => [ticket.tripId, ticket])).values()]
  return <div className="passenger-page stack"><div className="page-heading"><span className="eyebrow">LẮNG NGHE ĐỂ PHỤC VỤ TỐT HƠN</span><h1>Hỗ trợ & thông báo</h1><p className="muted">Cập nhật hành trình, gửi phản ánh và quản lý hồ sơ ưu đãi của bạn.</p></div><ErrorMessage error={error} />{notice && <div className="alert alert-success" role="status">{notice}</div>}{loading ? <Loading /> : <div className="support-layout"><div className="stack"><section className="card stack"><div className="row spread"><h2>Thông báo của bạn</h2><span className="badge">{notifications.filter(item => !item.read).length} chưa đọc</span></div>{notifications.length ? notifications.map(item => <article className={`notification-item ${item.read ? '' : 'unread'}`} key={item.id}><span className="notification-dot" /><div><div className="row spread"><h3>{item.title}</h3>{!item.read && <button className="passenger-text-button" disabled={Boolean(busy)} onClick={() => markRead(item.id)}>{busy === `notification-${item.id}` ? 'Đang lưu…' : 'Đánh dấu đã đọc'}</button>}</div><p>{item.message}</p><time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time></div></article>) : <div className="empty-state"><p className="muted">Chưa có thông báo. Thông tin vé và cập nhật hành trình sẽ xuất hiện tại đây.</p></div>}</section><section className="card stack"><span className="eyebrow">MỖI Ý KIẾN ĐỀU CÓ GIÁ TRỊ</span><h2>Đánh giá chuyến đi</h2>{eligible.length ? <form onSubmit={submit} className="stack"><label className="field">Chuyến xe đã đặt<select required value={form.tripId} disabled={Boolean(busy)} onChange={event => setForm({ ...form, tripId: event.target.value })}><option value="">Chọn chuyến cần phản ánh</option>{eligible.map(ticket => <option value={ticket.tripId} key={ticket.tripId}>{ticket.routeName} · {dateTime(ticket.departureTime)}</option>)}</select></label><div className="field"><span>Mức độ hài lòng: {form.rating}/5</span><div className="rating-picker" role="group" aria-label="Mức độ hài lòng">{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" className={value <= form.rating ? 'selected' : ''} aria-label={`${value} sao`} aria-pressed={form.rating === value} disabled={Boolean(busy)} onClick={() => setForm({ ...form, rating: value })}>★</button>)}</div></div><label className="field">Nội dung phản ánh<textarea required minLength={10} maxLength={2000} rows={4} disabled={Boolean(busy)} value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} placeholder="Chia sẻ trải nghiệm và những điều chúng tôi có thể cải thiện…" /></label><button className="btn btn-primary" disabled={Boolean(busy)}>{busy === 'feedback' ? 'Đang gửi…' : 'Gửi đánh giá'}</button></form> : <div className="empty-state"><p className="muted">Bạn có thể gửi đánh giá sau khi đặt vé thành công.</p><Link to="/" className="btn btn-secondary">Tìm chuyến xe</Link></div>}</section><section className="card stack"><h2>Phản ánh đã gửi</h2>{feedback.length ? feedback.map(item => <article className="feedback-item" key={item.id}><div className="row spread"><span aria-label={`${item.rating} sao`} style={{ color: '#b78539' }}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</span><Status value={item.status} /></div><p>{item.message}</p><small className="muted">{item.routeName || `Chuyến #${item.tripId}`} · {dateTime(item.createdAt)}</small>{item.response && <div className="feedback-response"><strong>Phản hồi từ SmartBus</strong><p>{item.response}</p></div>}</article>) : <p className="muted">Bạn chưa gửi phản ánh nào.</p>}</section></div><aside className="stack"><DiscountForm /><div className="card passenger-note"><h3>Chủ động trước giờ khởi hành</h3><p className="muted">Đổi hoặc hủy vé tại mục Vé của tôi. Theo dõi vị trí xe và trạm dừng trong bản đồ hành trình.</p><div className="row"><Link className="passenger-text-link" to="/tickets">Vé của tôi →</Link><Link className="passenger-text-link" to="/tracking">Theo dõi xe →</Link></div></div></aside></div>}</div>
}
