import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, useResource, useMutation, ResourceState, Notice, Field, Table, Status, dateTime, money, localDateTime, inputChange, roles, roleName, getLatestCreatedId, setLatestCreatedId, sortLatestFirst, latestRowClass } from './shared';

export function UsersSection() {
  const { user } = useAuth();
  const resource = useResource('/admin/users');
  const mutation = useMutation(resource.refresh);
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState('');
  async function submit(event) {
    event.preventDefault();
    const body = form.id ? { role: form.role, active: form.active } : { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password, role: form.role };
    if (await mutation.perform(() => api(form.id ? `/admin/users/${form.id}` : '/admin/users', { method: form.id ? 'PATCH' : 'POST', body }), form.id ? 'Đã cập nhật quyền tài khoản.' : 'Đã tạo tài khoản.')) setForm(null);
  }
  const rows = (resource.data || []).filter(row => `${row.name} ${row.email}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
  return <div className="stack"><div className="row spread"><div><h2>Quản lý tài khoản</h2><p className="muted">Phân quyền truy cập cho hành khách, tài xế và nhân viên điều hành.</p></div><button className="btn btn-primary" type="button" onClick={() => { mutation.reset(); setForm({ name: '', email: '', password: '', role: 'passenger', phone: '' }); }}>+ Tạo tài khoản</button></div><Notice {...mutation} />
    {form && <form className="card ops-editor" onSubmit={submit}><h3>{form.id ? `Phân quyền: ${form.name}` : 'Tài khoản mới'}</h3><fieldset disabled={mutation.pending}><div className="form-grid">{!form.id && <><Field label="Họ tên" name="name" value={form.name} onChange={inputChange(setForm)} /><Field label="Email" type="email" name="email" value={form.email} onChange={inputChange(setForm)} autoComplete="off" /><Field label="Mật khẩu ban đầu" type="password" name="password" value={form.password} onChange={inputChange(setForm)} minLength={8} maxLength={128} autoComplete="new-password" help="Ít nhất 8 ký tự." /><Field label="Số điện thoại" type="tel" name="phone" value={form.phone} onChange={inputChange(setForm)} required={false} /></>}<Field label="Vai trò" name="role" value={form.role} onChange={inputChange(setForm)} options={roles} disabled={form.id === user.id} />{form.id && <label className="ops-checkbox"><input type="checkbox" checked={!!form.active} disabled={form.id === user.id} onChange={event => setForm(value => ({ ...value, active: event.target.checked }))} />Cho phép tài khoản hoạt động</label>}</div>{form.id === user.id && <p className="muted">Bạn không thể tự khóa hoặc hạ quyền tài khoản đang đăng nhập.</p>}<div className="row ops-form-actions"><button className="btn btn-primary" type="submit" disabled={mutation.pending || form.id === user.id}>{mutation.pending ? 'Đang lưu…' : 'Lưu tài khoản'}</button><button className="btn btn-secondary" type="button" onClick={() => setForm(null)}>Đóng</button></div></fieldset></form>}
    <div className="card"><Field label="Tìm tài khoản" value={search} onChange={event => setSearch(event.target.value)} required={false} placeholder="Tên hoặc email" /></div><ResourceState resource={resource}><article className="card"><Table rows={rows} columns={[{ key: 'name', label: 'Họ tên', render: row => <strong>{row.name}{row.id === user.id && ' (bạn)'}</strong> }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Vai trò', render: row => <span className="badge">{roleName(row.role)}</span> }, { key: 'active', label: 'Trạng thái', render: row => row.active ? 'Đang hoạt động' : 'Đã khóa' }, { key: 'actions', label: 'Thao tác', render: row => <button className="btn btn-secondary ops-small" type="button" disabled={mutation.pending || row.id === user.id} onClick={() => { mutation.reset(); setForm({ ...row, active: !!row.active }); }}>Phân quyền</button> }]} /></article></ResourceState>
  </div>;
}

export function DiscountsSection() {
  const resource = useResource('/admin/discounts');
  const mutation = useMutation(resource.refresh);
  const [filter, setFilter] = useState('pending');
  const [rejecting, setRejecting] = useState('');
  const [reason, setReason] = useState('');
  const rows = (resource.data || []).filter(row => !filter || row.discountStatus === filter);
  async function submitRejection(event, row) {
    event.preventDefault();
    if (await mutation.perform(() => api(`/admin/discounts/${row.id}`, { method: 'PATCH', body: { discountStatus: 'rejected', reason: reason.trim() } }), `Đã từ chối hồ sơ của ${row.name}.`)) { setRejecting(''); setReason(''); }
  }
  return <div className="stack"><div><h2>Duyệt đối tượng ưu đãi</h2><p className="muted">Kiểm tra thông tin học sinh, sinh viên và người cao tuổi trước khi áp dụng giá ưu đãi.</p></div><Notice {...mutation} /><div className="card ops-filter"><Field label="Trạng thái hồ sơ" value={filter} onChange={event => setFilter(event.target.value)} required={false} options={[{ value: 'pending', label: 'Chờ duyệt' }, { value: 'approved', label: 'Đã duyệt' }, { value: 'rejected', label: 'Từ chối' }]} /></div>
    <ResourceState resource={resource}><div className="ops-review-list">{rows.length ? rows.map(row => <article className="card" key={row.id}><div className="row spread"><div><h3>{row.name}</h3><p className="muted">{row.email}</p></div><Status value={row.discountStatus} /></div><dl className="ops-details"><div><dt>Đối tượng</dt><dd>{row.discountType === 'student' ? 'Sinh viên' : row.discountType === 'pupil' ? 'Học sinh' : row.discountType === 'senior' ? 'Người cao tuổi' : row.discountType}</dd></div><div><dt>Thông tin minh chứng</dt><dd className="ops-preserve">{row.discountEvidence || 'Chưa cung cấp'}{row.evidenceFileId && <><br/><a className="passenger-text-link" href={`/api/private-files/${row.evidenceFileId}`} target="_blank" rel="noreferrer">Xem tệp minh chứng riêng tư ({row.evidenceFileName || 'tệp đính kèm'}) →</a></>}</dd></div></dl>{row.discountStatus === 'pending' && <><div className="row"><button className="btn btn-primary" type="button" disabled={mutation.pending} onClick={() => mutation.perform(() => api(`/admin/discounts/${row.id}`, { method: 'PATCH', body: { discountStatus: 'approved' } }), `Đã duyệt ưu đãi cho ${row.name}.`)}>Duyệt hồ sơ</button><button className="btn btn-danger" type="button" disabled={mutation.pending} onClick={() => { setRejecting(row.id); setReason(''); }}>Từ chối</button></div>{rejecting === row.id && <form className="stack" onSubmit={event => submitRejection(event, row)}><Field label="Lý do từ chối" type="textarea" value={reason} onChange={event => setReason(event.target.value)} minLength={3} maxLength={1000}/><div className="row"><button className="btn btn-danger" type="submit" disabled={mutation.pending || reason.trim().length < 3}>Xác nhận từ chối</button><button className="btn btn-secondary" type="button" onClick={() => setRejecting('')}>Đóng</button></div></form>}</>}</article>) : <div className="card empty-state">Không có hồ sơ ở trạng thái này.</div>}</div></ResourceState>
  </div>;
}

export function VouchersSection() {
  const resource = useResource('/admin/vouchers');
  const mutation = useMutation(resource.refresh);
  const [form, setForm] = useState(null);
  const [latestId, setLatestId] = useState(() => getLatestCreatedId('vouchers'));
  async function submit(event) {
    event.preventDefault();
    const body = { code: form.code.trim().toUpperCase(), name: form.name.trim(), description: form.description.trim(), type: form.type, value: Number(form.value), maxDiscount: Number(form.maxDiscount), minAmount: Number(form.minAmount), startsAt: new Date(form.startsAt).toISOString(), expiresAt: new Date(form.expiresAt).toISOString(), usageLimit: Number(form.usageLimit), perUserLimit: Number(form.perUserLimit), active: !!form.active };
    const isNew = !form.id;
    let saved;
    if (await mutation.perform(async () => { saved = await api(form.id ? `/admin/vouchers/${form.id}` : '/admin/vouchers', { method: form.id ? 'PATCH' : 'POST', body }); }, 'Đã lưu mã giảm giá.')) {
      if (isNew && saved?.id != null) { setLatestCreatedId('vouchers', saved.id); setLatestId(String(saved.id)); }
      setForm(null);
    }
  }
  const newVoucher = () => ({ code: '', name: '', description: '', type: 'percent', value: '10', maxDiscount: '20000', minAmount: '0', startsAt: localDateTime(), expiresAt: localDateTime(Date.now() + 30 * 86_400_000), usageLimit: '100', perUserLimit: '1', active: true });
  const editVoucher = row => ({ ...row, name: row.name || row.code, description: row.description || '', type: row.type || 'percent', value: String(row.value || row.percent), active: !!row.active, startsAt: localDateTime(row.startsAt), expiresAt: localDateTime(row.expiresAt) });
  return <div className="stack"><div className="row spread"><div><h2>Mã giảm giá</h2><p className="muted">Thiết lập nội dung, giá trị, thời hạn và giới hạn sử dụng theo người.</p></div><button className="btn btn-primary" type="button" onClick={() => { mutation.reset(); setForm(newVoucher()); }}>+ Tạo mã</button></div><Notice {...mutation} />
    {form && <form className="card ops-editor" onSubmit={submit}><h3>{form.id ? 'Chỉnh sửa mã giảm giá' : 'Mã giảm giá mới'}</h3><fieldset disabled={mutation.pending}><div className="form-grid"><Field label="Mã voucher" name="code" value={form.code} onChange={inputChange(setForm)} pattern="[A-Za-z0-9_-]+" maxLength={40} help="Chữ không dấu, số, dấu gạch ngang hoặc gạch dưới." /><Field label="Tên chương trình" name="name" value={form.name} onChange={inputChange(setForm)} maxLength={120}/><Field label="Mô tả" type="textarea" name="description" value={form.description} onChange={inputChange(setForm)} maxLength={1000} required={false}/><Field label="Loại giảm" name="type" value={form.type} onChange={inputChange(setForm)} options={[{ value: 'percent', label: 'Phần trăm' }, { value: 'fixed', label: 'Số tiền cố định' }]}/><Field label={form.type === 'percent' ? 'Mức giảm (%)' : 'Số tiền giảm (VNĐ)'} name="value" type="number" min="1" max={form.type === 'percent' ? '100' : '10000000'} step="1" value={form.value} onChange={inputChange(setForm)}/><Field label="Giảm tối đa (VNĐ)" name="maxDiscount" type="number" min="0" step="1000" value={form.maxDiscount} onChange={inputChange(setForm)}/><Field label="Đơn hàng tối thiểu (VNĐ)" name="minAmount" type="number" min="0" step="1000" value={form.minAmount} onChange={inputChange(setForm)}/><Field label="Bắt đầu" name="startsAt" type="datetime-local" value={form.startsAt} onChange={inputChange(setForm)}/><Field label="Kết thúc" name="expiresAt" type="datetime-local" value={form.expiresAt} onChange={inputChange(setForm)}/><Field label="Giới hạn tổng lượt" name="usageLimit" type="number" min="1" step="1" value={form.usageLimit} onChange={inputChange(setForm)}/><Field label="Giới hạn mỗi tài khoản" name="perUserLimit" type="number" min="1" step="1" value={form.perUserLimit} onChange={inputChange(setForm)}/><label className="ops-checkbox"><input type="checkbox" checked={!!form.active} onChange={event => setForm(value => ({ ...value, active: event.target.checked }))}/>Kích hoạt mã giảm giá</label></div><div className="row ops-form-actions"><button className="btn btn-primary" type="submit" disabled={mutation.pending}>{mutation.pending ? 'Đang lưu…' : 'Lưu mã giảm giá'}</button><button className="btn btn-secondary" type="button" onClick={() => setForm(null)}>Đóng</button></div></fieldset></form>}
    <ResourceState resource={resource}><article className="card"><Table rows={sortLatestFirst(resource.data, latestId)} rowClassName={latestRowClass(latestId)} columns={[{ key: 'code', label: 'Mã / tên', render: row => <><code className="ops-voucher-code">{row.code}</code><small className="ops-block muted">{row.name || row.code}</small></> }, { key: 'value', label: 'Ưu đãi', render: row => <>{row.type === 'fixed' ? money(row.value) : `${row.value || row.percent}%`}<small className="ops-block muted">Tối đa {money(row.maxDiscount)} · đơn từ {money(row.minAmount)}</small></> }, { key: 'usageLimit', label: 'Lượt dùng', render: row => `${row.usedCount} / ${row.usageLimit} · mỗi người ${row.perUserLimit}` }, { key: 'startsAt', label: 'Hiệu lực', render: row => <>{dateTime(row.startsAt)}<small className="ops-block muted">đến {dateTime(row.expiresAt)}</small></> }, { key: 'active', label: 'Trạng thái', render: row => <span className="badge">{!row.active ? 'Đã tắt' : new Date(row.startsAt) > new Date() ? 'Chưa bắt đầu' : new Date(row.expiresAt) <= new Date() ? 'Hết hạn' : Number(row.usedCount) >= Number(row.usageLimit) ? 'Hết lượt dùng' : 'Đang áp dụng'}</span> }, { key: 'actions', label: 'Thao tác', render: row => <button className="btn btn-secondary ops-small" type="button" disabled={mutation.pending} onClick={() => { mutation.reset(); setForm(editVoucher(row)); }}>Sửa</button> }]} /></article></ResourceState>
  </div>;
}

export function FeedbackSection() {
  const resource = useResource('/admin/feedback');
  const mutation = useMutation(resource.refresh);
  const [filter, setFilter] = useState('open');
  const [selected, setSelected] = useState(null);
  const [response, setResponse] = useState('');
  const rows = (resource.data || []).filter(row => !filter || row.status === filter);
  async function submit(event) {
    event.preventDefault();
    if (await mutation.perform(() => api(`/admin/feedback/${selected}`, { method: 'PATCH', body: { response: response.trim(), status: 'resolved' } }), 'Đã gửi phản hồi và đánh dấu xử lý.')) { setSelected(null); setResponse(''); }
  }
  return <div className="stack"><div><h2>Phản ánh chất lượng dịch vụ</h2><p className="muted">Đọc đánh giá của hành khách và phản hồi trực tiếp trên hệ thống.</p></div><Notice {...mutation} /><div className="card ops-filter"><Field label="Trạng thái xử lý" value={filter} onChange={event => setFilter(event.target.value)} required={false} options={[{ value: 'open', label: 'Chờ xử lý' }, { value: 'resolved', label: 'Đã xử lý' }]} /></div>
    <ResourceState resource={resource}><div className="stack">{rows.length ? rows.map(row => <article className="card" key={row.id}><div className="row spread"><div><h3>{row.userName || row.name || `Hành khách #${row.userId}`}</h3><p className="muted">{row.routeName || `Chuyến #${row.tripId}`} · {dateTime(row.createdAt)}</p></div><div className="row"><span className="ops-rating" aria-label={`${row.rating} trên 5 sao`}>{'★'.repeat(Number(row.rating) || 0)}<span className="muted">{'☆'.repeat(5 - Math.min(5, Number(row.rating) || 0))}</span></span><Status value={row.status} /></div></div><p className="ops-preserve">{row.message}</p>{row.response && <div className="ops-feedback-response"><strong>Phản hồi của nhà xe</strong><p className="ops-preserve">{row.response}</p></div>}
      {selected === row.id ? <form onSubmit={submit}><Field label="Nội dung phản hồi" type="textarea" value={response} onChange={event => setResponse(event.target.value)} minLength={3} maxLength={3000} disabled={mutation.pending} /><div className="row ops-form-actions"><button className="btn btn-primary" type="submit" disabled={mutation.pending || !response.trim()}>{mutation.pending ? 'Đang gửi…' : 'Gửi phản hồi'}</button><button className="btn btn-secondary" type="button" disabled={mutation.pending} onClick={() => setSelected(null)}>Đóng</button></div></form> : <button className="btn btn-secondary" type="button" disabled={mutation.pending} onClick={() => { mutation.reset(); setSelected(row.id); setResponse(row.response || ''); }}>{row.response ? 'Cập nhật phản hồi' : 'Phản hồi hành khách'}</button>}
    </article>) : <div className="card empty-state">Không có phản ánh ở trạng thái này.</div>}</div></ResourceState>
  </div>;
}

