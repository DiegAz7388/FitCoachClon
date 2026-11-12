# Supabase · FitCoach

## 1. Migración (tablas y permisos para la app de pacientes)

En el panel de Supabase → **SQL Editor**, ejecuta el contenido de:

```
migrations/20261112000000_fitcoach_mobile.sql
```

Es aditiva (no borra nada) y se puede ejecutar más de una vez. Agrega:

- `fc_clients.user_id`: vincula el expediente con la cuenta del paciente.
- `fc_exercises`: `gif_url`, `image_url`, `equipment`, `category`, `catalog_id`.
- `fc_routine_exercises`: `duration_seconds` (ejercicios por tiempo) y `notes`.
- Tablas `fc_workout_sessions`, `fc_set_logs` y `fc_body_measurements`.
- Funciones `fc_claim_client()` y `fc_current_client_id()`.
- Políticas RLS: el paciente solo ve y registra lo suyo; el entrenador ve lo de sus pacientes.

> El panel web nuevo guarda `gif_url` y `duration_seconds`; aplica la migración **antes** de usarlo con datos reales.

## 2. Catálogo de ejercicios con animaciones

Ejecuta `seed/exercises.sql` en el SQL Editor (1,318 ejercicios con GIF e instrucciones en español). Si cambia el catálogo del panel, regenéralo con:

```bash
node supabase/scripts/build-exercise-seed.mjs
```

## 3. Rutinas con IA (OpenAI)

Con la [CLI de Supabase](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref zyqhhdaovhwxfgwocdow
supabase secrets set OPENAI_API_KEY=sk-...        # tu clave de OpenAI (nunca en la app ni en el panel)
supabase secrets set OPENAI_MODEL=gpt-4.1-mini    # opcional
supabase functions deploy generate-routine
```

- Paciente (app): genera y guarda su rutina directamente.
- Nutriólogo (panel → Constructor → Con IA): recibe una propuesta, la edita y la asigna.

Pruebas de la lógica: `npx tsx supabase/functions/generate-routine/plan.test.ts`.

## 4. Autenticación

En **Authentication → Providers → Email**, deja habilitado el registro con correo. Si "Confirm email" está activo, el paciente debe confirmar su correo antes de entrar.
