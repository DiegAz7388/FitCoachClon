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

## 5. Invitaciones por correo a los pacientes

Al dar de alta a un paciente con correo, el panel le envía "‹Nutriólogo› te invitó a FitCoach". El paciente acepta,
confirma su correo, crea su contraseña en la página de bienvenida del panel y su app queda vinculada.

1. **Correo propio (SMTP).** El servicio de correo de prueba de Supabase solo envía al equipo del proyecto (2 por hora).
   Para el piloto, con una cuenta de Gmail dedicada a FitCoach:
   - En esa cuenta de Google activa la **verificación en 2 pasos** y crea una **contraseña de aplicación**
     (https://myaccount.google.com/apppasswords).
   - Supabase → **Authentication → Emails → SMTP Settings** → *Enable custom SMTP*:
     Sender email = la cuenta de Gmail · Sender name = `FitCoach` · Host = `smtp.gmail.com` · Port = `465` ·
     Username = la cuenta de Gmail · Password = la contraseña de aplicación (sin espacios).
   - Para la versión final conviene un servicio con el dominio del nutriólogo (Resend, Brevo, etc.).
2. **Plantilla.** Supabase → **Authentication → Emails → Templates → Invite user**:
   - Subject: `{{ .Data.trainer_name }} te invitó a FitCoach`
   - Body: el contenido de `supabase/templates/invitacion.html`.
3. **Site URL.** Supabase → **Authentication → URL Configuration → Site URL** = la dirección del panel en Netlify.
   El botón del correo lleva ahí.
4. **Función.** Supabase → **Edge Functions → Deploy a new function → Via editor**, nombre `invite-client`,
   pega el archivo armado (`npx esbuild supabase/functions/invite-client/index.ts --bundle --packages=external --format=esm`)
   o usa `npx supabase functions deploy invite-client`.
5. **Nombre del nutriólogo.** El correo usa `fc_profiles.full_name` de quien da de alta al paciente.

Cuando la app esté en las tiendas, agrega en Netlify las variables `VITE_ANDROID_URL` y `VITE_IOS_URL`
(Project configuration → Environment variables) y vuelve a publicar: la página de bienvenida mostrará los botones de descarga.
