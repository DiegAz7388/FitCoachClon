// Genera supabase/seed/exercises.sql a partir del catálogo del panel (1,318 ejercicios únicos).
// Uso: node supabase/scripts/build-exercise-seed.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const MEDIA = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';
const catalog = JSON.parse(readFileSync(new URL('web/public/data/exercises.json', root), 'utf8'));
const q = (value) => (value == null ? 'null' : `'${String(value).replace(/'/g, "''")}'`);
const arr = (items) => `array[${items.map(q).join(',')}]::text[]`;

const seen = new Set();
const rows = [];
for (const e of catalog) {
  const key = e.name.trim().toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  const type = e.category === 'cardio' ? 'cardio' : 'compound'; // mismos valores que ya usa el panel
  rows.push(`(${[q(e.name.trim()), q(e.target || e.muscle_group || e.category), arr(e.secondary_muscles || []), q('beginner'), q(type),
    arr(e.instruction_steps?.es || []), q(e.equipment ? `Equipo: ${e.equipment}` : null), 'true', q(e.id),
    q(e.gif_url ? MEDIA + e.gif_url : null), q(e.image ? MEDIA + e.image : null), q(e.equipment), q(e.category)].join(',')})`);
}

const sql = `-- Generado por supabase/scripts/build-exercise-seed.mjs. Imágenes y GIFs: © Gym visual (ver web/public/EXERCISES_NOTICE.md).
insert into public.fc_exercises (name, muscle_group, secondary_muscles, difficulty, exercise_type, instructions, coaching_tip, is_active, catalog_id, gif_url, image_url, equipment, category)
values
${rows.join(',\n')}
on conflict (name) do update set
  catalog_id = excluded.catalog_id, gif_url = excluded.gif_url, image_url = excluded.image_url,
  equipment = excluded.equipment, category = excluded.category,
  instructions = case when coalesce(array_length(public.fc_exercises.instructions, 1), 0) = 0 then excluded.instructions else public.fc_exercises.instructions end;
`;
mkdirSync(new URL('supabase/seed/', root), { recursive: true });
writeFileSync(new URL('supabase/seed/exercises.sql', root), sql);
console.log(`${rows.length} ejercicios → supabase/seed/exercises.sql`);
