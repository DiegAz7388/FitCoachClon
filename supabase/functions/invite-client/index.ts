// Edge Function: envía al paciente el correo de invitación a FitCoach.
//
// POST /functions/v1/invite-client   (Authorization: Bearer <JWT del nutriólogo>)   { client_id }
// Usa el correo "Invite user" de Supabase Auth (plantilla en supabase/templates/invitacion.html).
// Al aceptarla, el paciente confirma su correo, crea su contraseña en la página de bienvenida
// del panel y su cuenta queda vinculada al expediente (fc_claim_my_client).
//
// Requiere SMTP propio en Supabase: el servicio de correo de prueba solo envía al equipo del proyecto.
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase automáticamente.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { HttpError, inviteClient } from './invite.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) throw new HttpError(401, 'Inicia sesión para enviar invitaciones.');
    const role = String(user.app_metadata?.role ?? 'patient');
    if (role !== 'trainer' && role !== 'admin') throw new HttpError(403, 'Solo el equipo puede invitar pacientes.');

    const body = await request.json().catch(() => ({}));
    const result = await inviteClient(Number(body.client_id), {
      // Mismo criterio que private.fc_can_write_client: admin, nutriólogo principal o staff "coach".
      canWriteClient: async (clientId) => {
        const { data: client } = await admin.from('fc_clients').select('primary_trainer_id, status').eq('id', clientId).maybeSingle();
        if (!client || client.status === 'archived') return false;
        if (role === 'admin' || client.primary_trainer_id === user.id) return true;
        const { data: staff } = await admin.from('fc_client_staff').select('access_level').eq('client_id', clientId).eq('staff_user_id', user.id).maybeSingle();
        return staff?.access_level === 'coach';
      },
      loadClient: async (clientId) => {
        const { data } = await admin.from('fc_clients').select('id, full_name, email, user_id, status').eq('id', clientId).maybeSingle();
        return data;
      },
      trainerName: async () => {
        const { data } = await admin.from('fc_profiles').select('full_name').eq('user_id', user.id).maybeSingle();
        return String(data?.full_name || user.user_metadata?.full_name || 'Tu nutriólogo').trim();
      },
      invite: async (email, data) => {
        const { error } = await admin.auth.admin.inviteUserByEmail(email, { data });
        if (error) console.error('inviteUserByEmail:', error.message);
        return error ? error.message : null;
      },
    });
    return json(result);
  } catch (error) {
    if (!(error instanceof HttpError)) console.error(error);
    const message = error instanceof Error ? error.message : 'Error inesperado.';
    return json({ error: message }, error instanceof HttpError ? error.status : 500);
  }
});
