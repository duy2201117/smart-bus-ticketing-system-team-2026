import { useEffect, useRef, useState } from 'react';
import { api, dateTime } from '../../lib/api';
import { ErrorMessage, Loading, Status, time } from '../passenger/shared';

export default function DriverPage() {
  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState('');
  const [code, setCode] = useState('');
  const [incident, setIncident] = useState({ type: 'traffic', description: '' });
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gpsActive, setGpsActive] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const watcher = useRef(null);
  const video = useRef(null);
  const scanner = useRef(null);

  async function loadTrips() {
    try {
      const data = await api('/driver/trips');
      setTrips(data);
      setTripId(current => data.some(trip => String(trip.id) === current) ? current : String(data[0]?.id || ''));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrips();
    return () => { if (watcher.current !== null) navigator.geolocation?.clearWatch(watcher.current); };
  }, []);

  useEffect(() => {
    if (!cameraOpen) return undefined;
    let active = true;
    import('@zxing/browser').then(({ BrowserMultiFormatReader }) => {
      if (!active || !video.current) return null;
      const reader = new BrowserMultiFormatReader();
      return reader.decodeFromVideoDevice(undefined, video.current, result => {
        if (!active || !result) return;
        setCode(result.getText()); setCameraOpen(false); scanner.current?.stop();
      });
    }).then(controls => { if (active) scanner.current = controls; else controls?.stop(); }).catch(() => { if (active) { setError('Không thể mở camera. Hãy cấp quyền camera hoặc nhập mã vé.'); setCameraOpen(false); } });
    return () => { active = false; scanner.current?.stop(); scanner.current = null; };
  }, [cameraOpen]);

  const selectedTrip = trips.find(trip => String(trip.id) === tripId);
  async function submitScan(event) {
    event.preventDefault();
    setBusy(true); setError(''); setResult('');
    try {
      const data = await api('/driver/scan', { method: 'POST', body: { code: code.trim(), tripId } });
      setResult(data.message || 'Soát vé thành công.'); setCode('');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function updateStatus(status) {
    setBusy(true); setError('');
    try { await api(`/driver/trips/${tripId}/status`, { method: 'POST', body: { status } }); await loadTrips(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function submitIncident(event) {
    event.preventDefault();
    setBusy(true); setError(''); setResult('');
    try {
      await api('/driver/incidents', { method: 'POST', body: { tripId, ...incident } });
      setResult('Đã gửi thông báo sự cố đến hành khách liên quan.'); setIncident(current => ({ ...current, description: '' }));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function toggleGps() {
    if (watcher.current !== null) {
      navigator.geolocation.clearWatch(watcher.current); watcher.current = null; setGpsActive(false); setResult('Đã tắt chia sẻ vị trí GPS.'); return;
    }
    if (!navigator.geolocation || !tripId) { setError('Thiết bị hoặc trình duyệt chưa hỗ trợ GPS.'); return; }
    setError('');
    watcher.current = navigator.geolocation.watchPosition(async position => {
      try {
        await api(`/driver/trips/${tripId}/location`, { method: 'POST', body: { lat: position.coords.latitude, lng: position.coords.longitude } });
        setResult(`Đã cập nhật vị trí lúc ${new Date().toLocaleTimeString('vi-VN')}.`);
      } catch (err) { setError(err.message); }
    }, () => setError('Không thể lấy vị trí. Hãy cấp quyền GPS và thử lại.'), { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
    setGpsActive(true);
    setResult('Đang chia sẻ vị trí GPS cho chuyến được chọn.');
  }

  return <div className="passenger-page stack">
    <header className="page-heading"><span className="eyebrow">KHÔNG GIAN LÀM VIỆC</span><h1>Tác nghiệp tài xế</h1><p className="muted">Quản lý chuyến được phân công, soát vé và cập nhật tình hình trên tuyến.</p></header>
    <ErrorMessage error={error}/>{result && <div className="alert alert-success" role="status">{result}</div>}
    {loading ? <Loading>Đang tải chuyến được giao…</Loading> : <>
      {!trips.length ? <div className="empty-state card">Hiện chưa có chuyến được phân công.</div> : <>
        <section className="card stack"><div className="field"><label htmlFor="driver-trip">Chuyến đang tác nghiệp</label><select id="driver-trip" className="input" value={tripId} onChange={event => setTripId(event.target.value)}>{trips.map(trip => <option key={trip.id} value={trip.id}>{trip.routeCode} · {dateTime(trip.departureTime)} · {trip.plate}</option>)}</select></div>
          {selectedTrip && <div className="row spread"><div><h2>{selectedTrip.routeName}</h2><p className="muted">{selectedTrip.origin} → {selectedTrip.destination} · {time(selectedTrip.departureTime)}</p></div><Status value={selectedTrip.status}/></div>}
          <div className="row"><button type="button" className="btn btn-primary" disabled={busy || selectedTrip?.status !== 'scheduled'} onClick={() => updateStatus('running')}>Bắt đầu chuyến</button><button type="button" className="btn btn-secondary" disabled={busy || selectedTrip?.status !== 'running'} onClick={() => updateStatus('completed')}>Kết thúc chuyến</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={toggleGps}>{gpsActive ? 'Tắt chia sẻ GPS' : 'Bật chia sẻ GPS'}</button></div>
        </section>
        <div className="grid grid-2"><section className="card stack"><h2>Soát vé hành khách</h2><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setError(''); setCameraOpen(value => !value); }}>{cameraOpen ? 'Đóng camera' : 'Quét mã bằng camera'}</button>{cameraOpen && <div className="driver-camera"><video ref={video} autoPlay muted playsInline aria-label="Khung camera quét mã QR"/></div>}<form className="stack" onSubmit={submitScan}><label className="field">Mã vé hoặc nội dung QR<input className="input" required maxLength={200} value={code} onChange={event => setCode(event.target.value)} placeholder="SB-…" autoComplete="off"/></label><button className="btn btn-primary" disabled={busy || !tripId || !code.trim()}>{busy ? 'Đang kiểm tra…' : 'Xác nhận vé'}</button></form></section>
          <section className="card stack"><h2>Báo cáo sự cố</h2><form className="stack" onSubmit={submitIncident}><label className="field">Loại sự cố<select className="input" value={incident.type} onChange={event => setIncident({ ...incident, type: event.target.value })}><option value="traffic">Ùn tắc giao thông</option><option value="breakdown">Hỏng xe</option><option value="delay">Chậm chuyến</option><option value="incident">Sự cố</option><option value="other">Khác</option></select></label><label className="field">Thông tin<textarea className="input" required maxLength={1000} value={incident.description} onChange={event => setIncident({ ...incident, description: event.target.value })}/></label><button className="btn btn-primary" disabled={busy || !tripId}>Gửi thông báo</button></form></section></div>
      </>}
    </>}
  </div>;
}