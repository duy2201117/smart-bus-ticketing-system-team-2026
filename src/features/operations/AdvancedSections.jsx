import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { download } from '../../lib/api';
import { api, useResource, useMutation, ResourceState, Notice, Field, Table, Status, dateTime, money, today, localDateTime, inputChange, optionList } from './shared';

const analyticsInitialFilter = { from: localDateTime(Date.now() - 89 * 86400000).slice(0, 10), to: today(), routeId: '' };

export function RefundsSection() {
  const resource = useResource('/admin/refunds');
  const mutation = useMutation(resource.refresh);
  async function transition(refund, status) {
    await mutation.perform(() => api(`/admin/refunds/${refund.id}`, { method: 'PATCH', body: { status } }), `Đã cập nhật yêu cầu ${refund.id}.`);
  }
  return <div className="stack"><div><h2>Yêu cầu hoàn tiền</h2><p className="muted">Mỗi vé chỉ tạo một yêu cầu; giao dịch chỉ chuyển sang đã hoàn sau khi quản lý xác nhận.</p></div><Notice {...mutation}/><ResourceState resource={resource}><article className="card"><Table rows={resource.data} empty="Chưa có yêu cầu hoàn tiền." columns={[
    { key: 'createdAt', label: 'Thời điểm', render: row => dateTime(row.createdAt) }, { key: 'userName', label: 'Hành khách' },
    { key: 'routeName', label: 'Tuyến' }, { key: 'code', label: 'Mã vé', render: row => <code>{row.code}</code> },
    { key: 'amount', label: 'Số tiền', render: row => money(row.amount) }, { key: 'status', label: 'Trạng thái', render: row => <Status value={row.status}/> },
    { key: 'actions', label: 'Xử lý', render: row => <div className="row">{row.status === 'requested' && <><button type="button" className="btn btn-secondary ops-small" disabled={mutation.pending} onClick={() => transition(row, 'processing')}>Tiếp nhận</button><button type="button" className="btn btn-danger ops-small" disabled={mutation.pending} onClick={() => transition(row, 'rejected')}>Từ chối</button></>}{row.status === 'processing' && <><button type="button" className="btn btn-primary ops-small" disabled={mutation.pending} onClick={() => transition(row, 'completed')}>Xác nhận hoàn</button><button type="button" className="btn btn-danger ops-small" disabled={mutation.pending} onClick={() => transition(row, 'failed')}>Thất bại</button></>}</div> },
  ]}/></article></ResourceState></div>;
}

export function ComplaintsSection() {
  const resource = useResource('/admin/complaints');
  const mutation = useMutation(resource.refresh);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ status: 'processing', response: '' });
  async function submit(event) {
    event.preventDefault();
    if (await mutation.perform(() => api(`/admin/complaints/${selected.id}`, { method: 'PATCH', body: form }), 'Đã cập nhật phản ánh.')) setSelected(null);
  }
  return <div className="stack"><div><h2>Phản ánh khách hàng</h2><p className="muted">Theo dõi nội dung, trạng thái xử lý và phản hồi đến hành khách.</p></div><Notice {...mutation}/><ResourceState resource={resource}><div className="stack">{resource.data?.length ? resource.data.map(row => <article className="card stack" key={row.id}><div className="row spread"><div><h3>{row.category}</h3><p className="muted">{row.userName} · {row.tripId ? `Chuyến ${row.tripId} · ` : ''}{dateTime(row.createdAt)}</p></div><Status value={row.status}/></div><p className="ops-preserve">{row.content}</p>{row.response && <div className="ops-feedback-response"><strong>Phản hồi</strong><p>{row.response}</p></div>}{selected?.id === row.id ? <form className="stack" onSubmit={submit}><Field label="Trạng thái" value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} options={[{ value: 'processing', label: 'Đang xử lý' }, { value: 'resolved', label: 'Đã giải quyết' }, { value: 'rejected', label: 'Từ chối' }]}/><Field label="Phản hồi" type="textarea" value={form.response} onChange={event => setForm({ ...form, response: event.target.value })} minLength={2} maxLength={3000}/><div className="row"><button className="btn btn-primary" disabled={mutation.pending}>Lưu xử lý</button><button className="btn btn-secondary" type="button" onClick={() => setSelected(null)}>Đóng</button></div></form> : <button className="btn btn-secondary" type="button" onClick={() => { mutation.reset(); setSelected(row); setForm({ status: row.status === 'open' ? 'processing' : row.status, response: row.response || '' }); }}>{row.response ? 'Cập nhật xử lý' : 'Phản hồi'}</button>}</article>) : <div className="card empty-state">Chưa có phản ánh cần xử lý.</div>}</div></ResourceState></div>;
}

function ChartPanel({ title, children }) {
  return <article className="card"><h3>{title}</h3><div className="ops-chart-container">{children}</div></article>;
}

