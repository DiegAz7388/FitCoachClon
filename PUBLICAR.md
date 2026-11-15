# Publicar una versión de prueba de FitCoach

## 1. Panel web (Netlify, gratis)

1. Entra a https://app.netlify.com con tu cuenta de GitHub.
2. **Add new project → Import an existing project → GitHub** y elige el repo `FitCoachClon`.
3. Netlify lee `netlify.toml` (carpeta `web`, comando `npm run build`, publica `dist`). Presiona **Deploy**.
4. Al terminar te da una dirección como `https://nombre.netlify.app`. Puedes cambiar el nombre en **Project configuration → Change project name**.
5. En Supabase → **Authentication → URL Configuration**, pon esa dirección en **Site URL** (es a donde regresan los correos de confirmación).

> El plan gratuito tiene créditos mensuales y cada publicación gasta algunos. Si haces muchos `git push` seguidos, desactiva las publicaciones automáticas en **Project configuration → Build & deploy → Continuous deployment** y publica con **Trigger deploy** cuando quieras.

## 2. App para Android (archivo APK, gratis)

Desde `mobile/`, con la sesión de Expo iniciada (`npx expo login`):

```bash
npx eas-cli build --platform android --profile preview
```

- La primera vez pregunta si crea el proyecto en Expo: responde **Y**. Escribe un `projectId` en `app.json`; súbelo al repo.
- Pregunta si genera el keystore de Android: responde **Y** (Expo lo guarda).
- Tarda de 10 a 30 minutos (fila gratuita). Al final da un enlace y un QR para descargar e instalar el APK.
- En el celular, Android pedirá permitir "instalar apps de origen desconocido" para ese navegador.

## 3. App para iPhone

Para instalar una versión de prueba en iPhone se necesita la cuenta de **Apple Developer** (99 USD al año) y TestFlight:

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios
```

Sin esa cuenta, la app se puede mostrar en iPhone con Expo Go mientras tu computadora corre `npx expo start --tunnel`.

## 4. Cuentas para la persona que va a probar

- **Panel:** crea su usuario en Supabase (**Authentication → Users → Add user**, con *Auto Confirm User*) y dale el rol `trainer` con el SQL de `supabase/README.md`.
- **App (paciente de prueba):** crea el expediente en el panel con un correo de prueba y crea ese mismo usuario en Supabase con *Auto Confirm User*. Al entrar a la app con ese correo, queda vinculado.
