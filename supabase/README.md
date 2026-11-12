# Supabase · FitCoach sobre Arnold V2

FitCoach usa las tablas, reglas (RLS) y funciones que ya tiene Arnold V2. Esta carpeta solo **agrega** lo que falta.

## 1. Migración

En Supabase → **SQL Editor**, abre una consulta nueva, **pega el contenido** de este archivo y presiona **Run**:

```
migrations/20261112100000_fitcoach_app.sql
```

> Pega el texto que hay dentro del archivo, no su ruta.

Es aditiva y se puede ejecutar más de una vez:

- `fc_exercises`: columnas `gif_url`, `image_url`, `catalog_id` y `equipment`.
- `fc_claim_my_client()`: vincula la cuenta del paciente con su expediente. El nutriólogo lo registra con su correo (`invited`); cuando el paciente entra a la app con ese correo **confirmado**, queda vinculado y `active`.
- `fc_my_routine()` y `fc_my_progress()`: lectura de la rutina activa y del historial del paciente.

Funciones de Arnold V2 que usan la app y el panel: `fc_create_client`, `fc_complete_my_workout`, `fc_record_my_body_measurement`.

## 2. Catálogo de ejercicios (después de la migración)

Ejecuta en orden, cada uno en una consulta nueva:

```
seed/01_equipo.sql
seed/02_ejercicios_1.sql
seed/03_ejercicios_2.sql
seed/04_ejercicios_3.sql
seed/05_ejercicios_4.sql
```

Carga 1,318 ejercicios con animación e instrucciones en español, y los vincula con `fc_equipment` / `fc_exercise_equipment`. Comprobación:

```sql
select count(*), count(gif_url) from fc_exercises;   -- ambos ≥ 1318
```

Para regenerarlos si cambia el catálogo: `node supabase/scripts/build-exercise-seed.mjs`.

## 3. Rutinas con IA (Google Gemini)

Crea una clave gratuita en [Google AI Studio](https://aistudio.google.com/apikey) y, desde la carpeta del proyecto en tu computadora:

```bash
npx supabase login
npx supabase link --project-ref zyqhhdaovhwxfgwocdow
npx supabase secrets set GEMINI_API_KEY=tu-clave-de-gemini    # nunca en la app, el panel ni el chat
npx supabase functions deploy generate-routine
```

- Modelo por defecto: `gemini-2.5-flash`. Para usar otro: `npx supabase secrets set GEMINI_MODEL=gemini-3.8-flash`.
- El nivel gratuito tiene límite de solicitudes por minuto y por día; si se alcanza, la app muestra un aviso para intentar más tarde.
- Si algún día prefieren OpenAI: configura `OPENAI_API_KEY` en lugar de `GEMINI_API_KEY`.

Uso:

- Paciente (app): genera y guarda su rutina (`source = 'fito_ai'`).
- Nutriólogo (panel → Constructor → Con IA): recibe una propuesta, la edita y la asigna.
- Cada solicitud queda en `fc_ai_routine_requests` y `fc_ai_request_days`.

## 4. Autenticación

- **Authentication → Providers → Email**: deja activo el registro y **Confirm email**. La vinculación exige correo confirmado para que nadie pueda reclamar el expediente de otra persona.
- Los roles salen de `app_metadata.role` (`patient`, `trainer`, `admin`), como ya lo usa Arnold V2.

## Pruebas locales

`tests/arnold_v2_replica.sql` recrea el esquema de Arnold V2 (exportado del proyecto) y `tests/flujo_paciente.sql` prueba el flujo completo: alta, vinculación, rutina, entrenamiento, medidas y aislamiento entre usuarios. **No se ejecutan en Supabase.**

```bash
createdb fitcoach_test
psql -d fitcoach_test -f supabase/tests/arnold_v2_replica.sql
psql -d fitcoach_test -f supabase/migrations/20261112100000_fitcoach_app.sql
for f in supabase/seed/*.sql; do psql -d fitcoach_test -f "$f"; done
psql -d fitcoach_test -f supabase/tests/flujo_paciente.sql
```

Lógica de la función de IA: `npx tsx supabase/functions/generate-routine/plan.test.ts` y `ai.test.ts`.
