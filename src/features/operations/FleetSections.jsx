import { useState } from 'react';
import { api, useResource, useMutation, ResourceState, Notice, Field, Table, Status, dateTime, money, today, localDateTime, inputChange, optionList, getLatestCreatedId, setLatestCreatedId, sortLatestFirst, latestRowClass } from './shared';

function FormActions({ pending, onCancel, label = 'Lưu thay đổi' }) {
  return <div className="row ops-form-actions"><button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Đang lưu…' : label}</button><button className="btn btn-secondary" type="button" disabled={pending} onClick={onCancel}>Đóng</button></div>;
}

function OrderedStops({ ids, stops, onChange, disabled }) {
  const [newId, setNewId] = useState('');
  const remaining = stops.filter(stop => !ids.map(String).includes(String(stop.id)));
  function move(index, direction) {
    const next = [...ids];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  }
  return <div className="ops-stop-editor"><h4>Thứ tự trạm dừng</h4><p className="muted">Thêm trạm theo chiều chạy của tuyến, sau đó điều chỉnh thứ tự.</p>
    {ids.length ? <ol className="ops-stop-list">{ids.map((id, index) => <li key={id}><span className="ops-stop-order">{index + 1}</span><span>{stops.find(stop => String(stop.id) === String(id))?.name || `Trạm #${id}`}</span><div className="row"><button className="btn btn-secondary ops-small" type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label={`Đưa trạm ${index + 1} lên`}>↑</button><button className="btn btn-secondary ops-small" type="button" disabled={disabled || index === ids.length - 1} onClick={() => move(index, 1)} aria-label={`Đưa trạm ${index + 1} xuống`}>↓</button><button className="btn btn-danger ops-small" type="button" disabled={disabled} onClick={() => onChange(ids.filter((_, item) => item !== index))}>Bỏ</button></div></li>)}</ol> : <p className="muted">Chưa có trạm dừng.</p>}
    <div className="row"><label className="field ops-grow"><span>Thêm trạm vào tuyến</span><select className="input" value={newId} disabled={disabled} onChange={event => setNewId(event.target.value)}><option value="">Chọn trạm dừng</option>{remaining.map(stop => <option key={stop.id} value={stop.id}>{stop.name}</option>)}</select></label><button type="button" className="btn btn-secondary ops-align-bottom" disabled={disabled || !newId} onClick={() => { onChange([...ids, newId]); setNewId(''); }}>Thêm trạm</button></div>
  </div>;
}

