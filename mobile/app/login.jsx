import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Button, Screen, styles as ui } from '../src/components/ui';
import { isConfigured, supabase } from '../src/lib/supabase';
import { colors } from '../src/lib/theme';

export default function Login() {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    setBusy(true); setMessage('');
    const credentials = { email: email.trim().toLowerCase(), password };
    const { data, error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp(credentials);
    setBusy(false);
    if (error) { setMessage(traducir(error.message)); return; }
    if (mode === 'signup' && !data.session) setMessage('Te enviamos un correo para confirmar tu cuenta. Después inicia sesión.');
  }

  async function reset() {
    if (!email.trim()) { setMessage('Escribe tu correo para enviarte el enlace.'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    setMessage(error ? traducir(error.message) : 'Revisa tu correo para restablecer la contraseña.');
  }

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ minHeight: '100%', justifyContent: 'center', paddingBottom: 60 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#0b1a0f' }}>↗</Text>
          </View>
          <View>
            <Text style={ui.h1}>FitCoach</Text>
            <Text style={ui.muted}>Tu plan de entrenamiento</Text>
          </View>
        </View>

        <Text style={[ui.h2, { marginBottom: 4 }]}>{mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}</Text>
        <Text style={ui.muted}>Usa el mismo correo que registró tu nutriólogo para ver tu rutina.</Text>

        <Text style={ui.label}>Correo</Text>
        <TextInput style={ui.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="tucorreo@ejemplo.com" placeholderTextColor={colors.muted} />
        <Text style={ui.label}>Contraseña</Text>
        <TextInput style={ui.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'signin' ? 'password' : 'new-password'} placeholder="Mínimo 6 caracteres" placeholderTextColor={colors.muted} />

        {message ? <Text style={[ui.muted, { color: colors.amber, marginTop: 12 }]}>{message}</Text> : null}
        {!isConfigured ? <Text style={[ui.muted, { color: colors.red, marginTop: 12 }]}>Falta configurar Supabase en el archivo .env</Text> : null}

        <Button title={mode === 'signin' ? 'Entrar' : 'Crear cuenta'} onPress={submit} loading={busy} disabled={!email || password.length < 6} style={{ marginTop: 20 }} />
        <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }} style={{ padding: 14, alignItems: 'center' }}>
          <Text style={{ color: colors.green, fontWeight: '700' }}>{mode === 'signin' ? '¿Primera vez? Crea tu cuenta' : 'Ya tengo cuenta'}</Text>
        </Pressable>
        {mode === 'signin' && (
          <Pressable onPress={reset} style={{ alignItems: 'center' }}><Text style={ui.muted}>Olvidé mi contraseña</Text></Pressable>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function traducir(message) {
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(message)) return 'Confirma tu correo antes de iniciar sesión.';
  if (/already registered/i.test(message)) return 'Ese correo ya tiene cuenta. Inicia sesión.';
  if (/network/i.test(message)) return 'Sin conexión. Revisa tu internet.';
  return message;
}
