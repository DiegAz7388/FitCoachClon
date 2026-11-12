# FitCoach · Administración web

Panel web de administración en **React + Vite**: clientes, expedientes, rutinas, biblioteca de ejercicios, progreso y ajustes. No incluye pagos, suscripciones ni mensualidades.

## Ejecutar localmente

Requiere Node.js 20 o superior. Desde esta carpeta:

```powershell
npm install
npm run dev
```

Abre `http://localhost:8082`.

Para producción:

```powershell
npm run build     # genera la carpeta dist/
npm run preview   # sirve dist/ en http://localhost:8082
```

Sube el contenido de `dist/` a cualquier hosting estático (Netlify, Vercel, Cloudflare Pages, etc.).

## Arnold V2 (Supabase)

1. Copia `.env.example` como `.env`.
2. Coloca exclusivamente la URL del proyecto Arnold V2 y su **publishable key**.
3. Inicia sesión desde **Conectar Arnold V2** con una cuenta `admin` o `trainer` autorizada por las políticas RLS.

No incluyas una clave `service_role`, `secret` ni ninguna otra credencial privada. `.env` está en `.gitignore`; en el hosting configura las mismas variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Estructura

```
src/
  main.jsx            punto de entrada y registro del service worker
  App.jsx             elige la pantalla y el modal activos
  state.jsx           estado global (contexto): sesión, clientes, rutinas, catálogo
  config.js           lee las variables de entorno
  lib/arnold.js       acceso a Supabase (REST + Auth)
  lib/format.js       utilidades de texto y estados
  lib/drafts.js       borradores sin conexión
  data/demo.js        datos de demostración sin sesión
  components/         Shell (barra lateral), Topbar, componentes comunes
  pages/              Resumen, Clientes, Rutinas, Ejercicios, Progreso, Ajustes
  modals/             expediente, nuevo cliente, constructor, ejercicio, login
  styles.css          estilos (sin cambios respecto a la versión anterior)
public/
  data/exercises.json catálogo de 1,324 ejercicios
  sw.js               service worker para uso sin conexión
```

## Ejercicios y uso sin conexión

El catálogo completo se guarda en `public/data/exercises.json`. En producción, el service worker conserva la aplicación y el catálogo después de la primera visita, para que las búsquedas, instrucciones, el constructor de rutinas y los borradores continúen disponibles sin Internet.

Las miniaturas se cargan del repositorio de origen cuando hay conexión. Revisa `public/EXERCISES_NOTICE.md` y conserva su atribución para cualquier uso de las imágenes o GIFs.

## Sincronización de datos

- Clientes y rutinas se guardan directamente en Arnold V2 al estar conectado.
- Cuando no hay sesión, los nuevos elementos se guardan como borradores en el navegador.
- Al guardar una rutina conectada, sus ejercicios se incorporan a `fc_exercises` mediante el nombre único y se relacionan con `fc_routine_exercises`.

Antes de usar información real, aplica las migraciones de Arnold V2 y revisa las políticas RLS para confirmar que solo administradores y entrenadores autorizados puedan consultar expedientes.
