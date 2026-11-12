// Consultas a Supabase para el paciente. Las reglas RLS limitan todo a su propio expediente.
import { supabase } from './supabase';
import { DAY_NAMES } from './theme';

async function unwrap(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
}

// Vincula la cuenta con el expediente (mismo correo que registró el nutriólogo) y lo devuelve.
export async function loadClient() {
  const id = await unwrap(supabase.rpc('fc_claim_client'));
  if (!id) return null;
  return unwrap(supabase.from('fc_clients').select('id, full_name, email, goal, height_cm, status').eq('id', id).single());
}

export async function loadActiveRoutine(clientId) {
  const routine = await unwrap(supabase.from('fc_routines')
    .select(`id, name, source, session_minutes, days_per_week, created_at,
      fc_routine_days ( day_of_week, label ),
      fc_routine_exercises ( id, day_of_week, order_index, sets, reps_min, reps_max, rest_seconds, duration_seconds, notes,
        exercise:fc_exercises ( id, name, muscle_group, equipment, gif_url, image_url, instructions ) )`)
    .eq('client_id', clientId).eq('is_active', true)
    .order('created_at', { ascending: false }).limit(1).maybeSingle());
  if (!routine) return null;
  const items = routine.fc_routine_exercises || [];
  const days = (routine.fc_routine_days || [])
    .map((d) => ({
      day_of_week: d.day_of_week,
      label: d.label || DAY_NAMES[d.day_of_week],
      exercises: items.filter((i) => i.day_of_week === d.day_of_week).sort((a, b) => a.order_index - b.order_index).map((i) => ({
        id: i.exercise?.id ?? null,
        name: i.exercise?.name ?? 'Ejercicio',
        muscle_group: i.exercise?.muscle_group,
        equipment: i.exercise?.equipment,
        gif_url: i.exercise?.gif_url,
        image_url: i.exercise?.image_url,
        instructions: Array.isArray(i.exercise?.instructions) ? i.exercise.instructions : [],
        sets: i.sets || 3,
        reps_min: i.duration_seconds ? null : i.reps_min,
        reps_max: i.duration_seconds ? null : i.reps_max,
        duration_seconds: i.duration_seconds || null,
        rest_seconds: i.rest_seconds ?? 60,
        notes: i.notes,
      })),
    }))
    .sort((a, b) => (a.day_of_week || 7) - (b.day_of_week || 7));
  return { id: routine.id, name: routine.name, source: routine.source, session_minutes: routine.session_minutes, days };
}

export async function loadSessions(clientId, sinceDays = 400) {
  const since = new Date(Date.now() - sinceDays * 864e5).toISOString();
  return unwrap(supabase.from('fc_workout_sessions')
    .select('id, routine_id, day_of_week, started_at, completed_at, duration_seconds, total_volume_kg, fc_set_logs ( exercise_name, set_number, reps, weight_kg, duration_seconds, completed_at )')
    .eq('client_id', clientId).gte('started_at', since).order('started_at', { ascending: true }));
}

export async function saveWorkout({ clientId, routineId, dayOfWeek, state, summary }) {
  const session = await unwrap(supabase.from('fc_workout_sessions').insert({
    client_id: clientId, routine_id: routineId, day_of_week: dayOfWeek,
    started_at: new Date(state.startedAt).toISOString(), completed_at: new Date(state.finishedAt || Date.now()).toISOString(),
    duration_seconds: summary.durationSeconds, total_volume_kg: summary.volume,
  }).select('id').single());
  if (state.logs.length) {
    await unwrap(supabase.from('fc_set_logs').insert(state.logs.map((l) => ({
      session_id: session.id, exercise_id: l.exerciseId, exercise_name: l.exerciseName, set_number: l.set,
      reps: l.reps, weight_kg: l.weight, duration_seconds: l.duration, completed_at: new Date(l.at).toISOString(),
    }))));
  }
  return session.id;
}

export async function loadMeasurements(clientId) {
  return unwrap(supabase.from('fc_body_measurements').select('id, measured_at, weight_kg, body_fat_pct, waist_cm')
    .eq('client_id', clientId).order('measured_at', { ascending: true }));
}

export async function addMeasurement(clientId, values) {
  return unwrap(supabase.from('fc_body_measurements').insert({ client_id: clientId, ...values }));
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
