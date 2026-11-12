import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '../../src/lib/theme';

const icon = (name) => ({ color, size, focused }) => <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.green,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      sceneStyle: { backgroundColor: colors.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Hoy', tabBarIcon: icon('flash') }} />
      <Tabs.Screen name="routine" options={{ title: 'Rutina', tabBarIcon: icon('barbell') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progreso', tabBarIcon: icon('stats-chart') }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
