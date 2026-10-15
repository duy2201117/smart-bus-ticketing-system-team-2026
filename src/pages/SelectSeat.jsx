import { useState } from 'react';
import Navbar from '../components/Navbar';
import CountdownTimer from '../components/CountdownTimer';

function SelectSeat() {
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [holdStarted, setHoldStarted] = useState(false);
  const seats = ['A01','A02','A03','A04','B01','B02','B03','B04'];

  const handleSelectSeat = (seat) => { if (!holdStarted) setSelectedSeat(seat); };
  const handleStartHold = () => { if (!selectedSeat) { window.alert('Vui lòng chọn ghế trước khi tiếp tục.'); return; } setHoldStarted(true); };
  const handleHoldExpired = () => { setHoldStarted(false); setSelectedSeat(null); };
  const handlePaymentSuccess = () => { setHoldStarted(true); };

  return (
    <>
      <Navbar />
      <div className="container stack">
        <header className="page-heading"><span className="eyebrow">💺 CHỌN CHỖ NGỒI CỦA BẠN</span><h1>Chọn ghế</h1><p className="muted">Một chỗ ngồi xinh xắn đang chờ bạn trên BubuBus.</p></header>
        {!holdStarted ? <>
          <section className="card">
            <h2>🚌 Sơ đồ ghế</h2>
            <p className="muted">Vui lòng chọn một ghế để bắt đầu phiên giữ chỗ.</p>
            <div className="legacy-seat-grid">{seats.map((seat) => <button key={seat} type="button" onClick={() => handleSelectSeat(seat)} className={`legacy-seat ${selectedSeat === seat ? 'selected' : ''}`}>💺 {seat}</button>)}</div>
          </section>
          <section className="card row spread wrap"><p>Ghế đã chọn: <strong>{selectedSeat || 'Chưa chọn ghế'}</strong></p><button type="button" className="btn btn-primary" onClick={handleStartHold} disabled={!selectedSeat}>Giữ ghế và tiếp tục thanh toán</button></section>
        </> : <>
          <section className="card alert alert-success"><strong>✨ Ghế đang giữ: {selectedSeat}</strong></section>
          <CountdownTimer seat={selectedSeat} onExpired={handleHoldExpired} onPaymentSuccess={handlePaymentSuccess}/>
        </>}
      </div>
    </>
  );
}

export default SelectSeat;
