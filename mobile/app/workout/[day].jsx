// Modo entrenamiento: animación del ejercicio, serie actual, repeticiones o cuenta regresiva,
// descanso automático entre series y resumen final que se guarda en Supabase.
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ExerciseMedia from '../../src/components/ExerciseMedia';
import { Button, Pill, T, styles as ui } from '../../src/components/ui';
import { useApp } from '../../src/lib/AppContext';
import { saveWorkout } from '../../src/lib/data';
import { lastPerformance } from '../../src/lib/stats';
import { colors, radius } from '../../src/lib/theme';
import {
  createWorkout, currentExercise, formatClock, isTimed, PHASE, progress, secondsLeft, summary as getSummary, targetLabel, upNext, workoutReducer,
} from '../../src/lib/workout';

const MAX_RESUME_MS = 6 * 3600 * 1000;

export default function Workout() {
  useKeepAwake();
  const { day } = useLocalSearchParams();
  const router = useRouter();
  const { routine, client, sessions, refresh } = useApp();
  const plan = routine?.days.find((d) => String(d.day_of_week) === String(day));
  const storageKey = `fitcoach-workout-${routine?.id}-${day}`;

  const [state, dispatch] = useReducer(workoutReducer, null, () => createWorkout(plan?.exercises || []));
  const [now, setNow] = useState(Date.now());
  const [showHow, setShowHow] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const restored = useRef(false);

  // Retomar un entrenamiento interrumpido (app cerrada, llamada, etc.).
  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((raw) => {
      restored.current = true;
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.phase !== PHASE.DONE && Date.now() - saved.startedAt < MAX_RESUME_MS && saved.exercises.length === plan?.exercises.length) {
        dispatch({ type: 'RESTORE', state: saved });
      }
    }).catch(() => { restored.current = true; });
  }, [storageKey, plan?.exercises.length]);

  useEffect(() => {
    if (!restored.current) return;
    if (state.phase === PHASE.DONE) AsyncStorage.removeItem(storageKey);
    else AsyncStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  // Reloj: avanza descansos y cuentas regresivas.
  useEffect(() => {
    const id = setInterval(() => { const t = Date.now(); setNow(t); dispatch({ type: 'TICK', now: t }); }, 250);
    return () => clearInterval(id);
  }, []);

  // Vibraciones: últimos 3 s del descanso y al cambiar de fase.
  const previousPhase = useRef(state.phase);
  const lastBeep = useRef(null);
  useEffect(() => {
    if (previousPhase.current !== state.phase) {
      if (state.phase === PHASE.WORK) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (state.phase === PHASE.DONE) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      previousPhase.current = state.phase;
    }
    const endsAt = state.phase === PHASE.REST ? state.restEndsAt : state.workEndsAt;
    const left = secondsLeft(endsAt, now);
    if (endsAt && left > 0 && left <= 3 && lastBeep.current !== `${endsAt}-${left}`) {
      lastBeep.current = `${endsAt}-${left}`;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }, [state.phase, state.restEndsAt, state.workEndsAt, now]);

  // Guardado automático al terminar.
  const summary = useMemo(() => getSummary(state), [state]);
  async function persist() {
    if (!state.logs.length) { setSaveStatus('saved'); return; }
    setSaveStatus('saving');
    try {
      await saveWorkout({ clientId: client.id, routineId: routine.id, dayOfWeek: Number(day), state, summary });
      setSaveStatus('saved');
      refresh();
    } catch {
      setSaveStatus('error');
    }
  }
  useEffect(() => { if (state.phase === PHASE.DONE && saveStatus === 'idle') persist(); }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan || !client) {
    return (
      <SafeAreaView style={[ui.screen, { padding: 20, justifyContent: 'center' }]}>
        <T.h3>No encontramos este entrenamiento.</T.h3>
        <Button title="Volver" variant="ghost" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </SafeAreaView>
    );
  }

  function close() {
    if (state.phase === PHASE.DONE) { router.back(); return; }
    Alert.alert('¿Salir del entrenamiento?', state.logs.length ? 'Puedes guardar lo que llevas o retomarlo después.' : 'Puedes retomarlo después desde Hoy.', [
      { text: 'Seguir entrenando', style: 'cancel' },
      ...(state.logs.length ? [{ text: 'Terminar y guardar', onPress: () => dispatch({ type: 'FINISH' }) }] : []),
      { text: 'Salir (retomar después)', onPress: () => router.back() },
      { text: 'Descartar', style: 'destructive', onPress: () => { AsyncStorage.removeItem(storageKey); router.back(); } },
    ]);
  }

  const exercise = currentExercise(state);
  const next = upNext(state);

  return (
    <SafeAreaView style={ui.screen}>
      {/* Barra superior */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 }}>
        <Pressable onPress={close} hitSlop={12}><Ionicons name="close" size={28} color={colors.text} /></Pressable>
        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surface3, overflow: 'hidden' }}>
          <View style={{ width: `${progress(state) * 100}%`, height: '100%', backgroundColor: colors.green }} />
        </View>
        <Text style={{ color: colors.muted, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{formatClock((now - state.startedAt) / 1000)}</Text>
      </View>

      {state.phase === PHASE.WORK && exercise && (
        <WorkView key={`${state.exIndex}-${state.set}`} state={state} exercise={exercise} now={now} dispatch={dispatch}
          last={lastPerformance(sessions.flatMap((s) => s.fc_set_logs || []))[exercise.name]}
          showHow={showHow} setShowHow={setShowHow} />
      )}
      {state.phase === PHASE.REST && <RestView state={state} now={now} next={next} dispatch={dispatch} />}
      {state.phase === PHASE.DONE && (
        <DoneView summary={summary} saveStatus={saveStatus} onRetry={persist} onClose={() => router.back()} dayLabel={plan.label} />
      )}
    </SafeAreaView>
  );
}

function WorkView({ state, exercise, now, dispatch, last, showHow, setShowHow }) {
  const timed = isTimed(exercise);
  const [reps, setReps] = useState(String(last?.reps ?? exercise.reps_max ?? exercise.reps_min ?? 10));
  const [weight, setWeight] = useState(last?.weight != null ? String(last.weight) : '');
  const running = Boolean(state.workEndsAt);
  const remaining = running ? secondsLeft(state.workEndsAt, now) : exercise.duration_seconds;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <ExerciseMedia exercise={exercise} height={280} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
        <Pill>Ejercicio {state.exIndex + 1} de {state.exercises.length}</Pill>
        <Pressable onPress={() => setShowHow(!showHow)}><Text style={{ color: colors.green, fontWeight: '700' }}>{showHow ? 'Ocultar' : 'Cómo se hace'}</Text></Pressable>
      </View>
      <Text style={[ui.h1, { marginTop: 8, textTransform: 'capitalize' }]}>{exercise.name}</Text>
      {showHow && (
        <View style={{ marginTop: 6 }}>
          {exercise.notes ? <T.body style={{ color: colors.amber }}>💡 {exercise.notes}</T.body> : null}
          {exercise.instructions.map((step, i) => <T.muted key={i} style={{ marginTop: 4 }}>{i + 1}. {step}</T.muted>)}
        </View>
      )}

      {/* Series */}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
        {Array.from({ length: exercise.sets }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i + 1 < state.set ? colors.green : i + 1 === state.set ? colors.amber : colors.surface3 }} />
        ))}
      </View>
      <Text style={{ color: colors.muted, marginTop: 6, fontWeight: '700' }}>Serie {state.set} de {exercise.sets} · objetivo {targetLabel(exercise)}</Text>

      {timed ? (
        <View style={{ alignItems: 'center', marginTop: 18 }}>
          <Text style={{ color: running ? colors.green : colors.text, fontSize: 84, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{formatClock(remaining)}</Text>
          {running
            ? <Button title="Terminar serie" variant="ghost" style={{ alignSelf: 'stretch' }} onPress={() => dispatch({ type: 'COMPLETE_SET' })} />
            : <Button title="Iniciar" style={{ alignSelf: 'stretch' }} icon={<Ionicons name="play" size={20} color="#0b1a0f" />} onPress={() => dispatch({ type: 'START_TIMER' })} />}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <Stepper label="Repeticiones" value={reps} onChange={setReps} step={1} />
            <Stepper label="Peso (kg)" value={weight} onChange={setWeight} step={2.5} placeholder="—" />
          </View>
          {last?.weight != null ? <T.muted style={{ marginTop: 6 }}>La vez pasada: {last.reps ?? '—'} reps × {last.weight} kg</T.muted> : null}
          <Button title="Serie completada" style={{ marginTop: 16 }} icon={<Ionicons name="checkmark" size={20} color="#0b1a0f" />}
            onPress={() => dispatch({ type: 'COMPLETE_SET', reps: Number(reps) || null, weight: weight === '' ? null : Number(weight.replace(',', '.')) })} />
        </>
      )}
      <Pressable onPress={() => dispatch({ type: 'SKIP_EXERCISE' })} style={{ alignItems: 'center', padding: 14 }}>
        <Text style={{ color: colors.muted, fontWeight: '700' }}>Saltar ejercicio</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stepper({ label, value, onChange, step, placeholder }) {
  const bump = (delta) => {
    const n = Math.max(0, (Number(String(value).replace(',', '.')) || 0) + delta);
    onChange(String(Math.round(n * 10) / 10));
    Haptics.selectionAsync().catch(() => {});
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <Pressable onPress={() => bump(-step)} hitSlop={8} style={stepBtn}><Ionicons name="remove" size={22} color={colors.text} /></Pressable>
        <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder={placeholder} placeholderTextColor={colors.muted} selectTextOnFocus
          style={{ flex: 1, color: colors.text, fontSize: 28, fontWeight: '800', textAlign: 'center', padding: 0 }} />
        <Pressable onPress={() => bump(step)} hitSlop={8} style={stepBtn}><Ionicons name="add" size={22} color={colors.text} /></Pressable>
      </View>
    </View>
  );
}
const stepBtn = { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' };

function RestView({ state, now, next, dispatch }) {
  const left = secondsLeft(state.restEndsAt, now);
  const pct = state.restTotal ? left / state.restTotal : 0;
  return (
    <View style={{ flex: 1, padding: 20 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.muted, fontWeight: '800', letterSpacing: 3 }}>DESCANSO</Text>
        <Text style={{ color: left <= 3 ? colors.amber : colors.text, fontSize: 108, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{formatClock(left)}</Text>
        <View style={{ width: '80%', height: 8, borderRadius: 4, backgroundColor: colors.surface3, overflow: 'hidden' }}>
          <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: colors.green }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, alignSelf: 'stretch' }}>
          <Button title="+15 s" variant="ghost" style={{ flex: 1 }} onPress={() => dispatch({ type: 'ADD_REST', seconds: 15 })} />
          <Button title="Saltar" style={{ flex: 1 }} onPress={() => dispatch({ type: 'SKIP_REST' })} />
        </View>
      </View>
      {next && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12 }}>
          <ExerciseMedia exercise={next.exercise} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>SIGUIENTE</Text>
            <T.h3 style={{ textTransform: 'capitalize' }}>{next.exercise.name}</T.h3>
            <T.muted>Serie {next.set} de {next.exercise.sets} · {targetLabel(next.exercise)}</T.muted>
          </View>
        </View>
      )}
    </View>
  );
}

