import { Alert, View } from 'react-native';
import { NoClient } from '../../src/components/states';
import { Button, Card, Header, Screen, T } from '../../src/components/ui';
import { useApp } from '../../src/lib/AppContext';
import { colors } from '../../src/lib/theme';

function Line({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <T.muted>{label}</T.muted><T.body style={{ fontWeight: '700' }}>{value}</T.body>
    </View>
  );
}

export default function Profile() {
  const { session, client, loading, signOut } = useApp();
  return (
    <Screen>
      <Header eyebrow="Mi cuenta" title="Perfil" />
      {!client && !loading ? <NoClient /> : null}
      <Card>
        <Line label="Nombre" value={client?.full_name || '—'} />
        <Line label="Correo" value={session?.user?.email || '—'} />
        <Line label="Objetivo" value={client?.goal || 'Sin definir'} />
        <Line label="Estatura" value={client?.height_cm ? `${client.height_cm} cm` : '—'} />
      </Card>
      <T.muted style={{ marginBottom: 14 }}>Tu objetivo y datos los actualiza tu nutriólogo desde tu expediente.</T.muted>
      <Button title="Cerrar sesión" variant="ghost" onPress={() => Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
        { text: 'Cancelar', style: 'cancel' }, { text: 'Salir', style: 'destructive', onPress: signOut },
      ])} />
    </Screen>
  );
}
