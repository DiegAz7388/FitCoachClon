// Lógica de la invitación (sin red): se prueba aparte en invite.test.ts.

export type Client = { id: number; full_name: string; email: string | null; user_id: string | null; status: string };
export type Deps = {
  canWriteClient: (clientId: number) => Promise<boolean>;
  loadClient: (clientId: number) => Promise<Client | null>;
  trainerName: () => Promise<string>;
  // Envía el correo "Invite user" de Supabase; devuelve el mensaje de error de Supabase o null.
  invite: (email: string, data: Record<string, string>) => Promise<string | null>;
};
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export async function inviteClient(clientId: number, deps: Deps) {
  if (!Number.isFinite(clientId)) throw new HttpError(400, 'Falta el paciente.');
  if (!(await deps.canWriteClient(clientId))) throw new HttpError(403, 'No tienes permiso para invitar a este paciente.');
  const client = await deps.loadClient(clientId);
  if (!client || client.status === 'archived') throw new HttpError(404, 'No se encontró el paciente.');
  if (client.user_id) throw new HttpError(409, `${firstName(client.full_name)} ya usa la app; no hace falta invitarlo.`);
  const email = client.email?.trim().toLowerCase();
  if (!email) throw new HttpError(400, 'Agrega el correo del paciente para enviarle la invitación.');

  const trainer = await deps.trainerName();
  // user_metadata → la plantilla del correo usa {{ .Data.trainer_name }} y {{ .Data.first_name }}.
  const error = await deps.invite(email, { full_name: client.full_name, first_name: firstName(client.full_name), trainer_name: trainer });
  if (error) throw new HttpError(...explain(error, client.full_name));
  return { email, trainer_name: trainer };
}

// Errores de Supabase Auth → mensaje claro para el nutriólogo.
export function explain(message: string, name: string): [number, string] {
  if (/already been registered|already registered|email_exists/i.test(message)) {
    return [409, `${firstName(name)} ya tiene una cuenta confirmada con ese correo: puede entrar a la app con su correo y contraseña.`];
  }
  if (/not authorized/i.test(message)) {
    return [502, 'Supabase no permite enviar correos a este destinatario con su servicio de prueba. Configura el envío de correos (SMTP) en Authentication → Emails.'];
  }
  if (/rate limit|too many/i.test(message)) {
    return [429, 'Se alcanzó el límite de correos por hora de Supabase. Intenta más tarde o sube el límite en Authentication → Rate Limits.'];
  }
  if (/invalid.*email|email.*invalid|validate email/i.test(message)) return [400, 'El correo del paciente no es válido. Corrígelo en su expediente.'];
  return [502, `No se pudo enviar la invitación: ${message}`];
}
