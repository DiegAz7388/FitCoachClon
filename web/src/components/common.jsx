import { useFitCoach } from '../state.jsx';
import { EXERCISE_MEDIA_BASE, initials, statusClass, textStatus } from '../lib/format.js';

export function StatusPill({ status }) {
  return <span className={`pill ${statusClass(status)}`}>{textStatus(status)}</span>;
}

export function ClientRow({ client }) {
  const { openModal } = useFitCoach();
  return (
    <button className="list-row" onClick={() => openModal({ type: 'client', clientId: client.id })}>
      <span className="initials">{initials(client.full_name)}</span>
      <span className="row-content"><strong>{client.full_name}</strong><p>{client.goal || 'Sin objetivo definido'}</p></span>
      <StatusPill status={client.status} />
    </button>
  );
}

export function Activity({ title, children }) {
  return <div className="activity"><i className="activity-dot" /><div><strong>{title}</strong><p>{children}</p></div></div>;
}

export function DetailLine({ label, children }) {
  return <div className="detail-line"><span>{label}</span><strong>{children}</strong></div>;
}

export function CardHeader({ title, subtitle, children }) {
  return <div className="card-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{children}</div>;
}

// Imagen del ejercicio; si falla (sin conexión) se queda solo el ícono de respaldo.
export function ExerciseImage({ exercise, lazy }) {
  if (!exercise.image) return '↗';
  return (
    <img
      loading={lazy ? 'lazy' : undefined}
      src={EXERCISE_MEDIA_BASE + exercise.image}
      alt=""
      onError={(event) => event.currentTarget.remove()}
    />
  );
}

// Fondo + ventana de los modales. Cierra al hacer clic fuera.
export function Modal({ as: Tag = 'section', wide, title, subtitle, onSubmit, children }) {
  const { closeModal } = useFitCoach();
  const dialogProps = Tag === 'form' ? { onSubmit } : { role: 'dialog', 'aria-modal': 'true' };
  return (
    <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
      <Tag className={`modal${wide ? ' modal-wide' : ''}`} {...dialogProps}>
        <div className="modal-header">
          <div><h2>{title}</h2><p>{subtitle}</p></div>
          <button type="button" className="icon-button" onClick={closeModal} aria-label="Cerrar">×</button>
        </div>
        {children}
      </Tag>
    </div>
  );
}
