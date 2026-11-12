import { useState } from 'react';
import { Modal } from '../components/common.jsx';
import { useFitCoach } from '../state.jsx';

export default function LoginModal() {
  const { isConfigured, signIn, closeModal, toast } = useFitCoach();
  const [busy, setBusy] = useState(false);
  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    try { await signIn(form.elements.email.value.trim(), form.elements.password.value); } catch (error) { toast(error.message); } finally { setBusy(false); }
  }
  return (
    <Modal as="form" title="Conectar Arnold V2" subtitle="Inicia sesión con una cuenta de administrador o entrenador autorizada." onSubmit={handleSubmit}>
      {isConfigured ? (
        <>
          <div className="form-stack">
            <label>Correo<input className="field" name="email" type="email" required autoComplete="email" /></label>
            <label>Contraseña<input className="field" name="password" type="password" required autoComplete="current-password" /></label>
          </div>
          <div className="form-actions">
            <button type="button" className="button" onClick={closeModal}>Cancelar</button>
            <button className="button primary" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
          </div>
        </>
      ) : (
        <>
          <div className="status-banner warn">Falta la URL y la publishable key de Arnold V2. Copia <code>.env.example</code> como <code>.env</code> y agrega solamente las credenciales públicas de ese proyecto.</div>
          <div className="form-actions"><button type="button" className="button" onClick={closeModal}>Entendido</button></div>
        </>
      )}
    </Modal>
  );
}
