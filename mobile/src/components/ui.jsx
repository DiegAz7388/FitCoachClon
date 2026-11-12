import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius } from '../lib/theme';

export function Screen({ children, scroll = true, padded = true, refreshControl }) {
  const content = <View style={[padded && styles.padded]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 40 }} refreshControl={refreshControl}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Header({ eyebrow, title, right }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.h1}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress }) {
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }, style]}>{children}</Pressable>;
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style, icon }) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, primary ? styles.buttonPrimary : styles.buttonGhost, (disabled || loading) && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.98 }] }, style]}
    >
      {loading ? <ActivityIndicator color={primary ? colors.bg : colors.text} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon}
          <Text style={[styles.buttonText, { color: primary ? '#0b1a0f' : colors.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Pill({ children, color = colors.green }) {
  return <View style={[styles.pill, { backgroundColor: color + '22' }]}><Text style={[styles.pillText, { color }]}>{children}</Text></View>;
}

export const T = {
  h2: (p) => <Text {...p} style={[styles.h2, p.style]} />,
  h3: (p) => <Text {...p} style={[styles.h3, p.style]} />,
  body: (p) => <Text {...p} style={[styles.body, p.style]} />,
  muted: (p) => <Text {...p} style={[styles.muted, p.style]} />,
};

export function Loading() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.green} size="large" /></View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { paddingHorizontal: 18, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 18, gap: 12 },
  eyebrow: { color: colors.muted, fontSize: font.tiny, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  h1: { color: colors.text, fontSize: font.h1, fontWeight: '800', letterSpacing: -0.5 },
  h2: { color: colors.text, fontSize: font.h2, fontWeight: '800' },
  h3: { color: colors.text, fontSize: font.h3, fontWeight: '700' },
  body: { color: colors.text, fontSize: font.body, lineHeight: 21 },
  muted: { color: colors.muted, fontSize: font.small, lineHeight: 19 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 16, marginBottom: 14 },
  button: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonPrimary: { backgroundColor: colors.green },
  buttonGhost: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: 16, fontWeight: '800' },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillText: { fontSize: font.tiny, fontWeight: '800' },
  input: { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, height: 50, paddingHorizontal: 14, fontSize: 16 },
  label: { color: colors.muted, fontSize: font.small, fontWeight: '700', marginBottom: 6, marginTop: 12 },
});
