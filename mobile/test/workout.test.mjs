// node --test test/   (lógica del modo entrenamiento)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorkout, workoutReducer as r, PHASE, secondsLeft, summary, upNext, targetLabel, formatClock, progress } from '../src/lib/workout.js';

const squat = { id: 1, routine_exercise_id: 101, name: 'Sentadilla', sets: 2, reps_min: 8, reps_max: 12, rest_seconds: 60 };
const plank = { id: 2, name: 'Plancha', sets: 2, duration_seconds: 30, rest_seconds: 20 };
const T = 1_000_000;

test('series con repeticiones y descanso automático', () => {
  let s = createWorkout([squat, plank], T);
  assert.equal(s.phase, PHASE.WORK);
  assert.equal(targetLabel(squat), '8–12 reps');
  s = r(s, { type: 'COMPLETE_SET', reps: 10, weight: 40, now: T + 30_000 });
  assert.equal(s.phase, PHASE.REST);
  assert.equal(s.logs[0].routineExerciseId, 101, 'guarda el id del ejercicio de la rutina');
  assert.equal(secondsLeft(s.restEndsAt, T + 30_000), 60);
  assert.deepEqual(upNext(s), { exercise: squat, set: 2 });
  s = r(s, { type: 'TICK', now: T + 60_000 });
  assert.equal(s.phase, PHASE.REST, 'aún descansando');
  s = r(s, { type: 'TICK', now: T + 90_000 });
  assert.equal(s.phase, PHASE.WORK); assert.equal(s.set, 2);
});

test('+15 s y saltar descanso', () => {
  let s = r(createWorkout([squat], T), { type: 'COMPLETE_SET', now: T });
  s = r(s, { type: 'ADD_REST', seconds: 15, now: T });
  assert.equal(secondsLeft(s.restEndsAt, T), 75);
  assert.equal(s.restTotal, 75);
  s = r(s, { type: 'SKIP_REST', now: T + 1000 });
  assert.equal(s.phase, PHASE.WORK); assert.equal(s.set, 2);
});

test('ejercicio por tiempo: cuenta regresiva que completa la serie sola', () => {
  let s = createWorkout([plank], T);
  assert.equal(targetLabel(plank), '0:30');
  s = r(s, { type: 'TICK', now: T + 60_000 });
  assert.equal(s.logs.length, 0, 'sin iniciar no avanza');
  s = r(s, { type: 'START_TIMER', now: T });
  s = r(s, { type: 'START_TIMER', now: T + 5000 });
  assert.equal(s.workEndsAt, T + 30_000, 'iniciar dos veces no reinicia');
  s = r(s, { type: 'TICK', now: T + 29_000 });
  assert.equal(s.logs.length, 0);
  s = r(s, { type: 'TICK', now: T + 30_500 });
  assert.equal(s.logs[0].duration, 30); assert.equal(s.logs[0].reps, null);
  assert.equal(s.phase, PHASE.REST);
});

test('terminar antes registra el tiempo real', () => {
  let s = r(createWorkout([plank], T), { type: 'START_TIMER', now: T });
  s = r(s, { type: 'COMPLETE_SET', now: T + 18_000 });
  assert.equal(s.logs[0].duration, 18);
});

test('última serie termina el entrenamiento sin descanso', () => {
  let s = createWorkout([{ ...squat, sets: 1 }], T);
  s = r(s, { type: 'COMPLETE_SET', reps: 12, weight: 50, now: T + 45_000 });
  assert.equal(s.phase, PHASE.DONE);
  assert.equal(s.restEndsAt, null);
  assert.deepEqual(summary(s), { sets: 1, totalSets: 1, exercisesDone: 1, volume: 600, durationSeconds: 45 });
  assert.equal(r(s, { type: 'COMPLETE_SET', now: T }), s, 'ya terminado no cambia');
});

test('saltar ejercicio y orden completo', () => {
  let s = createWorkout([squat, plank], T);
  s = r(s, { type: 'SKIP_EXERCISE', now: T });
  assert.equal(s.exIndex, 1); assert.equal(s.set, 1);
  s = r(s, { type: 'SKIP_EXERCISE', now: T });
  assert.equal(s.phase, PHASE.DONE);
});

test('descanso 0 pasa directo a la siguiente serie', () => {
  let s = createWorkout([{ ...squat, rest_seconds: 0 }], T);
  s = r(s, { type: 'COMPLETE_SET', now: T });
  assert.equal(s.phase, PHASE.WORK); assert.equal(s.set, 2);
});

test('rutina vacía y utilidades', () => {
  assert.equal(createWorkout([], T).phase, PHASE.DONE);
  assert.equal(formatClock(75), '1:15');
  let s = createWorkout([squat, plank], T);
  s = r(s, { type: 'COMPLETE_SET', now: T });
  assert.equal(progress(s), 0.25);
  assert.equal(r(s, { type: 'RESTORE', state: createWorkout([squat], T) }).exercises.length, 1);
});
