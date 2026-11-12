-- FitCoach · App de pacientes sobre el esquema Arnold V2
-- Aditiva: solo agrega columnas y funciones. No crea tablas ni cambia políticas existentes.
-- Se puede ejecutar más de una vez.

-- 1) Animación e imagen de cada ejercicio (catálogo Gym visual) ------------
alter table public.fc_exercises add column if not exists gif_url text;
alter table public.fc_exercises add column if not exists image_url text;
alter table public.fc_exercises add column if not exists catalog_id text;
alter table public.fc_exercises add column if not exists equipment text;  -- etiqueta del catálogo; el detalle vive en fc_exercise_equipment
create unique index if not exists fc_exercises_catalog_id_key on public.fc_exercises (catalog_id) where catalog_id is not null;
do $$ begin
  alter table public.fc_exercises add constraint fc_exercises_gif_url_https check (gif_url is null or gif_url ~ '^https://');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.fc_exercises add constraint fc_exercises_image_url_https check (image_url is null or image_url ~ '^https://');
exception when duplicate_object then null; end $$;

-- 2) Vincular la cuenta del paciente con su expediente --------------------
-- El nutriólogo crea el expediente con el correo del paciente (queda 'invited').
-- Cuando el paciente inicia sesión en la app con ese correo YA CONFIRMADO,
-- se vincula y pasa a 'active'. Devuelve solo datos no sensibles del expediente.
create or replace function public.fc_claim_my_client()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_role text;
  v_client public.fc_clients;
begin
  if v_uid is null then return null; end if;

  select * into v_client from public.fc_clients c where c.user_id = v_uid and c.status <> 'archived' limit 1;
  if not found then
    select lower(trim(u.email)), coalesce(u.raw_app_meta_data ->> 'role', 'patient')
      into v_email, v_role
    from auth.users u
    where u.id = v_uid and u.email_confirmed_at is not null;
    if v_email is null or v_role <> 'patient' then return null; end if;

    update public.fc_clients c
       set user_id = v_uid,
           status = case when c.status = 'invited' then 'active' else c.status end,
           updated_at = now()
     where c.id = (
       select x.id from public.fc_clients x
        where x.user_id is null and x.status in ('invited', 'active', 'paused')
          and lower(trim(x.email)) = v_email and x.primary_trainer_id <> v_uid
        order by x.created_at desc limit 1)
    returning * into v_client;
    if not found then return null; end if;
  end if;

  return jsonb_build_object('id', v_client.id, 'full_name', v_client.full_name, 'email', v_client.email,
    'goal', v_client.goal, 'height_cm', v_client.height_cm, 'status', v_client.status);
end $$;

-- 3) Rutina activa del paciente con ejercicios y animaciones --------------
create or replace function public.fc_my_routine()
returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (
    select c.id from public.fc_clients c where c.user_id = (select auth.uid()) and c.status <> 'archived' limit 1
  ), r as (
    select r.* from public.fc_routines r join me on r.client_id = me.id
     where r.archived_at is null and r.is_active is not false
     order by r.created_at desc limit 1
  ), days as (
    select r.id as routine_id, x.day_of_week, d.label
      from r
      join (select re.routine_id, re.day_of_week from public.fc_routine_exercises re
            union select rd.routine_id, rd.day_of_week from public.fc_routine_days rd) x on x.routine_id = r.id
      left join public.fc_routine_days d on d.routine_id = r.id and d.day_of_week = x.day_of_week
  )
  select jsonb_build_object(
    'id', r.id, 'name', r.name, 'source', r.source, 'goal', r.goal,
    'session_minutes', r.session_minutes, 'days_per_week', r.days_per_week,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day_of_week', days.day_of_week,
        'label', days.label,
        'exercises', coalesce((
          select jsonb_agg(jsonb_build_object(
            'routine_exercise_id', re.id, 'exercise_id', e.id, 'name', e.name,
            'muscle_group', e.muscle_group, 'equipment', e.equipment,
            'gif_url', e.gif_url, 'image_url', e.image_url,
            'instructions', e.instructions, 'coaching_tip', e.coaching_tip,
            'sets', re.sets, 'reps_min', re.reps_min, 'reps_max', re.reps_max,
            'duration_seconds', re.duration_seconds, 'rest_seconds', re.rest_seconds, 'notes', re.notes
          ) order by re.order_index)
          from public.fc_routine_exercises re join public.fc_exercises e on e.id = re.exercise_id
          where re.routine_id = r.id and re.day_of_week = days.day_of_week), '[]'::jsonb)
      ) order by days.day_of_week)
      from days), '[]'::jsonb))
  from r
$$;

-- 4) Historial del paciente: entrenamientos con series y medidas ----------
create or replace function public.fc_my_progress(p_days integer default 400)
returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (
    select c.id from public.fc_clients c where c.user_id = (select auth.uid()) and c.status <> 'archived' limit 1
  ), s as (
    select s.* from public.fc_workout_sessions s
     where s.status = 'completed'
       and (s.client_id = (select id from me) or s.subject_user_id = (select auth.uid()))
       and coalesce(s.completed_at, s.started_at, s.created_at) >= now() - make_interval(days => greatest(1, least(p_days, 3650)))
  )
  select jsonb_build_object(
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'routine_id', s.routine_id, 'started_at', s.started_at,
        'completed_at', coalesce(s.completed_at, s.started_at, s.created_at), 'duration_seconds', s.duration_seconds,
        'day_of_week', (select re.day_of_week from public.fc_set_logs l join public.fc_routine_exercises re on re.id = l.routine_exercise_id where l.session_id = s.id limit 1),
        'sets', coalesce((
          select jsonb_agg(jsonb_build_object(
            'exercise_name', e.name, 'set_number', l.set_number, 'reps', l.reps_completed,
            'weight_kg', case when l.weight_unit = 'lb' then round(l.weight * 0.453592, 2) else l.weight end,
            'completed_at', coalesce(l.completed_at, s.completed_at)
          ) order by re.order_index, l.set_number)
          from public.fc_set_logs l
          join public.fc_routine_exercises re on re.id = l.routine_exercise_id
          join public.fc_exercises e on e.id = re.exercise_id
          where l.session_id = s.id), '[]'::jsonb)
      ) order by coalesce(s.completed_at, s.started_at, s.created_at))
      from s), '[]'::jsonb),
    'measurements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'measured_on', m.measured_on, 'weight_kg', m.weight_kg, 'body_fat_percent', m.body_fat_percent,
        'muscle_mass_kg', m.muscle_mass_kg, 'waist_cm', m.waist_cm
      ) order by m.measured_on, m.created_at)
      from public.fc_body_measurements m
      where m.client_id = (select id from me) or m.subject_user_id = (select auth.uid())), '[]'::jsonb)
  )
$$;

revoke all on function public.fc_claim_my_client() from public, anon;
revoke all on function public.fc_my_routine() from public, anon;
revoke all on function public.fc_my_progress(integer) from public, anon;
grant execute on function public.fc_claim_my_client() to authenticated;
grant execute on function public.fc_my_routine() to authenticated;
grant execute on function public.fc_my_progress(integer) to authenticated;
