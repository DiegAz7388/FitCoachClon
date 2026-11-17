import { useState } from 'react';
import { APP_DOWNLOADS } from '../config.js';
import { acceptInvite, createPassword } from '../lib/invite.js';

const firstName = (name = '') => name.trim().split(/\s+/)[0] || '';

// Página a la que llega el paciente desde el correo de invitación.
// 1) Acepta (confirma su correo)  2) Crea su contraseña  3) Descarga la app e inicia sesión.
export default function Welcome({ tokenHash }) {
  const [step, setStep] = useState('intro');
  const [session, setSession] = useState(null);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const meta = session?.user?.user_metadata || {};
  const email = session?.user?.email || '';
  const trainer = meta.trainer_name || 'Tu nutriólogo';

  async function accept() {
    setBusy(true); setError('');
    try {
      const result = await acceptInvite(tokenHash);
      window.history.replaceState(null, '', window.location.pathname); // el enlace ya no sirve
      setSession(result);
      setStep('password');
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  async function save(event) {
    event.preventDefault();
    if (password.length < 8) { setError('Usa al menos 8 caracteres.'); return; }
    if (password !== repeat) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true); setError('');
    try { await createPassword(session, password); setStep('done'); } catch (err) { setError(err.message); }
    setBusy(false);
  }

  const downloads = Object.entries(APP_DOWNLOADS).filter(([, url]) => url);

  return (
    <main className="login-screen">
      <div className="login-card welcome-card">
        <div className="brand login-brand">
          <span className="brand-mark">↗</span>
          <span>FitCoach<small className="brand-subtitle">Tu entrenamiento</small></span>
        </div>

        {step === 'intro' && (
          <>
            <h1>Te invitaron a FitCoach</h1>
            <p className="muted">Tu nutriólogo te dio acceso a la app donde verás tu rutina, la animación de cada ejercicio y tu progreso.</p>
            {error ? <div className="status-banner danger" role="alert">{error}</div> : null}
            <button className="button primary login-submit" onClick={accept} disabled={busy}>{busy ? 'Confirmando…' : 'Aceptar invitación'}</button>
          </>
        )}

        {step === 'password' && (
          <form className="welcome-form" onSubmit={save}>
            <h1>{trainer} te invitó a FitCoach</h1>
            <p className="muted">Hola{meta.first_name ? ` ${meta.first_name}` : ''}, tu correo <strong>{email}</strong> quedó confirmado. Crea tu contraseña para entrar a la app.</p>
            {error ? <div className="status-banner danger" role="alert">{error}</div> : null}
            <label>Contraseña
              <input className="field" type="password" autoComplete="new-password" required minLength={8} autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label>Repite la contraseña
              <input className="field" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            </label>
            <button className="button primary login-submit" disabled={busy}>{busy ? 'Guardando…' : 'Crear contraseña'}</button>
          </form>
        )}

        {step === 'done' && (
          <>
            <h1>¡Listo{firstName(meta.full_name) ? `, ${firstName(meta.full_name)}` : ''}!</h1>
            <p className="muted">Tu cuenta está activa. Descarga la app FitCoach e inicia sesión con <strong>{email}</strong> y la contraseña que acabas de crear.</p>
            {downloads.length ? (
              <div className="welcome-downloads">
                {downloads.map(([store, url]) => (
                  <a key={store} className="button primary" href={url} target="_blank" rel="noreferrer">{store === 'ios' ? 'Descargar en App Store' : store === 'android' ? 'Descargar en Google Play' : 'Descargar la app'}</a>
                ))}
              </div>
            ) : (
              <div className="status-banner">El enlace para descargar la app estará disponible muy pronto; {trainer === 'Tu nutriólogo' ? 'tu nutriólogo' : trainer} te lo compartirá.</div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
