import Mascot from './Mascot';

function CancelModal({ open, onClose, onConfirm }) {
  if (!open) return null;

  return (
    <div className="legacy-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="legacy-kawaii-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-ticket-title">
        <Mascot size="notice" decorative />
        <div className="legacy-modal-copy">
          <span className="eyebrow">XÁC NHẬN THAO TÁC</span>
          <h3 id="cancel-ticket-title">Bạn muốn hủy vé này?</h3>
          <p className="muted">Bubu sẽ gửi yêu cầu hủy và hệ thống tiếp tục xử lý chính sách hoàn tiền hiện có.</p>
          <div className="legacy-modal-actions">
            <button className="btn btn-danger" onClick={onConfirm}>Hủy vé</button>
            <button className="btn btn-secondary" onClick={onClose}>Giữ vé</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default CancelModal;