const emptyRoute = { code: '', name: '', origin: '', destination: '', distanceKm: '', price: '', durationMinutes: '', stopIds: [] };
export function RoutesSection() {
  const resource = useResource('/admin/routes');
  const stops = useResource('/admin/stops');
  const mutation = useMutation(resource.refresh);
  const [form, setForm] = useState(null);
  const [latestId, setLatestId] = useState(() => getLatestCreatedId('routes'));
  async function submit(event) {
    event.preventDefault();
    const body = { code: form.code.trim(), name: form.name.trim(), origin: form.origin.trim(), destination: form.destination.trim(), distanceKm: Number(form.distanceKm), price: Number(form.price), durationMinutes: Number(form.durationMinutes), stopIds: form.stopIds.map(String) };
    const isNew = !form.id;
    let saved;
    if (await mutation.perform(async () => { saved = await api(form.id ? `/admin/routes/${form.id}` : '/admin/routes', { method: form.id ? 'PATCH' : 'POST', body }); }, form.id ? 'Đã cập nhật tuyến đường.' : 'Đã tạo tuyến đường.')) {
      if (isNew && saved?.id != null) { setLatestCreatedId('routes', saved.id); setLatestId(String(saved.id)); }
      setForm(null);
    }
  }
  return <div className="stack"><div className="row spread"><div><h2>Tuyến đường</h2><p className="muted">Thiết lập hành trình, giá vé và thứ tự trạm dừng.</p></div><button className="btn btn-primary" type="button" onClick={() => { mutation.reset(); setForm({ ...emptyRoute }); }}>+ Thêm tuyến</button></div><Notice {...mutation} />
    {form && <form className="card ops-editor" onSubmit={submit}><h3>{form.id ? 'Chỉnh sửa tuyến đường' : 'Tuyến đường mới'}</h3><fieldset disabled={mutation.pending}><div className="form-grid"><Field label="Mã tuyến" name="code" value={form.code} onChange={inputChange(setForm)} maxLength={30} /><Field label="Tên tuyến" name="name" value={form.name} onChange={inputChange(setForm)} maxLength={200} /><Field label="Điểm đi" name="origin" value={form.origin} onChange={inputChange(setForm)} /><Field label="Điểm đến" name="destination" value={form.destination} onChange={inputChange(setForm)} /><Field label="Quãng đường (km)" name="distanceKm" type="number" min="0" max="2000" step="0.1" value={form.distanceKm} onChange={inputChange(setForm)} /><Field label="Giá vé (VNĐ)" name="price" type="number" min="0" step="1000" value={form.price} onChange={inputChange(setForm)} /><Field label="Thời gian di chuyển (phút)" name="durationMinutes" type="number" min="1" step="1" value={form.durationMinutes} onChange={inputChange(setForm)} /></div><Notice error={stops.error} /><OrderedStops ids={form.stopIds} stops={stops.data || []} disabled={stops.loading} onChange={stopIds => setForm(value => ({ ...value, stopIds }))} /><FormActions pending={mutation.pending || stops.loading || !!stops.error} onCancel={() => setForm(null)} /></fieldset></form>}
    <ResourceState resource={resource}><article className="card"><Table rows={sortLatestFirst(resource.data, latestId)} rowClassName={latestRowClass(latestId)} columns={[
      { key: 'code', label: 'Mã tuyến', render: row => <strong>{row.code}</strong> }, { key: 'name', label: 'Tên tuyến' },
      { key: 'journey', label: 'Hành trình', render: row => <span>{row.origin} → {row.destination}<small className="ops-block muted">{row.distanceKm} km · {row.durationMinutes} phút · {(row.stops || row.stopIds || []).length} trạm</small></span> },
      { key: 'price', label: 'Giá vé', render: row => money(row.price) }, { key: 'active', label: 'Trạng thái', render: row => <span className="badge">{row.active ? 'Đang khai thác' : 'Ngừng khai thác'}</span> },
      { key: 'actions', label: 'Thao tác', render: row => <div className="row"><button className="btn btn-secondary ops-small" type="button" disabled={mutation.pending} onClick={() => { mutation.reset(); setForm({ ...row, stopIds: (row.stopIds || row.stops || []).map(item => typeof item === 'object' ? item.id : item) }); }}>Sửa</button>{!!row.active && <button className="btn btn-danger ops-small" type="button" disabled={mutation.pending} onClick={() => { if (window.confirm(`Ngừng khai thác tuyến ${row.code}?`)) mutation.perform(() => api(`/admin/routes/${row.id}`, { method: 'DELETE' }), 'Đã ngừng khai thác tuyến.'); }}>Ngừng</button>}</div> },
    ]} /></article></ResourceState>
  </div>;
}

export function StopsSection() {
  const resource = useResource('/admin/stops');
  const mutation = useMutation(resource.refresh);
  const [form, setForm] = useState(null);
  const [latestId, setLatestId] = useState(() => getLatestCreatedId('stops'));
  async function submit(event) {
    event.preventDefault();
    const body = { name: form.name.trim(), address: form.address.trim(), lat: Number(form.lat), lng: Number(form.lng) };
    const isNew = !form.id;
    let saved;
    if (await mutation.perform(async () => { saved = await api(form.id ? `/admin/stops/${form.id}` : '/admin/stops', { method: form.id ? 'PATCH' : 'POST', body }); }, 'Đã lưu trạm dừng.')) {
      if (isNew && saved?.id != null) { setLatestCreatedId('stops', saved.id); setLatestId(String(saved.id)); }
      setForm(null);
    }
  }
  return <div className="stack"><div className="row spread"><div><h2>Trạm dừng</h2><p className="muted">Tọa độ trạm được dùng để định vị và thông báo xe sắp đến.</p></div><button className="btn btn-primary" type="button" onClick={() => { mutation.reset(); setForm({ name: '', address: '', lat: '', lng: '' }); }}>+ Thêm trạm</button></div><Notice {...mutation} />
    {form && <form className="card ops-editor" onSubmit={submit}><h3>{form.id ? 'Chỉnh sửa trạm dừng' : 'Trạm dừng mới'}</h3><fieldset disabled={mutation.pending}><div className="form-grid"><Field label="Tên trạm" name="name" value={form.name} onChange={inputChange(setForm)} /><Field label="Địa chỉ" name="address" value={form.address} onChange={inputChange(setForm)} /><Field label="Vĩ độ" type="number" min="-90" max="90" step="any" name="lat" value={form.lat} onChange={inputChange(setForm)} /><Field label="Kinh độ" type="number" min="-180" max="180" step="any" name="lng" value={form.lng} onChange={inputChange(setForm)} /></div><FormActions pending={mutation.pending} onCancel={() => setForm(null)} /></fieldset></form>}
    <ResourceState resource={resource}><article className="card"><Table rows={sortLatestFirst(resource.data, latestId)} rowClassName={latestRowClass(latestId)} columns={[{ key: 'name', label: 'Tên trạm' }, { key: 'address', label: 'Địa chỉ' }, { key: 'coordinates', label: 'Tọa độ', render: row => `${row.lat}, ${row.lng}` }, { key: 'actions', label: 'Thao tác', render: row => <div className="row"><button className="btn btn-secondary ops-small" type="button" disabled={mutation.pending} onClick={() => { mutation.reset(); setForm({ ...row }); }}>Sửa</button><button className="btn btn-danger ops-small" type="button" disabled={mutation.pending} onClick={() => { if (window.confirm(`Xóa trạm ${row.name}? Chỉ có thể xóa trạm chưa thuộc tuyến.`)) mutation.perform(() => api(`/admin/stops/${row.id}`, { method: 'DELETE' }), 'Đã xóa trạm dừng.'); }}>Xóa</button></div> }]} /></article></ResourceState>
  </div>;
}

