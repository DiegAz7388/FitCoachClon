import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { BarChart, LineChart } from '../../src/components/Charts';
import { NoClient } from '../../src/components/states';
import { Button, Card, Header, Screen, T, styles as ui } from '../../src/components/ui';
import { useApp } from '../../src/lib/AppContext';
import { addMeasurement } from '../../src/lib/data';
import { bestLifts, weeklyCounts } from '../../src/lib/stats';
import { colors } from '../../src/lib/theme';

const shortDate = (value) => new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
const METRICS = [
  { key: 'weight_kg', label: 'Peso', unit: ' kg' },
  { key: 'body_fat_pct', label: '% grasa', unit: '%' },
  { key: 'waist_cm', label: 'Cintura', unit: ' cm' },
];

export default function Progress() {
  const { client, sessions, measurements, loading, refresh } = useApp();
  const [metric, setMetric] = useState('weight_kg');
  const completed = useMemo(() => sessions.filter((s) => s.completed_at), [sessions]);
  const weeks = useMemo(() => weeklyCounts(completed, 8).map((w) => ({ value: w.count, label: `${w.start.getDate()}/${w.start.getMonth() + 1}` })), [completed]);
  const volume = useMemo(() => completed.filter((s) => Number(s.total_volume_kg) > 0).slice(-12).map((s) => ({ value: Math.round(Number(s.total_volume_kg)), label: shortDate(s.completed_at) })), [completed]);
  const body = useMemo(() => measurements.filter((m) => m[metric] != null).map((m) => ({ value: Number(m[metric]), label: shortDate(`${m.measured_at}T12:00:00`) })), [measurements, metric]);
  const records = useMemo(() => bestLifts(completed.flatMap((s) => s.fc_set_logs || [])).slice(0, 8), [completed]);
  const current = METRICS.find((m) => m.key === metric);

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.green} />}>
      <Header eyebrow="Seguimiento" title="Progreso" />
      {!client && !loading ? <NoClient /> : null}
      {client && (
        <>
          <Card>
            <T.h3>Entrenamientos por semana</T.h3>
            <T.muted style={{ marginBottom: 8 }}>Últimas 8 semanas</T.muted>
            <BarChart bars={weeks} />
          </Card>

          <Card>
            <T.h3>Medidas corporales</T.h3>
            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 10 }}>
              {METRICS.map((m) => (
                <Pressable key={m.key} onPress={() => setMetric(m.key)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: metric === m.key ? colors.green : colors.surface3 }}>
                  <Text style={{ color: metric === m.key ? '#0b1a0f' : colors.text, fontWeight: '700', fontSize: 13 }}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
            <LineChart points={body} unit={current.unit} empty="Registra tu primera medida abajo." />
            <MeasurementForm clientId={client.id} onSaved={refresh} />
          </Card>

          <Card>
            <T.h3>Volumen por entrenamiento</T.h3>
            <T.muted style={{ marginBottom: 8 }}>Peso × repeticiones de cada sesión</T.muted>
            <LineChart points={volume} unit=" kg" empty="Registra el peso en tus series para ver tu volumen." />
          </Card>

          <Card>
            <T.h3>Mejores marcas</T.h3>
            {records.length ? records.map((r) => (
              <View key={r.name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <T.body style={{ flex: 1, textTransform: 'capitalize' }}>{r.name}</T.body>
                <Text style={{ color: colors.green, fontWeight: '800' }}>{r.weight} kg × {r.reps}</Text>
              </View>
            )) : <T.muted style={{ marginTop: 6 }}>Tus récords aparecerán aquí al registrar peso.</T.muted>}
          </Card>
        </>
      )}
    </Screen>
  );
}

function MeasurementForm({ clientId, onSaved }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ weight_kg: '', body_fat_pct: '', waist_cm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const num = (v) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

  async function save() {
    const payload = { weight_kg: num(values.weight_kg), body_fat_pct: num(values.body_fat_pct), waist_cm: num(values.waist_cm) };
    if (Object.values(payload).every((v) => v == null)) { setError('Escribe al menos una medida.'); return; }
    if (Object.values(payload).some((v) => v != null && (Number.isNaN(v) || v <= 0))) { setError('Revisa los números.'); return; }
    setBusy(true); setError('');
    try {
      await addMeasurement(clientId, payload);
      setValues({ weight_kg: '', body_fat_pct: '', waist_cm: '' }); setOpen(false); onSaved();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (!open) return <Button title="+ Registrar medida de hoy" variant="ghost" style={{ marginTop: 12 }} onPress={() => setOpen(true)} />;
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {METRICS.map((m) => (
          <View key={m.key} style={{ flex: 1 }}>
            <Text style={ui.label}>{m.label}</Text>
            <TextInput style={ui.input} keyboardType="decimal-pad" value={values[m.key]} onChangeText={(t) => setValues({ ...values, [m.key]: t })} placeholder={m.unit.trim()} placeholderTextColor={colors.muted} />
          </View>
        ))}
      </View>
      {error ? <Text style={{ color: colors.red, marginTop: 8 }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Button title="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={() => setOpen(false)} />
        <Button title="Guardar" style={{ flex: 1 }} loading={busy} onPress={save} />
      </View>
    </View>
  );
}
