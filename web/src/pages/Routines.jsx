import Shell from '../components/Shell.jsx';
import Topbar from '../components/Topbar.jsx';
import { CardHeader } from '../components/common.jsx';
import { useFitCoach } from '../state.jsx';

export default function Routines() {
  const { routines, clients, openModal } = useFitCoach();
  const openBuilder = () => openModal({ type: 'routine' });
  return (
    <Shell>
      <Topbar title="Rutinas" eyebrow="Planes de entrenamiento">
        <button className="button primary" onClick={openBuilder}>+ Crear rutina</button>
      </Topbar>
      <section className="content-grid">
        <div className="card">
          <CardHeader title="Rutinas activas" subtitle="Una rutina activa por paciente; al asignar otra, la anterior se archiva." />
          <div className="list">
            {routines.map((routine) => {
              const client = clients.find((item) => String(item.id) === String(routine.client_id));
              const exerciseCount = routine.days.reduce((total, day) => total + day.exercises.length, 0);
              return (
                <button key={routine.id} className="list-row" onClick={() => openModal({ type: 'routine-view', clientId: routine.client_id })}>
                  <span className="initials">⌁</span>
                  <span className="row-content">
                    <strong>{routine.name}</strong>
                    <p>{client?.full_name || 'Paciente sin asignar'} · {routine.days.length || routine.days_per_week || 0} días · {exerciseCount} ejercicios</p>
                  </span>
                  <span className="pill active">Activa</span>
                </button>
              );
            })}
            {!routines.length && <p className="empty">Aún no hay rutinas activas.</p>}
          </div>
        </div>
        <div className="card">
          <CardHeader title="Constructor" subtitle="Usa el catálogo local, incluso cuando no hay conexión." />
          <p className="muted">Elige un paciente, selecciona los días y agrega sus ejercicios, o pide una propuesta a la IA y ajústala antes de asignarla.</p>
          <button className="button primary" onClick={openBuilder}>Abrir constructor</button>
        </div>
      </section>
    </Shell>
  );
}
