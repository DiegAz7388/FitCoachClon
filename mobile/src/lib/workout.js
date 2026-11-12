// Motor del modo entrenamiento (lógica pura, sin React).
// Los temporizadores usan marcas de tiempo (endsAt), así que siguen correctos
// aunque la app pase a segundo plano o la pantalla se bloquee.
//
// exercises: [{ id, name, gif_url, sets, reps_min, reps_max, duration_seconds, rest_seconds, notes, instructions }]

export const PHASE = { WORK: 'work', REST: 'rest', DONE: 'done' };

export function createWorkout(exercises, now = Date.now()) {
  const list = (exercises || []).filter((e) => e && e.sets > 0);
  return {
    exercises: list,
    exIndex: 0,
    set: 1,
    phase: list.length ? PHASE.WORK : PHASE.DONE,
    workEndsAt: null,   // solo ejercicios por tiempo, mientras corre la cuenta regresiva
    restEndsAt: null,
    restTotal: 0,
    startedAt: now,
    finishedAt: list.length ? null : now,
    logs: [],           // { exerciseId, exerciseName, set, reps, weight, duration, at }
  };
}

export const currentExercise = (s) => s.exercises[s.exIndex] || null;
export const isTimed = (exercise) => Boolean(exercise && exercise.duration_seconds > 0);
export const totalSets = (s) => s.exercises.reduce((sum, e) => sum + e.sets, 0);
export const doneSets = (s) => s.logs.length;
export const progress = (s) => (totalSets(s) ? doneSets(s) / totalSets(s) : 1);

export function targetLabel(exercise) {
  if (!exercise) return '';
  if (isTimed(exercise)) return formatClock(exercise.duration_seconds);
  if (exercise.reps_min && exercise.reps_max && exercise.reps_min !== exercise.reps_max) return `${exercise.reps_min}–${exercise.reps_max} reps`;
  return `${exercise.reps_max || exercise.reps_min || 10} reps`;
}

// Siguiente paso a partir del actual (sin modificar el estado).
function nextPosition(s) {
  const exercise = currentExercise(s);
  if (s.set < exercise.sets) return { exIndex: s.exIndex, set: s.set + 1 };
  if (s.exIndex + 1 < s.exercises.length) return { exIndex: s.exIndex + 1, set: 1 };
  return null;
}

export function upNext(s) {
  if (s.phase === PHASE.DONE) return null;
  const position = nextPosition(s);
  if (!position) return null;
  return { exercise: s.exercises[position.exIndex], set: position.set };
}

function finish(s, now) {
  return { ...s, phase: PHASE.DONE, workEndsAt: null, restEndsAt: null, finishedAt: now };
}

function advance(s, now) {
  const position = nextPosition(s);
  if (!position) return finish(s, now);
  return { ...s, ...position, phase: PHASE.WORK, workEndsAt: null, restEndsAt: null, restTotal: 0 };
}

export function workoutReducer(s, action) {
  const now = action.now ?? Date.now();
  if (s.phase === PHASE.DONE && action.type !== 'RESTORE') return s;
  const exercise = currentExercise(s);

  switch (action.type) {
    case 'START_TIMER':
      if (s.phase !== PHASE.WORK || !isTimed(exercise) || s.workEndsAt) return s;
      return { ...s, workEndsAt: now + exercise.duration_seconds * 1000 };

    case 'COMPLETE_SET': {
      if (s.phase !== PHASE.WORK) return s;
      const log = {
        exerciseId: exercise.id ?? null,
        routineExerciseId: exercise.routine_exercise_id ?? null, // requerido por fc_complete_my_workout
        exerciseName: exercise.name,
        set: s.set,
        reps: isTimed(exercise) ? null : Number(action.reps ?? exercise.reps_max ?? exercise.reps_min ?? 0) || null,
        weight: action.weight != null && action.weight !== '' ? Number(action.weight) : null,
        duration: isTimed(exercise)
          ? Math.round(action.duration ?? (s.workEndsAt ? exercise.duration_seconds - Math.max(0, (s.workEndsAt - now) / 1000) : exercise.duration_seconds))
          : null,
        at: now,
      };
      const next = { ...s, logs: [...s.logs, log], workEndsAt: null };
      if (!nextPosition(next)) return finish(next, now);
      const rest = Math.max(0, Number(exercise.rest_seconds) || 0);
      if (!rest) return advance(next, now);
      return { ...next, phase: PHASE.REST, restEndsAt: now + rest * 1000, restTotal: rest };
    }

    case 'TICK':
      if (s.phase === PHASE.REST && now >= s.restEndsAt) return advance(s, now);
      if (s.phase === PHASE.WORK && s.workEndsAt && now >= s.workEndsAt) {
        return workoutReducer(s, { type: 'COMPLETE_SET', duration: exercise.duration_seconds, weight: action.weight, now });
      }
      return s;

    case 'ADD_REST':
      if (s.phase !== PHASE.REST) return s;
      return { ...s, restEndsAt: s.restEndsAt + (action.seconds ?? 15) * 1000, restTotal: s.restTotal + (action.seconds ?? 15) };

    case 'SKIP_REST':
      return s.phase === PHASE.REST ? advance(s, now) : s;

    case 'SKIP_EXERCISE': {
      if (s.exIndex + 1 >= s.exercises.length) return finish(s, now);
      return { ...s, exIndex: s.exIndex + 1, set: 1, phase: PHASE.WORK, workEndsAt: null, restEndsAt: null, restTotal: 0 };
    }

    case 'FINISH':
      return finish(s, now);

    case 'RESTORE':
      return action.state;

    default:
      return s;
  }
}

export function secondsLeft(endsAt, now = Date.now()) {
  return endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
}

export function formatClock(totalSeconds) {
  const sec = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function summary(s) {
  const volume = s.logs.reduce((sum, l) => sum + (l.weight && l.reps ? l.weight * l.reps : 0), 0);
  const exercisesDone = new Set(s.logs.map((l) => l.exerciseName)).size;
  const end = s.finishedAt ?? Date.now();
  return { sets: s.logs.length, totalSets: totalSets(s), exercisesDone, volume: Math.round(volume * 10) / 10, durationSeconds: Math.round((end - s.startedAt) / 1000) };
}
