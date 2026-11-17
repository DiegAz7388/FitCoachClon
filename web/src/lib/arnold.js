// Acceso a Supabase (REST + Auth) con la publishable key y la sesión del nutriólogo.
import { config } from '../config.js';
import { dayName } from './format.js';

const SESSION_KEY = 'fitcoach-admin-session';
const STAFF_ROLES = ['trainer', 'admin'];
const AI_TIMEOUT_MS = 120_000; // la función de Supabase corta a los 150 s

export function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
export function saveSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
export function clearSession() { localStorage.removeItem(SESSION_KEY); }

export const roleOf = (session) => session?.user?.app_metadata?.role || 'patient';
export const isStaff = (session) => STAFF_ROLES.includes(roleOf(session));

// Mensajes de error de Supabase en español.
export function friendlyError(raw) {
  let message = raw;
  try { const data = JSON.parse(raw); message = data.message || data.error_description || data.msg || raw; } catch { /* texto plano */ }
  if (/Invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(message)) return 'Esta cuenta aún no confirma su correo.';
  if (/JWT expired|invalid JWT/i.test(message)) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (/Only authenticated trainers/i.test(message)) return 'Tu cuenta no tiene permiso para crear pacientes.';
  if (/row-level security/i.test(message)) return 'Tu cuenta no tiene permiso para esta acción.';
  if (/Failed to fetch|NetworkError/i.test(message)) return 'Sin conexión con el servidor. Revisa tu internet.';
  return message;
}

async function authRequest(path, body) {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: config.supabasePublishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(friendlyError(JSON.stringify(result)) || 'No se pudo iniciar sesión.');
  return result;
}

export async function signInWithPassword(email, password) {
  const session = await authRequest('token?grant_type=password', { email, password });
  if (!isStaff(session)) throw new Error('Esta cuenta es de paciente. Los pacientes usan la app FitCoach en su celular.');
  return session;
}

const refreshSession = (session) => authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token });

