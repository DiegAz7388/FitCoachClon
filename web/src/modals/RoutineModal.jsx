import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/common.jsx';
import { emptyPlanner, finalize, fromDays, setDraft, summarize, toggleDay } from '../lib/dayPlanner.js';
import { EXERCISE_MEDIA_BASE } from '../lib/format.js';
import { useFitCoach } from '../state.jsx';

// 1 = Lunes … 7 = Domingo (como en la base de datos).
const DAY_OPTIONS = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [7, 'Domingo']];
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

export default function RoutineModal({ clientId = '', routineId = null }) {
  const { clients, routines } = useFitCoach();
  const [tab, setTab] = useState('manual');
  const [client, setClient] = useState(String(clientId || clients[0]?.id || ''));
  const editing = routineId ? routines.find((item) => String(item.id) === String(routineId)) : null;

  if (editing) {
    const patient = clients.find((item) => String(item.id) === String(editing.client_id));
    return (
      <Modal wide title="Editar rutina" subtitle={`${patient?.full_name || 'Paciente'} · Elige un día para agregar, quitar o modificar sus ejercicios. El paciente ve los cambios en la app al guardar.`}>
        <ManualBuilder clientId={String(editing.client_id)} routine={editing} />
      </Modal>
    );
  }

  return (
    <Modal wide title="Constructor de rutina" subtitle="Arma la rutina a mano o deja que la IA proponga una para revisarla antes de asignarla.">
      <div className="builder-tabs">
        <button type="button" className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>Manual</button>
        <button type="button" className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>✦ Con IA</button>
      </div>
      <div className="form-grid" style={{ marginBottom: 12 }}>
        <label>Paciente
          <select className="select" value={client} onChange={(event) => setClient(event.target.value)} required>
            {clients.map((item) => <option key={item.id} value={String(item.id)}>{item.full_name}</option>)}
          </select>
        </label>
      </div>
      {tab === 'manual' ? <ManualBuilder clientId={client} /> : <AiBuilder clientId={client} />}
    </Modal>
  );
}

// Buscador del catálogo: un clic agrega el ejercicio.
function ExercisePicker({ onPick, maxHeight = 380, autoFocus = false }) {
  const { exercises } = useFitCoach();
  const [search, setSearch] = useState('');
  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return exercises
      .filter((exercise) => !needle || exercise.name.toLowerCase().includes(needle) || String(exercise.target || '').toLowerCase().includes(needle))
      .slice(0, 18);
  }, [exercises, search]);
  return (
    <div>
      <input className="field" placeholder="Buscar ejercicio para agregar..." value={search} autoFocus={autoFocus} onChange={(event) => setSearch(event.target.value)} />
      <div className="list" style={{ marginTop: 10, maxHeight, overflow: 'auto' }}>
        {results.map((exercise) => (
          <button type="button" key={exercise.id} className="list-row" onClick={() => onPick(exercise)}>
            <span className="initials">+</span>
            <span className="row-content"><strong>{exercise.name}</strong><p>{exercise.target || exercise.category || ''} · {exercise.equipment || ''}</p></span>
          </button>
        ))}
        {!results.length && <p className="muted">Sin resultados.</p>}
      </div>
    </div>
  );
}

const sameExercise = (a, b) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase();

// Ejercicio guardado en Supabase → elemento editable del constructor.
const fromSaved = (exercise) => ({ id: `db-${exercise.id}`, name: exercise.name, gif_url: exercise.gif_url, notes: exercise.notes, cfg: toCfg(exercise) });

