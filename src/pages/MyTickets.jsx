import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import CancelModal from '../components/CancelModal';
import ChangeTripModal from '../components/ChangeTripModal';
import Mascot from '../components/Mascot';
import { getMyTickets, cancelTicket, changeTicket, canCancelTicket, canChangeTicket } from '../services/ticketService';

function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [searchCode, setSearchCode] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showChange, setShowChange] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadTickets(); }, []);

  const loadTickets = async () => {
    try { setLoading(true); setError(''); setTickets(await getMyTickets()); }
    catch (err) { setError(err.message || 'Không thể tải danh sách vé.'); }
    finally { setLoading(false); }
  };

  const formatDepartureTime = (departureTime) => !departureTime ? 'Chưa xác định' : new Date(departureTime).toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric' });
  const filteredTickets = tickets.filter((ticket) => {
    if (!searchCode.trim()) return true;
    const keyword = searchCode.trim().toLowerCase();
    const ticketCode = `VE${ticket.id.toString().padStart(3,'0')}`.toLowerCase();
    return ticketCode.includes(keyword) || (ticket.electronicTicketCode?.toLowerCase() || '').includes(keyword);
  });

  const handleOpenCancel = (ticket) => {
    if (ticket.status === 'Đã hủy') { window.alert('Vé này đã được hủy.'); return; }
    if (!canCancelTicket(ticket)) { window.alert('Không thể hủy vé vì vé không còn đủ điều kiện hủy trước giờ khởi hành.'); return; }
    setSelectedTicket(ticket); setShowCancel(true);
  };
  const handleCloseCancel = () => { if (!processing) { setShowCancel(false); setSelectedTicket(null); } };
  const handleConfirmCancel = async () => {
    if (!selectedTicket) return;
    try {
      setProcessing(true); setError('');
      const result = await cancelTicket(selectedTicket.id); setTickets(await getMyTickets());
      window.alert(`Đã hủy vé VE${selectedTicket.id.toString().padStart(3,'0')}.\n\n${result.refundMessage}`);
      setShowCancel(false); setSelectedTicket(null);
    } catch (err) { setError(err.message || 'Không thể hủy vé.'); }
    finally { setProcessing(false); }
  };
  const handleOpenChange = (ticket) => {
    if (ticket.status === 'Đã hủy') { window.alert('Không thể đổi chuyến cho vé đã hủy.'); return; }
    if (!canChangeTicket(ticket)) { window.alert('Không thể đổi vé vì chuyến xe đã đến hoặc qua giờ khởi hành.'); return; }
    setSelectedTicket(ticket); setShowChange(true);
  };
  const handleCloseChange = () => { if (!processing) { setShowChange(false); setSelectedTicket(null); } };
  const handleConfirmChange = async (newTrip) => {
    if (!selectedTicket) return;
    if (!newTrip?.trim()) { window.alert('Vui lòng chọn chuyến mới.'); return; }
    try {
      setProcessing(true); setError('');
      const result = await changeTicket(selectedTicket.id,newTrip.trim()); setTickets(await getMyTickets());
      window.alert(`Đổi vé thành công!\n\nChuyến mới: ${newTrip.trim()}\nMã vé điện tử mới: ${result.electronicTicketCode}`);
      setShowChange(false); setSelectedTicket(null);
    } catch (err) { setError(err.message || 'Không thể đổi vé.'); }
    finally { setProcessing(false); }
  };

  return <>
    <Navbar />
    <div className="container stack">
      <header className="page-heading"><span className="eyebrow">🎟️ BỘ SƯU TẬP HÀNH TRÌNH</span><h1>Vé của tôi</h1><p className="muted">Tra cứu, đổi hoặc hủy vé trong một không gian gọn gàng và dễ thương.</p></header>
      <section className="card legacy-search-card"><h3>🔎 Tra cứu vé</h3><input className="input" type="text" placeholder="Nhập mã vé, ví dụ: VE001 hoặc DT..." value={searchCode} onChange={(e) => setSearchCode(e.target.value)}/></section>
      {error && <div className="alert alert-error kawaii-error" role="alert"><span className="state-emoji">🚌😢</span><span>{error}</span></div>}
      {loading ? <div className="card empty-state"><p>🚌💨 Đang tải danh sách vé...</p></div> : filteredTickets.length === 0 ? <div className="card empty-state kawaii-empty"><Mascot size="state" decorative/><h2>Bạn chưa có chuyến đi nào 🌈</h2><p className="muted">Thử tìm một chuyến mới nhé!</p></div> : <div className="legacy-ticket-grid">{filteredTickets.map((ticket) => {
        const ticketCode = `VE${ticket.id.toString().padStart(3,'0')}`;
        const isCancelled = ticket.status === 'Đã hủy';
        const allowCancel = canCancelTicket(ticket); const allowChange = canChangeTicket(ticket);
        return <article key={ticket.id} className="card legacy-ticket-card">
          <div className="row spread"><div><span className="eyebrow">VÉ {ticketCode}</span><h3>{ticket.route}</h3></div><span className="badge">{ticket.status}</span></div>
          <div className="legacy-ticket-meta"><div><span>💺 Ghế</span><strong>{ticket.seat}</strong></div><div><span>🕐 Khởi hành</span><strong>{formatDepartureTime(ticket.departureTime)}</strong></div><div><span>💰 Giá vé</span><strong>{ticket.price.toLocaleString('vi-VN')} VNĐ</strong></div><div><span>💸 Hoàn tiền</span><strong>{ticket.refundStatus}</strong></div></div>
          {ticket.electronicTicketCode && <div className="legacy-ticket-code"><span>Mã vé điện tử mới</span><br/><strong>{ticket.electronicTicketCode}</strong></div>}
          {!isCancelled && <div className={`legacy-condition ${allowCancel && allowChange ? 'ok' : 'no'}`}>{allowCancel && allowChange ? '✓ Vé còn trong thời gian cho phép hủy/đổi.' : 'Vé không còn đủ điều kiện hủy/đổi.'}</div>}
          <div className="legacy-ticket-actions"><button type="button" className="btn btn-danger" disabled={processing || !allowCancel} onClick={() => handleOpenCancel(ticket)}>{isCancelled ? 'Đã hủy' : 'Hủy vé'}</button><button type="button" className="btn btn-primary" disabled={processing || !allowChange} onClick={() => handleOpenChange(ticket)}>Đổi vé</button></div>
        </article>;
      })}</div>}
      <CancelModal open={showCancel} onClose={handleCloseCancel} onConfirm={handleConfirmCancel}/>
      <ChangeTripModal open={showChange} onClose={handleCloseChange} onConfirm={handleConfirmChange}/>
    </div>
  </>;
}

export default MyTickets;
