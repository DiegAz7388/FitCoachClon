# FitCoach · App de pacientes (Android e iOS)

App en **React Native + Expo** para los pacientes del nutriólogo. Usa el mismo Supabase (Arnold V2) que el panel web.

## Qué hace

- **Hoy**: el entrenamiento que toca, semana con días entrenados, racha y avance semanal.
- **Rutina**: la rutina asignada por día, con la animación de cada ejercicio, series, repeticiones o tiempo, descanso e instrucciones.
- **Modo entrenamiento**: animación del ejercicio en curso, serie actual, registro de repeticiones y peso (precargado con la vez anterior), cuenta regresiva para ejercicios por tiempo, descanso automático con "+15 s" y "Saltar", vibración al terminar el descanso, pantalla siempre encendida y resumen final. Si la app se cierra a media sesión, al volver se retoma donde iba.
- **Progreso**: entrenamientos por semana, peso / % grasa / cintura, volumen por sesión y mejores marcas.
- **Rutina con IA**: cuestionario (objetivo, nivel, lugar, días, minutos, músculos, lesiones) y la IA arma la rutina con ejercicios del catálogo.

## Requisitos previos (una sola vez)

1. Aplicar en Supabase la migración y el catálogo (ver `../supabase/README.md`).
2. El nutriólogo registra al paciente en el panel con su **correo**. El paciente crea su cuenta en la app con ese mismo correo y queda vinculado automáticamente.

## Ejecutar en tu celular

Requiere Node.js 20+ y la app **Expo Go** en el teléfono (Play Store / App Store).

```bash
cd mobile
cp .env.example .env          # y coloca la URL y la publishable key
npm install
npx expo install --fix        # alinea las versiones con el SDK de Expo instalado
npx expo start
```

Escanea el código QR con la cámara (iPhone) o con Expo Go (Android).

## Pruebas

```bash
npm test     # motor del modo entrenamiento y cálculos de progreso
```

## Publicar en las tiendas

Con [EAS](https://docs.expo.dev/build/introduction/): `npm i -g eas-cli`, `eas build -p android` / `eas build -p ios` y `eas submit`. Se necesita cuenta de Google Play (pago único) y de Apple Developer (anual). Antes, agrega íconos y pantalla de inicio en `app.json`.
