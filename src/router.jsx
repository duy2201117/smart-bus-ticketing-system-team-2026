import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation, Link, useRouteError } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';
import Mascot from './components/Mascot';
const SearchPage = lazy(() => import('./features/passenger/SearchPage'));
const BookingPage = lazy(() => import('./features/passenger/BookingPage'));
const TicketsPage = lazy(() => import('./features/passenger/TicketsPage'));
const TrackingPage = lazy(() => import('./features/passenger/TrackingPage'));
const PassesPage = lazy(() => import('./features/passenger/PassesPage'));
const SupportPage = lazy(() => import('./features/passenger/SupportPage'));
const ComplaintsPage = lazy(() => import('./features/passenger/ComplaintsPage'));
const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const PasswordRecoveryPage = lazy(() => import('./features/auth/PasswordRecoveryPage'));
const OperationsPage = lazy(() => import('./features/operations/OperationsPage'));
const DriverPage = lazy(() => import('./features/driver/DriverPage'));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage'));
function Pending() { return <div className="page-loading kawaii-page-loading" role="status"><Mascot size="loading" decorative/><div><span className="spinner"/>Đang chuẩn bị hành trình…</div></div>; }
function Protected({ roles }) {
  const { user, loading } = useAuth(); const location = useLocation();
  if (loading) return <Pending/>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace/>;
  if (roles && !roles.includes(user.role)) return <div className="card empty-state kawaii-empty"><Mascot size="state" decorative/><h1>Bạn không có quyền truy cập</h1><p>Khu vực này dành cho nhân viên có vai trò phù hợp.</p><Link className="btn btn-primary" to="/">🏠 Về trang tìm chuyến</Link></div>;
  return <Outlet/>;
}
function RouteError() {
  const error = useRouteError();
  return <div className="card empty-state kawaii-empty kawaii-error-state"><Mascot size="state" decorative/><h1>Ối! Bubu chưa mở được trang này.</h1><p>{error?.status === 404 ? 'Đường dẫn bạn truy cập không tồn tại.' : 'Có lỗi khi tải trang. Vui lòng tải lại hoặc quay về trang chủ.'}</p><Link className="btn btn-primary" to="/" reloadDocument>🔎 Về trang chủ</Link></div>;
}
const page = (Component) => <Suspense fallback={<Pending/>}><Component/></Suspense>;
export default createBrowserRouter([{
  element: <AppShell/>, errorElement: <RouteError/>, children: [
    { path: '/', element: page(SearchPage) }, { path: '/login', element: page(LoginPage) }, { path: '/forgot-password', element: page(PasswordRecoveryPage) }, { path: '/reset-password', element: page(PasswordRecoveryPage) },
    { path: '/tracking', element: page(TrackingPage) }, { path: '/booking/:tripId', element: page(BookingPage) },
    { path: '/support', element: page(SupportPage) }, { path: '/complaints', element: page(ComplaintsPage) }, { path: '/passes', element: page(PassesPage) },
    { element: <Protected/>, children: [{ path: '/tickets', element: page(TicketsPage) }, { path: '/profile', element: page(ProfilePage) }] },
    { element: <Protected roles={['admin', 'manager']}/>, children: [{ path: '/manage', element: page(OperationsPage) }] },
    { element: <Protected roles={['admin', 'manager', 'driver']}/>, children: [{ path: '/driver', element: page(DriverPage) }] },
    { path: '/seat', element: <Navigate to="/" replace/> },
    { path: '*', element: <div className="card empty-state kawaii-empty kawaii-error-state"><Mascot size="state" decorative/><h1>Ối! Bubu chưa tìm thấy trang này.</h1><p>Chuyến hành trình này chưa có trong hệ thống.</p><Link className="btn btn-primary" to="/">🔎 Tìm chuyến xe</Link></div> },
  ],
}]);
