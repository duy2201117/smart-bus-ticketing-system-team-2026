import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, money } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { date, ErrorMessage, Loading, SignInPrompt, Status } from './shared'

const requestId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`

export default function PassesPage() {
  const { user, loading: authLoading } = useAuth()
  const [routes, setRoutes] = useState([])
  const [passes, setPasses] = useState([])
  const [config, setConfig] = useState(null)
  const [routeId, setRouteId] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState(null)
  const reload = useCallback(async () => {
    const [nextRoutes, nextConfig, nextPasses] = await Promise.all([api('/routes'), api('/config'), user ? api('/passes') : Promise.resolve([])])
    setRoutes(nextRoutes); setConfig(nextConfig); setPasses(nextPasses)
  }, [user])
  useEffect(() => {
    if (authLoading) return
    setLoading(true); reload().catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [reload, authLoading])
  async function purchase() {
    setError(''); setNotice(''); setPending('purchase')
    try { const pass = await api('/passes', { method: 'POST', body: { routeId, idempotencyKey: requestId() } }); setNotice(`Đã tạo vé tháng qua thanh toán mô phỏng. Giá xác nhận: ${money(pass.price)}.`); setConfirm(null); await reload() }
    catch (e) { setError(e.message) }
    finally { setPending('') }
  }
  async function renew(passId) {
    setError(''); setNotice(''); setPending(String(passId))
    try { await api(`/passes/${passId}/renew`, { method: 'POST', body: { idempotencyKey: requestId() } }); setNotice('Đã gia hạn vé thêm 30 ngày qua thanh toán mô phỏng.'); setConfirm(null); await reload() }
    catch (e) { setError(e.message) }
    finally { setPending('') }
  }
  const selected = routes.find(route => String(route.id) === String(routeId))
  const canPay = config?.paymentMode === 'sandbox'
  return <div className="passenger-page stack"><div className="page-heading"><span className="eyebrow">ĐỒNG HÀNH DÀI LÂU</span><h1>Đi mỗi ngày, chọn vé tháng</h1><p className="muted">Đăng ký theo tuyến và chủ động gia hạn thời gian sử dụng.</p></div><ErrorMessage error={error} />{notice && <div className="alert alert-success" role="status">{notice}</div>}{loading ? <Loading /> : <div className="passenger-booking-grid"><section className="stack"><div className="pass-card-preview"><div className="row spread"><span>SMARTBUS / MONTHLY PASS</span><span>30 NGÀY</span></div><div><small>ĐI LẠI THUẬN TIỆN</small><h2>Một tấm vé.<br />Nhiều hành trình.</h2></div><div className="row spread"><span>{user?.name || 'VÉ THÁNG CỦA BẠN'}</span><span aria-hidden="true">▦</span></div></div><div className="card stack"><h2>Vé tháng của tôi</h2>{!user ? <SignInPrompt title="Đăng nhập để quản lý vé tháng" from="/passes" /> : !passes.length ? <div className="empty-state"><p className="muted">Bạn chưa có vé tháng. Chọn tuyến phù hợp để bắt đầu.</p></div> : passes.map(pass => <article className="monthly-pass-item" key={pass.id}><div className="row spread"><h3>{pass.routeName}</h3><Status value={new Date(pass.endDate) <= new Date() ? 'expired' : pass.status} /></div><div className="summary-row"><span>Thời hạn</span><strong>{date(pass.startDate)} → {date(pass.endDate)}</strong></div><div className="summary-row"><span>Giá vé</span><strong>{money(pass.price)}</strong></div><div className="row spread"><span className="muted">Mã vé tháng <strong>{pass.code || pass.id}</strong></span><button className="btn btn-secondary" disabled={Boolean(pending) || !canPay} onClick={() => setConfirm({ type: 'renew', pass })}>Gia hạn 30 ngày</button></div>{confirm?.type === 'renew' && confirm.pass.id === pass.id && <div className="alert stack"><p>Gia hạn thêm 30 ngày từ ngày hết hạn hiện tại hoặc từ hôm nay nếu vé đã hết hạn. Giao dịch mô phỏng, không thu tiền thật.</p><div className="row"><button className="btn btn-primary" disabled={Boolean(pending)} onClick={() => renew(pass.id)}>{pending ? 'Đang xử lý…' : 'Xác nhận gia hạn mô phỏng'}</button><button className="btn btn-secondary" disabled={Boolean(pending)} onClick={() => setConfirm(null)}>Quay lại</button></div></div>}</article>)}</div></section><aside className="stack"><form className="card stack" onSubmit={e => { e.preventDefault(); setConfirm({ type: 'purchase' }) }}><span className="eyebrow">ĐĂNG KÝ TRỰC TUYẾN</span><h2>Chọn tuyến của bạn</h2><div className="field"><label htmlFor="pass-route">Tuyến xe</label><select className="input" required id="pass-route" value={routeId} disabled={Boolean(pending)} onChange={e => { setRouteId(e.target.value); setConfirm(null) }}><option value="">Chọn tuyến đăng ký</option>{routes.map(route => <option key={route.id} value={route.id}>{route.code} · {route.name}</option>)}</select></div>{selected && <><div className="summary-row"><span>Thời gian sử dụng</span><strong>30 ngày</strong></div><div className="summary-row"><span>Giá niêm yết (20 lượt)</span><strong>{money(selected.price * 20)}</strong></div>{user?.discountStatus === 'approved' && <div className="alert">Tài khoản đã được duyệt ưu đãi. Mức giảm và giá cuối cùng được hệ thống xác nhận khi đăng ký.</div>}</>}<div className="alert"><strong>{canPay ? 'Đăng ký bằng thanh toán mô phỏng' : 'Thanh toán chưa được cấu hình'}</strong><p>{canPay ? 'Không thu tiền thật. Vé được lưu vào tài khoản để sử dụng trong bản trình diễn.' : 'Đăng ký và gia hạn sẽ khả dụng khi cổng thanh toán được cấu hình.'}</p></div>{user ? confirm?.type === 'purchase' ? <div className="stack"><p>Xác nhận đăng ký vé tháng tuyến <strong>{selected?.name}</strong>?</p><button type="button" className="btn btn-primary" disabled={Boolean(pending) || !canPay} onClick={purchase}>{pending ? 'Đang đăng ký…' : 'Xác nhận đăng ký mô phỏng'}</button><button type="button" className="btn btn-secondary" disabled={Boolean(pending)} onClick={() => setConfirm(null)}>Quay lại</button></div> : <button className="btn btn-primary" disabled={!routeId || Boolean(pending) || !canPay}>Đăng ký vé tháng →</button> : <Link to="/login" state={{ from: '/passes' }} className="btn btn-primary">Đăng nhập để đăng ký</Link>}</form><div className="card passenger-note"><h3>Ưu đãi theo đối tượng</h3><p className="muted">Học sinh, sinh viên và người cao tuổi có thể gửi hồ sơ để quản lý xét duyệt chính sách ưu đãi.</p><Link className="passenger-text-link" to="/support">Gửi hồ sơ ưu đãi →</Link></div></aside></div>}</div>
}
