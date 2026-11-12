import { useMemo, useState } from 'react';
import { Modal } from '../components/common.jsx';
import { useFitCoach } from '../state.jsx';

const DAY_OPTIONS = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado']];

export default function RoutineModal({ clientId = '' }) {
  const { clients, exercises, addRoutine, closeModal, toast } = useFitCoach();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return exercises
      .filter((exercise) => !needle || exercise.name.toLowerCase().includes(needle) || String(exercise.target || '').toLowerCase().includes(needle))
      .slice(0, 18);
  }, [exercises, search]);

  const add = (exercise) => setSelected((current) => (current.some((item) => String(item.id) === String(exercise.id)) ? current : [...current, exercise]));
  const remove = (index) => setSelected((current) => current.filter((_, i) => i !== index));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selected.length) { toast('Agrega al menos un ejercicio.'); return; }
    const form = event.currentTarget;
    const values = new FormData(form);
    const days = [...form.elements.days.selectedOptions].map((option) => Number(option.value));
    const routine = {
      id: `local-routine-${Date.now()}`,
      client_id: values.get('client_id'),
      name: values.get('name').trim(),
      session_minutes: Number(values.get('session_minutes')),
      days: days.map((day) => ({ day, exercises: selected.map((exercise) => ({ ...exercise, sets: 3, reps: '10-12' })) })),
    };
    try { await addRoutine(routine); } catch (error) { toast(error.message); }
  }

  return (
    <Modal as="form" wide title="Constructor de rutina" subtitle="Elige ejercicios del catálogo local. Se guardará como borrador si no hay conexión." onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>Nombre de rutina<input className="field" name="name" required placeholder="Ej. Fuerza base" /></label>
        <label>Cliente
          <select className="select" name="client_id" required defaultValue={String(clientId || clients[0]?.id || '')}>
            {clients.map((client) => <option key={client.id} value={String(client.id)}>{client.full_name}</option>)}
          </select>
        </label>
        <label>Días
          <select className="select" name="days" multiple size="4" defaultValue={['1', '3', '5']}>
            {DAY_OPTIONS.map(([value, label]) => <option key={value} value={String(value)}>{label}</option>)}
          </select>
        </label>
        <label>Duración estimada
          <select className="select" name="session_minutes" defaultValue="60">
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">60 min</option>
            <option value="90">90 min</option>
          </select>
        </label>
      </div>
      <div className="builder-layout" style={{ marginTop: 17 }}>
        <div>
          <input className="field" placeholder="Buscar ejercicio para agregar..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="list" style={{ marginTop: 10, maxHeight: 350, overflow: 'auto' }}>
            {results.map((exercise) => (
              <button type="button" key={exercise.id} className="list-row" onClick={() => add(exercise)}>
                <span className="initials">+</span>
                <span className="row-content"><strong>{exercise.name}</strong><p>{exercise.target || exercise.category || ''} · {exercise.equipment || ''}</p></span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3>Ejercicios seleccionados</h3>
          <div className="selected-exercises">
            {selected.map((exercise, index) => (
              <div className="selected-exercise" key={exercise.id}>
                <span>{exercise.name}</span>
                <button type="button" onClick={() => remove(index)}>Quitar</button>
              </div>
            ))}
            {!selected.length && <p className="muted">Aún no agregas ejercicios.</p>}
          </div>
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="button" onClick={closeModal}>Cancelar</button>
        <button className="button primary">Guardar rutina</button>
      </div>
    </Modal>
  );
}
