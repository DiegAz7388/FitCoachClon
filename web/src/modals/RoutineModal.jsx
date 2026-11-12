import { useMemo, useState } from 'react';
import { Modal } from '../components/common.jsx';
import { EXERCISE_MEDIA_BASE } from '../lib/format.js';
import { useFitCoach } from '../state.jsx';

const DAY_OPTIONS = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']];
const TIMED_HINT = /plank|plancha|hold|wall sit|isometric|jump rope|run|bike|cardio/i;

// Configuración inicial razonable según el tipo de ejercicio.
export function defaultConfig(exercise) {
  const timed = exercise.category === 'cardio' || TIMED_HINT.test(exercise.name);
  return timed
    ? { sets: 3, mode: 'time', reps_min: 10, reps_max: 12, duration_seconds: exercise.category === 'cardio' ? 60 : 30, rest_seconds: 30 }
    : { sets: 3, mode: 'reps', reps_min: 10, reps_max: 12, duration_seconds: 30, rest_seconds: 60 };
}

const thumb = (exercise) => {
  const path = exercise.gif_url || exercise.image;
  return path ? (/^https?:/.test(path) ? path : EXERCISE_MEDIA_BASE + path) : null;
};

// Edición de series / reps o tiempo / descanso de un ejercicio.
export function SetConfig({ cfg, onChange }) {
  const set = (key) => (event) => onChange({ ...cfg, [key]: event.target.value === '' ? '' : Number(event.target.value) });
  return (
    <div className="set-config">
      <label>Series<input type="number" min="1" max="10" value={cfg.sets} onChange={set('sets')} /></label>
      <label>Tipo
        <select value={cfg.mode} onChange={(event) => onChange({ ...cfg, mode: event.target.value })}>
          <option value="reps">Reps</option>
          <option value="time">Tiempo</option>
        </select>
      </label>
      {cfg.mode === 'reps' ? (
        <>
          <label>Reps mín.<input type="number" min="1" max="100" value={cfg.reps_min} onChange={set('reps_min')} /></label>
          <label>Reps máx.<input type="number" min="1" max="100" value={cfg.reps_max} onChange={set('reps_max')} /></label>
        </>
      ) : (
        <label>Segundos<input type="number" min="5" max="900" step="5" value={cfg.duration_seconds} onChange={set('duration_seconds')} /></label>
      )}
      <label>Descanso (s)<input type="number" min="0" max="600" step="5" value={cfg.rest_seconds} onChange={set('rest_seconds')} /></label>
    </div>
  );
}

export default function RoutineModal({ clientId = '' }) {
  const { clients, isRemote } = useFitCoach();
  const [tab, setTab] = useState('manual');
  const [client, setClient] = useState(String(clientId || clients[0]?.id || ''));
  return (
    <Modal wide title="Constructor de rutina" subtitle="Arma la rutina a mano o deja que la IA proponga una para revisarla antes de asignarla.">
      <div className="builder-tabs">
        <button type="button" className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>Manual</button>
        <button type="button" className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>✦ Con IA</button>
      </div>
      <div className="form-grid" style={{ marginBottom: 12 }}>
        <label>Cliente
          <select className="select" value={client} onChange={(event) => setClient(event.target.value)} required>
            {clients.map((item) => <option key={item.id} value={String(item.id)}>{item.full_name}</option>)}
          </select>
        </label>
      </div>
      {tab === 'manual' ? <ManualBuilder clientId={client} /> : isRemote ? <AiBuilder clientId={client} /> : (
        <div className="status-banner warn">Conecta Arnold V2 para generar rutinas con IA. La generación se hace en el servidor con la clave de OpenAI.</div>
      )}
    </Modal>
  );
}

