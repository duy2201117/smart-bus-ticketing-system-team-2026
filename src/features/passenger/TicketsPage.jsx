import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api, download, money } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { Countdown, date, ErrorMessage, JourneyLine, Loading, localDate, SeatGrid, SignInPrompt, Status, time } from './shared'
import Mascot from '../../components/Mascot'

function ChangeTicket({ ticket, onDone, onClose }) {
  const [departureDate, setDepartureDate] = useState(localDate())
  const [trips, setTrips] = useState([])
  const [tripId, setTripId] = useState('')
  const [trip, setTrip] = useState(null)
  const [seat, setSeat] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setTripId(''); setTrip(null); setSeat(null)
    api(`/trips?routeId=${ticket.routeId}&date=${departureDate}`).then(data => { if (active) setTrips(data.filter(item => String(item.id) !== String(ticket.tripId) && item.status === 'scheduled' && new Date(item.departureTime) > new Date())) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [ticket.routeId, ticket.tripId, departureDate])
  useEffect(() => {
    if (!tripId) return
    let active = true
    setLoading(true); setSeat(null); setTrip(null); setError('')
    api(`/trips/${tripId}`).then(data => { if (active) setTrip(data) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tripId])
  async function change(e) {
    e.preventDefault(); setPending(true); setError('')
    try { await api(`/tickets/${ticket.id}/change`, { method: 'POST', body: { tripId: Number(tripId), seat } }); await onDone('Đã đổi chuyến. Mã QR cũ không còn hiệu lực, hãy dùng vé mới.'); onClose() }
    catch (e) { setError(e.message) }
    finally { setPending(false) }
  }
  return <form className="ticket-action-panel stack" onSubmit={change}><div className="row spread"><h3>Chọn chuyến thay thế</h3><button type="button" className="passenger-text-button" onClick={onClose} disabled={pending}>Đóng</button></div><p className="muted">Đổi sang chuyến cùng tuyến và cùng giá vé trước giờ khởi hành. Ghế cũ chỉ được trả khi đổi thành công.</p><ErrorMessage error={error} /><div className="form-grid"><div className="field"><label htmlFor={`change-date-${ticket.id}`}>Ngày đi mới</label><input id={`change-date-${ticket.id}`} className="input" type="date" min={localDate()} required value={departureDate} disabled={pending} onChange={e => setDepartureDate(e.target.value)} /></div><div className="field"><label htmlFor={`change-trip-${ticket.id}`}>Chuyến mới</label><select id={`change-trip-${ticket.id}`} className="input" value={tripId} disabled={pending || loading} onChange={e => setTripId(e.target.value)} required><option value="">Chọn chuyến xe</option>{trips.map(item => <option value={item.id} key={item.id} disabled={item.availableSeats <= 0}>{time(item.departureTime)} · {item.plate} · {item.availableSeats} chỗ trống</option>)}</select></div></div>{loading ? <Loading /> : trip ? <SeatGrid seats={trip.seats} selected={seat} onSelect={setSeat} disabled={pending} /> : !trips.length && <p className="muted">Chưa có chuyến thay thế trong ngày đã chọn.</p>}<button className="btn btn-primary" disabled={pending || loading || !seat || !trip}>{pending ? 'Đang đổi chuyến…' : 'Xác nhận đổi chuyến'}</button></form>
}

function TicketCard({ ticket, onUpdate, config, isNew = false }) {
  const [action, setAction] = useState('')
  const [qr, setQr] = useState(null)
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cancelReason, setCancelReason] = useState('');
  const paid = ticket.status === 'paid' || ticket.status === 'checked_in'
  const canChange = ticket.status === 'paid' && new Date(ticket.departureTime) > new Date()
  useEffect(() => { setQr(null) }, [ticket.code])
  async function perform(name, work) {
    setPending(name); setError(''); setNotice('')
    try { await work() } catch (e) { setError(e.message) } finally { setPending('') }
  }
  function showQr() { perform('qr', async () => { const result = await api(`/tickets/${ticket.id}/qr`); setQr(result); setAction('qr') }) }
  function cancel() { perform('cancel', async () => { const result = await api(`/tickets/${ticket.id}/cancel`, { method: 'POST', body: { reason: cancelReason.trim() } }); setAction(''); await onUpdate(result.refund?.status === 'completed' ? 'Đã hủy vé và hoàn tiền sandbox tự động thành công.' : (result.message || 'Đã hủy vé.')); }) }
  return <article className={`card passenger-ticket${isNew ? ' passenger-ticket-new' : ''}`}>{isNew && <div className="new-ticket-ribbon"><span>✨ VÉ VỪA ĐẶT</span><small>Vé mới nhất của bạn</small></div>}<div className="row spread"><div><span className="eyebrow">VÉ #{ticket.id}</span><h2>{ticket.routeName}</h2></div><Status value={ticket.status} /></div><p className="muted">{date(ticket.departureTime)} · Xe {ticket.plate}</p><JourneyLine trip={ticket} /><div className="ticket-perforation" /><div className="ticket-details"><div><span>Vị trí ghế</span><strong>{ticket.seat}</strong></div><div><span>Giá thanh toán</span><strong>{money(ticket.price)}</strong></div><div><span>Mã vé</span><strong className="ticket-code">{ticket.code || 'Chưa phát hành'}</strong></div></div>{ticket.refundStatus && ticket.refundStatus !== 'none' && <p className="muted">Hoàn tiền: <Status value={ticket.refundStatus} /></p>}{ticket.status === 'held' && <div className="hold-notice"><span>Ghế đang được giữ</span><Countdown expiresAt={ticket.holdExpiresAt} /></div>}<ErrorMessage error={error} />{notice && <div className="alert" role="status">{notice}</div>}
    <div className="ticket-actions">{paid && <><button className="btn btn-primary" disabled={Boolean(pending)} onClick={() => action === 'qr' ? setAction('') : showQr()}>{pending === 'qr' ? 'Đang tải QR…' : action === 'qr' ? 'Ẩn mã QR' : '▦ Hiển thị vé QR'}</button><button className="btn btn-secondary" disabled={Boolean(pending)} onClick={() => perform('invoice', () => download(`/tickets/${ticket.id}/invoice`, `Hoa-don-SmartBus-${ticket.id}.pdf`))}>Tải hóa đơn PDF</button><button className="passenger-text-button" disabled={Boolean(pending)} onClick={() => perform('email', async () => { const result = await api(`/tickets/${ticket.id}/email`, { method: 'POST' }); setNotice(result.message) })}>{pending === 'email' ? 'Đang xử lý…' : 'Gửi hóa đơn qua email'}</button></>}{ticket.status === 'held' && new Date(ticket.holdExpiresAt) > new Date() && <Link className="btn btn-primary" to={`/booking/${ticket.tripId}`}>Tiếp tục thanh toán</Link>}{canChange && <><button className="passenger-text-button" disabled={Boolean(pending)} onClick={() => { setAction(action === 'change' ? '' : 'change'); setError('') }}>Đổi chuyến</button><button className="passenger-text-button danger-text" disabled={Boolean(pending)} onClick={() => setAction(action === 'cancel' ? '' : 'cancel')}>Hủy vé</button></>}{paid && <Link className="passenger-text-link" to={`/tracking?tripId=${ticket.tripId}`}>Theo dõi chuyến ↗</Link>}</div>
    {action === 'qr' && qr && <div className="ticket-qr-panel"><img src={qr.dataUrl} alt={`Mã QR của vé ${ticket.id}, ghế ${ticket.seat}`} width="220" height="220" /><div><span className="eyebrow">XUẤT TRÌNH KHI LÊN XE</span><h3>Vé điện tử của bạn</h3><p className="ticket-code">{qr.code}</p><p className="muted">Đưa mã QR cho tài xế hoặc phụ xe để xác thực. Mã vé chỉ được soát một lần.</p><a className="btn btn-secondary" href={qr.dataUrl} download={`SmartBus-ve-${ticket.id}.png`}>Lưu ảnh mã QR</a></div></div>}
    {action === 'change' && <ChangeTicket ticket={ticket} onDone={onUpdate} onClose={() => setAction('')} />}
    {action === 'cancel' && <div className="ticket-action-panel stack"><h3>Xác nhận hủy vé ghế {ticket.seat}?</h3><p>{config?.refundPolicy || 'Chính sách hoàn tiền do hệ thống áp dụng theo điều kiện của vé.'}</p><label className="field">Lý do hủy<textarea className="input" maxLength={500} value={cancelReason} onChange={event => setCancelReason(event.target.value)} placeholder="Chia sẻ lý do để nhà xe hỗ trợ tốt hơn"/></label>{config?.paymentMode === 'sandbox' && <p className="muted">Đây là hoàn tiền mô phỏng, không phát sinh giao dịch ngân hàng.</p>}<div className="row"><button className="btn btn-danger" disabled={Boolean(pending)} onClick={cancel}>{pending === 'cancel' ? 'Đang hủy…' : 'Xác nhận hủy vé'}</button><button className="btn btn-secondary" disabled={Boolean(pending)} onClick={() => setAction('')}>Giữ lại vé</button></div></div>}
  </article>
}

export default function TicketsPage() {
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const [tickets, setTickets] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.message || '')
  const [filter, setFilter] = useState('upcoming')
  const newTicketId = location.state?.newTicketId
  const reload = useCallback(async message => {
    const [nextTickets, nextConfig] = await Promise.all([api('/tickets'), api('/config')])
    setTickets(nextTickets); setConfig(nextConfig); if (message) setNotice(message)
  }, [])
  useEffect(() => {
    if (!user) { if (!authLoading) setLoading(false); return }
    setLoading(true); reload().catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [user, authLoading, reload])
  if (authLoading) return <Loading />
  if (!user) return <SignInPrompt title="Đăng nhập để xem vé của bạn" from="/tickets" />
  const upcoming = ticket => ['paid', 'held', 'checked_in'].includes(ticket.status) && new Date(ticket.departureTime) >= new Date()
  const shown = tickets
    .filter(ticket => filter === 'all' || (filter === 'upcoming' ? upcoming(ticket) : !upcoming(ticket)))
    .sort((a, b) => {
      if (String(a.id) === String(newTicketId)) return -1
      if (String(b.id) === String(newTicketId)) return 1
      return new Date(b.createdAt || b.departureTime) - new Date(a.createdAt || a.departureTime)
    })
  return <div className="passenger-page stack"><div className="page-heading row spread"><div><span className="eyebrow">HÀNH TRÌNH CỦA BẠN</span><h1>Vé của tôi</h1><p className="muted">Vé điện tử, hóa đơn và thông tin chuyến đi ở cùng một nơi.</p></div><Link className="btn btn-primary" to="/">+ Đặt vé mới</Link></div>{notice && <div className="alert alert-success ticket-success-celebration" role="status"><Mascot size="notice" decorative/><div><strong>🎉 Đặt vé thành công!</strong><span>{notice}</span></div></div>}<ErrorMessage error={error} /><div className="passenger-tabs" role="group" aria-label="Lọc vé">{[['upcoming', 'Sắp khởi hành'], ['history', 'Lịch sử'], ['all', 'Tất cả vé']].map(([value, label]) => <button className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)} key={value}>{label}{value === 'all' && <span>{tickets.length}</span>}</button>)}</div>{loading ? <Loading /> : shown.length ? <div className="ticket-list">{shown.map(ticket => <TicketCard key={ticket.id} ticket={ticket} config={config} onUpdate={reload} isNew={String(ticket.id) === String(newTicketId)} />)}</div> : <div className="card empty-state"><div className="passenger-empty-symbol">▤</div><h2>Chưa có vé trong danh sách này</h2><p className="muted">Tìm một chuyến xe phù hợp để bắt đầu hành trình.</p><Link className="btn btn-primary" to="/">Tìm chuyến xe</Link></div>}</div>
}
