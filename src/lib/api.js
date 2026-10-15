export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { ...options, credentials: 'include', headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const data = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : null;
  if (!response.ok) { const error = new Error(data?.message || `Không thể thực hiện yêu cầu (${response.status}).`); error.status = response.status; throw error; }
  if (!data && response.status !== 204) throw new Error('API chưa sẵn sàng. Vui lòng kiểm tra backend.');
  return data;
}
export async function download(path, filename) {
  const response = await fetch(`/api${path}`, { credentials: 'include' });
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || 'Không thể tải tài liệu.'); }
  const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value) || 0);
export const dateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa cập nhật';
const labels = { held: 'Đang giữ chỗ', paid: 'Đã thanh toán', checked_in: 'Đã soát vé', cancelled: 'Đã hủy', expired: 'Hết hạn', scheduled: 'Sắp khởi hành', running: 'Đang di chuyển', completed: 'Hoàn thành', active: 'Hoạt động', maintenance: 'Bảo dưỡng', none: 'Chưa yêu cầu', pending: 'Chờ xử lý', approved: 'Đã duyệt', rejected: 'Từ chối', refunded: 'Đã hoàn tiền', failed: 'Thất bại', open: 'Chờ phản hồi', resolved: 'Đã phản hồi', passenger: 'Hành khách', driver: 'Tài xế', manager: 'Quản lý', admin: 'Quản trị viên', student: 'Sinh viên', pupil: 'Học sinh', senior: 'Người cao tuổi', gps: 'GPS từ tài xế', simulation: 'Mô phỏng GPS', sandbox: 'Sandbox', demo: 'Dữ liệu demo' };
export const statusLabel = (status) => labels[status] || status || '—';