function ManualBuilder({ clientId }) {
  const { exercises, addRoutine, closeModal, toast } = useFitCoach();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return exercises
      .filter((exercise) => !needle || exercise.name.toLowerCase().includes(needle) || String(exercise.target || '').toLowerCase().includes(needle))
      .slice(0, 18);
  }, [exercises, search]);

  const add = (exercise) => setSelected((current) => (current.some((item) => String(item.id) === String(exercise.id)) ? current : [...current, { ...exercise, cfg: defaultConfig(exercise) }]));
  const remove = (index) => setSelected((current) => current.filter((_, i) => i !== index));
  const updateCfg = (index, cfg) => setSelected((current) => current.map((item, i) => (i === index ? { ...item, cfg } : item)));
  const move = (index, delta) => setSelected((current) => {
    const next = [...current]; const target = index + delta;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selected.length) { toast('Agrega al menos un ejercicio.'); return; }
    const form = event.currentTarget;
    const days = [...form.elements.days.selectedOptions].map((option) => Number(option.value));
    if (!days.length) { toast('Elige al menos un día.'); return; }
    const exercisesWithCfg = selected.map((exercise) => {
      const cfg = { ...exercise.cfg, sets: exercise.cfg.sets || 3, rest_seconds: exercise.cfg.rest_seconds === '' ? 60 : exercise.cfg.rest_seconds };
      if (cfg.mode === 'reps') { cfg.reps_min = cfg.reps_min || 10; cfg.reps_max = Math.max(cfg.reps_min, cfg.reps_max || cfg.reps_min); }
      return { ...exercise, cfg, sets: cfg.sets, reps: cfg.mode === 'time' ? `${cfg.duration_seconds} s` : cfg.reps_min === cfg.reps_max ? String(cfg.reps_min) : `${cfg.reps_min}-${cfg.reps_max}` };
    });
    const routine = {
      id: `local-routine-${Date.now()}`,
      client_id: clientId,
      name: form.elements.name.value.trim(),
      session_minutes: Number(form.elements.session_minutes.value),
      days: days.map((day) => ({ day, exercises: exercisesWithCfg })),
    };
    setSaving(true);
    try { await addRoutine(routine); } catch (error) { toast(error.message); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>Nombre de rutina<input className="field" name="name" required placeholder="Ej. Fuerza base" /></label>
        <label>Duración estimada
          <select className="select" name="session_minutes" defaultValue="60">
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">60 min</option>
            <option value="90">90 min</option>
          </select>
        </label>
        <label>Días
          <select className="select" name="days" multiple size="4" defaultValue={['1', '3', '5']}>
            {DAY_OPTIONS.map(([value, label]) => <option key={value} value={String(value)}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="builder-layout" style={{ marginTop: 17 }}>
        <div>
          <input className="field" placeholder="Buscar ejercicio para agregar..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="list" style={{ marginTop: 10, maxHeight: 380, overflow: 'auto' }}>
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
                {thumb(exercise) ? <img className="exercise-thumb" src={thumb(exercise)} alt="" onError={(event) => event.currentTarget.remove()} /> : null}
                <span>{index + 1}. {exercise.name}</span>
                <button type="button" style={{ color: 'var(--muted)' }} onClick={() => move(index, -1)} aria-label="Subir">↑</button>
                <button type="button" style={{ color: 'var(--muted)' }} onClick={() => move(index, 1)} aria-label="Bajar">↓</button>
                <button type="button" onClick={() => remove(index)}>Quitar</button>
                <SetConfig cfg={exercise.cfg} onChange={(cfg) => updateCfg(index, cfg)} />
              </div>
            ))}
            {!selected.length && <p className="muted">Aún no agregas ejercicios.</p>}
          </div>
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="button" onClick={closeModal}>Cancelar</button>
        <button className="button primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar rutina'}</button>
      </div>
    </form>
  );
}

