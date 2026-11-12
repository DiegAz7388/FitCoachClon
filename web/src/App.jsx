import { useFitCoach } from './state.jsx';
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
import LoginModal from './modals/LoginModal.jsx';

const PAGES = { dashboard: Dashboard, clients: Clients, routines: Routines, exercises: Exercises, progress: Progress, settings: Settings };
const MODALS = { client: ClientModal, 'new-client': NewClientModal, routine: RoutineModal, exercise: ExerciseModal, login: LoginModal };

export default function App() {
  const { view, modal, toastMessage } = useFitCoach();
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