const auditActionLabels = {
  LOGIN: 'Đăng nhập', ROLE_CHANGE: 'Đổi vai trò', LOCK: 'Khóa tài khoản', UNLOCK: 'Mở khóa tài khoản',
  REFUND: 'Hoàn tiền', TICKET_SCAN: 'Soát vé', FORECAST: 'Dự báo', EXPORT: 'Xuất dữ liệu',
  'voucher.create': 'Tạo mã giảm giá', 'voucher.update': 'Cập nhật mã giảm giá',
  'bus.create': 'Thêm xe', 'bus.update': 'Cập nhật xe',
  'stop.create': 'Thêm trạm', 'stop.update': 'Cập nhật trạm', 'stop.delete': 'Xóa trạm',
  'route.create': 'Thêm tuyến', 'route.update': 'Cập nhật tuyến', 'route.deactivate': 'Ngừng tuyến',
  'trip.create': 'Thêm chuyến', 'trip.update': 'Cập nhật chuyến',
  'schedule.create': 'Tạo lịch định kỳ', 'payment.success': 'Thanh toán thành công',
  'payment.pending': 'Chờ thanh toán', 'payment.failed': 'Thanh toán thất bại',
  'hold.create': 'Giữ ghế', 'hold.release': 'Nhả ghế', 'ticket.change': 'Đổi vé',
};
const auditEntityLabels = { users: 'Tài khoản', tickets: 'Vé', payments: 'Thanh toán', refunds: 'Hoàn tiền', demand_forecasts: 'Dự báo', reports: 'Báo cáo', analytics: 'Phân tích', trips: 'Chuyến xe', routes: 'Tuyến đường', buses: 'Xe buýt', vouchers: 'Mã giảm giá', stops: 'Trạm dừng', schedules: 'Lịch chạy' };
const auditDetailLabels = { code: 'Mã', name: 'Tên', description: 'Mô tả', type: 'Loại', value: 'Giá trị', percent: 'Phần trăm', maxDiscount: 'Giảm tối đa', minAmount: 'Đơn tối thiểu', startsAt: 'Bắt đầu', expiresAt: 'Hết hạn', usageLimit: 'Giới hạn lượt', perUserLimit: 'Mỗi người', active: 'Kích hoạt', plate: 'Biển số', seatCount: 'Số ghế', status: 'Trạng thái', address: 'Địa chỉ', lat: 'Vĩ độ', lng: 'Kinh độ', routeId: 'Mã tuyến', busId: 'Mã xe', driverId: 'Mã tài xế', departureTime: 'Giờ khởi hành', arrivalTime: 'Giờ đến', ticketId: 'Mã vé', amount: 'Số tiền', method: 'Phương thức', provider: 'Nhà cung cấp', reason: 'Lý do', automatic: 'Tự động', tripId: 'Mã chuyến', seat: 'Ghế' };
function auditDetailValue(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'amount' || key === 'maxDiscount' || key === 'minAmount') return money(value);
  if (['startsAt', 'expiresAt', 'departureTime', 'arrivalTime'].includes(key)) return dateTime(value);
  if (typeof value === 'boolean' || key === 'active' || key === 'automatic') return value ? 'Có' : 'Không';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
