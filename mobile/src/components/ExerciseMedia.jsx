// Animación del ejercicio (GIF de Gym visual). Sin conexión muestra un ícono de respaldo.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import { colors, radius } from '../lib/theme';

export default function ExerciseMedia({ exercise, size = 64, height, animated = true, style }) {
  const [failed, setFailed] = useState(false);
  const uri = animated ? exercise?.gif_url || exercise?.image_url : exercise?.image_url || exercise?.gif_url;
  const box = { width: height ? '100%' : size, height: height || size, borderRadius: height ? radius.lg : radius.sm, backgroundColor: '#ffffff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' };
  if (!uri || failed) {
    return <View style={[box, { backgroundColor: colors.greenDeep }, style]}><Ionicons name="barbell-outline" size={(height || size) * 0.35} color={colors.green} /></View>;
  }
  return (
    <View style={[box, style]}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" cachePolicy="disk" autoplay={animated} onError={() => setFailed(true)} transition={150} />
    </View>
  );
}
