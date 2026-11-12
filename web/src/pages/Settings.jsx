import Shell from '../components/Shell.jsx';
import Topbar from '../components/Topbar.jsx';
import { CardHeader, DetailLine } from '../components/common.jsx';
import { useFitCoach } from '../state.jsx';

export default function Settings() {
  const { isRemote, isConfigured, connect, signOut } = useFitCoach();
  return (
    <Shell>
      <Topbar title="Ajustes" eyebrow="Configuración del panel" />
      <section className="content-grid">
        <div className="card">
          <CardHeader title="Arnold V2" subtitle="Conexión exclusiva del panel web." />
          <div className="detail-list">
            <DetailLine label="Estado">{isRemote ? 'Conectado' : isConfigured ? 'Listo para iniciar sesión' : 'Falta configuración'}</DetailLine>
            <DetailLine label="Modo sin conexión">Biblioteca y borradores locales</DetailLine>
            <DetailLine label="Clave privada">No se utiliza</DetailLine>
            <DetailLine label="Módulos de cobro">No incluidos</DetailLine>
          </div>
          <div className="form-actions">
            <button className="button primary" onClick={connect}>{isRemote ? 'Actualizar datos' : 'Conectar Arnold V2'}</button>
            {isRemote && <button className="button danger" onClick={signOut}>Cerrar sesión</button>}
          </div>
        </div>
        <div className="card">
          <CardHeader title="Instalación sin conexión" subtitle="Disponible después de abrir el panel una vez." />
          <p className="muted">El catálogo de 1,324 ejercicios se guarda en el navegador mediante el servicio local de la aplicación. Los datos sensibles no se copian como parte de este caché.</p>
        </div>
      </section>
    </Shell>
  );
}
