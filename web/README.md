# FitCoach · Administración web

Panel web de administración: clientes, expedientes, rutinas, biblioteca de ejercicios, progreso y ajustes. No incluye pagos, suscripciones ni mensualidades.

## Ejecutar localmente

Desde esta carpeta:

```powershell
node server.mjs
```

Abre `http://localhost:8082`.

## Arnold V2

La app no reutiliza las credenciales de la aplicación móvil. Para conectar Arnold V2:

1. Copia `config.example.js` como `config.js`.
2. Coloca exclusivamente la URL del proyecto Arnold V2 y su **publishable key**.
3. Inicia sesión desde el botón **Conectar Arnold V2** con una cuenta `admin` o `trainer` ya autorizada por las políticas RLS.

No incluyas una clave `service_role`, `secret` ni ninguna otra credencial privada en este proyecto.

## Ejercicios y uso sin conexión

El catálogo completo de 1,324 ejercicios se guarda en `data/exercises.json`. El service worker conserva la aplicación y el catálogo después de la primera visita, para que las búsquedas, instrucciones, el constructor de rutinas y los borradores continúen disponibles sin Internet.

Las miniaturas se cargan del repositorio de origen cuando hay conexión. Los datos y las instrucciones siguen disponibles sin ellas. Revisa `EXERCISES_NOTICE.md` y conserva su atribución para cualquier uso de las imágenes o GIFs.

## Sincronización de datos

- Clientes y rutinas se guardan directamente en Arnold V2 al estar conectado.
- Cuando no hay red, los nuevos elementos se guardan como borradores en el navegador.
- Al guardar una rutina conectada, sus ejercicios se incorporan a `fc_exercises` mediante el nombre único y se relacionan con `fc_routine_exercises`.

Antes de usar información real, aplica las migraciones de Arnold V2 y revisa las políticas RLS para confirmar que solo administradores y entrenadores autorizados puedan consultar expedientes.
