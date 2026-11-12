// Acceso a Arnold V2 (Supabase REST + Auth) con la publishable key y la sesión del usuario.
// Mismas tablas y consultas que la versión anterior del panel.
import { config } from '../config.js';
import { dayName, EXERCISE_MEDIA_BASE } from './format.js';

const mediaUrl = (path) => (/^https?:/.test(path) ? path : EXERCISE_MEDIA_BASE + path);

const SESSION_KEY = 'fitcoach-arnold-v2-session';

export function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
export function saveSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
export function clearSession() { localStorage.removeItem(SESSION_KEY); }

export function createArnoldClient(getSession) {
  async function api(path, options = {}) {
    const session = getSession();
    if (!session?.access_token) throw new Error('Inicia sesión en Arnold V2 antes de sincronizar.');
    const headers = new Headers(options.headers || {});
    headers.set('apikey', config.supabasePublishableKey);
    headers.set('Authorization', `Bearer ${session.access_token}`);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${config.supabaseUrl}${path}`, { ...options, headers });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Error ${response.status}`);
    }
    if (response.status === 204) return null;
    // Los POST sin "return=representation" responden 201 con cuerpo vacío.
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function loadRemoteData() {
    const [clients, routineRows] = await Promise.all([
      api('/rest/v1/fc_clients?select=*&order=created_at.desc'),
      api('/rest/v1/fc_routines?select=id,client_id,name,session_minutes,days_per_week,is_active,created_at&is_active=eq.true&order=created_at.desc'),
    ]);
    const routines = routineRows.map((routine) => ({ ...routine, days: [] }));
    if (routines.length) {
      const ids = routines.map((routine) => routine.id).join(',');
      const [days, exercises] = await Promise.all([
        api(`/rest/v1/fc_routine_days?select=routine_id,day_of_week,label&routine_id=in.(${ids})&order=day_of_week.asc`),
        api(`/rest/v1/fc_routine_exercises?select=routine_id,day_of_week,order_index,sets,reps_min,reps_max,rest_seconds,duration_seconds,exercise:fc_exercises(id,name,muscle_group,gif_url)&routine_id=in.(${ids})&order=order_index.asc`),
      ]);
      routines.forEach((routine) => {
        routine.days = days.filter((day) => String(day.routine_id) === String(routine.id)).map((day) => ({
          day: day.day_of_week,
          label: day.label,
          exercises: exercises
            .filter((item) => String(item.routine_id) === String(routine.id) && item.day_of_week === day.day_of_week)
            .map((item) => ({
              id: item.exercise?.id,
              name: item.exercise?.name || 'Ejercicio',
              muscle_group: item.exercise?.muscle_group,
              gif_url: item.exercise?.gif_url,
              sets: item.sets,
              reps: item.reps_min === item.reps_max ? String(item.reps_min) : `${item.reps_min}-${item.reps_max}`,
              duration_seconds: item.duration_seconds,
              rest_seconds: item.rest_seconds,
            })),
        }));
      });
    }
    return { clients, routines };
  }

  async function createClient(client, trainerId) {
    const { id, ...payload } = client;
    const created = await api('/rest/v1/fc_clients', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...payload, trainer_id: trainerId }),
    });
    return created[0];
  }

  async function createRoutine(routine, userId) {
    const [created] = await api('/rest/v1/fc_routines', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        client_id: Number(routine.client_id), created_by: userId, name: routine.name, source: 'trainer', goal: 'general',
        experience_level: 'beginner', training_location: 'gym', focus_mode: 'balanced', priority_muscles: [],
        session_minutes: routine.session_minutes, days_per_week: routine.days.length, is_active: true,
      }),
    });
    await api('/rest/v1/fc_routine_days', {
      method: 'POST',
      body: JSON.stringify(routine.days.map((day) => ({ routine_id: created.id, day_of_week: day.day, label: dayName(day.day) }))),
    });
    const lookup = new Map();
    for (const exercise of routine.days[0].exercises) {
      const [saved] = await api('/rest/v1/fc_exercises?on_conflict=name', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          name: exercise.name,
          muscle_group: exercise.target || exercise.muscle_group || exercise.category || 'general',
          secondary_muscles: exercise.secondary_muscles || [],
          difficulty: 'beginner',
          exercise_type: exercise.category === 'cardio' ? 'cardio' : 'compound',
          instructions: exercise.instruction_steps?.es || [],
          coaching_tip: exercise.equipment ? `Equipo: ${exercise.equipment}` : null,
          is_active: true,
          catalog_id: exercise.catalog_id || (typeof exercise.id === 'string' && /^\d+$/.test(exercise.id) ? exercise.id : null),
          gif_url: exercise.gif_url ? mediaUrl(exercise.gif_url) : null,
          image_url: exercise.image ? mediaUrl(exercise.image) : null,
          equipment: exercise.equipment || null,
          category: exercise.category || null,
        }),
      });
      lookup.set(String(exercise.id), saved.id);
    }
    await api('/rest/v1/fc_routine_exercises', {
      method: 'POST',
      body: JSON.stringify(routine.days.flatMap((day) => day.exercises.map((exercise, index) => ({
        routine_id: created.id, exercise_id: lookup.get(String(exercise.id)), day_of_week: day.day,
        order_index: index + 1,
        // Configuración por ejercicio del constructor (antes fija en 3 × 10-12, 90 s).
        sets: exercise.cfg?.sets || 3,
        reps_min: exercise.cfg?.mode === 'time' ? 1 : exercise.cfg?.reps_min || 10,
        reps_max: exercise.cfg?.mode === 'time' ? 1 : exercise.cfg?.reps_max || exercise.cfg?.reps_min || 12,
        duration_seconds: exercise.cfg?.mode === 'time' ? exercise.cfg.duration_seconds || 30 : null,
        rest_seconds: exercise.cfg?.rest_seconds ?? 60,
      })))),
    });
    return created.id;
  }

  // Rutina con IA (Edge Function generate-routine). Sin `plan` pide una propuesta;
  // con `plan` guarda la propuesta revisada por el nutriólogo.
  async function generateRoutine(clientId, answers, plan) {
    const session = getSession();
    const response = await fetch(`${config.supabaseUrl}/functions/v1/generate-routine`, {
      method: 'POST',
      headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: Number(clientId), answers, plan, save: Boolean(plan) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Error ${response.status} al generar la rutina.`);
    return result;
  }

  return { api, loadRemoteData, createClient, createRoutine, generateRoutine };
}

export async function signInWithPassword(email, password) {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.supabasePublishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description || result.msg || 'No se pudo iniciar sesión.');
  return result;
}
