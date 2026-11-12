// Genera el catálogo para Supabase a partir de web/public/data/exercises.json:
//   supabase/seed/01_equipo.sql            equipos (fc_equipment)
//   supabase/seed/02..05_ejercicios_N.sql  ejercicios + su equipo (≈300 KB c/u, para pegar en el SQL Editor)
// Uso: node supabase/scripts/build-exercise-seed.mjs
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const MEDIA = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';
const PARTS = 4;
const catalog = JSON.parse(readFileSync(new URL('web/public/data/exercises.json', root), 'utf8'));
const q = (value) => (value == null ? 'null' : `'${String(value).replace(/'/g, "''")}'`);
const arr = (items) => `array[${items.map(q).join(',')}]::text[]`;

// Equipo del catálogo → fc_equipment (slug, nombre en español, categoría permitida por el CHECK).
const EQUIPMENT = {
  'body weight': ['peso-corporal', 'Peso corporal', 'bodyweight'],
  dumbbell: ['mancuerna', 'Mancuerna', 'free_weight'],
  cable: ['polea', 'Polea', 'machine'],
  barbell: ['barra', 'Barra', 'free_weight'],
  'leverage machine': ['maquina-de-palanca', 'Máquina de palanca', 'machine'],
  band: ['banda', 'Banda elástica', 'band'],
  'smith machine': ['maquina-smith', 'Máquina Smith', 'machine'],
  kettlebell: ['kettlebell', 'Kettlebell', 'free_weight'],
  weighted: ['lastre', 'Lastre', 'free_weight'],
  'stability ball': ['balon-de-estabilidad', 'Balón de estabilidad', 'other'],
  'ez barbell': ['barra-z', 'Barra Z', 'free_weight'],
  assisted: ['maquina-asistida', 'Máquina asistida', 'machine'],
  'sled machine': ['prensa-trineo', 'Prensa / trineo', 'machine'],
  'medicine ball': ['balon-medicinal', 'Balón medicinal', 'free_weight'],
  rope: ['cuerda', 'Cuerda', 'other'],
  roller: ['rodillo', 'Rodillo de espuma', 'other'],
  'resistance band': ['banda-de-resistencia', 'Banda de resistencia', 'band'],
  'bosu ball': ['bosu', 'BOSU', 'other'],
  'olympic barbell': ['barra-olimpica', 'Barra olímpica', 'free_weight'],
  'wheel roller': ['rueda-abdominal', 'Rueda abdominal', 'other'],
  'upper body ergometer': ['ergometro-de-brazos', 'Ergómetro de brazos', 'cardio'],
  'skierg machine': ['skierg', 'SkiErg', 'cardio'],
  hammer: ['mazo', 'Mazo', 'other'],
  'stationary bike': ['bicicleta-fija', 'Bicicleta fija', 'cardio'],
  tire: ['llanta', 'Llanta', 'other'],
  'trap bar': ['barra-hexagonal', 'Barra hexagonal', 'free_weight'],
  'elliptical machine': ['eliptica', 'Elíptica', 'cardio'],
  'stepmill machine': ['escaladora', 'Escaladora', 'cardio'],
};

const seen = new Set();
const exercises = [];
for (const e of catalog) {
  const name = e.name.trim();
  if (seen.has(name.toLowerCase())) continue; // 6 nombres repetidos en el catálogo
  seen.add(name.toLowerCase());
  if (e.equipment && !EQUIPMENT[e.equipment]) throw new Error(`Equipo sin mapear: ${e.equipment}`);
  exercises.push({ ...e, name });
}

const header = (title) => `-- ${title}\n-- Generado por supabase/scripts/build-exercise-seed.mjs. Imágenes y GIFs: © Gym visual (web/public/EXERCISES_NOTICE.md).\n-- Requiere haber ejecutado antes la migración 20261112100000_fitcoach_app.sql. Se puede ejecutar más de una vez.\n`;

const equipmentSql = `${header('FitCoach · Catálogo 1/5: equipo')}
insert into public.fc_equipment (slug, name, category, created_at, updated_at) values
${Object.values(EQUIPMENT).map(([slug, name, category]) => `(${q(slug)}, ${q(name)}, ${q(category)}, now(), now())`).join(',\n')}
on conflict do nothing;
`;

function exercisePart(rows, index) {
  const values = rows.map((e) => {
    const type = e.category === 'cardio' ? 'cardio' : (e.secondary_muscles || []).length >= 2 ? 'compound' : 'isolation';
    return `(${[q(e.name), q(e.target || e.muscle_group || e.category || 'general'), arr(e.secondary_muscles || []), q('beginner'), q(type),
      arr(e.instruction_steps?.es || []), q(e.equipment ? `Equipo: ${EQUIPMENT[e.equipment][1]}` : null), 'true', q(e.id),
      q(e.gif_url ? MEDIA + e.gif_url : null), q(e.image ? MEDIA + e.image : null), q(e.equipment), 'now()', 'now()'].join(',')})`;
  });
  const links = rows.filter((e) => e.equipment).map((e) => `(${q(e.name)}, ${q(EQUIPMENT[e.equipment][0])})`);
  return `${header(`FitCoach · Catálogo ${index + 2}/5: ejercicios (${rows.length})`)}
insert into public.fc_exercises (name, muscle_group, secondary_muscles, difficulty, exercise_type, instructions, coaching_tip, is_active, catalog_id, gif_url, image_url, equipment, created_at, updated_at)
values
${values.join(',\n')}
on conflict (name) do update set
  catalog_id = coalesce(public.fc_exercises.catalog_id, excluded.catalog_id),
  gif_url = excluded.gif_url, image_url = excluded.image_url, equipment = excluded.equipment,
  instructions = case when coalesce(cardinality(public.fc_exercises.instructions), 0) = 0 then excluded.instructions else public.fc_exercises.instructions end,
  updated_at = now();

insert into public.fc_exercise_equipment (exercise_id, equipment_id)
select e.id, q.id
from (values
${links.join(',\n')}
) as v(exercise_name, equipment_slug)
join public.fc_exercises e on e.name = v.exercise_name
join public.fc_equipment q on q.slug = v.equipment_slug
on conflict do nothing;
`;
}

const dir = new URL('supabase/seed/', root);
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) rmSync(new URL(f, dir));
writeFileSync(new URL('01_equipo.sql', dir), equipmentSql);
const size = Math.ceil(exercises.length / PARTS);
for (let i = 0; i < PARTS; i += 1) {
  writeFileSync(new URL(`0${i + 2}_ejercicios_${i + 1}.sql`, dir), exercisePart(exercises.slice(i * size, (i + 1) * size), i));
}
console.log(`${Object.keys(EQUIPMENT).length} equipos y ${exercises.length} ejercicios → supabase/seed/`);