// Sin `routine` crea una rutina; con `routine` edita esa rutina (se guarda como versión nueva).
function ManualBuilder({ clientId, routine = null }) {
  const { addRoutine, closeModal, openModal, toast } = useFitCoach();
  const [planner, setPlanner] = useState(() => (routine
    ? fromDays(routine.days.map((day) => ({ day: day.day, exercises: day.exercises.map(fromSaved) })))
    : emptyPlanner()));
  const [saving, setSaving] = useState(false);
  const selected = planner.draft;
  const groups = summarize(planner);

  const setSelected = (updater) => setPlanner((current) => setDraft(current, updater));
  const add = (exercise) => {
    if (selected.some((item) => sameExercise(item, exercise))) { toast('Ese ejercicio ya está en la lista.'); return; }
    setSelected((current) => [...current, { ...exercise, cfg: defaultConfig(exercise) }]);
  };
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
    if (selected.length && !planner.active.length) { toast('Elige los días para los ejercicios de la lista.'); return; }
    const days = finalize(planner);
    if (!days.length) { toast('Elige al menos un día y agrégale ejercicios.'); return; }
    const normalize = (exercise) => {
      const cfg = { ...exercise.cfg, sets: exercise.cfg.sets || 3, rest_seconds: exercise.cfg.rest_seconds === '' ? 60 : exercise.cfg.rest_seconds };
      if (cfg.mode === 'reps') { cfg.reps_min = cfg.reps_min || 10; cfg.reps_max = Math.max(cfg.reps_min, cfg.reps_max || cfg.reps_min); }
      return { ...exercise, cfg, sets: cfg.sets, reps: cfg.mode === 'time' ? `${cfg.duration_seconds} s` : cfg.reps_min === cfg.reps_max ? String(cfg.reps_min) : `${cfg.reps_min}-${cfg.reps_max}` };
    };
    const form = event.currentTarget;
    const payload = {
      id: `local-routine-${Date.now()}`,
      client_id: clientId,
      name: form.elements.name.value.trim(),
      session_minutes: Number(form.elements.session_minutes.value),
      // Los días conservan su nombre (p. ej. "Tren superior" de la IA).
      days: days.map(({ day, exercises: list }) => ({ day, label: routine?.days.find((d) => d.day === day)?.label, exercises: list.map(normalize) })),
      base: routine || undefined,
    };
    setSaving(true);
    try { await addRoutine(payload); } catch (error) { toast(error.message); } finally { setSaving(false); }
  }

  const activeLabel = planner.active.length ? joinDays(planner.active) : '';

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>Nombre de rutina<input className="field" name="name" required minLength={2} placeholder="Ej. Fuerza base" defaultValue={routine?.name} /></label>
        <label>Duración estimada
          <select className="select" name="session_minutes" defaultValue={String(routine?.session_minutes || 60)}>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">60 min</option>
            <option value="90">90 min</option>
          </select>
        </label>
      </div>

      <div className="day-picker">
        <span className="day-picker-label">Días</span>
        <div className="day-chips" role="group" aria-label="Días de entrenamiento">
          {DAY_OPTIONS.map(([value, label]) => {
            const active = planner.active.includes(value);
            const count = planner.plan[value]?.length;
            return (
              <button type="button" key={value} aria-pressed={active}
                className={`day-chip${active ? ' active' : ''}${count ? ' done' : ''}`}
                onClick={() => setPlanner((current) => toggleDay(current, value))}>
                {label.slice(0, 3)}
                {count ? <small>{count}</small> : null}
              </button>
            );
          })}
        </div>
        <p className="muted day-hint">
          {planner.active.length
            ? selected.length
              ? `Editando ${activeLabel}. Al elegir otro día, estos ejercicios se guardan y la lista queda limpia.`
              : `Agrega los ejercicios para ${activeLabel}. Puedes elegir más días para que compartan los mismos ejercicios.`
            : 'Elige uno o más días y luego agrega sus ejercicios.'}
        </p>
        {groups.length ? (
          <div className="day-summary">
            {groups.map((group) => <span key={group.days.join()} className="pill active">{joinDays(group.days)} · {group.count} ejercicio{group.count === 1 ? '' : 's'}</span>)}
          </div>
        ) : null}
      </div>

      <div className="builder-layout" style={{ marginTop: 17 }}>
        <ExercisePicker onPick={add} />
        <div>
          <h3>{activeLabel ? `Ejercicios de ${activeLabel}` : 'Ejercicios seleccionados'}</h3>
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
            {!selected.length && <p className="muted">Aún no agregas ejercicios{activeLabel ? ` para ${activeLabel}` : ''}.</p>}
          </div>
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="button" onClick={routine ? () => openModal({ type: 'routine-view', clientId }) : closeModal}>Cancelar</button>
        <button className="button primary" disabled={saving}>{saving ? 'Guardando…' : routine ? 'Guardar cambios' : 'Guardar rutina'}</button>
      </div>
    </form>
  );
}

// "Lunes", "Lunes y Miércoles", "Lunes, Miércoles y Viernes"
function joinDays(days) {
  const names = days.map((d) => DAY_OPTIONS.find(([v]) => v === d)?.[1]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0];
}

