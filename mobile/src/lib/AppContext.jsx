// Sesión de Supabase + expediente, rutina e historial del paciente.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { loadActiveRoutine, loadClient, loadMeasurements, loadSessions } from './data';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = cargando
  const [client, setClient] = useState(null);
  const [routine, setRoutine] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError('');
    try {
      const c = await loadClient();
      setClient(c);
      if (c) {
        const [r, s, m] = await Promise.all([loadActiveRoutine(c.id), loadSessions(c.id), loadMeasurements(c.id)]);
        setRoutine(r); setSessions(s); setMeasurements(m);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) refresh();
    else { setClient(null); setRoutine(null); setSessions([]); setMeasurements([]); }
  }, [session, refresh]);

  const signOut = () => supabase.auth.signOut();

  return (
    <AppContext.Provider value={{ session, client, routine, sessions, measurements, loading, error, refresh, signOut }}>
      {children}
    </AppContext.Provider>
  );
}
