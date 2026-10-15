import mascot from '../assets/bubu-bus.png';

export default function Mascot({
  size = 'md',
  className = '',
  alt = 'Bubu, mascot xe buýt SmartBus',
  label,
  decorative = false,
}) {
  return (
    <figure className={`bubu-mascot bubu-${size} ${className}`.trim()} aria-hidden={decorative ? 'true' : undefined}>
      <div className="bubu-glow" aria-hidden="true" />
      <img src={mascot} alt={decorative ? '' : alt} draggable="false" />
      {label ? <figcaption className="bubu-bubble">{label}</figcaption> : null}
    </figure>
  );
}
