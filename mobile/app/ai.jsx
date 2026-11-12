// Cuestionario estilo Gravl → la Edge Function genera y guarda la rutina con OpenAI.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Button, Card, Screen, T, styles as ui } from '../src/components/ui';
import { useApp } from '../src/lib/AppContext';
import { generateRoutine } from '../src/lib/data';
import { colors } from '../src/lib/theme';

const GOALS = [['fat_loss', 'Perder grasa'], ['muscle', 'Ganar músculo'], ['strength', 'Ganar fuerza'], ['general', 'Estar en forma']];
const LEVELS = [['beginner', 'Principiante'], ['intermediate', 'Intermedio'], ['advanced', 'Avanzado']];
const PLACES = [['gym', 'Gimnasio'], ['home', 'Casa'], ['mixed', 'Ambos']];
const DAYS = [2, 3, 4, 5, 6].map((d) => [d, `${d} días`]);
const MINUTES = [30, 45, 60, 90].map((m) => [m, `${m} min`]);
const MUSCLES = [['glutes', 'Glúteos'], ['quads', 'Piernas'], ['abs', 'Abdomen'], ['pectorals', 'Pecho'], ['lats', 'Espalda'], ['delts', 'Hombros'], ['biceps', 'Bíceps'], ['triceps', 'Tríceps']];

function Choice({ title, options, value, onChange, multi }) {
  const active = (v) => (multi ? value.includes(v) : value === v);
  const toggle = (v) => onChange(multi ? (value.includes(v) ? value.filter((x) => x !== v) : [...value, v]) : v);
  return (
    <View style={{ marginBottom: 18 }}>
      <T.h3 style={{ marginBottom: 8 }}>{title}</T.h3>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map(([v, label]) => (
          <Pressable key={v} onPress={() => toggle(v)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
            borderColor: active(v) ? colors.green : colors.border, backgroundColor: active(v) ? colors.greenDeep : colors.surface }}>
            <Text style={{ color: active(v) ? colors.green : colors.text, fontWeight: '700' }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function AiRoutine() {
  const router = useRouter();
  const { refresh } = useApp();
  const [answers, setAnswers] = useState({ goal: 'general', experience_level: 'beginner', training_location: 'gym', days_per_week: 3, session_minutes: 45, priority_muscles: [], limitations: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const set = (key) => (value) => setAnswers({ ...answers, [key]: value });

  async function generate() {
    setBusy(true); setError('');
    try { setResult(await generateRoutine(answers)); await refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (result) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
          <Ionicons name="sparkles" size={40} color={colors.green} />
          <Text style={[ui.h1, { marginTop: 10, textAlign: 'center' }]}>{result.plan.name}</Text>
          <T.muted style={{ textAlign: 'center', marginTop: 6 }}>{result.plan.summary}</T.muted>
        </View>
        {result.plan.days.map((d) => (
          <Card key={d.day_of_week}>
            <T.h3>{d.label}</T.h3>
            {d.exercises.map((e, i) => (
              <T.muted key={i} style={{ marginTop: 4, textTransform: 'capitalize' }}>
                {e.name} · {e.sets}×{e.duration_seconds ? `${e.duration_seconds}s` : `${e.reps_min}${e.reps_max !== e.reps_min ? `–${e.reps_max}` : ''}`}
              </T.muted>
            ))}
          </Card>
        ))}
        <Button title="Ver mi rutina" onPress={() => router.replace('/routine')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={ui.h1}>Rutina con IA</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="close" size={28} color={colors.text} /></Pressable>
      </View>
      <T.muted style={{ marginBottom: 18 }}>Responde unas preguntas y armamos un plan con ejercicios animados. Reemplaza tu rutina actual y tu nutriólogo podrá revisarla.</T.muted>
      <Choice title="¿Cuál es tu objetivo?" options={GOALS} value={answers.goal} onChange={set('goal')} />
      <Choice title="¿Qué experiencia tienes?" options={LEVELS} value={answers.experience_level} onChange={set('experience_level')} />
      <Choice title="¿Dónde entrenas?" options={PLACES} value={answers.training_location} onChange={set('training_location')} />
      <Choice title="¿Cuántos días por semana?" options={DAYS} value={answers.days_per_week} onChange={set('days_per_week')} />
      <Choice title="¿Cuánto tiempo por sesión?" options={MINUTES} value={answers.session_minutes} onChange={set('session_minutes')} />
      <Choice title="Músculos a priorizar (opcional)" options={MUSCLES} value={answers.priority_muscles} onChange={set('priority_muscles')} multi />
      <T.h3 style={{ marginBottom: 8 }}>¿Lesiones o molestias?</T.h3>
      <TextInput style={[ui.input, { height: 80, paddingTop: 12, textAlignVertical: 'top' }]} multiline value={answers.limitations} onChangeText={set('limitations')}
        placeholder="Ej. dolor de rodilla derecha" placeholderTextColor={colors.muted} />
      {error ? <Text style={{ color: colors.red, marginTop: 12 }}>{error}</Text> : null}
      <Button title={busy ? 'Generando tu rutina…' : 'Generar rutina'} loading={busy} style={{ marginTop: 20 }} onPress={generate} />
    </Screen>
  );
}
