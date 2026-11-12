import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading } from '../src/components/ui';
import { AppProvider, useApp } from '../src/lib/AppContext';
import { colors } from '../src/lib/theme';

function AuthGate() {
  const { session } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return;
    const inLogin = segments[0] === 'login';
    if (!session && !inLogin) router.replace('/login');
    if (session && inLogin) router.replace('/');
  }, [session, segments, router]);

  if (session === undefined) return <Loading />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="workout/[day]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      <Stack.Screen name="ai" options={{ presentation: 'modal' }} />
      <Stack.Screen name="day/[day]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <AuthGate />
      </AppProvider>
    </SafeAreaProvider>
  );
}
