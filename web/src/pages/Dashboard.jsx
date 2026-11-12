import Shell from '../components/Shell.jsx';
import Topbar, { ConnectButton, NewClientButton } from '../components/Topbar.jsx';
import { Activity, CardHeader, ClientRow } from '../components/common.jsx';
import { useFitCoach } from '../state.jsx';

const METRICS = [
  ['active', 'green', 'Clientes activos'],
  ['invited', 'amber', 'Invitados sin app'],
  ['paused', 'red', 'Pausados'],
];

export default function Dashboard() {
  const { clients, exercises, navigate } = useFitCoach();
  const urgent = clients.find((client) => client.status === 'invited');
  return (
    <Shell>
      <Topbar title="Resumen" eyebrow="Administración de FitCoach"><ConnectButton /><NewClientButton /></Topbar>
      <section className="grid-metrics">
        {METRICS.map(([status, color, label]) => (
          <button key={status} className={`metric ${color}`} onClick={() => navigate('clients', status)}>
            <span className="metric-label">{label}</span>
            <span className="metric-value">{clients.filter((client) => client.status === status).length}</span>
          </button>
        ))}
        <button className="metric" onClick={() => navigate('clients', 'all')}>
          <span className="metric-label">Total de clientes</span>
          <span className="metric-value">{clients.length}</span>
        </button>
      </section>
      <section className="content-grid">
        <div className="card">
          <CardHeader title="Clientes recientes" subtitle="Expedientes y seguimiento, sin cobros recurrentes.">
            <button className="button small" onClick={() => navigate('clients')}>Ver todos</button>
          </CardHeader>
          <div className="list">{clients.slice(0, 5).map((client) => <ClientRow key={client.id} client={client} />)}</div>
        </div>
        <div className="card">
          <CardHeader title="Atención del día" subtitle="Seguimiento operativo" />
          {urgent
            ? <div className="notice"><span>●</span><div><strong>{urgent.full_name}</strong><p>Aún no activa su cuenta en la app. Pídele que se registre con {urgent.email || 'su correo'} y lo confirme.</p></div></div>
            : <p className="muted">No hay clientes pendientes de revisión.</p>}
          <Activity title="Biblioteca disponible">{exercises.length.toLocaleString('es-MX')} ejercicios guardados localmente.</Activity>
          <Activity title="Modo sin conexión">Las consultas de ejercicios y los borradores siguen disponibles.</Activity>
          <Activity title="Sin pagos">Este panel no incluye cobros, facturación ni mensualidades.</Activity>
        </div>
      </section>
    </Shell>
  );
}
