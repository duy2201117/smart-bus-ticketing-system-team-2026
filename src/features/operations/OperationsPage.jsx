import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { OverviewSection, ReportsSection } from './ReportsSections';
import { RoutesSection, StopsSection, BusesSection, TripsSection } from './FleetSections';
import { UsersSection, DiscountsSection, VouchersSection, FeedbackSection, AuditSection } from './PeopleSections';
import { RefundsSection, ComplaintsSection, AnalyticsSection } from './AdvancedSections';
import './operations.css';

const tabs = [
  ['overview', 'Tổng quan', OverviewSection], ['trips', 'Chuyến & lịch chạy', TripsSection],
  ['routes', 'Tuyến đường', RoutesSection], ['stops', 'Trạm dừng', StopsSection], ['buses', 'Đội xe', BusesSection],
  ['reports', 'Báo cáo', ReportsSection], ['discounts', 'Duyệt ưu đãi', DiscountsSection],
  ['vouchers', 'Mã giảm giá', VouchersSection], ['feedback', 'Phản ánh', FeedbackSection],
  ['complaints', 'Khiếu nại', ComplaintsSection], ['refunds', 'Hoàn tiền', RefundsSection], ['analytics', 'AI phân tích', AnalyticsSection],
  ['users', 'Tài khoản', UsersSection], ['audit', 'Nhật ký', AuditSection],
];

export default function OperationsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const visibleTabs = tabs.filter(([key]) => user?.role === 'admin' || !['users', 'audit'].includes(key));
  const selected = visibleTabs.find(([key]) => key === tab) || visibleTabs[0];
  const Section = selected[2];
  if (!['admin', 'manager'].includes(user?.role)) return <div className="alert alert-error">Bạn cần tài khoản quản trị viên hoặc điều hành để truy cập trang này.</div>;
  return <div className="ops-page stack">
    <header className="page-heading"><div><span className="eyebrow">TRUNG TÂM ĐIỀU HÀNH</span><h1>Quản lý vận hành</h1><p className="muted">Điều phối chuyến xe, chăm sóc hành khách và theo dõi hiệu quả kinh doanh.</p></div><span className="badge">{user.role === 'admin' ? 'Quản trị viên' : 'Điều hành'}</span></header>
    <nav className="ops-tabs" aria-label="Chức năng điều hành">{visibleTabs.map(([key, label]) => <button type="button" key={key} className={key === selected[0] ? 'ops-tab active' : 'ops-tab'} aria-current={key === selected[0] ? 'page' : undefined} onClick={() => setTab(key)}>{label}</button>)}</nav>
    <section aria-label={selected[1]} key={selected[0]}><Section /></section>
  </div>;
}