export function BusesSection() {
  const resource = useResource('/admin/buses');
  const mutation = useMutation(resource.refresh);
  const [form, setForm] = useState(null);
  const [latestId, setLatestId] = useState(() => getLatestCreatedId('buses'));
  async function submit(event) {
    event.preventDefault();
    const body = { code: form.code.trim(), type: form.type.trim(), plate: form.plate.trim(), name: form.name.trim(), seatCount: Number(form.seatCount), status: form.status };
    const isNew = !form.id;
    let saved;
    if (await mutation.perform(async () => { saved = await api(form.id ? `/admin/buses/${form.id}` : '/admin/buses', { method: form.id ? 'PATCH' : 'POST', body }); }, 'Đã lưu thông tin xe.')) {
      if (isNew && saved?.id != null) { setLatestCreatedId('buses', saved.id); setLatestId(String(saved.id)); }
      setForm(null);
    }
  }
  return <div className="stack"><div className="row spread"><div><h2>Đội xe</h2><p className="muted">Quản lý mã xe, loại xe, sức chứa và tình trạng khai thác.</p></div><button className="btn btn-primary" type="button" onClick={() => { mutation.reset(); setForm({ code: '', type: 'xe khách', plate: '', name: '', seatCount: '40', status: 'active' }); }}>+ Thêm xe</button></div><Notice {...mutation} />
    {form && <form className="card ops-editor" onSubmit={submit}><h3>{form.id ? 'Chỉnh sửa phương tiện' : 'Phương tiện mới'}</h3><fieldset disabled={mutation.pending}><div className="form-grid"><Field label="Mã xe" name="code" value={form.code} onChange={inputChange(setForm)} maxLength={40}/><Field label="Biển số" name="plate" value={form.plate} onChange={inputChange(setForm)} /><Field label="Loại xe" name="type" value={form.type} onChange={inputChange(setForm)} maxLength={80}/><Field label="Tên / mô tả" name="name" value={form.name} onChange={inputChange(setForm)} /><Field label="Số ghế" name="seatCount" type="number" min="1" max="100" step="1" value={form.seatCount} onChange={inputChange(setForm)} help="Không thể đổi sức chứa của xe có chuyến đã đặt chỗ." /><Field label="Trạng thái" name="status" value={form.status} onChange={inputChange(setForm)} options={[{ value: 'active', label: 'Đang hoạt động' }, { value: 'maintenance', label: 'Bảo dưỡng' }, { value: 'inactive', label: 'Ngừng khai thác' }]} /></div><FormActions pending={mutation.pending} onCancel={() => setForm(null)} /></fieldset></form>}
    <ResourceState resource={resource}><article className="card"><Table rows={sortLatestFirst(resource.data, latestId)} rowClassName={latestRowClass(latestId)} columns={[{ key: 'code', label: 'Mã xe', render: row => <strong>{row.code}</strong> }, { key: 'plate', label: 'Biển số' }, { key: 'type', label: 'Loại xe' }, { key: 'seatCount', label: 'Số ghế' }, { key: 'status', label: 'Trạng thái', render: row => <Status value={row.status} /> }, { key: 'actions', label: 'Thao tác', render: row => <button className="btn btn-secondary ops-small" type="button" disabled={mutation.pending} onClick={() => { mutation.reset(); setForm({ ...row }); }}>Sửa</button> }]} /></article></ResourceState>
  </div>;
}

