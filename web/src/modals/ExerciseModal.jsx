import { ExerciseImage, Modal } from '../components/common.jsx';
import { exerciseSteps } from '../lib/format.js';
import { useFitCoach } from '../state.jsx';

export default function ExerciseModal({ exerciseId }) {
  const { exercises } = useFitCoach();
  const exercise = exercises.find((item) => String(item.id) === String(exerciseId));
  if (!exercise) return null;
  return (
    <Modal title={exercise.name} subtitle={`${exercise.target || exercise.muscle_group || exercise.category || ''} · ${exercise.equipment || 'sin equipo'}`}>
      <div className="detail-columns">
        <div>
          <h3>Instrucciones</h3>
          <ol className="muted" style={{ lineHeight: 1.6 }}>{exerciseSteps(exercise).map((step, index) => <li key={index}>{step}</li>)}</ol>
          <p className="muted">Músculos secundarios: {(exercise.secondary_muscles || []).join(', ') || 'No especificados'}</p>
        </div>
        <div>
          <div className="exercise-visual" style={{ height: 210, borderRadius: 14 }}><ExerciseImage exercise={exercise} /></div>
          <p className="muted" style={{ fontSize: 11 }}>Las imágenes de Gym visual se muestran cuando hay conexión y conservan su atribución.</p>
        </div>
      </div>
    </Modal>
  );
}
