-- Prueba del flujo completo sobre la réplica de Arnold V2 (ver arnold_v2_replica.sql).
\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'nutri@fc.mx', now(), '{"role":"trainer"}'),
  ('22222222-2222-2222-2222-222222222222', 'Ana@Mail.com', now(), '{"role":"patient"}'),
  ('33333333-3333-3333-3333-333333333333', 'beto@mail.com', null, '{"role":"patient"}'),
  ('44444444-4444-4444-4444-444444444444', 'intruso@mail.com', now(), '{}');
create function pg_temp.como(uid text) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', uid)::text, false) $$;
set role authenticated;

\echo '== Nutriólogo crea pacientes y asigna rutina (con RLS, como el panel)'
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select 'Ana creada: ' || (fc_create_client('Ana García', ' ana@mail.com ', null, 'Bajar grasa', 160)).status;
select 'Beto creado: ' || (fc_create_client('Beto Ruiz', 'beto@mail.com')).status;
insert into fc_routines (client_id, created_by, name, source, experience_level, training_location, focus_mode, priority_muscles, session_minutes, days_per_week, is_active)
  select id, '11111111-1111-1111-1111-111111111111', 'Fuerza base', 'trainer', 'beginner', 'gym', 'balanced', '{}', 45, 2, true from fc_clients where full_name = 'Ana García';
insert into fc_routine_days select r.id, d, l from fc_routines r, (values (1, 'Lunes'), (7, 'Domingo')) v(d, l) where r.name = 'Fuerza base';
insert into fc_routine_exercises (routine_id, exercise_id, day_of_week, order_index, sets, reps_min, reps_max, duration_seconds, rest_seconds)
  select r.id, e.id, v.d, v.o, 3, v.rmin, v.rmax, v.dur, 60 from fc_routines r,
  (values ('barbell full squat', 1, 1, 8, 12, null::int), ('weighted front plank', 1, 2, null, null, 40), ('push-up', 7, 1, 10, 15, null)) v(n, d, o, rmin, rmax, dur)
  join fc_exercises e on e.name = v.n where r.name = 'Fuerza base';
select 'ejercicios asignados: ' || count(*) from fc_routine_exercises;

\echo '== Beto (correo SIN confirmar) no puede vincularse'
select pg_temp.como('33333333-3333-3333-3333-333333333333');
select 'Beto vincula: ' || coalesce(fc_claim_my_client()::text, 'null (correcto)');

\echo '== Ana se vincula, ve su rutina, entrena y registra medidas'
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select 'rutina antes de vincular: ' || coalesce(fc_my_routine()::text, 'null (correcto)');
select 'vincula: ' || (fc_claim_my_client() ->> 'status') || ' / ' || (fc_claim_my_client() ->> 'full_name');
select 'no expone notas del nutriólogo: ' || (not (fc_claim_my_client() ? 'notes'))::text;
select 'rutina: ' || (r ->> 'name') || ' · días ' || (select string_agg(d ->> 'day_of_week', ',') from jsonb_array_elements(r -> 'days') d)
  || ' · plancha ' || (r #>> '{days,0,exercises,1,duration_seconds}') || ' s · gif ' || left(r #>> '{days,0,exercises,0,gif_url}', 40) from fc_my_routine() r;
select 'guarda entrenamiento: sesión ' || fc_complete_my_workout(
  (fc_my_routine() ->> 'id')::bigint, 1::smallint, now() - interval '40 min', now(),
  (select jsonb_agg(jsonb_build_object('routine_exercise_id', (e ->> 'routine_exercise_id')::bigint, 'set_number', s, 'reps_completed', case when e ->> 'duration_seconds' is null then 10 end, 'weight', case when e ->> 'duration_seconds' is null then 42.5 end))
     from jsonb_array_elements(fc_my_routine() #> '{days,0,exercises}') e, generate_series(1, 3) s));
select 'medida: ' || (fc_record_my_body_measurement(current_date, 68.4, 28.5, null, 81)).weight_kg;
select 'progreso: ' || jsonb_array_length(p -> 'sessions') || ' sesión, ' || jsonb_array_length(p #> '{sessions,0,sets}') || ' series, día ' || (p #>> '{sessions,0,day_of_week}')
  || ', 1.ª serie ' || (p #>> '{sessions,0,sets,0,exercise_name}') || ' ' || (p #>> '{sessions,0,sets,0,weight_kg}') || ' kg · medidas ' || jsonb_array_length(p -> 'measurements') from fc_my_progress() p;
\echo '--- debe FALLAR: serie de un día que no corresponde'
select fc_complete_my_workout((fc_my_routine() ->> 'id')::bigint, 7::smallint, now() - interval '1 min', now(),
  jsonb_build_array(jsonb_build_object('routine_exercise_id', (fc_my_routine() #>> '{days,0,exercises,0,routine_exercise_id}')::bigint, 'set_number', 1)));

\echo '== Otro usuario (intruso) no ve nada de Ana'
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select 'intruso: vincula=' || coalesce(fc_claim_my_client()::text, 'null') || ' rutina=' || coalesce(fc_my_routine()::text, 'null')
  || ' sesiones=' || jsonb_array_length(fc_my_progress() -> 'sessions') || ' medidas=' || jsonb_array_length(fc_my_progress() -> 'measurements')
  || ' clientes visibles=' || (select count(*) from fc_clients);

\echo '== El nutriólogo ve el progreso de Ana (RLS existente)'
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select 'nutriólogo: sesiones=' || (select count(*) from fc_workout_sessions) || ' series=' || (select count(*) from fc_set_logs) || ' medidas=' || (select count(*) from fc_body_measurements);
select 'nutriólogo como paciente: ' || coalesce(fc_claim_my_client()::text, 'null (correcto)');
