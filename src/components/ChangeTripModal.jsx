import { useEffect, useState } from 'react';
import { getAvailableTrips } from '../services/ticketService';
import Mascot from './Mascot';

function ChangeTripModal({ open, onClose, onConfirm }) {
  const [newTrip, setNewTrip] = useState('');
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNewTrip('');
    const loadTrips = async () => {
      try { setLoading(true); setTrips(await getAvailableTrips()); }
      catch { setTrips([]); }
      finally { setLoading(false); }
    };
    loadTrips();
  }, [open]);

  if (!open) return null;
  const selectedTrip = trips.find((trip) => trip.route === newTrip);
  const handleConfirm = () => {
    if (!newTrip) { window.alert('Vui lòng chọn chuyến mới.'); return; }
    if (selectedTrip && selectedTrip.availableSeats <= 0) { window.alert('Chuyến này đã hết ghế. Vui lòng chọn chuyến khác.'); return; }
    onConfirm(newTrip);
  };

  return (
    <div className="legacy-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="legacy-kawaii-modal legacy-change-modal" role="dialog" aria-modal="true" aria-labelledby="change-trip-title">
        <Mascot size="notice" decorative />
        <div className="legacy-modal-copy">
          <span className="eyebrow">ĐỔI HÀNH TRÌNH</span>
          <h3 id="change-trip-title">Chọn chuyến xe mới</h3>
          {loading ? <div className="legacy-inline-loading">🚌💨 Đang tải danh sách chuyến...</div> : <>
            <label className="field">Chuyến mới
              <select className="input" value={newTrip} onChange={(e) => setNewTrip(e.target.value)}>
                <option value="">-- Chọn chuyến --</option>
                {trips.map((trip) => <option key={trip.id} value={trip.route}>{trip.route} · Còn {trip.availableSeats} ghế</option>)}
              </select>
            </label>
            {selectedTrip && <div className={`legacy-trip-availability ${selectedTrip.availableSeats > 0 ? 'available' : 'soldout'}`}>
              {selectedTrip.availableSeats > 0 ? <>✨ Còn <strong>{selectedTrip.availableSeats}</strong> ghế trống.</> : <>😢 Chuyến này đã hết ghế.</>}
            </div>}
          </>}
          <div className="legacy-modal-actions">
            <button className="btn btn-primary" onClick={handleConfirm} disabled={loading || !newTrip || selectedTrip?.availableSeats <= 0}>Xác nhận đổi chuyến</button>
            <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ChangeTripModal;
