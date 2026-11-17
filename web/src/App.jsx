import { useFitCoach } from './state.jsx';
import Login from './pages/Login.jsx';
import Welcome from './pages/Welcome.jsx';
import { readInviteLink } from './lib/invite.js';

// Enlace del correo de invitación (se lee una sola vez: la página lo borra de la barra de direcciones).
const inviteToken = readInviteLink();
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import Routines from './pages/Routines.jsx';
import Exercises from './pages/Exercises.jsx';
import Progress from './pages/Progress.jsx';
import Settings from './pages/Settings.jsx';
import ClientModal from './modals/ClientModal.jsx';
import NewClientModal from './modals/NewClientModal.jsx';
import RoutineModal from './modals/RoutineModal.jsx';
import ExerciseModal from './modals/ExerciseModal.jsx';
import RoutineViewModal from './modals/RoutineViewModal.jsx';

const PAGES = { dashboard: Dashboard, clients: Clients, routines: Routines, exercises: Exercises, progress: Progress, settings: Settings };
const MODALS = { client: ClientModal, 'new-client': NewClientModal, routine: RoutineModal, 'routine-view': RoutineViewModal, exercise: ExerciseModal };

export default function App() {
  const { signedIn, loading, view, modal, toastMessage } = useFitCoach();
  if (inviteToken) return <Welcome tokenHash={inviteToken} />;
  if (!signedIn) return <Login />;
  if (loading) return <main className="login-screen"><div className="loading-spinner" aria-label="Cargando" /></main>;
  const Page = PAGES[view] || Dashboard;
  const ModalComponent = modal ? MODALS[modal.type] : null;
  return (
    <>
      <Page />
      {/* key: reinicia el estado interno al cambiar de modal (p. ej. expediente → constructor) */}
      {ModalComponent && <ModalComponent key={JSON.stringify(modal)} {...modal} />}
      {toastMessage && <div className="statusbar">{toastMessage}</div>}
    </>
  );
}
