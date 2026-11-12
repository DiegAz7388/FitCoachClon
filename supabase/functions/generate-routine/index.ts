// Edge Function: genera una rutina con IA (Gemini u OpenAI) usando el catálogo fc_exercises (esquema Arnold V2).
//
// POST /functions/v1/generate-routine   (Authorization: Bearer <JWT del usuario>)
//   Paciente (app):  { answers }                              → genera y guarda su rutina.
//   Nutriólogo (panel): { client_id, answers }                → propuesta para revisar (no guarda).
//                       { client_id, answers, plan, request_id } → guarda la propuesta revisada, sin volver a llamar a OpenAI.
// Cada solicitud queda registrada en fc_ai_routine_requests (+ fc_ai_request_days).
//
// Secretos: GEMINI_API_KEY (u OPENAI_API_KEY) y opcionalmente GEMINI_MODEL / OPENAI_MODEL (ver ai.ts).
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase automáticamente.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { AiError, generatePlanWithAI } from './ai.ts';
import { buildPrompt, type Candidate, normalizeAnswers, type Plan, sanitizePlan, selectCandidates } from './plan.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

// Mismo criterio que private.fc_can_write_client: admin, nutriólogo principal o staff con acceso "coach".
async function canWriteClient(admin: SupabaseClient, userId: string, role: string, clientId: number) {
  const { data: client } = await admin.from('fc_clients').select('id, primary_trainer_id, status').eq('id', clientId).maybeSingle();
  if (!client || client.status === 'archived') return false;
  if (role === 'admin' || client.primary_trainer_id === userId) return true;
  const { data: staff } = await admin.from('fc_client_staff').select('access_level').eq('client_id', clientId).eq('staff_user_id', userId).maybeSingle();
  return staff?.access_level === 'coach';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let requestId: number | null = null;

  try {
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) throw new HttpError(401, 'Inicia sesión para generar una rutina.');
    const role = String(user.app_metadata?.role ?? 'patient');

    const body = await request.json().catch(() => ({}));
    const answers = normalizeAnswers(body.answers ?? {});

    // ¿Para qué expediente?
    let clientId: number;
    let isPatient: boolean;
    if (body.client_id != null) {
      if (role !== 'trainer' && role !== 'admin') throw new HttpError(403, 'Solo el equipo puede generar rutinas para un paciente.');
      if (!(await canWriteClient(admin, user.id, role, Number(body.client_id)))) throw new HttpError(403, 'No tienes permiso para editar a este paciente.');
      clientId = Number(body.client_id);
      isPatient = false;
    } else {
      const { data: me } = await asUser.rpc('fc_claim_my_client');
      if (!me?.id) throw new HttpError(403, 'Tu cuenta no está vinculada a un expediente. Pide a tu nutriólogo que registre tu correo.');
      clientId = me.id;
      isPatient = true;
    }
    const reviewedPlan = !isPatient && body.plan ? (body.plan as Plan) : null;
    const save = isPatient || Boolean(reviewedPlan);

    const { data: client } = await admin.from('fc_clients').select('goal').eq('id', clientId).single();
    const { data: catalog, error: catalogError } = await admin
      .from('fc_exercises').select('id, name, muscle_group, equipment, exercise_type').eq('is_active', true).not('gif_url', 'is', null);
    if (catalogError) throw catalogError;
    if (!catalog?.length) throw new HttpError(500, 'El catálogo de ejercicios está vacío. Carga los archivos de supabase/seed/.');
    const all = catalog.map((e) => ({ ...e, category: e.exercise_type })) as Candidate[];

    // Registro de la solicitud (la propuesta revisada reutiliza la solicitud original).
    requestId = reviewedPlan && body.request_id ? Number(body.request_id) : null;
    if (!requestId) {
      const { data: req, error } = await admin.from('fc_ai_routine_requests').insert({
        client_id: clientId, requested_by: user.id, training_location: answers.training_location,
        focus_mode: answers.priority_muscles?.length ? 'focused' : 'balanced', priority_muscles: answers.priority_muscles ?? [],
        session_minutes: answers.session_minutes, experience_level: answers.experience_level,
        injury_notes: answers.limitations || null, status: 'processing',
      }).select('id').single();
      if (error) throw error;
      requestId = req.id;
    }

    let plan: Plan;
    let candidates: Candidate[];
    if (reviewedPlan) {
      candidates = all;
      plan = sanitizePlan(reviewedPlan, { ...answers, days_per_week: 7 }, candidates);
    } else {
      candidates = selectCandidates(all, answers);
      const { system, user: prompt } = buildPrompt(answers, candidates, client?.goal);
      plan = sanitizePlan(await generatePlanWithAI(system, prompt, (name) => Deno.env.get(name)), answers, candidates);
    }

    const byId = new Map(candidates.map((e) => [e.id, e]));
    const detailed = { ...plan, days: plan.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e, name: byId.get(e.exercise_id)?.name })) })) };

    if (!save) {
      await admin.from('fc_ai_routine_requests').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', requestId);
      return json({ request_id: requestId, plan: detailed, answers });
    }

    // Guardar: la nueva rutina reemplaza a la activa del paciente.
    await admin.from('fc_routines').update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('client_id', clientId).is('archived_at', null).or('is_active.is.null,is_active.eq.true'); // neq excluiría los NULL
    const { data: routine, error: routineError } = await admin.from('fc_routines').insert({
      client_id: clientId, created_by: user.id, name: plan.name, source: 'fito_ai', goal: answers.goal,
      experience_level: answers.experience_level, training_location: answers.training_location,
      focus_mode: answers.priority_muscles?.length ? 'focused' : 'balanced', priority_muscles: answers.priority_muscles ?? [],
      session_minutes: answers.session_minutes, days_per_week: plan.days.length, is_active: true,
    }).select('id').single();
    if (routineError) throw routineError;
    const { error: daysError } = await admin.from('fc_routine_days').insert(plan.days.map((d) => ({ routine_id: routine.id, day_of_week: d.day_of_week, label: d.label })));
    if (daysError) throw daysError;
    const { error: exError } = await admin.from('fc_routine_exercises').insert(plan.days.flatMap((d) => d.exercises.map((e, index) => ({
      routine_id: routine.id, exercise_id: e.exercise_id, day_of_week: d.day_of_week, order_index: index + 1, sets: e.sets,
      reps_min: e.reps_min, reps_max: e.reps_max, duration_seconds: e.duration_seconds, rest_seconds: e.rest_seconds, notes: e.notes,
    }))));
    if (exError) throw exError;

    await admin.from('fc_ai_routine_requests').update({ status: 'completed', completed_at: new Date().toISOString(), generated_routine_id: routine.id }).eq('id', requestId);
    await admin.from('fc_ai_request_days').upsert(plan.days.map((d) => ({ request_id: requestId, day_of_week: d.day_of_week })), { onConflict: 'request_id,day_of_week', ignoreDuplicates: true });

    return json({ request_id: requestId, routine_id: routine.id, plan: detailed });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Error inesperado.';
    if (requestId) await admin.from('fc_ai_routine_requests').update({ status: 'failed', error_message: message.slice(0, 500) }).eq('id', requestId);
    return json({ error: message }, error instanceof HttpError || error instanceof AiError ? error.status : 500);
  }
});
