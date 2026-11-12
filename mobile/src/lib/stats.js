// Cálculos de progreso (lógica pura, probada en test/stats.test.mjs).

// Lunes de la semana de una fecha, a medianoche local.
export function weekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// Entrenamientos completados por semana, de la más antigua a la actual.
export function weeklyCounts(sessions, weeks = 8, now = new Date()) {
  const current = weekStart(now).getTime();
  const WEEK = 7 * 24 * 3600 * 1000;
  const buckets = Array.from({ length: weeks }, (_, i) => ({ start: new Date(current - (weeks - 1 - i) * WEEK), count: 0 }));
  for (const s of sessions) {
    if (!s.completed_at) continue;
    const idx = weeks - 1 - Math.round((current - weekStart(s.completed_at).getTime()) / WEEK);
    if (idx >= 0 && idx < weeks) buckets[idx].count += 1;
  }
  return buckets;
}

// Semanas seguidas (hasta la actual) con al menos un entrenamiento.
// La semana en curso sin entrenar todavía no rompe la racha.
export function weekStreak(sessions, now = new Date()) {
  const counts = weeklyCounts(sessions, 104, now);
  let streak = 0;
  for (let i = counts.length - 1; i >= 0; i -= 1) {
    if (counts[i].count > 0) streak += 1;
    else if (i !== counts.length - 1) break;
  }
  return streak;
}

export function sessionsThisWeek(sessions, now = new Date()) {
  return weeklyCounts(sessions, 1, now)[0].count;
}

// Mejor peso por ejercicio (y reps con ese peso), ordenado por fecha más reciente.
export function bestLifts(logs) {
  const best = new Map();
  for (const l of logs) {
    if (!l.weight_kg) continue;
    const prev = best.get(l.exercise_name);
    const w = Number(l.weight_kg);
    if (!prev || w > prev.weight || (w === prev.weight && (l.reps || 0) > prev.reps)) {
      best.set(l.exercise_name, { name: l.exercise_name, weight: w, reps: l.reps || 0, at: l.completed_at });
    }
  }
  return [...best.values()].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

// Último peso y reps usados por ejercicio, para precargar el modo entrenamiento.
export function lastPerformance(logs) {
  const last = {};
  for (const l of [...logs].sort((a, b) => String(a.completed_at).localeCompare(String(b.completed_at)))) {
    last[l.exercise_name] = { weight: l.weight_kg != null ? Number(l.weight_kg) : null, reps: l.reps };
  }
  return last;
}

// Día de la rutina que toca hoy, o el siguiente disponible (días 1–7, domingo = 7).
export function pickToday(days, now = new Date()) {
  if (!days?.length) return null;
  const today = now.getDay() || 7;
  for (let offset = 0; offset < 7; offset += 1) {
    const dow = ((today - 1 + offset) % 7) + 1;
    const day = days.find((d) => d.day_of_week === dow);
    if (day) return { day, isToday: offset === 0, inDays: offset };
  }
  return { day: days[0], isToday: false, inDays: null };
}

// Duración aproximada de un día de rutina (trabajo + descansos).
export function estimateMinutes(day) {
  const seconds = day.exercises.reduce((sum, e) => sum + e.sets * ((e.duration_seconds || 40) + (e.rest_seconds || 0)), 0);
  return Math.max(5, Math.round(seconds / 60 / 5) * 5);
}
