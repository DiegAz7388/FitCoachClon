// Lógica del constructor por días (sin React), probada en web/test/dayPlanner.test.mjs.
//
// Flujo: eliges uno o más días → agregas ejercicios → al elegir un día distinto,
// los ejercicios se guardan en los días elegidos y la lista queda limpia para el nuevo día.
// Elegir un día que ya tiene ejercicios los vuelve a cargar para editarlos.
//
// Estado: { plan: { [día]: ejercicios[] }, active: número[], draft: ejercicios[] }
//   plan   → días ya guardados (no incluye los que se están editando)
//   active → días que se están editando
//   draft  → ejercicios que se están editando para los días activos

export const emptyPlanner = () => ({ plan: {}, active: [], draft: [] });

const copy = (list) => list.map((e) => ({ ...e, cfg: e.cfg ? { ...e.cfg } : e.cfg }));
const sortDays = (days) => [...days].sort((a, b) => a - b);

// Guarda los ejercicios en edición en los días activos (todos comparten la misma lista).
function commit(state) {
  const plan = { ...state.plan };
  for (const day of state.active) {
    if (state.draft.length) plan[day] = state.draft;
    else delete plan[day];
  }
  return plan;
}

// Saca un día guardado para editarlo (copia independiente: editarlo no cambia los demás días).
function checkout(plan, day) {
  const next = { ...plan };
  const exercises = next[day] ? copy(next[day]) : [];
  delete next[day];
  return { plan: next, exercises };
}

export function toggleDay(state, day) {
  const isActive = state.active.includes(day);

  // Quitar un día de la selección actual.
  if (isActive) return { ...state, active: state.active.filter((d) => d !== day) };

  // Todavía no hay ejercicios: se arma la selección de días.
  if (!state.draft.length) {
    if (state.plan[day]) {
      // Abrir un día ya armado para editarlo (los días seleccionados vacíos se descartan).
      const { plan, exercises } = checkout(commit(state), day);
      return { plan, active: [day], draft: exercises };
    }
    return { ...state, active: sortDays([...state.active, day]) };
  }

  // Hay ejercicios pero ningún día elegido: el día se suma a la selección.
  if (!state.active.length) return { ...state, active: [day] };

  // Hay ejercicios y días: se guardan y se empieza el nuevo día (limpio o con lo que ya tenía).
  const { plan, exercises } = checkout(commit(state), day);
  return { plan, active: [day], draft: exercises };
}

export function setDraft(state, updater) {
  return { ...state, draft: typeof updater === 'function' ? updater(state.draft) : updater };
}

// Plan final para guardar: [{ day, exercises }] ordenado de lunes a domingo.
export function finalize(state) {
  const plan = state.active.length ? commit(state) : state.plan;
  return sortDays(Object.keys(plan).map(Number))
    .filter((day) => plan[day]?.length)
    .map((day) => ({ day, exercises: plan[day] }));
}

// Resumen agrupando los días que comparten la misma lista: [{ days: [1,3], count: 4 }].
export function summarize(state) {
  const groups = [];
  for (const day of sortDays(Object.keys(state.plan).map(Number))) {
    const list = state.plan[day];
    const group = groups.find((g) => g.list === list);
    if (group) group.days.push(day);
    else groups.push({ list, days: [day] });
  }
  return groups.map(({ list, days }) => ({ days, count: list.length }));
}