// Propuesta de la IA → revisión por día → asignación.
function AiBuilder({ clientId }) {
  const { proposeAiRoutine, assignAiRoutine, closeModal, toast } = useFitCoach();
  const [answers, setAnswers] = useState({ goal: 'general', experience_level: 'beginner', training_location: 'gym', days_per_week: 3, session_minutes: 45, limitations: '' });
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState('');
  const set = (key, numeric) => (event) => setAnswers({ ...answers, [key]: numeric ? Number(event.target.value) : event.target.value });

  async function propose() {
    setBusy('propose');
    try {
      const result = await proposeAiRoutine(clientId, answers);
      setPlan({ ...result, days: result.days.map((day) => ({ ...day, exercises: day.exercises.map((e) => ({ ...e, cfg: toCfg(e) })) })) });
    } catch (error) { toast(error.message); } finally { setBusy(''); }
  }

  async function assign() {
    const reviewed = {
      name: plan.name, summary: plan.summary,
      days: plan.days.map((day) => ({ day_of_week: day.day_of_week, label: day.label, exercises: day.exercises.map((e) => fromCfg(e.exercise_id, e.cfg, e.notes)) })).filter((day) => day.exercises.length),
    };
    if (!reviewed.days.length) { toast('La rutina no tiene ejercicios.'); return; }
    setBusy('assign');
    try { await assignAiRoutine(clientId, answers, reviewed); } catch (error) { toast(error.message); setBusy(''); }
  }

  const updateExercise = (dayIndex, exIndex, patch) => setPlan((current) => ({
    ...current,
    days: current.days.map((day, d) => (d !== dayIndex ? day : { ...day, exercises: patch === null ? day.exercises.filter((_, i) => i !== exIndex) : day.exercises.map((e, i) => (i === exIndex ? { ...e, ...patch } : e)) })),
  }));

  return (
    <div>
      <div className="form-grid">
        <label>Objetivo
          <select className="select" value={answers.goal} onChange={set('goal')}>
            <option value="fat_loss">Perder grasa</option><option value="muscle">Ganar músculo</option><option value="strength">Ganar fuerza</option><option value="general">Condición general</option>
          </select>
        </label>
        <label>Nivel
          <select className="select" value={answers.experience_level} onChange={set('experience_level')}>
            <option value="beginner">Principiante</option><option value="intermediate">Intermedio</option><option value="advanced">Avanzado</option>
          </select>
        </label>
        <label>Lugar
          <select className="select" value={answers.training_location} onChange={set('training_location')}>
            <option value="gym">Gimnasio</option><option value="home">Casa</option>
          </select>
        </label>
        <label>Días por semana
          <select className="select" value={answers.days_per_week} onChange={set('days_per_week', true)}>
            {[2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label>Minutos por sesión
          <select className="select" value={answers.session_minutes} onChange={set('session_minutes', true)}>
            {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </label>
        <label>Lesiones o limitaciones<input className="field" value={answers.limitations} onChange={set('limitations')} placeholder="Ej. rodilla derecha" /></label>
      </div>
      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="button primary" onClick={propose} disabled={Boolean(busy)}>{busy === 'propose' ? 'Generando…' : plan ? '✦ Generar otra propuesta' : '✦ Generar propuesta'}</button>
      </div>

      {plan && (
        <div style={{ marginTop: 8 }}>
          <h3 style={{ marginBottom: 0 }}>{plan.name}</h3>
          <p className="ai-summary">{plan.summary}</p>
          {plan.days.map((day, dayIndex) => (
            <div className="ai-day" key={day.day_of_week}>
              <h3>{day.label}</h3>
              <div className="selected-exercises" style={{ maxHeight: 'none' }}>
                {day.exercises.map((e, exIndex) => (
                  <div className="selected-exercise" key={`${e.exercise_id}-${exIndex}`}>
                    <span><span style={{ textTransform: 'capitalize' }}>{exIndex + 1}. {e.name}</span>{e.notes ? <em className="muted"> — {e.notes}</em> : null}</span>
                    <button type="button" onClick={() => updateExercise(dayIndex, exIndex, null)}>Quitar</button>
                    <SetConfig cfg={e.cfg} onChange={(cfg) => updateExercise(dayIndex, exIndex, { cfg })} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="form-actions">
            <button type="button" className="button" onClick={closeModal}>Cancelar</button>
            <button type="button" className="button primary" onClick={assign} disabled={Boolean(busy)}>{busy === 'assign' ? 'Asignando…' : 'Asignar esta rutina'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const toCfg = (e) => (e.duration_seconds
  ? { sets: e.sets, mode: 'time', reps_min: 10, reps_max: 12, duration_seconds: e.duration_seconds, rest_seconds: e.rest_seconds }
  : { sets: e.sets, mode: 'reps', reps_min: e.reps_min, reps_max: e.reps_max, duration_seconds: 30, rest_seconds: e.rest_seconds });

const fromCfg = (exerciseId, cfg, notes) => ({
  exercise_id: exerciseId,
  sets: Number(cfg.sets) || 3,
  reps_min: cfg.mode === 'time' ? null : Number(cfg.reps_min) || 10,
  reps_max: cfg.mode === 'time' ? null : Number(cfg.reps_max) || Number(cfg.reps_min) || 12,
  duration_seconds: cfg.mode === 'time' ? Number(cfg.duration_seconds) || 30 : null,
  rest_seconds: cfg.rest_seconds === '' ? 60 : Number(cfg.rest_seconds),
  notes: notes || null,
});
