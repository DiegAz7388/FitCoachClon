import { useState } from 'react';
import { Modal } from '../components/common.jsx';
import { dayName } from '../lib/format.js';
import { useFitCoach } from '../state.jsx';
import { exerciseCount } from './ClientModal.jsx';

// "4 × 8-12 reps · descanso 90 s" / "3 × 30 s · descanso 30 s"
export function prescription(exercise) {
  const work = exercise.duration_seconds ? `${exercise.duration_seconds} s` : `${exercise.reps || '?'} reps`;
  return `${exercise.sets} × ${work}${exercise.rest_seconds != null ? ` · descanso ${exercise.rest_seconds} s` : ''}`;
}

// Rutina activa del paciente, de solo lectura, con accesos a editar o quitar.
export default function RoutineViewModal({ clientId }) {
  const { clients, routines, openModal, removeRoutine, toast } = useFitCoach();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const client = clients.find((item) => String(item.id) === String(clientId));
  const routine = routines.find((item) => String(item.client_id) === String(clientId));

  if (!routine) {
    return (
      <Modal title="Rutina" subtitle={client?.full_name}>
        <p className="muted">Este paciente no tiene una rutina asignada.</p>
        <div className="form-actions"><button className="button primary" onClick={() => openModal({ type: 'routine', clientId })}>Asignar rutina</button></div>
      </Modal>
    );
  }

  async function remove() {
    setRemoving(true);
    try { await removeRoutine(routine); } catch (error) { toast(error.message); setRemoving(false); setConfirming(false); }
  }

  return (
    <Modal wide title={routine.name} subtitle={`${client?.full_name || 'Paciente'} · ${routine.days.length} días · ${exerciseCount(routine)} ejercicios · ${routine.session_minutes} min por sesión`}>
      <div className="routine-view">
        {routine.days.map((day) => (
          <div className="routine-day" key={day.day}>
            <strong>{dayName(day.day)}</strong>
            {day.label && day.label !== dayName(day.day) ? <span className="muted"> · {day.label}</span> : null}
            <div className="view-exercises">
              {day.exercises.map((exercise, index) => (
                <div className="view-exercise" key={`${exercise.id}-${index}`}>
                  {exercise.gif_url ? <img className="exercise-thumb" src={exercise.gif_url} alt="" loading="lazy" onError={(event) => event.currentTarget.remove()} /> : <span className="exercise-thumb" />}
                  <div>
                    <strong>{index + 1}. {exercise.name}</strong>
                    <p className="muted">{prescription(exercise)}</p>
                    {exercise.notes ? <p className="muted view-note">{exercise.notes}</p> : null}
                  </div>
                </div>
              ))}
              {!day.exercises.length && <p className="muted">Sin ejercicios</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="form-actions routine-view-actions">
        {confirming ? (
          <span className="confirm-remove">
            <span className="muted">El paciente dejará de ver esta rutina en la app.</span>
            <button className="button" onClick={() => setConfirming(false)} disabled={removing}>No</button>
            <button className="button danger" onClick={remove} disabled={removing}>{removing ? 'Quitando…' : 'Sí, quitar'}</button>
          </span>
        ) : (
          <button className="button danger" onClick={() => setConfirming(true)}>Quitar rutina</button>
        )}
        <span style={{ flex: 1 }} />
        <button className="button" onClick={() => openModal({ type: 'client', clientId })}>Expediente</button>
        <button className="button primary" onClick={() => openModal({ type: 'routine', clientId, routineId: routine.id })}>Editar rutina</button>
      </div>
    </Modal>
  );
}
