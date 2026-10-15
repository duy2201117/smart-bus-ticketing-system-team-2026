import { useState } from 'react';
import { download } from '../../lib/api';
import { useResource, useMutation, ResourceState, Notice, Field, Table, Status, money, dateTime, today, inputChange, optionList } from './shared';

function Metrics({ stats }) {
  const values = [['Doanh thu hôm nay', money(stats?.todayRevenue || 0), `${stats?.todayTickets || 0} vé · ${stats?.todayBookings || 0} đơn`], ['Doanh thu tháng này', money(stats?.monthRevenue || 0), `${stats?.monthTickets || 0} vé · ${stats?.monthBookings || 0} đơn`], ['Doanh thu theo lọc', money(stats?.revenue || 0), 'Đã trừ các giao dịch hoàn tiền'], ['Vé bán', (stats?.tickets || 0).toLocaleString('vi-VN'), 'Trong khoảng thống kê'], ['Đơn đặt vé', (stats?.bookings || 0).toLocaleString('vi-VN'), 'Giao dịch thành công'], ['Yêu cầu hoàn tiền', (stats?.refunds || 0).toLocaleString('vi-VN'), 'Theo dữ liệu trong khoảng lọc'], ['Tỷ lệ lấp đầy', `${Number(stats?.occupancy || 0).toFixed(1)}%`, 'Số ghế đã bán / tổng ghế'], ['Chuyến xe', (stats?.trips || 0).toLocaleString('vi-VN'), 'Trong khoảng thống kê']];
  return <div className="ops-metrics">{values.map(([label, value, detail]) => <article className="stat-card" key={label}><span className="muted">{label}</span><strong>{value}</strong><small className="muted">{detail}</small></article>)}</div>;
}

function RevenueChart({ rows }) {
  const data = (rows || []).slice(-14);
  const max = Math.max(1, ...data.map(row => Math.abs(Number(row.revenue) || 0)));
  return <article className="card"><div className="row spread"><h3>Doanh thu theo ngày</h3><span className="muted">{data.length} ngày gần nhất có dữ liệu</span></div>{data.length ? <div className="ops-chart" aria-label="Biểu đồ doanh thu theo ngày">{data.map(row => <div className="ops-chart-column" key={row.date} title={`${row.date}: ${money(row.revenue)}`}><span className="ops-chart-value">{money(row.revenue)}</span><div className="ops-chart-track"><div className={`ops-chart-bar${Number(row.revenue) < 0 ? ' negative' : ''}`} style={{ height: `${Math.max(1, Math.abs(Number(row.revenue) || 0) / max * 100)}%` }} /></div><span className="ops-chart-date">{String(row.date).slice(5).split('-').reverse().join('/')}</span></div>)}</div> : <div className="empty-state">Chưa có giao dịch để vẽ biểu đồ.</div>}</article>;
}

function RouteReport({ rows }) {
  return <article className="card"><h3>Hiệu quả từng tuyến</h3><Table rows={rows} rowKey="routeId" columns={[
    { key: 'routeName', label: 'Tuyến đường' }, { key: 'tickets', label: 'Vé bán' },
    { key: 'revenue', label: 'Doanh thu thuần', render: row => money(row.revenue) },
    { key: 'occupancy', label: 'Lấp đầy', render: row => <div className="ops-occupancy"><progress max="100" value={Math.min(100, Number(row.occupancy) || 0)} aria-label={`Tỷ lệ lấp đầy ${row.routeName}`} /><span>{Number(row.occupancy || 0).toFixed(1)}%</span></div> },
  ]} /></article>;
}

