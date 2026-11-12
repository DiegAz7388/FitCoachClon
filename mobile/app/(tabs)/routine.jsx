import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { RefreshControl, Text, View } from 'react-native';
import ExerciseMedia from '../../src/components/ExerciseMedia';
import { NoClient, NoRoutine } from '../../src/components/states';
import { Button, Card, Header, Pill, Screen, T } from '../../src/components/ui';
import { useApp } from '../../src/lib/AppContext';
import { colors, DAY_NAMES } from '../../src/lib/theme';
import { estimateMinutes } from '../../src/lib/stats';

export default function Routine() {
  const { client, routine, loading, refresh } = useApp();
  const router = useRouter();
  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.green} />}>
      <Header eyebrow="Mi plan" title="Rutina" />
      {!client && !loading ? <NoClient /> : null}
      {client && !routine && !loading ? <NoRoutine /> : null}
      {routine && (
        <>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <T.h2>{routine.name}</T.h2>
                <T.muted>{routine.days.length} días por semana{routine.session_minutes ? ` · ${routine.session_minutes} min por sesión` : ''}</T.muted>
              </View>
              <Pill color={routine.source === 'ai' ? colors.amber : colors.green}>{routine.source === 'ai' ? 'Con IA' : 'De tu nutriólogo'}</Pill>
            </View>
          </Card>
          {routine.days.map((day) => (
            <Card key={day.day_of_week} onPress={() => router.push(`/day/${day.day_of_week}`)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{DAY_NAMES[day.day_of_week].toUpperCase()}</Text>
                  <T.h3>{day.label}</T.h3>
                </View>
                <T.muted>~{estimateMinutes(day)} min</T.muted>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {day.exercises.slice(0, 5).map((e, i) => <ExerciseMedia key={i} exercise={e} size={52} animated={false} />)}
                {day.exercises.length > 5 && (
                  <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.text, fontWeight: '800' }}>+{day.exercises.length - 5}</Text>
                  </View>
                )}
              </View>
              <Button title="Empezar" style={{ marginTop: 12, height: 44 }} icon={<Ionicons name="play" size={16} color="#0b1a0f" />}
                onPress={() => router.push(`/workout/${day.day_of_week}`)} />
            </Card>
          ))}
          <Button title="Generar nueva rutina con IA" variant="ghost" icon={<Ionicons name="sparkles" size={18} color={colors.amber} />} onPress={() => router.push('/ai')} />
          <T.muted style={{ textAlign: 'center', marginTop: 8 }}>Reemplaza tu rutina actual. Tu nutriólogo podrá verla y ajustarla.</T.muted>
        </>
      )}
    </Screen>
  );
}
