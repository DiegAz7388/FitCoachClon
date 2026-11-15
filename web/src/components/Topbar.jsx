import { useFitCoach } from '../state.jsx';
import { initials } from '../lib/format.js';

export default function Topbar({ title, eyebrow, children }) {
  const { user } = useFitCoach();
  return (
    <header className="topbar">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
      <div className="top-actions">
        {children}
        <div className="avatar" title={user?.email}>{initials(user?.email?.split('@')[0].replace(/[._-]+/g, ' ') || 'FC')}</div>
      </div>
    </header>
  );
}

export function NewClientButton() {
  const { openModal } = useFitCoach();
  return <button className="button primary" onClick={() => openModal({ type: 'new-client' })}>+ Nuevo paciente</button>;
}