export function OverviewSection() {
  const resource = useResource('/admin/overview');
  const data = resource.data;
  return <div className="stack"><div className="row spread"><h2>Tình hình vận hành</h2><button className="btn btn-secondary" type="button" disabled={resource.loading} onClick={resource.refresh}>Cập nhật dữ liệu</button></div><ResourceState resource={resource}>{data && <>
    <Metrics stats={data.stats} /><RevenueChart rows={data.daily} /><RouteReport rows={data.byRoute} />
    <div className="ops-overview-bottom"><article className="card"><h3>Vé gần đây</h3><Table rows={data.recentTickets} columns={[
      { key: 'code', label: 'Mã vé', render: row => <code>{row.code || `#${row.id}`}</code> },
      { key: 'routeName', label: 'Tuyến' }, { key: 'price', label: 'Giá vé', render: row => money(row.price) },
      { key: 'status', label: 'Trạng thái', render: row => <Status value={row.status} /> },
    ]} /></article><article className="card"><h3>Sự cố mới báo cáo</h3>{data.incidents?.length ? <ul className="ops-incidents">{data.incidents.slice(0, 8).map(row => <li key={row.id}><div className="row spread"><strong>{row.routeName || `Chuyến #${row.tripId}`}</strong><small className="muted">{dateTime(row.createdAt)}</small></div><p>{row.description}</p><span className="badge">{incidentLabel(row.type)}</span></li>)}</ul> : <div className="empty-state">Chưa ghi nhận sự cố.</div>}</article></div>
  </>}</ResourceState></div>;
}

export function incidentLabel(type) { return ({ traffic: 'Ùn tắc giao thông', breakdown: 'Sự cố phương tiện', delay: 'Trễ chuyến', other: 'Sự cố khác', road: 'Sự cố đường xá' })[type] || type; }

export function ReportsSection() {
  const [filter, setFilter] = useState({ from: today().slice(0, 8) + '01', to: today(), routeId: '' });
  const [applied, setApplied] = useState(filter);
  const routes = useResource('/admin/routes');
  const query = new URLSearchParams(Object.entries(applied).filter(([, value]) => value)).toString();
  const resource = useResource(`/admin/reports?${query}`);
  const mutation = useMutation();
  const data = resource.data;
  return <div className="stack"><div className="row spread"><div><h2>Báo cáo & thống kê</h2><p className="muted">Doanh thu từ giao dịch thực tế trong hệ thống, sau hoàn tiền.</p></div><div className="row"><button type="button" className="btn btn-secondary" disabled={mutation.pending || resource.loading || !!resource.error} onClick={() => mutation.perform(() => download(`/admin/reports/export?${query}&format=xlsx`, `smartbus-bao-cao-${applied.from}.xlsx`), 'Đã tải báo cáo Excel.')}>Xuất Excel</button><button type="button" className="btn btn-secondary" disabled={mutation.pending || resource.loading || !!resource.error} onClick={() => mutation.perform(() => download(`/admin/reports/export?${query}&format=pdf`, `smartbus-bao-cao-${applied.from}.pdf`), 'Đã tải báo cáo PDF.')}>Xuất PDF</button></div></div>
    <form className="card ops-filter" onSubmit={event => { event.preventDefault(); setApplied({ ...filter }); if (JSON.stringify(filter) === JSON.stringify(applied)) resource.refresh(); }}>
      <Field label="Từ ngày" type="date" name="from" value={filter.from} max={filter.to || undefined} onChange={inputChange(setFilter)} />
      <Field label="Đến ngày" type="date" name="to" value={filter.to} min={filter.from || undefined} onChange={inputChange(setFilter)} />
      <Field label="Tuyến đường" name="routeId" value={filter.routeId} onChange={inputChange(setFilter)} options={optionList(routes.data, row => `${row.code} · ${row.name}`)} required={false} help="Để trống để xem tất cả tuyến." />
      <button className="btn btn-primary" disabled={resource.loading} type="submit">Xem báo cáo</button>
    </form><Notice error={mutation.error || routes.error} success={mutation.success} />
    <ResourceState resource={resource}>{data && <><Metrics stats={data.stats} /><RevenueChart rows={data.daily} /><RouteReport rows={data.byRoute} /><article className="card"><h3>Chi tiết theo ngày</h3><Table rows={data.daily} rowKey="date" columns={[{ key: 'date', label: 'Ngày' }, { key: 'tickets', label: 'Vé bán' }, { key: 'revenue', label: 'Doanh thu thuần', render: row => money(row.revenue) }]} /></article></>}</ResourceState>
  </div>;
}
