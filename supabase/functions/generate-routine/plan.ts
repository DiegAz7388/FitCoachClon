// Lógica pura (sin red) para la generación de rutinas: se prueba aparte.

export type Answers = {
  goal: string;                 // fat_loss | muscle | strength | general
  experience_level: string;     // beginner | intermediate | advanced
  training_location: string;    // gym | home
  days_per_week: number;        // 1–6
  session_minutes: number;      // 20–120
  priority_muscles?: string[];
  limitations?: string;         // lesiones o restricciones en texto libre
};

export type Candidate = { id: number; name: string; muscle_group: string; equipment: string | null; category: string | null };

export type PlanExercise = { exercise_id: number; sets: number; reps_min: number | null; reps_max: number | null; duration_seconds: number | null; rest_seconds: number; notes: string | null };
export type Plan = { name: string; summary: string; days: { day_of_week: number; label: string; exercises: PlanExercise[] }[] };

const HOME_EQUIPMENT = new Set(['body weight', 'dumbbell', 'band', 'resistance band', 'kettlebell', 'stability ball', 'medicine ball', 'roller', 'wheel roller', 'bosu ball', 'weighted']);
const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

export function normalizeAnswers(raw: Partial<Answers>): Answers {
  const pick = (value: unknown, allowed: string[], fallback: string) => (allowed.includes(String(value)) ? String(value) : fallback);
  return {
    goal: pick(raw.goal, ['fat_loss', 'muscle', 'strength', 'general'], 'general'),
    experience_level: pick(raw.experience_level, ['beginner', 'intermediate', 'advanced'], 'beginner'),
    training_location: pick(raw.training_location, ['gym', 'home'], 'gym'),
    days_per_week: clamp(Number(raw.days_per_week) || 3, 1, 6),
    session_minutes: clamp(Number(raw.session_minutes) || 45, 20, 120),
    priority_muscles: Array.isArray(raw.priority_muscles) ? raw.priority_muscles.map(String).slice(0, 6) : [],
    limitations: typeof raw.limitations === 'string' ? raw.limitations.slice(0, 500) : '',
  };
}

// Reduce el catálogo a una lista manejable para el modelo, equilibrada por músculo.
export function selectCandidates(all: Candidate[], answers: Answers, perMuscle = 14, random = Math.random): Candidate[] {
  const allowed = all.filter((e) => answers.training_location === 'gym' || HOME_EQUIPMENT.has(e.equipment ?? 'body weight'));
  const groups = new Map<string, Candidate[]>();
  for (const exercise of allowed) {
    const key = exercise.muscle_group || 'general';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(exercise);
  }
  const priority = new Set((answers.priority_muscles ?? []).map((m) => m.toLowerCase()));
  const picked: Candidate[] = [];
  for (const [muscle, list] of groups) {
    const shuffled = [...list].sort(() => random() - 0.5);
    picked.push(...shuffled.slice(0, priority.has(muscle.toLowerCase()) ? perMuscle * 2 : perMuscle));
  }
  return picked;
}

