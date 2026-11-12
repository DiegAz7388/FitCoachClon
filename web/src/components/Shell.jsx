import { useFitCoach } from '../state.jsx';

const NAV_ITEMS = [
  ['dashboard', '⌂', 'Resumen'],
  ['clients', '♙', 'Clientes'],
  ['routines', '⌁', 'Rutinas'],
  ['exercises', '◈', 'Ejercicios'],
  ['progress', '◷', 'Progreso'],
  ['settings', '⚙', 'Ajustes'],
];

export default function Shell({ children }) {
  const { view, navigate, online, isRemote, isConfigured } = useFitCoach();
  const remoteLabel = isRemote ? 'Arnold V2 conectado' : isConfigured ? 'Arnold V2 · iniciar sesión' : 'Demo local · Arnold V2 pendiente';
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">↗</span>
          <span>FitCoach<small className="brand-subtitle">Administración</small></span>
        </div>
        <nav className="nav">
          {NAV_ITEMS.map(([key, icon, label]) => (
            <button key={key} className={view === key ? 'active' : ''} onClick={() => navigate(key)}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="connection">
            <strong><span className={`online-dot ${online ? '' : 'offline-dot'}`} />{online ? 'Con conexión' : 'Sin conexión'}</strong>
            {remoteLabel}
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
