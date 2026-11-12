import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import ExerciseMedia from '../../src/components/ExerciseMedia';
import { Button, Card, Screen, T } from '../../src/components/ui';
import { useApp } from '../../src/lib/AppContext';
import { formatClock, targetLabel } from '../../src/lib/workout';
import { colors, DAY_NAMES } from '../../src/lib/theme';

export default function DayDetail() {
  const { day } = useLocalSearchParams();
  const { routine } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(null);
  const current = routine?.days.find((d) => String(d.day_of_week) === String(day));
  if (!current) return <Screen><T.muted>No se encontró este día.</T.muted></Screen>;
  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 }}>
        <Ionicons name="chevron-back" size={20} color={colors.green} /><Text style={{ color: colors.green, fontWeight: '700' }}>Rutina</Text>
      </Pressable>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{DAY_NAMES[current.day_of_week].toUpperCase()}</Text>
      <T.h2 style={{ fontSize: 28, marginBottom: 14 }}>{current.label}</T.h2>
      {current.exercises.map((e, i) => (
        <Card key={i} onPress={() => setOpen(open === i ? null : i)}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <ExerciseMedia exercise={e} size={64} animated={open === i} />
            <View style={{ flex: 1 }}>
              <T.h3 style={{ textTransform: 'capitalize' }}>{e.name}</T.h3>
              <T.muted>{e.sets} × {targetLabel(e)} · descanso {formatClock(e.rest_seconds)}</T.muted>
            </View>
            <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
          </View>
          {open === i && (
            <View style={{ marginTop: 12 }}>
              <ExerciseMedia exercise={e} height={220} />
              {e.notes ? <T.body style={{ color: colors.amber, marginTop: 10 }}>💡 {e.notes}</T.body> : null}
              {e.instructions.map((step, k) => <T.muted key={k} style={{ marginTop: 6 }}>{k + 1}. {step}</T.muted>)}
            </View>
          )}
        </Card>
      ))}
      <Button title="Empezar entrenamiento" icon={<Ionicons name="play" size={18} color="#0b1a0f" />} onPress={() => router.push(`/workout/${current.day_of_week}`)} />
    </Screen>
  );
}
