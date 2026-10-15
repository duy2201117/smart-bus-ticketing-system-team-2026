import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, dateTime } from '../../lib/api'
import { date, ErrorMessage, Loading, localDate, Status, time } from './shared'
import 'leaflet/dist/leaflet.css'

function RouteMap({ trip }) {
  const element = useRef(null)
  const map = useRef(null)
  const layers = useRef(null)
  const leaflet = useRef(null)
  const fittedTrip = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    import('leaflet').then(module => {
      if (!active || !element.current) return
      const L = module.default || module
      leaflet.current = L
      map.current = L.map(element.current, { scrollWheelZoom: false }).setView([21.1, 105.83], 9)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map.current)
      layers.current = L.layerGroup().addTo(map.current)
      setReady(true)
    }).catch(() => setError('Không thể tải thư viện bản đồ. Hãy tải lại trang.'))
    return () => { active = false; map.current?.remove(); map.current = null }
  }, [])
  useEffect(() => {
    if (!ready || !map.current) return
    const L = leaflet.current
    layers.current.clearLayers()
    if (!trip) return
    const validCoordinate = point => point.lat != null && point.lng != null && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng))
    const stops = [...(trip.stops || [])].sort((a, b) => a.stopOrder - b.stopOrder).filter(validCoordinate)
    const bounds = stops.map(stop => [Number(stop.lat), Number(stop.lng)])
    if (bounds.length > 1) L.polyline(bounds, { color: '#65D5E5', weight: 5, opacity: 0.82, dashArray: '9 8' }).addTo(layers.current)
    stops.forEach((stop, index) => {
      const marker = L.circleMarker([Number(stop.lat), Number(stop.lng)], { color: '#65D5E5', fillColor: '#FFF8E8', fillOpacity: 1, weight: 3, radius: 8 }).addTo(layers.current)
      const label = document.createElement('div'); label.textContent = `${index + 1}. ${stop.name}`; marker.bindPopup(label)
    })
    if (validCoordinate(trip)) {
      const position = [Number(trip.lat), Number(trip.lng)]
      bounds.push(position)
      const isGps = trip.locationSource === 'gps'
      const marker = L.marker(position, { icon: L.divIcon({ className: 'bus-map-marker', html: `<span class="${isGps ? '' : 'sample'}"><img src="/bubu-bus.png" alt="" /></span>`, iconSize: [56, 50], iconAnchor: [28, 25] }) }).addTo(layers.current)
      const label = document.createElement('div'); label.textContent = `Xe ${trip.plate} · ${isGps ? 'Vị trí GPS gần nhất' : 'Vị trí mẫu, chưa có GPS trực tiếp'}`; marker.bindPopup(label)
    }
    if (bounds.length && fittedTrip.current !== trip.id) { map.current.fitBounds(bounds, { padding: [42, 42], maxZoom: 14 }); fittedTrip.current = trip.id }
    map.current.invalidateSize()
  }, [trip, ready])
  return <div className="tracking-map-wrap"><div ref={element} className="tracking-map" aria-label="Bản đồ tuyến xe, trạm dừng và vị trí xe gần nhất" />{error && <div className="map-overlay alert alert-error" role="alert">{error}</div>}{!ready && !error && <div className="map-overlay"><Loading>Đang tải bản đồ…</Loading></div>}</div>
}

