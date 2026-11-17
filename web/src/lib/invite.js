// Aceptar la invitación (página de bienvenida del paciente). Usa solo la publishable key y la
// sesión que devuelve Supabase al verificar el enlace; no guarda nada en el navegador.
import { config } from '../config.js';
import { friendlyError } from './arnold.js';

// Enlace del correo: <Site URL>?token_hash=…&type=invite (plantilla supabase/templates/invitacion.html).
export function readInviteLink(search = window.location.search) {
  const params = new URLSearchParams(search);
  return params.get('type') === 'invite' && params.get('token_hash') ? params.get('token_hash') : null;
}

async function call(path, { method = 'POST', body, token } = {}) {
  let response;
  try {
    response = await fetch(`${config.supabaseUrl}${path}`, {
      method,
      headers: { apikey: config.supabasePublishableKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new Error('Sin conexión con el servidor. Revisa tu internet.'); }
  const text = await response.text();
  if (!response.ok) throw Object.assign(new Error(friendlyError(text) || `Error ${response.status}`), { status: response.status, raw: text });
  return text ? JSON.parse(text) : null;
}

export async function acceptInvite(tokenHash) {
  try {
    return await call('/auth/v1/verify', { body: { type: 'invite', token_hash: tokenHash } });
  } catch (error) {
    if (/expired|invalid|not found|otp/i.test(error.raw || error.message)) {
      throw new Error('Esta invitación ya se usó o venció. Si ya creaste tu contraseña, entra a la app con tu correo. Si no, pide a tu nutriólogo que te la reenvíe.');
    }
    throw error;
  }
}

export async function createPassword(session, password) {
  try {
    await call('/auth/v1/user', { method: 'PUT', token: session.access_token, body: { password } });
  } catch (error) {
    if (/weak|short|at least|characters/i.test(error.raw || error.message)) throw new Error('La contraseña es muy débil. Usa al menos 8 caracteres combinando letras y números.');
    throw error;
  }
  // Vincula la cuenta con su expediente (si falla, la app lo vuelve a intentar al iniciar sesión).
  try { await call('/rest/v1/rpc/fc_claim_my_client', { token: session.access_token, body: {} }); } catch { /* sin efecto */ }
}