// onSession(nueva) se llama al renovar el acceso; onExpired() si ya no se puede renovar.
export function createArnoldClient(getSession, { onSession = () => {}, onExpired = () => {} } = {}) {
  let refreshing = null;
  async function renew() {
    const current = getSession();
    if (!current?.refresh_token) { onExpired(); throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.'); }
    refreshing ||= refreshSession(current)
      .then((next) => { onSession(next); return next; })
      .catch(() => { onExpired(); throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.'); })
      .finally(() => { refreshing = null; });
    return refreshing;
  }

  async function send(path, options, session) {
    const headers = new Headers(options.headers || {});
    headers.set('apikey', config.supabasePublishableKey);
    headers.set('Authorization', `Bearer ${session.access_token}`);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    try {
      return await fetch(`${config.supabaseUrl}${path}`, { ...options, headers });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('Sin conexión con el servidor. Revisa tu internet.');
    }
  }

  // Petición autenticada: renueva el acceso si está por vencer o si el servidor lo rechaza (401).
  async function authorized(path, options = {}) {
    let session = getSession();
    if (!session?.access_token) throw new Error('Inicia sesión para continuar.');
    if (session.expires_at && session.expires_at * 1000 < Date.now() + 60_000) session = await renew();
    let response = await send(path, options, session);
    if (response.status === 401) response = await send(path, options, await renew());
    return response;
  }

  async function api(path, options = {}) {
    const response = await authorized(path, options);
    if (!response.ok) throw new Error(friendlyError(await response.text()) || `Error ${response.status}`);
    if (response.status === 204) return null;
    // Los POST sin "return=representation" responden 201 con cuerpo vacío.
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function loadRemoteData() {
    const [clients, routineRows] = await Promise.all([
      api('/rest/v1/fc_clients?select=*&status=neq.archived&order=created_at.desc'),
      api('/rest/v1/fc_routines?select=id,client_id,name,source,goal,experience_level,training_location,focus_mode,priority_muscles,preferred_time,session_minutes,days_per_week,created_at&client_id=not.is.null&archived_at=is.null&order=created_at.desc'),
    ]);
    const routines = routineRows.map((routine) => ({ ...routine, days: [] }));
    if (routines.length) {
      const ids = routines.map((routine) => routine.id).join(',');
      const [days, exercises] = await Promise.all([
        api(`/rest/v1/fc_routine_days?select=routine_id,day_of_week,label&routine_id=in.(${ids})&order=day_of_week.asc`),
        api(`/rest/v1/fc_routine_exercises?select=routine_id,day_of_week,order_index,sets,reps_min,reps_max,rest_seconds,duration_seconds,notes,exercise:fc_exercises(id,name,muscle_group,gif_url,image_url)&routine_id=in.(${ids})&order=order_index.asc`),
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
              reps_min: item.reps_min,
              reps_max: item.reps_max,
              duration_seconds: item.duration_seconds,
              rest_seconds: item.rest_seconds,
              notes: item.notes,
            })),
        }));
      });
    }
    return { clients, routines };
  }

  // Alta de cliente con fc_create_client (asigna al nutriólogo y el estado invited/active).
  async function createClient(client) {
    return api('/rest/v1/rpc/fc_create_client', {
      method: 'POST',
      body: JSON.stringify({
        p_full_name: client.full_name, p_email: client.email, p_phone: client.phone, p_goal: client.goal,
        p_height_cm: client.height_cm, p_birth_date: client.birth_date || null, p_notes: client.notes,
      }),
    });
  }

  // Busca en fc_exercises los ejercicios del catálogo (solo un admin puede crear ejercicios).
  async function findExerciseIds(exercises) {
    const names = [...new Set(exercises.map((e) => e.name.trim()))];
    const list = names.map((n) => `"${n.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',');
    const rows = await api(`/rest/v1/fc_exercises?select=id,name&name=in.(${encodeURIComponent(list)})`);
    const byName = new Map(rows.map((row) => [row.name, row.id]));
    const missing = names.filter((n) => !byName.has(n));
    if (missing.length) throw new Error(`Estos ejercicios no están en el catálogo de Supabase: ${missing.join(', ')}. Carga los archivos de supabase/seed/.`);
    return byName;
  }

  // Guarda una rutina nueva o la versión editada de una existente (routine.base = la rutina original).
  // Arnold V2 no permite modificar ni borrar ejercicios de una rutina (el historial de series apunta a ellos),
  // así que editar = guardar una versión nueva y archivar la anterior. Si algo falla, se restaura la anterior.
  async function createRoutine(routine, userId) {
    const exercises = routine.days.flatMap((day) => day.exercises);
    const ids = await findExerciseIds(exercises);
    const base = routine.base || {};
    const clientId = Number(routine.client_id);
    // is_active es una columna generada; se archiva con archived_at.
    const previous = await api(`/rest/v1/fc_routines?client_id=eq.${clientId}&archived_at=is.null&select=id`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ archived_at: new Date().toISOString() }),
    }) || [];
    let created = null;
    try {
      [created] = await api('/rest/v1/fc_routines', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          client_id: clientId, created_by: userId, name: routine.name, source: base.source || 'trainer', goal: base.goal ?? null,
          experience_level: base.experience_level || 'beginner', training_location: base.training_location || 'gym',
          focus_mode: base.focus_mode || 'balanced', priority_muscles: base.priority_muscles || [], preferred_time: base.preferred_time ?? null,
          session_minutes: routine.session_minutes, days_per_week: routine.days.length,
        }),
      });
      await api('/rest/v1/fc_routine_days', {
        method: 'POST',
        body: JSON.stringify(routine.days.map((day) => ({ routine_id: created.id, day_of_week: day.day, label: day.label || dayName(day.day) }))),
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
            notes: exercise.notes || null,
          };
        }))),
      });
    } catch (error) {
      // Deja al paciente con la rutina que tenía.
      const undo = async (path, body) => { try { await api(path, { method: 'PATCH', body: JSON.stringify(body) }); } catch { /* sin conexión */ } };
      if (created) await undo(`/rest/v1/fc_routines?id=eq.${created.id}`, { archived_at: new Date().toISOString() });
      if (previous.length) await undo(`/rest/v1/fc_routines?id=in.(${previous.map((r) => r.id).join(',')})`, { archived_at: null });
      throw error;
    }
    return created.id;
  }

  // Quita la rutina al paciente (se archiva; el historial de entrenamientos se conserva).
  async function archiveRoutine(routineId) {
    await api(`/rest/v1/fc_routines?id=eq.${Number(routineId)}`, { method: 'PATCH', body: JSON.stringify({ archived_at: new Date().toISOString() }) });
  }

  // Nombre del catálogo → id en fc_exercises (para ejercicios agregados a mano a una propuesta de la IA).
  const resolveExerciseIds = (names) => findExerciseIds(names.map((name) => ({ name })));

  // Rutina con IA (Edge Function generate-routine). Sin `plan` pide una propuesta;
  // con `plan` guarda la propuesta revisada por el nutriólogo.
  async function generateRoutine(clientId, answers, plan, requestId) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const response = await authorized('/functions/v1/generate-routine', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({ client_id: Number(clientId), answers, plan, request_id: requestId, save: Boolean(plan) }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 404) throw new Error('La función de IA no está publicada en Supabase (generate-routine).');
      if (response.status === 546 || response.status === 504) throw new Error('La IA tardó demasiado en responder. Intenta de nuevo.');
      if (!response.ok) throw new Error(result.error || friendlyError(result.message || '') || `Error ${response.status} al generar la rutina.`);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('La IA tardó demasiado en responder. Intenta de nuevo en un momento.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // Correo de invitación (Edge Function invite-client).
  async function inviteClient(clientId) {
    const response = await authorized('/functions/v1/invite-client', { method: 'POST', body: JSON.stringify({ client_id: Number(clientId) }) });
    const result = await response.json().catch(() => ({}));
    if (response.status === 404 && !result.error) throw new Error('La función de invitaciones no está publicada en Supabase (invite-client).');
    if (!response.ok) throw new Error(result.error || friendlyError(result.message || '') || `Error ${response.status} al enviar la invitación.`);
    return result;
  }

  return { api, loadRemoteData, createClient, createRoutine, archiveRoutine, resolveExerciseIds, generateRoutine, inviteClient };
}