export function TripsSection() {
  const resource = useResource('/admin/trips');
  const routes = useResource('/admin/routes');
  const buses = useResource('/admin/buses');
  const users = useResource('/admin/users');
  const mutation = useMutation(resource.refresh);
  const [form, setForm] = useState(null);
  const [mode, setMode] = useState('trip');
  const [filter, setFilter] = useState({ date: today(), routeId: '', status: '' });
  const [latestId, setLatestId] = useState(() => getLatestCreatedId('trips'));
  const baseForm = { routeId: '', busId: '', driverId: '', departureTime: localDateTime(Date.now() + 3_600_000), startDate: today(), endDate: today(), firstDeparture: '06:00', lastDeparture: '18:00', frequencyMinutes: '120' };
  const lookupLoading = routes.loading || buses.loading || users.loading;
  const lookupError = routes.error || buses.error || users.error;
  const rows = sortLatestFirst((resource.data || []).filter(row => (!filter.routeId || String(row.routeId) === filter.routeId) && (!filter.status || row.status === filter.status) && (!filter.date || localDateTime(row.departureTime).startsWith(filter.date))), latestId);
  function newForm(nextMode) { mutation.reset(); setMode(nextMode); setForm({ ...baseForm }); }
  async function submit(event) {
    event.preventDefault();
    const assignments = { busId: String(form.busId), driverId: String(form.driverId) };
    let path, body;
    if (mode === 'schedule') {
      path = '/admin/schedules';
      body = { ...assignments, routeId: String(form.routeId), startDate: form.startDate, endDate: form.endDate, firstDeparture: form.firstDeparture, lastDeparture: form.lastDeparture, frequencyMinutes: Number(form.frequencyMinutes) };
    } else {
      path = form.id ? `/admin/trips/${form.id}` : '/admin/trips';
      body = { ...assignments, departureTime: new Date(form.departureTime).toISOString(), ...(form.id ? {} : { routeId: String(form.routeId) }) };
    }
    let created;
    let saved;
    const isNewTrip = mode === 'trip' && !form.id;
    if (await mutation.perform(async () => { const result = await api(path, { method: form.id ? 'PATCH' : 'POST', body }); saved = result; created = result?.created; }, mode === 'schedule' ? 'Đã tạo lịch chạy.' : 'Đã lưu chuyến xe.')) {
      if (isNewTrip && saved?.id != null) {
        setLatestCreatedId('trips', saved.id);
        setLatestId(String(saved.id));
        setFilter({ date: localDateTime(saved.departureTime).slice(0, 10), routeId: '', status: '' });
      }
      setForm(null);
      if (mode === 'schedule' && created != null) setScheduleResult(created);
    }
  }
  const [scheduleResult, setScheduleResult] = useState(null);
  return <div className="stack"><div className="row spread"><div><h2>Chuyến xe & lịch chạy</h2><p className="muted">Phân công xe và tài xế. Hệ thống kiểm tra trùng lịch và sức chứa.</p></div><div className="row"><button className="btn btn-secondary" type="button" onClick={() => newForm('schedule')}>Tạo lịch định kỳ</button><button className="btn btn-primary" type="button" onClick={() => newForm('trip')}>+ Thêm chuyến</button></div></div>
    <Notice error={mutation.error || lookupError} success={mutation.success} />{scheduleResult != null && <div className="alert alert-success" role="status">Lịch định kỳ đã tạo {scheduleResult} chuyến xe.</div>}
    {form && <form className="card ops-editor" onSubmit={submit}><h3>{mode === 'schedule' ? 'Tạo lịch định kỳ' : form.id ? 'Điều chỉnh chuyến xe' : 'Chuyến xe mới'}</h3><fieldset disabled={mutation.pending || lookupLoading || !!lookupError}><div className="form-grid"><Field label="Tuyến đường" name="routeId" value={form.routeId} disabled={!!form.id} options={optionList((routes.data || []).filter(row => row.active || row.id === form.routeId), row => `${row.code} · ${row.name}`)} onChange={inputChange(setForm)} /><Field label="Xe buýt" name="busId" value={form.busId} options={optionList((buses.data || []).filter(row => row.status === 'active' || row.id === form.busId), row => `${row.plate} · ${row.seatCount} ghế`)} onChange={inputChange(setForm)} /><Field label="Tài xế" name="driverId" value={form.driverId} options={optionList((users.data || []).filter(row => row.role === 'driver' && row.active), row => `${row.name} · ${row.email}`)} onChange={inputChange(setForm)} />
      {mode === 'schedule' ? <><Field label="Từ ngày" type="date" name="startDate" value={form.startDate} min={today()} max={form.endDate || undefined} onChange={inputChange(setForm)} /><Field label="Đến ngày" type="date" name="endDate" value={form.endDate} min={form.startDate || today()} onChange={inputChange(setForm)} /><Field label="Giờ khởi hành đầu tiên" type="time" name="firstDeparture" value={form.firstDeparture} max={form.lastDeparture} onChange={inputChange(setForm)} /><Field label="Giờ khởi hành cuối cùng" type="time" name="lastDeparture" value={form.lastDeparture} min={form.firstDeparture} onChange={inputChange(setForm)} /><Field label="Tần suất (phút / chuyến)" type="number" name="frequencyMinutes" value={form.frequencyMinutes} min="1" step="1" onChange={inputChange(setForm)} help="Tần suất cần đủ để xe và tài xế hoàn tất chuyến trước." /></> : <Field label="Giờ khởi hành" type="datetime-local" name="departureTime" value={form.departureTime} onChange={inputChange(setForm)} />}
    </div>{mode === 'schedule' && <p className="muted">Thời gian theo múi giờ Việt Nam. Cùng một xe và tài xế được gán cho toàn bộ lịch. Nếu có chuyến trùng lịch, yêu cầu sẽ bị từ chối.</p>}<FormActions pending={mutation.pending} onCancel={() => setForm(null)} label={mode === 'schedule' ? 'Tạo toàn bộ lịch' : 'Lưu chuyến xe'} /></fieldset></form>}
    <div className="card ops-filter"><Field label="Ngày khởi hành" type="date" name="date" value={filter.date} onChange={inputChange(setFilter)} required={false} /><Field label="Tuyến đường" name="routeId" value={filter.routeId} onChange={inputChange(setFilter)} required={false} options={optionList(routes.data, row => `${row.code} · ${row.name}`)} /><Field label="Trạng thái" name="status" value={filter.status} onChange={inputChange(setFilter)} required={false} options={[{ value: 'scheduled', label: 'Chưa khởi hành' }, { value: 'running', label: 'Đang chạy' }, { value: 'completed', label: 'Hoàn thành' }, { value: 'cancelled', label: 'Đã hủy' }]} /><button className="btn btn-secondary" type="button" onClick={() => setFilter({ date: '', routeId: '', status: '' })}>Xóa bộ lọc</button></div>
    <ResourceState resource={resource}><article className="card"><div className="row spread"><h3>{rows.length} chuyến xe</h3><button type="button" className="btn btn-secondary ops-small" onClick={resource.refresh}>Cập nhật</button></div><Table rows={rows} rowClassName={latestRowClass(latestId)} empty="Không có chuyến xe khớp bộ lọc." columns={[
      { key: 'routeName', label: 'Tuyến', render: row => <><strong>{row.routeCode}</strong><small className="ops-block">{row.routeName}</small></> },
      { key: 'departureTime', label: 'Lịch chạy', render: row => <>{dateTime(row.departureTime)}<small className="ops-block muted">Đến: {dateTime(row.arrivalTime)}</small></> },
      { key: 'plate', label: 'Phân công', render: row => <>{row.plate}<small className="ops-block muted">{row.driverName || 'Chưa gán tài xế'}</small></> },
      { key: 'availableSeats', label: 'Ghế trống', render: row => `${row.availableSeats ?? '—'} / ${row.seatCount ?? '—'}` },
      { key: 'status', label: 'Trạng thái', render: row => <Status value={row.status} /> },
      { key: 'actions', label: 'Thao tác', render: row => row.status === 'scheduled' ? <div className="row"><button className="btn btn-secondary ops-small" type="button" disabled={mutation.pending} onClick={() => { mutation.reset(); setMode('trip'); setForm({ ...row, departureTime: localDateTime(row.departureTime) }); }}>Sửa</button><button className="btn btn-danger ops-small" type="button" disabled={mutation.pending} onClick={() => { if (window.confirm(`Hủy chuyến ${row.routeName} lúc ${dateTime(row.departureTime)}? Vé đã thanh toán sẽ được xử lý hoàn tiền theo chế độ hệ thống.`)) mutation.perform(() => api(`/admin/trips/${row.id}`, { method: 'PATCH', body: { status: 'cancelled' } }), 'Đã hủy chuyến và cập nhật vé liên quan.'); }}>Hủy chuyến</button></div> : <span className="muted">—</span> },
    ]} /></article></ResourceState>
  </div>;
}