// Esquema JSON estricto que debe devolver OpenAI.
export const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['name', 'summary', 'days'],
  properties: {
    name: { type: 'string' },
    summary: { type: 'string' },
    days: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['day_of_week', 'label', 'exercises'],
        properties: {
          day_of_week: { type: 'integer' },
          label: { type: 'string' },
          exercises: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              required: ['exercise_id', 'sets', 'reps_min', 'reps_max', 'duration_seconds', 'rest_seconds', 'notes'],
              properties: {
                exercise_id: { type: 'integer' },
                sets: { type: 'integer' },
                reps_min: { type: ['integer', 'null'] },
                reps_max: { type: ['integer', 'null'] },
                duration_seconds: { type: ['integer', 'null'] },
                rest_seconds: { type: 'integer' },
                notes: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
  },
} as const;

export function buildPrompt(answers: Answers, candidates: Candidate[], clientGoal?: string | null) {
  const goals: Record<string, string> = { fat_loss: 'pérdida de grasa', muscle: 'ganar masa muscular', strength: 'ganar fuerza', general: 'condición física general' };
  const system = [
    'Eres un entrenador personal certificado que diseña rutinas seguras para pacientes de un nutriólogo.',
    'Responde en español. Usa SOLO ejercicios de la lista proporcionada, citando su id exacto.',
    'Reglas: cada día de 4 a 8 ejercicios según el tiempo disponible; compuestos primero; reparte grupos musculares durante la semana.',
    'Ejercicios de fuerza: usa reps_min/reps_max y duration_seconds = null. Planchas, cardio o isométricos: usa duration_seconds (15–120) y reps_min/reps_max = null.',
    'Descanso entre series de 30 a 180 segundos (más en fuerza, menos en pérdida de grasa). Series de 2 a 5.',
    'day_of_week: 1=Lunes … 6=Sábado, 0=Domingo; días no consecutivos cuando sea posible.',
    'Respeta lesiones o limitaciones evitando ejercicios que las comprometan. notes: un consejo breve de técnica o null.',
  ].join('\n');
  const user = [
    `Objetivo: ${goals[answers.goal]}${clientGoal ? ` (expediente: "${clientGoal}")` : ''}`,
    `Nivel: ${answers.experience_level}. Lugar: ${answers.training_location === 'home' ? 'casa' : 'gimnasio'}.`,
    `Días por semana: ${answers.days_per_week}. Minutos por sesión: ${answers.session_minutes}.`,
    `Músculos prioritarios: ${answers.priority_muscles?.join(', ') || 'ninguno'}.`,
    `Limitaciones: ${answers.limitations || 'ninguna'}.`,
    '',
    'Ejercicios disponibles (id | nombre | músculo | equipo):',
    ...candidates.map((e) => `${e.id} | ${e.name} | ${e.muscle_group} | ${e.equipment ?? 'body weight'}`),
  ].join('\n');
  return { system, user };
}

// Limpia la respuesta del modelo: ids válidos, números en rango, sin días repetidos.
export function sanitizePlan(raw: Plan, answers: Answers, candidates: Candidate[]): Plan {
  const valid = new Set(candidates.map((e) => e.id));
  const usedDays = new Set<number>();
  const days = [];
  for (const day of raw.days ?? []) {
    const dow = clamp(Number(day.day_of_week), 0, 6);
    if (usedDays.has(dow)) continue;
    const seen = new Set<number>();
    const exercises = (day.exercises ?? []).filter((e) => valid.has(e.exercise_id) && !seen.has(e.exercise_id) && seen.add(e.exercise_id)).slice(0, 10).map((e) => {
      const timed = e.duration_seconds != null && e.duration_seconds > 0;
      const repsMin = timed ? null : clamp(e.reps_min ?? 10, 1, 50);
      return {
        exercise_id: e.exercise_id,
        sets: clamp(e.sets, 1, 6),
        reps_min: repsMin,
        reps_max: timed ? null : Math.max(repsMin!, clamp(e.reps_max ?? repsMin!, 1, 50)),
        duration_seconds: timed ? clamp(e.duration_seconds!, 10, 600) : null,
        rest_seconds: clamp(e.rest_seconds, 15, 300),
        notes: e.notes ? String(e.notes).slice(0, 200) : null,
      };
    });
    if (!exercises.length) continue;
    usedDays.add(dow);
    days.push({ day_of_week: dow, label: String(day.label || DAY_LABELS[dow]).slice(0, 40), exercises });
  }
  if (!days.length) throw new Error('La IA no devolvió una rutina válida. Intenta de nuevo.');
  days.sort((a, b) => ((a.day_of_week || 7) - (b.day_of_week || 7)));
  return { name: String(raw.name || 'Rutina personalizada').slice(0, 80), summary: String(raw.summary || '').slice(0, 400), days: days.slice(0, answers.days_per_week) };
}
