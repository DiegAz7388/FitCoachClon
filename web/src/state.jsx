import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isConfigured } from './config.js';
import { demoClients, demoRoutines, starterExercises } from './data/demo.js';
import { clearSession, createArnoldClient, readSession, saveSession, signInWithPassword } from './lib/arnold.js';
import { queueDraft } from './lib/drafts.js';

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

export function FitCoachProvider({ children }) {
  const [view, setView] = useState('dashboard');
  const [clientFilter, setClientFilter] = useState('all');
  const [clients, setClients] = useState(() => structuredClone(demoClients));
  const [routines, setRoutines] = useState(demoRoutines);
  const [exercises, setExercises] = useState(starterExercises);
  const [session, setSession] = useState(() => (isConfigured ? readSession() : null));
  const [modal, setModal] = useState(null); // { type, ...props }
  const [toastMessage, setToastMessage] = useState('');
  const online = useOnline();

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const arnold = useMemo(() => createArnoldClient(() => sessionRef.current), []);
  const isRemote = Boolean(isConfigured && session?.access_token);
  const user = session?.user || null;

  const toastTimer = useRef();
  const toast = useCallback((message) => {
    setToastMessage(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMessage(''), 3200);
  }, []);

  // Avisos de conexión, igual que la versión anterior.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    toast(online ? 'Conexión restablecida.' : 'Modo sin conexión activado.');
  }, [online, toast]);

  const refresh = useCallback(async () => {
    const data = await arnold.loadRemoteData();
    setClients(data.clients);
    setRoutines(data.routines);
  }, [arnold]);

  // Catálogo local de ejercicios.
  useEffect(() => {
    fetch('./data/exercises.json')
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then(setExercises)
      .catch(() => { setExercises(starterExercises); toast('Se está usando el catálogo de respaldo sin conexión.'); });
  }, [toast]);

  // Sesión guardada: intentar recargar datos al abrir.
  useEffect(() => {
    if (!isRemote) return;
    refresh().then(() => toast('Arnold V2 conectado.')).catch(() => { clearSession(); setSession(null); });
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async (email, password) => {
    const result = await signInWithPassword(email, password);
    saveSession(result);
    sessionRef.current = result;
    setSession(result);
    await refresh();
    setModal(null);
    toast('Arnold V2 conectado correctamente.');
  }, [refresh, toast]);

  const signOut = useCallback(() => {
    clearSession();
    setSession(null);
    setClients(structuredClone(demoClients));
    setRoutines(demoRoutines);
    toast('Sesión cerrada. Estás en el modo local.');
  }, [toast]);

  const connect = useCallback(async () => {
    if (!isRemote) { setModal({ type: 'login' }); return; }
    try { await refresh(); toast('Datos de Arnold V2 actualizados.'); } catch (error) { toast(error.message); }
  }, [isRemote, refresh, toast]);

  const addClient = useCallback(async (client) => {
    if (isRemote) {
      client = await arnold.createClient(client);
    } else {
      queueDraft({ type: 'client', payload: client });
    }
    setClients((current) => [client, ...current]);
    setModal(null);
    toast(isRemote ? 'Cliente guardado en Arnold V2.' : 'Cliente guardado como borrador local.');
  }, [arnold, isRemote, toast, user]);

  const addRoutine = useCallback(async (routine) => {
    if (isRemote) {
      routine = { ...routine, id: await arnold.createRoutine(routine, user?.id) };
    } else {
      queueDraft({ type: 'routine', payload: routine });
    }
    setRoutines((current) => [routine, ...current]);
    setModal(null);
    toast(isRemote ? 'Rutina guardada en Arnold V2.' : 'Rutina guardada como borrador local.');
  }, [arnold, isRemote, toast, user]);

  // Rutina con IA: el nutriólogo pide una propuesta, la revisa y la asigna.
  const proposeAiRoutine = useCallback(async (clientId, answers) => {
    if (!isRemote) throw new Error('Conecta Arnold V2 para generar rutinas con IA.');
    return arnold.generateRoutine(clientId, answers);
  }, [arnold, isRemote]);

  const assignAiRoutine = useCallback(async (clientId, answers, plan, requestId) => {
    await arnold.generateRoutine(clientId, answers, plan, requestId);
    await refresh();
    setModal(null);
    toast('Rutina con IA asignada en Arnold V2.');
  }, [arnold, refresh, toast]);

  const navigate = useCallback((nextView, filter = 'all') => {
    setView(nextView);
    setClientFilter(filter);
  }, []);

  const value = {
    view, navigate, clientFilter, setClientFilter,
    clients, routines, exercises,
    online, isConfigured, isRemote, user,
    modal, openModal: setModal, closeModal: () => setModal(null),
    toastMessage, toast,
    connect, signIn, signOut, addClient, addRoutine, proposeAiRoutine, assignAiRoutine,
  };

  return <FitCoachContext.Provider value={value}>{children}</FitCoachContext.Provider>;
}
