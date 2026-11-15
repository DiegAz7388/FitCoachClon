import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isConfigured } from './config.js';
import { clearSession, createArnoldClient, isStaff, readSession, roleOf, saveSession, signInWithPassword } from './lib/arnold.js';

const FitCoachContext = createContext(null);

export function useFitCoach() {
  const value = useContext(FitCoachContext);
  if (!value) throw new Error('useFitCoach debe usarse dentro de <FitCoachProvider>.');
  return value;
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

// Sesión guardada válida solo si es de un nutriólogo o administrador.
const initialSession = () => {
  if (!isConfigured) return null;
  const saved = readSession();
  return saved?.access_token && isStaff(saved) ? saved : null;
};

export function FitCoachProvider({ children }) {
  const [view, setView] = useState('dashboard');
  const [clientFilter, setClientFilter] = useState('all');
  const [clients, setClients] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [session, setSession] = useState(initialSession);
  const [loading, setLoading] = useState(Boolean(session));
  const [authNotice, setAuthNotice] = useState('');
  const [modal, setModal] = useState(null); // { type, ...props }
  const [toastMessage, setToastMessage] = useState('');
  const online = useOnline();

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const user = session?.user || null;
  const role = roleOf(session);

  const toastTimer = useRef();
  const toast = useCallback((message) => {
    setToastMessage(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMessage(''), 4000);
  }, []);

  const resetData = useCallback(() => {
    setClients([]); setRoutines([]); setModal(null); setView('dashboard');
  }, []);

  const arnold = useMemo(() => createArnoldClient(() => sessionRef.current, {
    onSession: (next) => { saveSession(next); sessionRef.current = next; setSession(next); },
    onExpired: () => {
      clearSession(); sessionRef.current = null; setSession(null); resetData();
      setAuthNotice('Tu sesión expiró. Vuelve a iniciar sesión.');
    },
  }), [resetData]);

  // Avisos de conexión.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    toast(online ? 'Conexión restablecida.' : 'Sin conexión a internet.');
  }, [online, toast]);

  const refresh = useCallback(async () => {
    const data = await arnold.loadRemoteData();
    setClients(data.clients);
    setRoutines(data.routines);
  }, [arnold]);

  // Catálogo de ejercicios (archivo local del panel).
  useEffect(() => {
    fetch('./data/exercises.json')
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then(setExercises)
      .catch(() => toast('No se pudo cargar el catálogo de ejercicios.'));
  }, [toast]);

  // Sesión guardada: cargar datos al abrir.
  useEffect(() => {
    if (!sessionRef.current) return;
    refresh()
      .catch((error) => toast(error.message))
      .finally(() => setLoading(false));
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async (email, password) => {
    const result = await signInWithPassword(email, password);
    saveSession(result);
    sessionRef.current = result;
    setAuthNotice('');
    setSession(result);
    setLoading(true);
    try { await refresh(); } catch (error) { toast(error.message); } finally { setLoading(false); }
  }, [refresh, toast]);

  const signOut = useCallback(() => {
    clearSession();
    sessionRef.current = null;
    setSession(null);
    resetData();
  }, [resetData]);

  const reload = useCallback(async () => {
    try { await refresh(); toast('Datos actualizados.'); } catch (error) { toast(error.message); }
  }, [refresh, toast]);

  const addClient = useCallback(async (client) => {
    const created = await arnold.createClient(client);
    setClients((current) => [created, ...current]);
    setModal(null);
    toast('Paciente guardado.');
  }, [arnold, toast]);

  const addRoutine = useCallback(async (routine) => {
    await arnold.createRoutine(routine, sessionRef.current?.user?.id);
    await refresh();
    setModal(null);
    toast('Rutina guardada.');
  }, [arnold, refresh, toast]);

  // Rutina con IA: el nutriólogo pide una propuesta, la revisa y la asigna.
  const proposeAiRoutine = useCallback((clientId, answers) => arnold.generateRoutine(clientId, answers), [arnold]);

  const assignAiRoutine = useCallback(async (clientId, answers, plan, requestId) => {
    await arnold.generateRoutine(clientId, answers, plan, requestId);
    await refresh();
    setModal(null);
    toast('Rutina con IA asignada.');
  }, [arnold, refresh, toast]);

  const navigate = useCallback((nextView, filter = 'all') => {
    setView(nextView);
    setClientFilter(filter);
  }, []);

  const value = {
    view, navigate, clientFilter, setClientFilter,
    clients, routines, exercises,
    online, isConfigured, signedIn: Boolean(session), loading, authNotice, user, role,
    modal, openModal: setModal, closeModal: () => setModal(null),
    toastMessage, toast,
    signIn, signOut, reload, addClient, addRoutine, proposeAiRoutine, assignAiRoutine,
  };

  return <FitCoachContext.Provider value={value}>{children}</FitCoachContext.Provider>;
}
