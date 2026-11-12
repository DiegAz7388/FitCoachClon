// Acceso a Supabase (Arnold V2) para el paciente.
// Lecturas y escrituras pasan por funciones del servidor que solo tocan el expediente del propio paciente:
//   fc_claim_my_client · fc_my_routine · fc_my_progress  (migración 20261112100000_fitcoach_app.sql)
//   fc_complete_my_workout · fc_record_my_body_measurement (ya existentes en Arnold V2)
import { supabase } from './supabase';
import { DAY_NAMES } from './theme';

async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new Error(translate(error.message));
  return data;
}

function translate(message = '') {
  if (/Routine is not assigned/i.test(message)) return 'Esta rutina ya no está asignada a tu cuenta. Desliza hacia abajo para actualizar.';
  if (/do not belong to this routine day/i.test(message)) return 'La rutina cambió mientras entrenabas. Actualiza e intenta de nuevo.';
  if (/At least one completed set/i.test(message)) return 'Completa al menos una serie para guardar.';
  if (/No active patient record/i.test(message)) return 'Tu cuenta no está vinculada a un expediente.';
  if (/violates check constraint/i.test(message)) return 'Algún valor está fuera de rango.';
  if (/network|fetch/i.test(message)) return 'Sin conexión. Revisa tu internet.';
  return message;
}

// Vincula la cuenta con su expediente (mismo correo, ya confirmado) y lo devuelve; null si no hay.
export async function loadClient() {
  return rpc('fc_claim_my_client');
}

export async function loadActiveRoutine() {
  const routine = await rpc('fc_my_routine');
  if (!routine) return null;
  return {
    ...routine,
    days: (routine.days || []).map((d) => ({
      day_of_week: d.day_of_week,
      label: d.label || DAY_NAMES[d.day_of_week],
      exercises: (d.exercises || []).map((e) => ({
        id: e.exercise_id,
        routine_exercise_id: e.routine_exercise_id,
        name: e.name,
        muscle_group: e.muscle_group,
        equipment: e.equipment,
        gif_url: e.gif_url,
        image_url: e.image_url,
        instructions: Array.isArray(e.instructions) ? e.instructions : [],
        sets: e.sets || 3,
        reps_min: e.duration_seconds ? null : e.reps_min,
        reps_max: e.duration_seconds ? null : e.reps_max,
        duration_seconds: e.duration_seconds || null,
        rest_seconds: e.rest_seconds ?? 60,
        notes: e.notes || e.coaching_tip || null,
      })),
    })),
  };
}

// Entrenamientos (con series) y medidas del paciente.
export async function loadProgress(days = 400) {
  const data = await rpc('fc_my_progress', { p_days: days });
  const sessions = (data?.sessions || []).map((s) => {
    const sets = (s.sets || []).map((l) => ({ ...l, weight_kg: l.weight_kg != null ? Number(l.weight_kg) : null }));
    const volume = sets.reduce((sum, l) => sum + (l.weight_kg && l.reps ? l.weight_kg * l.reps : 0), 0);
    return { ...s, sets, total_volume_kg: Math.round(volume * 10) / 10 };
  });
  return { sessions, measurements: data?.measurements || [] };
}

export async function saveWorkout({ routineId, dayOfWeek, state }) {
  const sets = state.logs
    .filter((l) => l.routineExerciseId)
    .map((l) => ({ routine_exercise_id: l.routineExerciseId, set_number: l.set, reps_completed: l.reps, weight: l.weight }));
  if (!sets.length) return null;
  return rpc('fc_complete_my_workout', {
    p_routine_id: routineId,
    p_day_of_week: dayOfWeek,
    p_started_at: new Date(state.startedAt).toISOString(),
    p_completed_at: new Date(state.finishedAt || Date.now()).toISOString(),
    p_sets: sets,
  });
}

export async function addMeasurement(values) {
  return rpc('fc_record_my_body_measurement', {
    p_weight_kg: values.weight_kg, p_body_fat_percent: values.body_fat_percent,
    p_muscle_mass_kg: values.muscle_mass_kg, p_waist_cm: values.waist_cm,
  });
}

export async function generateRoutine(answers) {
  const { data, error } = await supabase.functions.invoke('generate-routine', { body: { answers } });
  if (error) {
    let message = 'No se pudo generar la rutina.';
    try { message = (await error.context.json()).error || message; } catch { /* sin cuerpo */ }
    throw new Error(message);
  }
  return data;
}
