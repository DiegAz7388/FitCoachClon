// npx tsx supabase/functions/invite-client/invite.test.ts
import assert from 'node:assert/strict';
import { type Client, type Deps, HttpError, inviteClient } from './invite.ts';

const base: Client = { id: 1, full_name: 'Ana María López', email: ' Ana@Mail.com ', user_id: null, status: 'invited' };
let sent: { email: string; data: Record<string, string> }[] = [];
const deps = (over: Partial<Deps> = {}, client: Partial<Client> = {}, inviteError: string | null = null): Deps => ({
  canWriteClient: async () => true,
  loadClient: async () => ({ ...base, ...client }),
  trainerName: async () => 'Dr. Ramírez',
  invite: async (email, data) => { sent.push({ email, data }); return inviteError; },
  ...over,
});
const fails = async (promise: Promise<unknown>, status: number, text: RegExp) => {
  await assert.rejects(promise, (e: unknown) => e instanceof HttpError && e.status === status && text.test(e.message));
};
let ok = 0;
const t = async (name: string, fn: () => Promise<void>) => { sent = []; try { await fn(); ok++; console.log('✔', name); } catch (e) { console.log('✘', name, e); process.exitCode = 1; } };

(async () => {
await t('envía la invitación con el nombre del nutriólogo y del paciente', async () => {
  const r = await inviteClient(1, deps());
  assert.deepEqual(r, { email: 'ana@mail.com', trainer_name: 'Dr. Ramírez' });
  assert.deepEqual(sent, [{ email: 'ana@mail.com', data: { full_name: 'Ana María López', first_name: 'Ana', trainer_name: 'Dr. Ramírez' } }]);
});
await t('sin permiso no envía', async () => { await fails(inviteClient(1, deps({ canWriteClient: async () => false })), 403, /permiso/); assert.equal(sent.length, 0); });
await t('paciente archivado o inexistente', async () => {
  await fails(inviteClient(1, deps({}, { status: 'archived' })), 404, /No se encontró/);
  await fails(inviteClient(1, deps({ loadClient: async () => null })), 404, /No se encontró/);
});
await t('ya vinculado: no se invita', async () => { await fails(inviteClient(1, deps({}, { user_id: 'u1' })), 409, /ya usa la app/); assert.equal(sent.length, 0); });
await t('sin correo', async () => { await fails(inviteClient(1, deps({}, { email: '  ' })), 400, /Agrega el correo/); });
await t('cuenta ya confirmada', async () => { await fails(inviteClient(1, deps({}, {}, 'A user with this email address has already been registered')), 409, /ya tiene una cuenta/); });
await t('servicio de correo de prueba', async () => { await fails(inviteClient(1, deps({}, {}, 'Email address "x" not authorized')), 502, /SMTP/); });
await t('límite de correos', async () => { await fails(inviteClient(1, deps({}, {}, 'email rate limit exceeded')), 429, /límite de correos/); });
await t('id inválido', async () => { await fails(inviteClient(NaN, deps()), 400, /Falta/); });
console.log(`${ok} pruebas correctas`);
})();
