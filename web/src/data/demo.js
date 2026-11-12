// Datos de demostración usados mientras no hay sesión en Arnold V2.
export const demoClients = [
  { id: 'demo-1', full_name: 'Carla Mendoza', email: 'carla@fitcoach.mx', phone: '662 555 0148', status: 'active', goal: 'Bajar grasa corporal', height_cm: 165, notes: 'Evitar peso libre en pierna derecha.', created_at: '2026-08-10' },
  { id: 'demo-2', full_name: 'Ana García', email: 'ana@fitcoach.mx', phone: '662 555 0172', status: 'active', goal: 'Ganar fuerza', height_cm: 160, notes: '', created_at: '2026-08-12' },
  { id: 'demo-3', full_name: 'Jorge Pérez', email: 'jorge@fitcoach.mx', phone: '662 555 0161', status: 'active', goal: 'Hipertrofia', height_cm: 178, notes: '', created_at: '2026-08-17' },
  { id: 'demo-4', full_name: 'Luis Torres', email: 'luis@fitcoach.mx', phone: '662 555 0185', status: 'invited', goal: 'Aumentar masa muscular', height_cm: 173, notes: 'Revisar técnica de sentadilla.', created_at: '2026-08-20' },
  { id: 'demo-5', full_name: 'María González', email: 'maria@fitcoach.mx', phone: '662 555 0134', status: 'invited', goal: 'Tonificar', height_cm: 168, notes: '', created_at: '2026-08-22' },
  { id: 'demo-6', full_name: 'Roberto Cruz', email: 'roberto@fitcoach.mx', phone: '662 555 0198', status: 'paused', goal: 'Fuerza base', height_cm: 181, notes: 'Retomar evaluación antes de activar.', created_at: '2026-07-20' },
];

export const starterExercises = [
  { id: 'local-squat', name: 'Sentadilla con barra', category: 'upper legs', equipment: 'barbell', target: 'quadriceps', muscle_group: 'quadriceps', secondary_muscles: ['glutes'], instruction_steps: { es: ['Coloca la barra sobre los trapecios.', 'Desciende con el torso firme y las rodillas alineadas.', 'Empuja el suelo para volver a la posición inicial.'] } },
  { id: 'local-press', name: 'Press de pecho con barra', category: 'chest', equipment: 'barbell', target: 'pectorals', muscle_group: 'pectorals', secondary_muscles: ['triceps'], instruction_steps: { es: ['Apoya la espalda y los pies firmemente.', 'Baja la barra con control hacia el pecho.', 'Empuja hasta extender los brazos sin bloquear.'] } },
  { id: 'local-row', name: 'Remo con mancuerna', category: 'back', equipment: 'dumbbell', target: 'lats', muscle_group: 'lats', secondary_muscles: ['biceps'], instruction_steps: { es: ['Apoya una mano y mantén la espalda neutra.', 'Lleva el codo hacia la cadera.', 'Baja la mancuerna con control.'] } },
  { id: 'local-plank', name: 'Plancha frontal', category: 'waist', equipment: 'body weight', target: 'abs', muscle_group: 'abs', secondary_muscles: ['shoulders'], instruction_steps: { es: ['Apoya antebrazos y puntas de los pies.', 'Mantén una línea recta de hombros a talones.', 'Respira sin perder la tensión abdominal.'] } },
];

export const demoRoutines = [
  { id: 'routine-demo-1', client_id: 'demo-1', name: 'Cuerpo completo A', days: [{ day: 1, exercises: starterExercises.slice(0, 4) }, { day: 3, exercises: starterExercises.slice(0, 4) }, { day: 5, exercises: starterExercises.slice(0, 4) }] },
  { id: 'routine-demo-2', client_id: 'demo-4', name: 'Fuerza base', days: [{ day: 2, exercises: starterExercises.slice(0, 3) }, { day: 4, exercises: starterExercises.slice(0, 3) }] },
];
