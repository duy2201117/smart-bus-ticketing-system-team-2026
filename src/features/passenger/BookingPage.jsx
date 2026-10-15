import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, money } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { Countdown, date, ErrorMessage, JourneyLine, Loading, SeatGrid, SignInPrompt } from './shared'

export default function BookingPage() {
  const { tripId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const [hold, setHold] = useState(null)
  const [selected, setSelected] = useState(null)
  const [voucher, setVoucher] = useState('')
  const [vouchers, setVouchers] = useState([])
  const [method, setMethod] = useState('momo')
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [expired, setExpired] = useState(false)
  const reload = useCallback(async () => {
    const [nextTrip, nextConfig, tickets, activeVouchers] = await Promise.all([api(`/trips/${tripId}`), api('/config'), user ? api('/tickets') : Promise.resolve([]), api('/vouchers/active').catch(() => [])])
    const existing = tickets.find(ticket => String(ticket.tripId) === String(tripId) && ticket.status === 'held' && new Date(ticket.holdExpiresAt) > new Date())
    setTrip(nextTrip); setConfig(nextConfig); setHold(existing || null); setVouchers(Array.isArray(activeVouchers) ? activeVouchers : [])
    if (existing) { setSelected(existing.seat); setExpired(false) }
  }, [tripId, user])
  useEffect(() => {
    if (authLoading) return
    let active = true
    setLoading(true)
    reload().catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload, authLoading])
  const expire = useCallback(() => { setExpired(true); setNotice('Thời gian giữ ghế đã hết. Vui lòng chọn ghế lại để tiếp tục.'); api(`/trips/${tripId}`).then(setTrip).catch(e => setError(e.message)) }, [tripId])
  async function reserve(e) {
    e.preventDefault(); setError(''); setNotice(''); setPending(true)
    try {
      const ticket = await api('/holds', { method: 'POST', body: { tripId, seat: selected, ...(voucher.trim() ? { voucherCode: voucher.trim() } : {}) } })
      setHold(ticket); setExpired(false)
      setTrip(await api(`/trips/${tripId}`))
    } catch (e) { setError(e.message); api(`/trips/${tripId}`).then(setTrip).catch(() => {}) }
    finally { setPending(false) }
  }
  async function release() {
    setPending(true); setError('')
    try { await api(`/holds/${hold.id}/release`, { method: 'POST' }); setHold(null); setSelected(null); setExpired(false); setNotice('Đã trả ghế về danh sách còn trống.'); setTrip(await api(`/trips/${tripId}`)) }
    catch (e) { setError(e.message) }
    finally { setPending(false) }
  }
  async function pay(outcome) {
    setPending(true); setError(''); setNotice('')
    try {
      const result = await api('/payments', { method: 'POST', body: { ticketId: hold.id, method, outcome } })
      if (result.ticket?.status === 'paid') { navigate('/tickets', { state: { message: result.message || 'Thanh toán mô phỏng thành công. Vé của bạn đã được tạo.', newTicketId: result.ticket.id } }); return }
      setNotice(result.message || 'Giao dịch chưa hoàn tất. Vui lòng kiểm tra lại vé.'); await reload()
    } catch (e) { setError(e.message); await reload().catch(() => {}) }
    finally { setPending(false) }
  }
  if (loading || authLoading) return <Loading>Đang tải sơ đồ ghế…</Loading>
  if (!trip) return <div className="stack"><ErrorMessage error={error} /><Link to="/" className="btn btn-secondary">Quay về tìm chuyến</Link></div>
  const activeHold = hold && !expired
  const bookingOpen = trip.status === 'scheduled' && new Date(trip.departureTime) > new Date()
  return <div className="passenger-page stack"><div className="page-heading"><Link to="/" className="passenger-text-link">← Tìm chuyến xe</Link><span className="eyebrow">ĐẶT VÉ SMARTBUS</span><h1>Chọn chỗ cho hành trình của bạn</h1><p className="muted">{trip.routeName} · {date(trip.departureTime)}</p></div><div className="booking-progress" aria-label="Các bước đặt vé"><span className={activeHold ? 'complete' : 'current'}>1. Chọn ghế</span><i /><span className={activeHold ? 'current' : ''}>2. Thanh toán</span><i /><span>3. Nhận vé QR</span></div><ErrorMessage error={error} />{notice && <div className="alert" role="status">{notice}</div>}{!bookingOpen && <div className="alert alert-error">Chuyến xe đã đóng đặt vé. Vui lòng chọn chuyến khác.</div>}
    <div className="passenger-booking-grid"><section className="card seat-panel"><div className="row spread"><div><h2>Sơ đồ chỗ ngồi</h2><p className="muted">Xe {trip.plate} · {trip.seatCount} ghế</p></div><span className="route-code">{trip.routeCode}</span></div><SeatGrid seats={trip.seats} selected={selected} onSelect={setSelected} disabled={pending || Boolean(activeHold) || !bookingOpen} ownSeat={activeHold ? hold.seat : undefined} /><p className="muted passenger-footnote">Sơ đồ minh họa thứ tự ghế. Ghế được xác nhận khi hệ thống tạo giữ chỗ thành công.</p></section>
    <aside className="stack"><section className="card booking-summary"><span className="eyebrow">THÔNG TIN HÀNH TRÌNH</span><h2>{trip.routeName}</h2><JourneyLine trip={trip} /><p className="muted">{date(trip.departureTime)} · Biển số {trip.plate}</p><div className="summary-row"><span>Ghế đã chọn</span><strong>{selected || 'Chưa chọn'}</strong></div><div className="summary-row"><span>Giá vé niêm yết</span><strong>{money(trip.price)}</strong></div>{activeHold && <><div className="summary-row"><span>Giá sau ưu đãi</span><strong>{money(hold.price)}</strong></div><div className="hold-notice"><div><strong>Ghế {hold.seat} đang được giữ</strong><small>Hoàn tất thanh toán trước khi hết giờ</small></div><Countdown expiresAt={hold.holdExpiresAt} onExpired={expire} /></div></>}
      {!user ? <SignInPrompt title="Đăng nhập để giữ ghế" from={`/booking/${tripId}`} /> : !activeHold ? <form className="stack" onSubmit={reserve}><div className="field"><label htmlFor="booking-voucher">Mã ưu đãi (nếu có)</label><input className="input" id="booking-voucher" autoComplete="off" value={voucher} maxLength={50} placeholder="Nhập mã giảm giá" onChange={e => setVoucher(e.target.value.toUpperCase())} disabled={pending} />{vouchers.length > 0 && <select className="input booking-voucher-select" aria-label="Chọn mã ưu đãi có sẵn" value={vouchers.some(item => item.code === voucher) ? voucher : ''} onChange={e => setVoucher(e.target.value)} disabled={pending}><option value="">— Chọn nhanh mã ưu đãi —</option>{vouchers.map(item => { const discount = item.type === 'fixed' ? `Giảm ${money(item.value)}` : `Giảm ${item.value || item.percent}%${Number(item.maxDiscount) > 0 ? ` · tối đa ${money(item.maxDiscount)}` : ''}`; const condition = Number(item.minAmount) > 0 ? ` · đơn từ ${money(item.minAmount)}` : ''; return <option key={item.code} value={item.code}>{item.code} — {discount}{condition}</option> })}</select>}<small className="muted">Bạn có thể nhập mã hoặc chọn nhanh mã đang còn hiệu lực. Giá ưu đãi được xác nhận khi giữ ghế.</small></div><button type="submit" className="btn btn-primary" disabled={!selected || pending || !bookingOpen}>{pending ? 'Đang giữ ghế…' : `Giữ ghế ${selected || ''} trong 10 phút →`}</button></form> : <div className="stack"><div className="summary-row summary-total"><span>Tổng thanh toán</span><strong>{money(hold.price)}</strong></div><div className="alert"><strong>{config?.paymentMode === 'sandbox' ? 'Thanh toán mô phỏng' : 'Thanh toán chưa khả dụng'}</strong><p>{config?.paymentMode === 'sandbox' ? 'Chức năng phục vụ trình diễn. Chưa kết nối ví điện tử hoặc ngân hàng và không thu tiền thật.' : 'Cổng thanh toán chưa được cấu hình. Bạn có thể trả ghế hoặc quay lại sau.'}</p></div><fieldset className="payment-methods" disabled={pending || config?.paymentMode !== 'sandbox'}><legend>Phương thức mô phỏng</legend>{[['momo', 'MoMo'], ['vnpay', 'VNPay'], ['zalopay', 'ZaloPay'], ['bank', 'Thẻ ngân hàng']].map(([value, label]) => <label className={method === value ? 'selected' : ''} key={value}><input type="radio" name="paymentMethod" checked={method === value} onChange={() => setMethod(value)} />{label}</label>)}</fieldset><button className="btn btn-primary" disabled={pending || config?.paymentMode !== 'sandbox'} onClick={() => pay('success')}>{pending ? 'Đang xử lý…' : `Mô phỏng thanh toán ${money(hold.price)}`}</button>{config?.paymentMode === 'sandbox' && <><button className="passenger-text-button" disabled={pending} onClick={() => pay('pending')}>Thử giao dịch đang xử lý</button><button className="passenger-text-button" disabled={pending} onClick={() => pay('failed')}>Thử giao dịch thất bại</button></>}<button className="btn btn-secondary" disabled={pending} onClick={release}>Trả ghế và chọn lại</button></div>}
    </section><div className="card passenger-note"><strong>Hành trình thuận tiện</strong><p className="muted">Vé QR được cấp sau khi thanh toán thành công. Bạn có thể xem vé, yêu cầu đổi chuyến và hủy vé tại mục Vé của tôi.</p>{config?.refundPolicy && <p className="muted">{config.refundPolicy}</p>}</div></aside></div>
  </div>
}
