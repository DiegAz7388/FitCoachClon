import Shell from '../components/Shell.jsx';
import Topbar, { NewClientButton } from '../components/Topbar.jsx';
import { Activity, CardHeader, ClientRow } from '../components/common.jsx';
import { useFitCoach } from '../state.jsx';

const METRICS = [
  ['active', 'green', 'Pacientes activos'],
  ['invited', 'amber', 'Invitados sin app'],
  ['paused', 'red', 'Pausados'],
];

export default function Dashboard() {
  const { clients, exercises, navigate } = useFitCoach();
  const urgent = clients.find((client) => client.status === 'invited');
  return (
    <Shell>
      <Topbar title="Resumen" eyebrow="Administración de FitCoach"><NewClientButton /></Topbar>
      <section className="grid-metrics">
        {METRICS.map(([status, color, label]) => (
          <button key={status} className={`metric ${color}`} onClick={() => navigate('clients', status)}>
            <span className="metric-label">{label}</span>
            <span className="metric-value">{clients.filter((client) => client.status === status).length}</span>
          </button>
        ))}
        <button className="metric" onClick={() => navigate('clients', 'all')}>
          <span className="metric-label">Total de pacientes</span>
          <span className="metric-value">{clients.length}</span>
        </button>
      </section>
      <section className="content-grid">
        <div className="card">
          <CardHeader title="Pacientes recientes" subtitle="Expedientes y seguimiento.">
            <button className="button small" onClick={() => navigate('clients')}>Ver todos</button>
          </CardHeader>
          <div className="list">
            {clients.slice(0, 5).map((client) => <ClientRow key={client.id} client={client} />)}
            {!clients.length && <p className="empty">Aún no tienes pacientes. Agrega el primero con <strong>+ Nuevo paciente</strong>.</p>}
          </div>
        </div>
        <div className="card">
          <CardHeader title="Atención del día" subtitle="Seguimiento operativo" />
          {urgent
            ? <div className="notice"><span>●</span><div><strong>{urgent.full_name}</strong><p>Aún no acepta la invitación que llegó a {urgent.email || 'su correo'}. Puedes reenviarla desde su expediente.</p></div></div>
            : <p className="muted">{clients.length ? 'Todos tus pacientes ya activaron la app.' : 'Sin pendientes por ahora.'}</p>}
          <Activity title="Biblioteca disponible">{exercises.length.toLocaleString('es-MX')} ejercicios con animación e instrucciones.</Activity>
          <Activity title="App de pacientes">{clients.filter((client) => client.user_id).length} de {clients.length} pacientes ya usan la app.</Activity>
          <Activity title="Sin pagos">Este panel no incluye cobros, facturación ni mensualidades.</Activity>
        </div>
      </section>
    </Shell>
  );
}
