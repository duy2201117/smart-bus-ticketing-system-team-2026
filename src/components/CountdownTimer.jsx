import { useEffect, useState } from 'react';
import useCountdown from '../hooks/useCountdown';
import Mascot from './Mascot';

function CountdownTimer({ seat, onExpired, onPaymentSuccess }) {
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [seatStatus, setSeatStatus] = useState('Giữ chỗ');
  const seconds = useCountdown(10, !paymentSuccess);
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  const timerState = paymentSuccess ? 'success' : seconds <= 60 ? 'urgent' : seconds <= 300 ? 'warning' : 'safe';

  useEffect(() => {
    if (seconds === 0 && !paymentSuccess) {
      setSeatStatus('Trống');
      window.alert(`Thời gian giữ ghế ${seat} đã hết. Ghế đã được trả về trạng thái trống.`);
      onExpired?.();
    }
  }, [seconds, paymentSuccess, seat, onExpired]);

  const handlePayment = () => {
    if (seconds <= 0) { window.alert('Thời gian giữ chỗ đã hết. Không thể thanh toán.'); return; }
    setPaymentSuccess(true); setSeatStatus('Đã thanh toán'); onPaymentSuccess?.();
    window.alert(`Thanh toán thành công ghế ${seat}! Countdown đã dừng.`);
  };

  return <section className="card legacy-countdown-card">
    <div className="row spread"><div><span className="eyebrow">⏱️ GIỮ GHẾ CHO BẠN</span><h2>Thời gian giữ chỗ</h2></div><Mascot size="notice" decorative/></div>
    <p>Ghế: <strong>{seat}</strong></p>
    <div className={`legacy-timer legacy-timer-${timerState}`}><strong>{minutes}:{remain.toString().padStart(2,'0')}</strong><span>{paymentSuccess ? 'Đã xác nhận 🎉' : 'Bubu đang giữ ghế cho bạn'}</span></div>
    <p>Trạng thái ghế: <strong>{seatStatus}</strong></p>
    {!paymentSuccess ? <><p className="muted">Vui lòng hoàn tất thanh toán trước khi thời gian giữ chỗ kết thúc.</p><button type="button" className="btn btn-primary" onClick={handlePayment} disabled={seconds <= 0}>💳 Thanh toán thành công</button></> : <div className="alert alert-success"><strong>✓ Thanh toán thành công</strong><p>Ghế {seat} đã được xác nhận.</p></div>}
  </section>;
}

export default CountdownTimer;
