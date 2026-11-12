import { useFitCoach } from '../state.jsx';
import { initials } from '../lib/format.js';

export default function Topbar({ title, eyebrow, children }) {
  const { isRemote, user } = useFitCoach();
  return (
    <header className="topbar">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
      <div className="top-actions">
        {children}
        <div className="avatar">{isRemote ? initials(user?.email || 'A') : 'AD'}</div>
      </div>
    </header>
  );
}

export function ConnectButton() {
  const { isRemote, connect } = useFitCoach();
  return <button className="button" onClick={connect}>{isRemote ? 'Sincronizar' : 'Conectar Arnold V2'}</button>;
}

export function NewClientButton() {
  const { openModal } = useFitCoach();
  return <button className="button primary" onClick={() => openModal({ type: 'new-client' })}>+ Nuevo cliente</button>;
}
