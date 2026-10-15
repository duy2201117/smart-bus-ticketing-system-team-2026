import { NavLink } from 'react-router-dom';
import Mascot from './Mascot';

function Navbar() {
  return (
    <nav className="legacy-kawaii-nav" aria-label="Điều hướng nhanh">
      <NavLink className="legacy-kawaii-brand" to="/">
        <Mascot size="logo" decorative />
        <span>BubuBus</span>
      </NavLink>
      <div className="legacy-kawaii-links">
        <NavLink to="/">🏠 Trang chủ</NavLink>
        <NavLink to="/seat">💺 Chọn ghế</NavLink>
        <NavLink to="/tickets">🎟️ Vé của tôi</NavLink>
      </div>
    </nav>
  );
}

export default Navbar;
