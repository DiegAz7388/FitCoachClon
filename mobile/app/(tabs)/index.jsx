import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { RefreshControl, Text, View } from 'react-native';
import ExerciseMedia from '../../src/components/ExerciseMedia';
import { NoClient, NoRoutine } from '../../src/components/states';
import { Button, Card, Header, Pill, Screen, T } from '../../src/components/ui';
import { useApp } from '../../src/lib/AppContext';
import { estimateMinutes, pickToday, sessionsThisWeek, weekStart, weekStreak } from '../../src/lib/stats';
import { colors, DAY_NAMES, DAY_SHORT, radius } from '../../src/lib/theme';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default function Today() {
  const { client, routine, sessions, loading, refresh, error } = useApp();
  const router = useRouter();
  const firstName = client?.full_name?.split(' ')[0] || '';
  const pick = pickToday(routine?.days);
  const mondayTs = weekStart(new Date()).getTime();
  // Días de esta semana en los que realmente se entrenó (según la fecha, no el día planeado).
  const doneThisWeek = new Set(sessions.filter((s) => s.completed_at && new Date(s.completed_at).getTime() >= mondayTs).map((s) => new Date(s.completed_at).getDay()));
  const todayDone = pick?.isToday && doneThisWeek.has(new Date().getDay());

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.green} />}>
      <Header eyebrow={greeting()} title={firstName ? `Hola, ${firstName}` : 'Hola'} />
      {error ? <Text style={{ color: colors.red, marginBottom: 12 }}>{error}</Text> : null}
      {!client && !loading ? <NoClient /> : null}
      {client && !routine && !loading ? <NoRoutine /> : null}

      {routine && (
        <>
          {/* Semana */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
              const planned = routine.days.some((d) => d.day_of_week === dow);
              const done = doneThisWeek.has(dow);
              const isToday = new Date().getDay() === dow;
              return (
                <View key={dow} style={{ alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: isToday ? colors.text : colors.muted, fontWeight: '700', fontSize: 12 }}>{DAY_SHORT[dow]}</Text>
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: done ? colors.green : planned ? colors.surface3 : 'transparent',
                    borderWidth: isToday ? 2 : 1, borderColor: isToday ? colors.green : colors.border }}>
                    {done ? <Ionicons name="checkmark" size={18} color="#0b1a0f" /> : planned ? <Ionicons name="barbell" size={14} color={colors.muted} /> : null}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Entrenamiento del día */}
          {pick && (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <View style={{ height: 180, backgroundColor: '#fff' }}>
                <ExerciseMedia exercise={pick.day.exercises[0]} height={180} style={{ borderRadius: 0 }} />
              </View>
              <View style={{ padding: 16 }}>
                <Pill color={todayDone ? colors.green : pick.isToday ? colors.amber : colors.muted}>
                  {todayDone ? 'Completado hoy' : pick.isToday ? 'Toca hoy' : pick.inDays === 1 ? 'Mañana' : DAY_NAMES[pick.day.day_of_week]}
                </Pill>
                <T.h2 style={{ marginTop: 8 }}>{pick.day.label}</T.h2>
                <T.muted>{routine.name} · {pick.day.exercises.length} ejercicios · ~{estimateMinutes(pick.day)} min</T.muted>
                <Button title={todayDone ? 'Repetir entrenamiento' : 'Empezar entrenamiento'} style={{ marginTop: 14 }}
                  variant={todayDone ? 'ghost' : 'primary'}
                  icon={<Ionicons name="play" size={18} color={todayDone ? colors.text : '#0b1a0f'} />}
                  onPress={() => router.push(`/workout/${pick.day.day_of_week}`)} />
                <Button title="Ver ejercicios" variant="ghost" style={{ marginTop: 8 }} onPress={() => router.push(`/day/${pick.day.day_of_week}`)} />
              </View>
            </Card>
          )}

          {/* Indicadores */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="Esta semana" value={`${sessionsThisWeek(sessions)}/${routine.days.length}`} />
            <Stat label="Racha" value={`${weekStreak(sessions)} sem`} icon="flame" />
            <Stat label="Total" value={String(sessions.filter((s) => s.completed_at).length)} />
          </View>
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, icon }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12 }}>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
        {icon ? <Ionicons name={icon} size={16} color={colors.amber} /> : null}
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      </View>
    </View>
  );
}