function AuditDetails({ details }) {
  let parsed = details;
  if (typeof details === 'string' && details.trim().startsWith('{')) {
    try { parsed = JSON.parse(details); } catch { parsed = details; }
  }
  if (!parsed) return <span className="ops-audit-details">—</span>;
  if (typeof parsed !== 'object' || Array.isArray(parsed)) return <span className="ops-audit-details">{String(parsed)}</span>;
  const entries = Object.entries(parsed);
  if (!entries.length) return <span className="ops-audit-details">—</span>;
  return <dl className="ops-audit-details ops-audit-detail-list">{entries.map(([key, value]) => <div key={key}><dt>{auditDetailLabels[key] || key}</dt><dd>{auditDetailValue(key, value)}</dd></div>)}</dl>;
}

export function AuditSection() {
  const [filter, setFilter] = useState({ from: '', to: '', action: '', entity: '', search: '' });
  const [applied, setApplied] = useState(filter);
  const query = new URLSearchParams(Object.entries(applied).filter(([, value]) => value)).toString();
  const resource = useResource(`/admin/audit?${query}`);
  return <div className="stack"><div className="row spread"><div><h2>Nhật ký hoạt động</h2><p className="muted">Theo dõi thao tác, đối tượng và tài khoản thực hiện.</p></div><button className="btn btn-secondary" type="button" disabled={resource.loading} onClick={resource.refresh}>Cập nhật</button></div>
    <form className="card ops-filter" onSubmit={event => { event.preventDefault(); setApplied({ ...filter }); }}><Field label="Từ ngày" type="date" name="from" value={filter.from} onChange={inputChange(setFilter)} max={filter.to || undefined} required={false}/><Field label="Đến ngày" type="date" name="to" value={filter.to} onChange={inputChange(setFilter)} min={filter.from || undefined} required={false}/><Field label="Thao tác" name="action" value={filter.action} onChange={inputChange(setFilter)} required={false} options={[{ value: 'LOGIN', label: 'Đăng nhập' }, { value: 'ROLE_CHANGE', label: 'Đổi vai trò' }, { value: 'LOCK', label: 'Khóa tài khoản' }, { value: 'UNLOCK', label: 'Mở khóa tài khoản' }, { value: 'REFUND', label: 'Hoàn tiền' }, { value: 'TICKET_SCAN', label: 'Soát vé' }, { value: 'FORECAST', label: 'Dự báo' }, { value: 'EXPORT', label: 'Xuất dữ liệu' }]}/><Field label="Đối tượng" name="entity" value={filter.entity} onChange={inputChange(setFilter)} required={false} options={['users','tickets','payments','refunds','demand_forecasts','reports','analytics','trips','routes','buses','vouchers'].map(value => ({ value, label: value }))}/><Field label="Từ khóa" name="search" value={filter.search} onChange={inputChange(setFilter)} required={false} maxLength={120} placeholder="Tài khoản, ID hoặc metadata"/><button className="btn btn-primary" type="submit">Lọc nhật ký</button><button className="btn btn-secondary" type="button" onClick={() => { const empty = { from: '', to: '', action: '', entity: '', search: '' }; setFilter(empty); setApplied(empty); }}>Xóa bộ lọc</button></form>
    <ResourceState resource={resource}><article className="card"><Table rows={resource.data} columns={[{ key: 'createdAt', label: 'Thời gian', render: row => dateTime(row.createdAt) }, { key: 'userName', label: 'Người thực hiện', render: row => row.userName || row.name || (row.userId ? `Tài khoản #${row.userId}` : 'Hệ thống') }, { key: 'action', label: 'Thao tác', render: row => <span>{auditActionLabels[row.action] || row.action}</span> }, { key: 'entity', label: 'Đối tượng', render: row => `${auditEntityLabels[row.entity] || row.entity} #${row.entityId ?? '—'}` }, { key: 'details', label: 'Chi tiết', render: row => <AuditDetails details={row.details} /> }]} /></article></ResourceState></div>;
}
