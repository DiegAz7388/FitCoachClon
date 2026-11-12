// Ejecutar: deno test  (o: npx tsx plan.test.ts)
import { buildPrompt, normalizeAnswers, sanitizePlan, selectCandidates, type Candidate } from './plan.ts';

const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error('FALLÓ: ' + msg); console.log('✔', msg); };
const catalog: Candidate[] = [
  { id: 1, name: 'push-up', muscle_group: 'pectorals', equipment: 'body weight', category: 'chest' },
  { id: 2, name: 'barbell bench press', muscle_group: 'pectorals', equipment: 'barbell', category: 'chest' },
  { id: 3, name: 'front plank', muscle_group: 'abs', equipment: 'body weight', category: 'waist' },
  { id: 4, name: 'dumbbell row', muscle_group: 'lats', equipment: 'dumbbell', category: 'back' },
  { id: 5, name: 'squat', muscle_group: 'quads', equipment: 'barbell', category: 'upper legs' },
];

const a = normalizeAnswers({ goal: 'hackear' as never, days_per_week: 12, session_minutes: 5, training_location: 'home', priority_muscles: ['abs'] });
assert(a.goal === 'general' && a.days_per_week === 6 && a.session_minutes === 30, 'normaliza valores fuera de rango (minutos a 30/45/60/90)');
assert(normalizeAnswers({ session_minutes: 50 }).session_minutes === 45 && normalizeAnswers({ session_minutes: 80 }).session_minutes === 90, 'ajusta minutos al valor permitido más cercano');
assert(normalizeAnswers({ training_location: 'mixed' }).training_location === 'mixed', 'acepta lugar mixto');

const home = selectCandidates(catalog, a, 14, () => 0.5);
assert(home.every((e) => !['barbell'].includes(e.equipment!)) && home.length === 3, 'en casa excluye barras');
assert(selectCandidates(catalog, { ...a, training_location: 'gym' }).length === 5, 'en gimnasio usa todo');
assert(selectCandidates(catalog, a, 1, () => 0.5).filter((e) => e.muscle_group === 'pectorals').length === 1, 'limita por músculo');

const { user } = buildPrompt(a, home, 'Bajar grasa');
assert(user.includes('1 | push-up') && user.includes('Bajar grasa'), 'prompt incluye candidatos y objetivo del expediente');

const plan = sanitizePlan({
  name: 'Plan', summary: 's', days: [
    { day_of_week: 3, label: 'Miércoles', exercises: [
      { exercise_id: 1, sets: 9, reps_min: 12, reps_max: 8, duration_seconds: null, rest_seconds: 5, notes: null },
      { exercise_id: 1, sets: 3, reps_min: 10, reps_max: 12, duration_seconds: null, rest_seconds: 60, notes: null },
      { exercise_id: 999, sets: 3, reps_min: 10, reps_max: 12, duration_seconds: null, rest_seconds: 60, notes: null },
      { exercise_id: 3, sets: 3, reps_min: 10, reps_max: 10, duration_seconds: 45, rest_seconds: 30, notes: 'abdomen firme' },
    ] },
    { day_of_week: 3, label: 'repetido', exercises: [{ exercise_id: 4, sets: 3, reps_min: 10, reps_max: 12, duration_seconds: null, rest_seconds: 60, notes: null }] },
    { day_of_week: 1, label: 'Lunes', exercises: [{ exercise_id: 4, sets: 3, reps_min: 10, reps_max: 12, duration_seconds: null, rest_seconds: 60, notes: null }] },
    { day_of_week: 5, label: 'vacío', exercises: [{ exercise_id: 999, sets: 3, reps_min: 1, reps_max: 1, duration_seconds: null, rest_seconds: 60, notes: null }] },
    { day_of_week: 0, label: '', exercises: [{ exercise_id: 3, sets: 2, reps_min: null, reps_max: null, duration_seconds: 30, rest_seconds: 30, notes: null }] },
  ],
}, { ...a, days_per_week: 3 }, home);
assert(plan.days.map((d) => d.day_of_week).join() === '1,3,7', 'quita días repetidos/vacíos, domingo 0 → 7 y ordena desde lunes');
assert(plan.days[2].label === 'Domingo', 'etiqueta por defecto del domingo');
const wed = plan.days[1].exercises;
assert(wed.length === 2, 'quita ids inventados y duplicados');
assert(wed[0].sets === 6 && wed[0].rest_seconds === 15 && wed[0].reps_max! >= wed[0].reps_min!, 'acota series, descanso y rango de reps');
assert(wed[1].duration_seconds === 45 && wed[1].reps_min === null, 'ejercicio por tiempo sin reps');
let threw = false; try { sanitizePlan({ name: '', summary: '', days: [] }, a, home); } catch { threw = true; }
assert(threw, 'error claro si la IA no devuelve nada usable');
