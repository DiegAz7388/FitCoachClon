import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useApp } from '../lib/AppContext';
import { colors } from '../lib/theme';
import { Button, Card, T } from './ui';

// Mensajes cuando aún no hay expediente o rutina.
export function NoClient() {
  const { session, refresh, loading } = useApp();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <Ionicons name="link-outline" size={36} color={colors.amber} />
      <T.h3 style={{ marginTop: 10, textAlign: 'center' }}>Tu cuenta aún no está vinculada</T.h3>
      <T.muted style={{ textAlign: 'center', marginTop: 6 }}>
        Pide a tu nutriólogo que registre tu correo ({session?.user?.email}) en tu expediente y vuelve a intentar.
      </T.muted>
      <Button title="Volver a intentar" variant="ghost" onPress={refresh} loading={loading} style={{ marginTop: 16, alignSelf: 'stretch' }} />
    </Card>
  );
}

export function NoRoutine() {
  const router = useRouter();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <Ionicons name="sparkles-outline" size={36} color={colors.green} />
      <T.h3 style={{ marginTop: 10, textAlign: 'center' }}>Todavía no tienes rutina</T.h3>
      <T.muted style={{ textAlign: 'center', marginTop: 6 }}>Tu nutriólogo puede asignarte una, o puedes generar una personalizada con IA en un minuto.</T.muted>
      <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
        <Button title="Crear rutina con IA" onPress={() => router.push('/ai')} icon={<Ionicons name="sparkles" size={18} color="#0b1a0f" />} />
      </View>
    </Card>
  );
}
