import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { money, statusLabel } from '../../lib/api'
import './passenger.css'
import Mascot from '../../components/Mascot'

export function localDate(value = new Date()) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function time(value) {
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export function date(value) {
  return new Date(value).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function Status({ value }) {
  return <span className={`badge passenger-status status-${value}`}>{statusLabel(value)}</span>
}

export function ErrorMessage({ error }) {
  return error ? <div className="alert alert-error kawaii-error" role="alert"><span className="state-emoji" aria-hidden="true">🚌😢</span><span>{error}</span></div> : null
}

export function Loading({ children = 'Đang tải dữ liệu…' }) {
  return <div className="passenger-loading kawaii-loading" role="status"><Mascot size="loading" decorative/><div><span className="passenger-spinner" />{children}</div></div>
}

export function SignInPrompt({ title = 'Đăng nhập để tiếp tục', from }) {
  return <div className="card empty-state kawaii-empty"><Mascot size="state" decorative/><h2>{title}</h2><p className="muted">Quản lý hành trình và vé của bạn trong một tài khoản.</p><Link className="btn btn-primary" to="/login" state={{ from }}>🎀 Đăng nhập</Link></div>
}

export function SeatGrid({ seats = [], selected, onSelect, disabled = false, ownSeat }) {
  return <div className="seat-layout">
    <div className="seat-bus-front"><span>🚌 FRONT · CỬA LÊN</span><span aria-label="Vị trí tài xế">😊</span></div>
    <div className="seat-grid">{seats.map(({ seat, status }) => {
      const isOwn = String(seat) === String(ownSeat)
      const isSelected = String(seat) === String(selected)
      const available = status === 'available' || isOwn
      return <button type="button" key={seat} className={`seat ${isSelected ? 'seat-selected' : ''} ${!available ? 'seat-unavailable' : ''} ${isOwn ? 'seat-own' : ''}`} disabled={disabled || !available} onClick={() => onSelect(seat)} aria-pressed={isSelected} aria-label={`Ghế ${seat}, ${isOwn ? 'đang giữ cho bạn' : available ? 'còn trống' : 'đã có người đặt'}`}><span className="seat-icon" aria-hidden="true">💺</span>{seat}</button>
    })}</div>
    <div className="seat-legend"><span><i />Còn trống</span><span><i className="selected" />Đang chọn</span><span><i className="unavailable" />Đã đặt</span></div>
  </div>
}

export function Countdown({ expiresAt, onExpired }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()))
  useEffect(() => {
    let notified = false
    const update = () => {
      const left = Math.max(0, new Date(expiresAt).getTime() - Date.now())
      setRemaining(left)
      if (left === 0 && !notified) { notified = true; onExpired?.() }
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [expiresAt, onExpired])
  const seconds = Math.ceil(remaining / 1000)
  return <span className={`hold-countdown ${seconds < 60 ? 'urgent' : ''}`} aria-label="Thời gian giữ ghế còn lại">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>
}

export function JourneyLine({ trip }) {
  return <div className="journey-line"><div><strong>{time(trip.departureTime)}</strong><span>{trip.origin}</span></div><div className="journey-connector"><span>●</span><i /><span>○</span></div><div><strong>{time(trip.arrivalTime)}</strong><span>{trip.destination}</span></div></div>
}

export function TripCard({ trip, action }) {
  return <article className="card trip-card"><div className="trip-card-top"><span className="route-code">{trip.routeCode || 'BUS'}</span><div><h3>{trip.routeName}</h3><p className="muted">{date(trip.departureTime)} · {trip.plate}</p></div><Status value={trip.status} /></div><JourneyLine trip={trip} /><div className="trip-card-footer"><span className="muted">{trip.availableSeats} ghế còn trống</span><div className="trip-card-price"><strong>{money(trip.price)}</strong>{action || <Link className="btn btn-primary" to={`/booking/${trip.id}`}>Chọn ghế <span aria-hidden="true">↗</span></Link>}</div></div></article>
}
