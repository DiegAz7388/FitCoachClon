-- FitCoach · Catálogo 1/5: equipo
-- Generado por supabase/scripts/build-exercise-seed.mjs. Imágenes y GIFs: © Gym visual (web/public/EXERCISES_NOTICE.md).
-- Requiere haber ejecutado antes la migración 20261112100000_fitcoach_app.sql. Se puede ejecutar más de una vez.

insert into public.fc_equipment (slug, name, category, created_at, updated_at) values
('peso-corporal', 'Peso corporal', 'bodyweight', now(), now()),
('mancuerna', 'Mancuerna', 'free_weight', now(), now()),
('polea', 'Polea', 'machine', now(), now()),
('barra', 'Barra', 'free_weight', now(), now()),
('maquina-de-palanca', 'Máquina de palanca', 'machine', now(), now()),
('banda', 'Banda elástica', 'band', now(), now()),
('maquina-smith', 'Máquina Smith', 'machine', now(), now()),
('kettlebell', 'Kettlebell', 'free_weight', now(), now()),
('lastre', 'Lastre', 'free_weight', now(), now()),
('balon-de-estabilidad', 'Balón de estabilidad', 'other', now(), now()),
('barra-z', 'Barra Z', 'free_weight', now(), now()),
('maquina-asistida', 'Máquina asistida', 'machine', now(), now()),
('prensa-trineo', 'Prensa / trineo', 'machine', now(), now()),
('balon-medicinal', 'Balón medicinal', 'free_weight', now(), now()),
('cuerda', 'Cuerda', 'other', now(), now()),
('rodillo', 'Rodillo de espuma', 'other', now(), now()),
('banda-de-resistencia', 'Banda de resistencia', 'band', now(), now()),
('bosu', 'BOSU', 'other', now(), now()),
('barra-olimpica', 'Barra olímpica', 'free_weight', now(), now()),
('rueda-abdominal', 'Rueda abdominal', 'other', now(), now()),
('ergometro-de-brazos', 'Ergómetro de brazos', 'cardio', now(), now()),
('skierg', 'SkiErg', 'cardio', now(), now()),
('mazo', 'Mazo', 'other', now(), now()),
('bicicleta-fija', 'Bicicleta fija', 'cardio', now(), now()),
('llanta', 'Llanta', 'other', now(), now()),
('barra-hexagonal', 'Barra hexagonal', 'free_weight', now(), now()),
('eliptica', 'Elíptica', 'cardio', now(), now()),
('escaladora', 'Escaladora', 'cardio', now(), now())
on conflict do nothing;
