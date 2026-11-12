import { useMemo, useState } from 'react';
import Shell from '../components/Shell.jsx';
import Topbar from '../components/Topbar.jsx';
import { ExerciseImage } from '../components/common.jsx';
import { exerciseSubtitle } from '../lib/format.js';
import { useFitCoach } from '../state.jsx';

export default function Exercises() {
  const { exercises, isRemote, openModal, toast } = useFitCoach();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const categories = useMemo(() => [...new Set(exercises.map((exercise) => exercise.category).filter(Boolean))].sort(), [exercises]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return exercises.filter((exercise) => {
      const text = [exercise.name, exercise.category, exercise.target, exercise.equipment, exercise.muscle_group].filter(Boolean).join(' ').toLowerCase();
      return (!needle || text.includes(needle)) && (category === 'all' || exercise.category === category);
    });
  }, [exercises, search, category]);

  return (
    <Shell>
      <Topbar title="Biblioteca de ejercicios" eyebrow="Catálogo local y sin conexión">
        <button className="button" disabled={!isRemote} onClick={() => toast('El catálogo completo ya se consulta localmente. Los ejercicios de una rutina se sincronizan al guardarla.')}>
          Sincronizar seleccionados
        </button>
      </Topbar>
      <section className="card">
        <div className="toolbar">
          <input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por ejercicio, músculo o equipo..." />
          <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">Todas las categorías</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <span className="muted">{filtered.length.toLocaleString('es-MX')} ejercicios disponibles localmente</span>
        </div>
      </section>
      <section className="exercise-grid">
        {filtered.slice(0, 60).map((exercise) => (
          <button key={exercise.id} className="exercise-card" onClick={() => openModal({ type: 'exercise', exerciseId: exercise.id })}>
            <span className="exercise-visual"><ExerciseImage exercise={exercise} lazy /></span>
            <span className="exercise-content"><h3>{exercise.name}</h3><p>{exerciseSubtitle(exercise)}</p></span>
          </button>
        ))}
        {!filtered.length && <div className="empty">No encontramos ejercicios con esos filtros.</div>}
      </section>
      <p className="muted" style={{ marginTop: 18, fontSize: 12 }}>
        Datos e instrucciones: exercises-dataset. Las imágenes se muestran cuando hay conexión; el catálogo, instrucciones y constructor permanecen disponibles sin conexión. Ver <a href="./EXERCISES_NOTICE.md" target="_blank" rel="noreferrer">aviso de atribución</a>.
      </p>
    </Shell>
  );
}
