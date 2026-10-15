import Navbar from '../components/Navbar';
import Mascot from '../components/Mascot';

function SearchTrip() {
  return (
    <>
      <Navbar />
      <div className="container stack">
        <section className="card empty-state kawaii-empty">
          <Mascot size="state" decorative />
          <span className="eyebrow">BUBUBUS · TRA CỨU HÀNH TRÌNH</span>
          <h1>Tra cứu tuyến xe</h1>
          <p className="muted">Chọn điểm đi, điểm đến và tìm chuyến phù hợp với bạn.</p>
        </section>
      </div>
    </>
  );
}

export default SearchTrip;
