// Edge Function: genera una rutina con OpenAI a partir del catálogo fc_exercises.
//
// POST /functions/v1/generate-routine   (Authorization: Bearer <JWT del usuario>)
// { answers: {...}, client_id?: number, save?: boolean, plan?: Plan }
//   - Paciente (app móvil): sin client_id; se usa su expediente y se guarda.
//   - Nutriólogo (panel): con client_id; save=false devuelve la propuesta para revisarla.
//     Después envía { client_id, answers, plan, save: true } con la propuesta ya revisada:
//     se valida contra el catálogo y se guarda sin volver a llamar a OpenAI.
//
// Secretos: OPENAI_API_KEY (obligatorio), OPENAI_MODEL (opcional).
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase automáticamente.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildPrompt, type Candidate, normalizeAnswers, PLAN_SCHEMA, type Plan, sanitizePlan, selectCandidates } from './plan.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  try {
    const authHeader = request.headers.get('Authorization') ?? '';
    const url = Deno.env.get('SUPABASE_URL')!;
    // Cliente con los permisos del usuario: respeta RLS para saber a qué expediente tiene acceso.
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: 'Inicia sesión para generar una rutina.' }, 401);

    const body = await request.json().catch(() => ({}));
    const answers = normalizeAnswers(body.answers ?? {});

    let clientId: number | null = null;
    let isPatient = false;
    if (body.client_id != null) {
      const { data } = await asUser.from('fc_clients').select('id, user_id').eq('id', body.client_id).maybeSingle();
      if (!data) return json({ error: 'No tienes acceso a este paciente.' }, 403);
      clientId = data.id;
      isPatient = data.user_id === user.id;
    } else {
      const { data } = await asUser.rpc('fc_claim_client');
      if (!data) return json({ error: 'Tu cuenta no está vinculada a un expediente. Pide a tu nutriólogo que registre tu correo.' }, 403);
      clientId = data;
      isPatient = true;
    }
    const save = isPatient ? true : body.save === true;

    const { data: client } = await admin.from('fc_clients').select('goal, notes').eq('id', clientId).single();
    const { data: catalog, error: catalogError } = await admin
      .from('fc_exercises').select('id, name, muscle_group, equipment, category').eq('is_active', true).not('gif_url', 'is', null);
    if (catalogError) throw catalogError;
    if (!catalog?.length) return json({ error: 'El catálogo fc_exercises está vacío. Carga supabase/seed/exercises.sql.' }, 500);

    let plan: Plan;
    let candidates: Candidate[];
    if (body.plan && !isPatient) {
      // Propuesta revisada por el nutriólogo: solo se valida.
      candidates = catalog as Candidate[];
      plan = sanitizePlan(body.plan as Plan, { ...answers, days_per_week: 7 }, candidates);
    } else {
      candidates = selectCandidates(catalog as Candidate[], answers);
      const { system, user: prompt } = buildPrompt(answers, candidates, client?.goal);

      const apiKey = Deno.env.get('OPENAI_API_KEY');
      if (!apiKey) return json({ error: 'Falta configurar OPENAI_API_KEY en los secretos de Supabase.' }, 500);
      const ai = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-mini',
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
          response_format: { type: 'json_schema', json_schema: { name: 'rutina', strict: true, schema: PLAN_SCHEMA } },
        }),
      });
      if (!ai.ok) {
        console.error('OpenAI', ai.status, await ai.text());
        return json({ error: 'El servicio de IA no respondió. Intenta de nuevo en unos minutos.' }, 502);
      }
      const completion = await ai.json();
      plan = sanitizePlan(JSON.parse(completion.choices[0].message.content) as Plan, answers, candidates);
    }

    const byId = new Map(candidates.map((e) => [e.id, e]));
    const detailed = { ...plan, days: plan.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e, name: byId.get(e.exercise_id)?.name })) })) };
    if (!save) return json({ plan: detailed, answers });

    // Guardar: desactiva la rutina anterior y crea la nueva.
    await admin.from('fc_routines').update({ is_active: false }).eq('client_id', clientId).eq('is_active', true);
    const { data: routine, error: routineError } = await admin.from('fc_routines').insert({
      client_id: clientId, created_by: user.id, name: plan.name, source: 'ai', goal: answers.goal,
      experience_level: answers.experience_level, training_location: answers.training_location, focus_mode: 'balanced',
      priority_muscles: answers.priority_muscles, session_minutes: answers.session_minutes, days_per_week: plan.days.length, is_active: true,
    }).select('id').single();
    if (routineError) throw routineError;
    const { error: daysError } = await admin.from('fc_routine_days').insert(plan.days.map((d) => ({ routine_id: routine.id, day_of_week: d.day_of_week, label: d.label })));
    if (daysError) throw daysError;
    const { error: exError } = await admin.from('fc_routine_exercises').insert(plan.days.flatMap((d) => d.exercises.map((e, index) => ({
      routine_id: routine.id, exercise_id: e.exercise_id, day_of_week: d.day_of_week, order_index: index + 1, sets: e.sets,
      reps_min: e.reps_min ?? 1, reps_max: e.reps_max ?? 1, duration_seconds: e.duration_seconds, rest_seconds: e.rest_seconds, notes: e.notes,
    }))));
    if (exError) throw exError;

    return json({ routine_id: routine.id, plan: detailed });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Error inesperado.' }, 500);
  }
});
