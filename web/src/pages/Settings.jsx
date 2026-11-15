import Shell from '../components/Shell.jsx';
import Topbar from '../components/Topbar.jsx';
import { CardHeader, DetailLine } from '../components/common.jsx';
import { useFitCoach } from '../state.jsx';

const ROLE_LABEL = { admin: 'Administrador', trainer: 'Nutriólogo / entrenador' };

export default function Settings() {
  const { user, role, reload, signOut, exercises } = useFitCoach();
  return (
    <Shell>
      <Topbar title="Ajustes" eyebrow="Configuración del panel" />
      <section className="content-grid">
        <div className="card">
          <CardHeader title="Mi cuenta" subtitle="Sesión activa en este navegador." />
          <div className="detail-list">
            <DetailLine label="Correo">{user?.email || '—'}</DetailLine>
            <DetailLine label="Rol">{ROLE_LABEL[role] || role}</DetailLine>
          </div>
          <div className="form-actions">
            <button className="button primary" onClick={reload}>Actualizar datos</button>
            <button className="button danger" onClick={signOut}>Cerrar sesión</button>
          </div>
        </div>
        <div className="card">
          <CardHeader title="Panel" subtitle="Información general." />
          <div className="detail-list">
            <DetailLine label="Ejercicios en catálogo">{exercises.length.toLocaleString('es-MX')}</DetailLine>
            <DetailLine label="Rutinas con IA">Generadas en el servidor</DetailLine>
            <DetailLine label="Cobros">No incluidos</DetailLine>
          </div>
        </div>
      </section>
    </Shell>
  );
}
