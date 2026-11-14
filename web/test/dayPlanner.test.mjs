// node --test web/test/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyPlanner, finalize, setDraft, summarize, toggleDay } from '../src/lib/dayPlanner.js';

const ex = (id) => ({ id, name: `e${id}`, cfg: { sets: 3 } });
const add = (s, ...ids) => setDraft(s, (d) => [...d, ...ids.map(ex)]);
const ids = (list) => list.map((e) => e.id).join(',');

test('elegir varios días antes de agregar ejercicios', () => {
  let s = toggleDay(toggleDay(emptyPlanner(), 3), 1);
  assert.deepEqual(s.active, [1, 3]);
  s = add(s, 10, 11);
  assert.deepEqual(finalize(s).map((d) => [d.day, ids(d.exercises)]), [[1, '10,11'], [3, '10,11']]);
});

test('al elegir otro día se guardan los ejercicios y la lista queda limpia', () => {
  let s = add(toggleDay(toggleDay(emptyPlanner(), 1), 3), 10, 11);
  s = toggleDay(s, 5);
  assert.deepEqual(s.active, [5]);
  assert.equal(s.draft.length, 0, 'lista limpia para el viernes');
  assert.deepEqual(summarize(s), [{ days: [1, 3], count: 2 }]);
  s = add(s, 20);
  assert.deepEqual(finalize(s).map((d) => [d.day, ids(d.exercises)]), [[1, '10,11'], [3, '10,11'], [5, '20']]);
});

test('volver a un día armado carga sus ejercicios y editarlo no cambia los demás días', () => {
  let s = add(toggleDay(toggleDay(emptyPlanner(), 1), 3), 10, 11);
  s = add(toggleDay(s, 5), 20);
  s = toggleDay(s, 3);
  assert.deepEqual(s.active, [3]);
  assert.equal(ids(s.draft), '10,11', 'carga lo del miércoles');
  s = setDraft(s, (d) => d.map((e) => ({ ...e, cfg: { ...e.cfg, sets: 5 } })).slice(0, 1));
  const out = Object.fromEntries(finalize(s).map((d) => [d.day, d.exercises]));
  assert.equal(ids(out[1]), '10,11'); assert.equal(out[1][0].cfg.sets, 3, 'lunes sin cambios');
  assert.equal(ids(out[3]), '10'); assert.equal(out[3][0].cfg.sets, 5, 'miércoles editado');
  assert.equal(ids(out[5]), '20');
});

test('quitar un día de la selección y dejar un día vacío lo elimina', () => {
  let s = add(toggleDay(toggleDay(emptyPlanner(), 1), 2), 10);
  s = toggleDay(s, 2);
  assert.deepEqual(s.active, [1], 'martes ya no recibe los ejercicios');
  s = toggleDay(s, 4);                       // guarda lunes, abre jueves
  s = toggleDay(s, 1);                       // jueves vacío: abre lunes para editar
  assert.equal(ids(s.draft), '10');
  s = setDraft(s, []);                        // vacía el lunes
  assert.deepEqual(finalize(s), [], 'sin ejercicios no hay días');
});

test('ejercicios sin días: el siguiente día elegido los recibe', () => {
  let s = add(emptyPlanner(), 10);
  s = toggleDay(s, 6);
  assert.deepEqual(s.active, [6]); assert.equal(ids(s.draft), '10');
  assert.deepEqual(finalize(s).map((d) => d.day), [6]);
});

test('domingo (7) se ordena al final', () => {
  let s = add(toggleDay(emptyPlanner(), 7), 1);
  s = add(toggleDay(s, 2), 2);
  assert.deepEqual(finalize(s).map((d) => d.day), [2, 7]);
});
