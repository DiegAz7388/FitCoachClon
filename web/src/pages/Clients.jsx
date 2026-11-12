import { useState } from 'react';
import Shell from '../components/Shell.jsx';
import Topbar, { ConnectButton, NewClientButton } from '../components/Topbar.jsx';
import { StatusPill } from '../components/common.jsx';
import { useFitCoach } from '../state.jsx';

export default function Clients() {
  const { clients, clientFilter, setClientFilter, openModal } = useFitCoach();
  const [search, setSearch] = useState('');
  const needle = search.toLowerCase();
  const rows = clients.filter((client) => (clientFilter === 'all' || client.status === clientFilter) && client.full_name.toLowerCase().includes(needle));
  const open = (client) => openModal({ type: 'client', clientId: client.id });
  return (
    <Shell>
      <Topbar title="Clientes" eyebrow="Expedientes y seguimiento"><ConnectButton /><NewClientButton /></Topbar>
      <section className="card">
        <div className="toolbar">
          <input className="field" placeholder="Buscar cliente..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="select" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="invited">Invitados</option>
            <option value="paused">Pausados</option>
          </select>
          <span className="muted">{rows.length} resultado(s)</span>
        </div>
      </section>
      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Cliente</th><th>Contacto</th><th>Objetivo</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {rows.map((client) => (
                <tr key={client.id}>
                  <td>
                    <button className="link-button" onClick={() => open(client)}>{client.full_name}</button><br />
                    <span className="muted">{client.height_cm ? `${client.height_cm} cm` : 'Sin estatura'}</span>
                  </td>
                  <td>{client.email || 'Sin correo'}<br /><span className="muted">{client.phone || 'Sin teléfono'}</span></td>
                  <td>{client.goal || 'Sin objetivo'}</td>
                  <td><StatusPill status={client.status} /></td>
                  <td><button className="button small" onClick={() => open(client)}>Abrir</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="5" className="empty">No hay clientes con este filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}