export default function TrackingPage() {
  const [params, setParams] = useSearchParams()
  const tripId = params.get('tripId') || ''
  const [departureDate, setDepartureDate] = useState(localDate())
  const [trips, setTrips] = useState([])
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tripLoading, setTripLoading] = useState(false)
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')
  const [lastFetched, setLastFetched] = useState(null)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    api(`/trips?date=${departureDate}`).then(data => { if (active) setTrips(data) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [departureDate])
  useEffect(() => {
    if (!tripId) { setTrip(null); return }
    let active = true
    let timer
    setTrip(null); setTripLoading(true); setPollError(''); setLastFetched(null)
    const update = async () => {
      try { const next = await api(`/trips/${tripId}`); if (active) { setTrip(next); setPollError(''); setLastFetched(new Date()) } }
      catch (e) { if (active) setPollError(e.message) }
      finally { if (active) { setTripLoading(false); timer = setTimeout(update, 5000) } }
    }
    update()
    return () => { active = false; clearTimeout(timer) }
  }, [tripId])
  const locationAge = trip?.locationUpdatedAt ? Math.max(0, Math.floor((Date.now() - new Date(trip.locationUpdatedAt)) / 1000)) : null
  const live = trip?.locationSource === 'gps' && locationAge !== null && locationAge < 90 && !pollError
  const options = trip && !trips.some(item => String(item.id) === String(trip.id)) ? [trip, ...trips] : trips
  return <div className="passenger-page stack"><div className="page-heading"><span className="eyebrow">CHỦ ĐỘNG MỖI HÀNH TRÌNH</span><h1>Theo dõi chuyến xe</h1><p className="muted">Xem trạm dừng và vị trí gần nhất do tài xế chia sẻ. Dữ liệu được kiểm tra mỗi 5 giây.</p></div><div className="card form-grid"><div className="field"><label htmlFor="tracking-date">Ngày khởi hành</label><input className="input" id="tracking-date" type="date" value={departureDate} onChange={e => { setDepartureDate(e.target.value); setParams({}) }} /></div><div className="field"><label htmlFor="tracking-trip">Chọn chuyến theo dõi</label><select className="input" id="tracking-trip" value={tripId} onChange={e => setParams(e.target.value ? { tripId: e.target.value } : {})} disabled={loading}><option value="">{loading ? 'Đang tải chuyến…' : 'Chọn một chuyến xe'}</option>{options.map(item => <option key={item.id} value={item.id}>{item.routeCode} · {time(item.departureTime)} · {item.routeName} · {item.plate}</option>)}</select></div></div><ErrorMessage error={error} /><ErrorMessage error={pollError ? `Không thể cập nhật vị trí: ${pollError}. Đang tự thử lại; thông tin hiển thị có thể đã cũ.` : ''} />
    <div className="passenger-tracking-grid"><section className="card tracking-map-card"><div className="row spread tracking-map-heading"><div><h2>{trip?.routeName || 'Bản đồ hành trình'}</h2><span className="muted">Đường nối trạm chỉ để tham khảo, không phải chỉ dẫn đường bộ.</span></div>{trip && <span className={`location-badge ${live ? 'live' : ''}`}><i />{live ? 'Có tín hiệu GPS' : trip.locationSource === 'gps' ? 'Vị trí GPS đã cũ' : 'Vị trí mẫu / chưa có GPS'}</span>}</div><RouteMap trip={trip} /><div className="tracking-map-footer"><span>● Trạm dừng <span className="muted">&nbsp; · &nbsp; BUS Vị trí xe</span></span><span className="muted">{lastFetched ? `Kiểm tra lúc ${lastFetched.toLocaleTimeString('vi-VN')}` : 'Chọn chuyến để hiển thị dữ liệu'}</span></div></section><aside className="stack">{tripLoading ? <Loading>Đang tải hành trình…</Loading> : trip ? <><section className="card stack"><div className="row spread"><span className="route-code">{trip.routeCode}</span><Status value={trip.status} /></div><h2>{trip.plate}</h2><p className="muted">{date(trip.departureTime)} · Khởi hành {time(trip.departureTime)}</p><div className="tracking-update"><strong>{trip.locationSource === 'gps' ? 'Lần nhận GPS gần nhất' : 'Chưa nhận GPS trực tiếp'}</strong><span>{trip.locationUpdatedAt ? dateTime(trip.locationUpdatedAt) : 'Chưa có dữ liệu thời gian'}</span>{trip.locationSource !== 'gps' && <small>Vị trí hiển thị là dữ liệu mô phỏng backend khi chưa có thiết bị GPS trực tiếp.</small>}{trip.locationSource === 'gps' && !live && <small>Vị trí này có thể không phản ánh vị trí hiện tại của xe.</small>}</div><div className="tracking-update"><strong>ETA dự kiến</strong><span>{trip.etaMinutes == null ? 'Chưa đủ dữ liệu' : `${trip.etaMinutes} phút đến điểm cuối`}</span><small>{trip.nextStop ? `Trạm gần nhất: ${trip.nextStop.name}` : 'Đang xác định trạm gần nhất'}{trip.distanceKmRemaining != null ? ` · còn khoảng ${trip.distanceKmRemaining} km` : ''}</small><small>Nguồn tính: {trip.etaSource === 'gps-estimate' ? 'GPS + mô hình tốc độ trung bình' : trip.etaSource === 'simulation-estimate' ? 'GPS simulator backend + mô hình tốc độ trung bình' : 'lịch trình'}. ETA là ước tính, không thay thế chỉ đường giao thông thực tế.</small></div><Link className="passenger-text-link" to="/support">Thông báo chuyến đi của tôi →</Link></section><section className="card"><h3>Các trạm trên tuyến</h3><ol className="tracking-stops">{[...(trip.stops || [])].sort((a, b) => a.stopOrder - b.stopOrder).map((stop, index) => <li key={stop.id}><span>{index + 1}</span><div><strong>{stop.name}</strong><small>{index === 0 ? 'Điểm đầu' : index === trip.stops.length - 1 ? 'Điểm cuối' : 'Trạm dừng'}</small></div></li>)}</ol></section></> : <div className="card empty-state"><div className="passenger-empty-symbol">⌖</div><h3>Hành trình trên bản đồ</h3><p className="muted">Chọn chuyến xe để xem trạm dừng và tình trạng cập nhật vị trí.</p></div>}</aside></div></div>
}
