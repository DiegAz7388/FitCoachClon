import { DetailLine, Modal } from '../components/common.jsx';
import { dayName, textStatus } from '../lib/format.js';
import { useFitCoach } from '../state.jsx';

export default function ClientModal({ clientId }) {
  const { clients, routines, openModal, isRemote } = useFitCoach();
  const client = clients.find((item) => String(item.id) === String(clientId)) || { full_name: 'Cliente sin asignar', id: '' };
  const routine = routines.find((item) => String(item.client_id) === String(client.id));
  return (
    <Modal title={client.full_name} subtitle="Expediente de cliente">
      <div className="detail-columns">
        <div>
          <div className="detail-list">
            <DetailLine label="Correo">{client.email || 'No registrado'}</DetailLine>
            <DetailLine label="Teléfono">{client.phone || 'No registrado'}</DetailLine>
            <DetailLine label="Objetivo">{client.goal || 'Sin definir'}</DetailLine>
            <DetailLine label="Estatura">{client.height_cm ? `${client.height_cm} cm` : 'Sin registrar'}</DetailLine>
            <DetailLine label="Estado">{textStatus(client.status)}</DetailLine>
            {isRemote && <DetailLine label="App móvil">{client.user_id ? 'Vinculada' : 'Sin vincular'}</DetailLine>}
          </div>
          <h3 style={{ marginTop: 19 }}>Notas del entrenador</h3>
          <p className="muted">{client.notes || 'Sin notas registradas.'}</p>
          {isRemote && !client.user_id && client.email ? <p className="muted" style={{ fontSize: 12 }}>Para usar la app, el paciente debe crear su cuenta con <strong>{client.email}</strong>.</p> : null}
        </div>
        <div>
          <h3>Rutina asignada</h3>
          {routine ? (
            <div className="routine-day">
              <strong>{routine.name}</strong>
              <p className="muted">{routine.days.length} día(s) de entrenamiento</p>
              {routine.days.map((day) => (
                <div className="routine-day" key={day.day}>
                  <strong>{day.label || dayName(day.day)}</strong>
                  <ol>
                    {day.exercises.map((exercise, index) => (
                      <li key={`${exercise.id}-${index}`}>
                        {exercise.name}
                        {exercise.sets ? <span className="muted"> · {exercise.sets} × {exercise.duration_seconds ? `${exercise.duration_seconds} s` : `${exercise.reps} reps`}{exercise.rest_seconds != null ? ` · descanso ${exercise.rest_seconds} s` : ''}</span> : null}
                      </li>
                    ))}
                    {!day.exercises.length && <li>Sin ejercicios</li>}
                  </ol>
                </div>
              ))}
            </div>
          ) : <p className="muted">No tiene una rutina asignada.</p>}
          <button className="button primary" style={{ marginTop: 12 }} onClick={() => openModal({ type: 'routine', clientId: client.id })}>Asignar rutina</button>
        </div>
      </div>
    </Modal>
  );
}
