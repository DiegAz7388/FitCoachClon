import { useState } from 'react';
import { useFitCoach } from '../state.jsx';

export default function Login() {
  const { signIn, isConfigured, authNotice } = useFitCoach();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try { await signIn(email.trim().toLowerCase(), password); } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand login-brand">
          <span className="brand-mark">↗</span>
          <span>FitCoach<small className="brand-subtitle">Administración</small></span>
        </div>
        <h1>Iniciar sesión</h1>
        <p className="muted">Acceso para nutriólogos y entrenadores.</p>

        {authNotice && !error ? <div className="status-banner warn">{authNotice}</div> : null}
        {error ? <div className="status-banner danger" role="alert">{error}</div> : null}
        {!isConfigured ? <div className="status-banner danger">Falta configurar el servidor (archivo .env del panel).</div> : null}

        <label>Correo
          <input className="field" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" />
        </label>
        <label>Contraseña
          <input className="field" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="button primary login-submit" disabled={busy || !isConfigured}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <p className="muted login-help">¿Olvidaste tu contraseña? Pide al administrador que la restablezca.</p>
      </form>
    </main>
  );
}