// Propuesta de la IA → revisión por día → asignación.
function AiBuilder({ clientId }) {
  const { proposeAiRoutine, assignAiRoutine, resolveExerciseIds, closeModal, toast } = useFitCoach();
  const [adding, setAdding] = useState(null); // índice del día al que se le agregan ejercicios
  const [answers, setAnswers] = useState({ goal: 'general', experience_level: 'beginner', training_location: 'gym', days_per_week: 3, session_minutes: 45, limitations: '' });
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const elapsed = useElapsed(Boolean(busy));
  const set = (key, numeric) => (event) => setAnswers({ ...answers, [key]: numeric ? Number(event.target.value) : event.target.value });

  async function propose() {
    setBusy('propose'); setError(''); setAdding(null);
    try {
      const { plan: result, request_id: requestId } = await proposeAiRoutine(clientId, answers);
      setPlan({ ...result, requestId, days: result.days.map((day) => ({ ...day, exercises: day.exercises.map((e) => ({ ...e, cfg: toCfg(e) })) })) });
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }

  async function assign() {
    if (!plan.days.some((day) => day.exercises.length)) { toast('La rutina no tiene ejercicios.'); return; }
    setBusy('assign');
    setError('');
    try {
      // Los ejercicios agregados a mano vienen del catálogo del panel: se busca su id en Supabase.
      const added = plan.days.flatMap((day) => day.exercises).filter((e) => !e.exercise_id).map((e) => e.name);
      const ids = added.length ? await resolveExerciseIds(added) : new Map();
      const reviewed = {
        name: plan.name, summary: plan.summary,
        days: plan.days
          .map((day) => ({ day_of_week: day.day_of_week, label: day.label, exercises: day.exercises.map((e) => fromCfg(e.exercise_id ?? ids.get(e.name.trim()), e.cfg, e.notes)) }))
          .filter((day) => day.exercises.length),
      };
      await assignAiRoutine(clientId, answers, reviewed, plan.requestId);
    } catch (err) { setError(err.message); setBusy(''); }
  }

  const addToDay = (dayIndex, exercise) => {
    if (plan.days[dayIndex].exercises.some((e) => sameExercise(e, exercise))) { toast('Ese ejercicio ya está en este día.'); return; }
    setPlan((current) => ({
      ...current,
      days: current.days.map((day, d) => (d !== dayIndex ? day : { ...day, exercises: [...day.exercises, { exercise_id: null, name: exercise.name, notes: null, cfg: defaultConfig(exercise) }] })),
    }));
  };

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
            <option value="gym">Gimnasio</option><option value="home">Casa</option><option value="mixed">Ambos</option>
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
        <button type="button" className="button primary" onClick={propose} disabled={Boolean(busy)}>{busy === 'propose' ? `Generando… ${elapsed} s` : plan ? '✦ Generar otra propuesta' : '✦ Generar propuesta'}</button>
        {busy === 'propose' ? <span className="muted ai-wait">La IA suele tardar entre 10 y 40 segundos.</span> : null}
      </div>

      {error ? <div className="status-banner danger ai-error" role="alert">{error}</div> : null}

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
                {!day.exercises.length && <p className="muted">Sin ejercicios: este día no se asignará.</p>}
              </div>
              {adding === dayIndex ? (
                <div className="ai-add">
                  <ExercisePicker onPick={(exercise) => addToDay(dayIndex, exercise)} maxHeight={240} autoFocus />
                  <button type="button" className="button" style={{ marginTop: 8 }} onClick={() => setAdding(null)}>Listo</button>
                </div>
              ) : day.exercises.length >= MAX_AI_EXERCISES ? (
                <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Máximo {MAX_AI_EXERCISES} ejercicios por día.</p>
              ) : (
                <button type="button" className="button add-exercise" onClick={() => setAdding(dayIndex)}>+ Agregar ejercicio</button>
              )}
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

// La función de IA guarda hasta 10 ejercicios por día.
const MAX_AI_EXERCISES = 10;

const toCfg = (e) => (e.duration_seconds
  ? { sets: e.sets || 3, mode: 'time', reps_min: 10, reps_max: 12, duration_seconds: e.duration_seconds, rest_seconds: e.rest_seconds ?? 60 }
  : { sets: e.sets || 3, mode: 'reps', reps_min: e.reps_min ?? 10, reps_max: e.reps_max ?? e.reps_min ?? 12, duration_seconds: 30, rest_seconds: e.rest_seconds ?? 60 });

const fromCfg = (exerciseId, cfg, notes) => ({
  exercise_id: exerciseId,
  sets: Number(cfg.sets) || 3,
  reps_min: cfg.mode === 'time' ? null : Number(cfg.reps_min) || 10,
  reps_max: cfg.mode === 'time' ? null : Number(cfg.reps_max) || Number(cfg.reps_min) || 12,
  duration_seconds: cfg.mode === 'time' ? Number(cfg.duration_seconds) || 30 : null,
  rest_seconds: cfg.rest_seconds === '' ? 60 : Number(cfg.rest_seconds),
  notes: notes || null,
});

// Segundos transcurridos mientras `running` es verdadero (para mostrar el avance de la IA).
function useElapsed(running) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) { setSeconds(0); return undefined; }
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(id);
  }, [running]);
  return seconds;
}
