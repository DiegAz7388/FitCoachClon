// Acceso a Arnold V2 (Supabase REST + Auth) con la publishable key y la sesión del usuario.
// Mismas tablas y consultas que la versión anterior del panel.
import { config } from '../config.js';
import { dayName } from './format.js';

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
      api('/rest/v1/fc_clients?select=*&status=neq.archived&order=created_at.desc'),
      api('/rest/v1/fc_routines?select=id,client_id,name,source,session_minutes,days_per_week,is_active,created_at&client_id=not.is.null&archived_at=is.null&or=(is_active.is.null,is_active.eq.true)&order=created_at.desc'),
    ]);
    const routines = routineRows.map((routine) => ({ ...routine, days: [] }));
    if (routines.length) {
      const ids = routines.map((routine) => routine.id).join(',');
      const [days, exercises] = await Promise.all([
        api(`/rest/v1/fc_routine_days?select=routine_id,day_of_week,label&routine_id=in.(${ids})&order=day_of_week.asc`),
        api(`/rest/v1/fc_routine_exercises?select=routine_id,day_of_week,order_index,sets,reps_min,reps_max,rest_seconds,duration_seconds,exercise:fc_exercises(id,name,muscle_group,gif_url,image_url)&routine_id=in.(${ids})&order=order_index.asc`),
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
              reps: item.reps_min == null ? null : item.reps_min === item.reps_max || item.reps_max == null ? String(item.reps_min) : `${item.reps_min}-${item.reps_max}`,
              duration_seconds: item.duration_seconds,
              rest_seconds: item.rest_seconds,
            })),
        }));
      });
    }
    return { clients, routines };
  }

  // Alta de cliente con la función de Arnold V2 (asigna al nutriólogo y el estado invited/active).
  async function createClient(client) {
    return api('/rest/v1/rpc/fc_create_client', {
      method: 'POST',
      body: JSON.stringify({
        p_full_name: client.full_name, p_email: client.email, p_phone: client.phone, p_goal: client.goal,
        p_height_cm: client.height_cm, p_birth_date: client.birth_date || null, p_notes: client.notes,
      }),
    });
  }

  // Busca en fc_exercises los ejercicios del catálogo (solo un admin puede crear ejercicios en Arnold V2).
  async function findExerciseIds(exercises) {
    const names = [...new Set(exercises.map((e) => e.name.trim()))];
    const list = names.map((n) => `"${n.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',');
    const rows = await api(`/rest/v1/fc_exercises?select=id,name&name=in.(${encodeURIComponent(list)})`);
    const byName = new Map(rows.map((row) => [row.name, row.id]));
    const missing = names.filter((n) => !byName.has(n));
    if (missing.length) throw new Error(`Estos ejercicios no están en el catálogo de Supabase: ${missing.join(', ')}. Carga los archivos de supabase/seed/.`);
    return byName;
  }

  async function createRoutine(routine, userId) {
    const exercises = routine.days.flatMap((day) => day.exercises);
    const ids = await findExerciseIds(exercises);
    // La rutina nueva reemplaza a la activa del cliente.
    await api(`/rest/v1/fc_routines?client_id=eq.${Number(routine.client_id)}&archived_at=is.null&or=(is_active.is.null,is_active.eq.true)`, {
      method: 'PATCH', body: JSON.stringify({ is_active: false }),
    });
    const [created] = await api('/rest/v1/fc_routines', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        client_id: Number(routine.client_id), created_by: userId, name: routine.name, source: 'trainer',
        experience_level: 'beginner', training_location: 'gym', focus_mode: 'balanced', priority_muscles: [],
        session_minutes: routine.session_minutes, days_per_week: routine.days.length, is_active: true,
      }),
    });
    await api('/rest/v1/fc_routine_days', {
      method: 'POST',
      body: JSON.stringify(routine.days.map((day) => ({ routine_id: created.id, day_of_week: day.day, label: dayName(day.day) }))),
    });
    await api('/rest/v1/fc_routine_exercises', {
      method: 'POST',
      body: JSON.stringify(routine.days.flatMap((day) => day.exercises.map((exercise, index) => {
        const timed = exercise.cfg?.mode === 'time';
        return {
          routine_id: created.id, exercise_id: ids.get(exercise.name.trim()), day_of_week: day.day, order_index: index + 1,
          // Configuración por ejercicio del constructor.
          sets: exercise.cfg?.sets || 3,
          reps_min: timed ? null : exercise.cfg?.reps_min || 10,
          reps_max: timed ? null : exercise.cfg?.reps_max || exercise.cfg?.reps_min || 12,
          duration_seconds: timed ? exercise.cfg.duration_seconds || 30 : null,
          rest_seconds: exercise.cfg?.rest_seconds ?? 60,
        };
      }))),
    });
    return created.id;
  }

  // Rutina con IA (Edge Function generate-routine). Sin `plan` pide una propuesta;
  // con `plan` guarda la propuesta revisada por el nutriólogo.
  async function generateRoutine(clientId, answers, plan, requestId) {
    const session = getSession();
    const response = await fetch(`${config.supabaseUrl}/functions/v1/generate-routine`, {
      method: 'POST',
      headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: Number(clientId), answers, plan, request_id: requestId, save: Boolean(plan) }),
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
