import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bestLifts, lastPerformance, pickToday, sessionsThisWeek, weeklyCounts, weekStart, weekStreak } from '../src/lib/stats.js';

const NOW = new Date(2026, 10, 12, 10); // jueves 12 nov 2026
const at = (y, m, d) => ({ completed_at: new Date(y, m, d, 18).toISOString() });

test('la semana empieza en lunes', () => {
  assert.equal(weekStart(NOW).getDate(), 9);
  assert.equal(weekStart(new Date(2026, 10, 15)).getDate(), 9, 'domingo pertenece a la semana del lunes 9');
});

test('entrenamientos por semana', () => {
  const sessions = [at(2026, 10, 10), at(2026, 10, 11), at(2026, 10, 3), at(2026, 9, 1), { completed_at: null }];
  const w = weeklyCounts(sessions, 4, NOW);
  assert.deepEqual(w.map((b) => b.count), [0, 0, 1, 2]);
  assert.equal(sessionsThisWeek(sessions, NOW), 2);
});

test('racha de semanas', () => {
  assert.equal(weekStreak([at(2026, 10, 10), at(2026, 10, 3), at(2026, 9, 27)], NOW), 3);
  assert.equal(weekStreak([at(2026, 10, 3), at(2026, 9, 27)], NOW), 2, 'semana actual vacía no rompe');
  assert.equal(weekStreak([at(2026, 9, 20)], NOW), 0, 'semana pasada vacía sí rompe');
});

test('récords y último rendimiento', () => {
  const logs = [
    { exercise_name: 'Press', weight_kg: 40, reps: 10, completed_at: '2026-11-01' },
    { exercise_name: 'Press', weight_kg: 45, reps: 6, completed_at: '2026-11-05' },
    { exercise_name: 'Press', weight_kg: 42.5, reps: 8, completed_at: '2026-11-10' },
    { exercise_name: 'Plancha', weight_kg: null, reps: null, completed_at: '2026-11-10' },
  ];
  assert.deepEqual(bestLifts(logs).map((b) => [b.name, b.weight, b.reps]), [['Press', 45, 6]]);
  assert.deepEqual(lastPerformance(logs).Press, { weight: 42.5, reps: 8 });
});

test('día que toca', () => {
  const days = [{ day_of_week: 1 }, { day_of_week: 4 }, { day_of_week: 6 }];
  assert.deepEqual(pickToday(days, NOW), { day: days[1], isToday: true, inDays: 0 });
  assert.equal(pickToday(days, new Date(2026, 10, 13)).inDays, 1, 'viernes → sábado');
  assert.equal(pickToday(days, new Date(2026, 10, 15)).day.day_of_week, 1, 'domingo → lunes');
  assert.equal(pickToday([], NOW), null);
});