function Heatmap({ rows }) {
  const names = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const values = new Map();
  for (const row of rows || []) {
    const weekday = new Date(`${row.date}T12:00:00`).getDay();
    const key = `${weekday}:${row.hour}`;
    values.set(key, (values.get(key) || 0) + Number(row.passengers));
  }
  const max = Math.max(1, ...values.values());
  return <div className="ops-heatmap-scroll"><table className="ops-heatmap"><thead><tr><th>Thứ / giờ</th>{Array.from({ length: 24 }, (_, hour) => <th key={hour}>{hour}</th>)}</tr></thead><tbody>{names.map((name, weekday) => <tr key={name}><th>{name}</th>{Array.from({ length: 24 }, (_, hour) => { const count = values.get(`${weekday}:${hour}`) || 0; return <td key={hour} title={`${name}, ${hour}:00 · ${count} hành khách`} style={{ backgroundColor: count ? `rgba(18, 126, 92, ${0.1 + count / max * 0.8})` : '#f2f5f2' }}>{count || ''}</td>; })}</tr>)}</tbody></table></div>;
}

export function AnalyticsSection() {
  const [filter, setFilter] = useState(analyticsInitialFilter);
  const [applied, setApplied] = useState(filter);
  const [forecastInput, setForecastInput] = useState({ routeId: '', date: today(), hour: '8' });
  const [forecast, setForecast] = useState(null);
  const [forecastError, setForecastError] = useState('');
  const [forecastBusy, setForecastBusy] = useState(false);
  const exportMutation = useMutation();
  const routes = useResource('/admin/routes');
  const query = new URLSearchParams(Object.entries(applied).filter(([, value]) => value)).toString();
  const density = useResource(`/admin/analytics/passenger-density?${query}`);
  const peaks = useResource(`/admin/analytics/peak-hours?${query}`);
  const demand = useResource(`/admin/analytics/route-demand?${query}`);
  const occupancy = useResource(`/admin/analytics/occupancy-trends?${query}`);
  const recommendations = useResource(`/admin/analytics/recommendations?${query}`);

  async function runForecast(event) {
    event.preventDefault(); setForecastBusy(true); setForecastError(''); setForecast(null);
    try { setForecast(await api('/admin/analytics/forecast', { method: 'POST', body: { routeId: forecastInput.routeId, date: forecastInput.date, hour: Number(forecastInput.hour) } })); }
    catch (err) { setForecastError(err.message); }
    finally { setForecastBusy(false); }
  }

  function exportData(type, format) {
    return exportMutation.perform(() => download(`/admin/analytics/export?${query}&type=${type}&format=${format}`, `smartbus-${type}-${applied.from}.${format}`), `Đã tải tệp ${format.toUpperCase()}.`);
  }

  const resourceError = [density, peaks, demand, occupancy, recommendations].find(resource => resource.error)?.error;
  return <div className="stack"><div className="row spread"><div><h2>Phân tích nhu cầu & dự báo</h2><p className="muted">Tính từ vé đã thanh toán, chuyến và sức chứa xe trong cơ sở dữ liệu.</p></div><div className="row ops-export-actions">{[['analytics','xlsx','Phân tích Excel'],['analytics','pdf','Phân tích PDF'],['occupancy','xlsx','Lấp đầy Excel'],['occupancy','pdf','Lấp đầy PDF'],['forecast','xlsx','Dự báo Excel'],['forecast','pdf','Dự báo PDF']].map(([type,format,label]) => <button key={`${type}-${format}`} type="button" className="btn btn-secondary ops-small" disabled={exportMutation.pending} onClick={() => exportData(type,format)}>{label}</button>)}</div></div><Notice {...exportMutation}/>
    <form className="card ops-filter" onSubmit={event => { event.preventDefault(); setApplied({ ...filter }); }}><Field label="Từ ngày" type="date" name="from" value={filter.from} onChange={inputChange(setFilter)} max={filter.to}/><Field label="Đến ngày" type="date" name="to" value={filter.to} onChange={inputChange(setFilter)} min={filter.from}/><Field label="Tuyến" name="routeId" value={filter.routeId} onChange={inputChange(setFilter)} options={optionList(routes.data, route => `${route.code} · ${route.name}`)} required={false}/><button className="btn btn-primary" type="submit">Cập nhật phân tích</button></form>
    {resourceError && <div className="alert alert-error" role="alert">{resourceError}</div>}
    <div className="grid grid-2"><ChartPanel title="Lượng hành khách theo giờ"><ResourceState resource={density}><ResponsiveContainer width="100%" height="100%"><AreaChart data={density.data || []}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Area type="monotone" dataKey="passengers" name="Hành khách" stroke="#087f72" fill="#8fc4a1" fillOpacity={0.3}/></AreaChart></ResponsiveContainer></ResourceState></ChartPanel>
      <ChartPanel title="Xu hướng lấp đầy theo ngày"><ResourceState resource={occupancy}><ResponsiveContainer width="100%" height="100%"><LineChart data={occupancy.data || []}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis domain={[0, 100]} unit="%"/><Tooltip/><Line type="monotone" dataKey="occupancy" name="Lấp đầy (%)" stroke="#d37b3f" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></ResourceState></ChartPanel></div>
    <ChartPanel title="Nhu cầu theo tuyến"><ResourceState resource={demand}><ResponsiveContainer width="100%" height="100%"><BarChart data={demand.data || []}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="routeName"/><YAxis/><Tooltip/><Legend/><Bar dataKey="passengers" name="Hành khách" fill="#087f72"/><Bar dataKey="trips" name="Số chuyến" fill="#e19a54"/></BarChart></ResponsiveContainer></ResourceState></ChartPanel>
    <section className="card stack"><h3>Mật độ theo thứ và giờ</h3><ResourceState resource={density}><Heatmap rows={density.data}/></ResourceState></section>
    <section className="card stack"><div><h3>Giờ cao điểm và thấp điểm</h3><p className="muted">Xếp hạng theo số vé đã thanh toán trong khoảng lọc.</p></div><ResourceState resource={peaks}><div className="grid grid-2"><div><h4>Giờ đông khách</h4><Table rows={peaks.data?.busiestHours} columns={[{ key: 'hour', label: 'Giờ', render: row => `${row.hour}:00` }, { key: 'passengers', label: 'Hành khách' }, { key: 'trips', label: 'Chuyến' }]}/></div><div><h4>Ngày trong tuần</h4><Table rows={peaks.data?.busiestDays} columns={[{ key: 'weekday', label: 'Thứ', render: row => ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'][row.weekday] }, { key: 'passengers', label: 'Hành khách' }, { key: 'trips', label: 'Chuyến' }]}/></div></div></ResourceState></section>
    <section className="card stack"><div><h3>Khuyến nghị vận hành</h3><p className="muted">Hệ thống chỉ gợi ý; không tự đổi giá, thêm chuyến hoặc phân công xe.</p></div><ResourceState resource={recommendations}>{recommendations.data?.recommendations?.length ? recommendations.data.recommendations.map(item => <div className="alert" key={`${item.routeId}:${item.type}`}><strong>{item.routeName} · {item.type === 'increase_frequency' ? 'Cân nhắc tăng chuyến' : 'Cân nhắc tối ưu lịch'}</strong><p>{item.reason}</p></div>) : <div className="empty-state">Chưa có khuyến nghị theo ngưỡng 85% / 30% trong khoảng lọc.</div>}</ResourceState></section>
    <section className="card stack"><div><h3>Dự báo nhu cầu</h3><p className="muted">Trung bình động có trọng số từ các chuyến lịch sử cùng tuyến và khung giờ.</p></div><form className="ops-filter" onSubmit={runForecast}><Field label="Tuyến" name="routeId" value={forecastInput.routeId} onChange={inputChange(setForecastInput)} options={optionList(routes.data, route => `${route.code} · ${route.name}`)}/><Field label="Ngày dự báo" type="date" name="date" value={forecastInput.date} min={today()} onChange={inputChange(setForecastInput)}/><Field label="Giờ khởi hành" type="number" name="hour" value={forecastInput.hour} min="0" max="23" onChange={inputChange(setForecastInput)}/><button className="btn btn-primary" disabled={forecastBusy || !forecastInput.routeId}>{forecastBusy ? 'Đang tính…' : 'Tạo dự báo'}</button></form>{forecastError && <div className="alert alert-error" role="alert">{forecastError}</div>}{forecast && <div className="forecast-result"><div className="row spread"><div><span className="eyebrow">{forecast.routeName} · {forecast.targetDate} · {forecast.targetHour}:00</span><h3>{Number(forecast.predictedPassengers).toFixed(1)} hành khách dự kiến</h3></div><span className="badge">{forecast.demandLevel}</span></div><div className="summary-row"><span>Độ lấp đầy dự báo</span><strong>{Number(forecast.predictedOccupancy).toFixed(1)}%</strong></div><div className="summary-row"><span>Độ tin cậy</span><strong>{Math.round(Number(forecast.confidence) * 100)}% · {forecast.metrics.samples} mẫu</strong></div>{forecast.metrics.note && <div className="alert">{forecast.metrics.note}</div>}{forecast.metrics.backtest && <p className="muted">Backtest: MAE {Number(forecast.metrics.backtest.mae).toFixed(2)} · MAPE {forecast.metrics.backtest.mape == null ? 'không đủ dữ liệu khác 0' : `${Number(forecast.metrics.backtest.mape).toFixed(1)}%`} · {forecast.metrics.backtest.samples} mẫu</p>}</div>}</section>
  </div>;
}