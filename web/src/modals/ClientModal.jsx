import { DetailLine, Modal } from '../components/common.jsx';
import { dayName, textStatus } from '../lib/format.js';

export const exerciseCount = (routine) => routine.days.reduce((total, day) => total + day.exercises.length, 0);
import { useFitCoach } from '../state.jsx';

export default function ClientModal({ clientId }) {
  const { clients, routines, openModal } = useFitCoach();
  const client = clients.find((item) => String(item.id) === String(clientId)) || { full_name: 'Paciente sin asignar', id: '' };
  const routine = routines.find((item) => String(item.client_id) === String(client.id));
  return (
    <Modal title={client.full_name} subtitle="Expediente del paciente">
      <div className="detail-columns">
        <div>
          <div className="detail-list">
            <DetailLine label="Correo">{client.email || 'No registrado'}</DetailLine>
            <DetailLine label="Teléfono">{client.phone || 'No registrado'}</DetailLine>
            <DetailLine label="Objetivo">{client.goal || 'Sin definir'}</DetailLine>
            <DetailLine label="Estatura">{client.height_cm ? `${client.height_cm} cm` : 'Sin registrar'}</DetailLine>
            <DetailLine label="Estado">{textStatus(client.status)}</DetailLine>
            {<DetailLine label="App móvil">{client.user_id ? 'Vinculada' : 'Sin vincular'}</DetailLine>}
          </div>
          <h3 style={{ marginTop: 19 }}>Notas del entrenador</h3>
          <p className="muted">{client.notes || 'Sin notas registradas.'}</p>
          {!client.user_id && client.email ? <p className="muted" style={{ fontSize: 12 }}>Para usar la app, el paciente debe crear su cuenta con <strong>{client.email}</strong>.</p> : null}
        </div>
        <div>
          <h3>Rutina asignada</h3>
          {routine ? (
            <div className="routine-card">
              <strong>{routine.name}</strong>
              <p className="muted">{routine.days.length} día{routine.days.length === 1 ? '' : 's'} · {exerciseCount(routine)} ejercicios{routine.source === 'fito_ai' ? ' · creada con IA' : ''}</p>
              <div className="day-summary">
                {routine.days.map((day) => <span key={day.day} className="pill neutral">{dayName(day.day).slice(0, 3)}</span>)}
              </div>
              <div className="routine-actions">
                <button className="button" onClick={() => openModal({ type: 'routine-view', clientId: client.id })}>Ver rutina</button>
                <button className="button primary" onClick={() => openModal({ type: 'routine', clientId: client.id, routineId: routine.id })}>Editar</button>
              </div>
            </div>
          ) : <p className="muted">No tiene una rutina asignada.</p>}
          <button className={`button${routine ? '' : ' primary'}`} style={{ marginTop: 12 }} onClick={() => openModal({ type: 'routine', clientId: client.id })}>
            {routine ? 'Asignar rutina nueva' : 'Asignar rutina'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
