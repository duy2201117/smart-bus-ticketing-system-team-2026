const paths = {
  bus: <><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 11h14M8 7h8M8 19v2m8-2v2"/><circle cx="8.5" cy="15" r=".7"/><circle cx="15.5" cy="15" r=".7"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  ticket: <><path d="M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4Z"/><path d="M15 6v3m0 2v2m0 2v3"/></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Zm6-3v15m6-12v15"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/></>,
  support: <><path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v6h4v-6Zm16 0h2v6h-4v-6ZM20 18a4 4 0 0 1-4 4h-4"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="11" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="18" width="7" height="3" rx="1"/></>,
  logout: <path d="M9 4H4v16h5m6-12 4 4-4 4m-7-4h13"/>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>, bell: <path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5Zm5 3h4"/>, menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
};
export default function Icon({ name, size = 20, ...props }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.bus}</svg>; }