function DoneView({ summary, saveStatus, onRetry, onClose, dayLabel }) {
  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.greenDeep, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trophy" size={44} color={colors.green} />
        </View>
        <Text style={[ui.h1, { marginTop: 16 }]}>¡Entrenamiento listo!</Text>
        <T.muted>{dayLabel}</T.muted>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
        <SummaryBox label="Duración" value={formatClock(summary.durationSeconds)} />
        <SummaryBox label="Series" value={`${summary.sets}/${summary.totalSets}`} />
        <SummaryBox label="Ejercicios" value={String(summary.exercisesDone)} />
        <SummaryBox label="Volumen" value={`${summary.volume.toLocaleString('es-MX')} kg`} />
      </View>
      <Text style={{ color: saveStatus === 'error' ? colors.red : colors.muted, textAlign: 'center', marginTop: 18 }}>
        {saveStatus === 'saving' ? 'Guardando…' : saveStatus === 'saved' ? 'Guardado en tu progreso ✓' : saveStatus === 'error' ? 'No se pudo guardar. Revisa tu conexión.' : ''}
      </Text>
      {saveStatus === 'error' && <Button title="Reintentar" variant="ghost" style={{ marginTop: 10 }} onPress={onRetry} />}
      <Button title="Listo" style={{ marginTop: 12 }} disabled={saveStatus === 'saving'} onPress={onClose} />
    </View>
  );
}

function SummaryBox({ label, value }) {
  return (
    <View style={{ width: '48%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 4 }}>{value}</Text>
    </View>
  );
}
