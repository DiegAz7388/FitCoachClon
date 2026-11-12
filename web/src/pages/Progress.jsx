import Shell from '../components/Shell.jsx';
import Topbar from '../components/Topbar.jsx';
import { Activity, CardHeader, DetailLine } from '../components/common.jsx';
import { useFitCoach } from '../state.jsx';

export default function Progress() {
  const { clients, routines, exercises } = useFitCoach();
  return (
    <Shell>
      <Topbar title="Progreso" eyebrow="Seguimiento de clientes" />
      <section className="content-grid">
        <div className="card">
          <CardHeader title="Actividad reciente" subtitle="Resumen operativo de entrenamiento." />
          {clients.slice(0, 5).map((client, index) => (
            <Activity key={client.id} title={client.full_name}>{index % 2 ? 'Rutina pendiente de revisión.' : 'Expediente actualizado recientemente.'}</Activity>
          ))}
        </div>
        <div className="card">
          <CardHeader title="Indicadores" subtitle="Sin métricas de cobro." />
          <div className="detail-list">
            <DetailLine label="Clientes activos">{clients.filter((client) => client.status === 'active').length}</DetailLine>
            <DetailLine label="Rutinas activas">{routines.length}</DetailLine>
            <DetailLine label="Ejercicios en catálogo">{exercises.length.toLocaleString('es-MX')}</DetailLine>
          </div>
        </div>
      </section>
    </Shell>
  );
}
