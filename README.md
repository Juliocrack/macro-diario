# Macro Diario

App móvil (Android / iOS) para todo lo que implica un cambio físico: nutrición con IA, entrenamiento, progreso corporal, recetas y calculadoras. Hecha con **Expo SDK 58 + React Native + TypeScript**. Los datos se guardan en el teléfono (SQLite) y funciona sin internet, salvo las funciones de IA y la búsqueda de productos en línea.

## Funciones

**Nutrición**
- Diario por comida (desayuno, comida, cena, snacks) con anillo de calorías y barras de proteína, grasa, carbohidratos y fibra.
- **Foto del platillo con IA (Gemini):** identifica cada alimento, estima los gramos y calcula los macros. Ajustas porciones antes de guardar.
- Describir la comida con texto ("3 tacos al pastor y una coca") y obtener macros.
- **Escáner de código de barras** con Open Food Facts. Si el producto no existe, le tomas foto a la etiqueta y la IA llena los datos.
- Base de 200+ alimentos mexicanos, búsqueda en línea, alimentos propios, favoritos, recientes y comidas frecuentes.
- Copiar comidas del día anterior, agua con metas y "¿Qué como?", que sugiere opciones según los macros que te faltan.

**Recetas**
- 12 recetas fit incluidas, creador con cálculo por porción, fotos y generación con IA.

**Entrenamiento**
- 95 ejercicios en español y 8 plantillas (PPL, Torso/Pierna, Full Body y en casa).
- Editor de rutinas y **programa semanal generado con IA**.
- Modo entrenamiento con series, peso y reps, valores de la sesión anterior y **temporizador de descanso** que también avisa con notificación.
- Historial, volumen, calendario, **récords personales**, 1RM estimado y gráfica por ejercicio.

**Progreso**
- Peso con promedio móvil, ritmo semanal e IMC.
- Medidas corporales con % de grasa automático (método Marina de EE. UU.).
- Fotos de progreso por pose con comparación lado a lado.
- Promedios y adherencia de calorías y proteína, y exportación a CSV.

**Calculadoras**
IMC, TMB (Mifflin, Harris-Benedict, Katch-McArdle), TDEE y macros por objetivo, % de grasa, FFMI, peso ideal, cintura-altura y cintura-cadera, 1RM con tabla de cargas, zonas de FC, calorías por actividad (METs), hidratación, proyección de peso y proteína diaria.

**Extras**
Ayuno intermitente con etapas y aviso al terminar, Coach IA con el contexto de tus datos, recordatorios (comidas, agua, pesaje y entreno), respaldo y restauración en JSON, y tema claro y oscuro.

## Correrla en tu celular

Requisitos: Node 20+ y la app **Expo Go** (Play Store / App Store).

```bash
git clone https://github.com/Juliocrack/macro-diario
cd macro-diario
npm install
npx expo start
```

Escanea el QR con Expo Go (en Android, desde la propia app). El celular y la compu deben estar en la misma red Wi-Fi; si no, usa `npx expo start --tunnel`.

### Generar el APK instalable

```bash
npm i -g eas-cli
eas login
eas build -p android --profile preview
```

Al terminar, EAS te da un enlace para descargar el `.apk` e instalarlo directo en tu Android.

## Configurar la IA (Gemini)

1. Entra a <https://aistudio.google.com/apikey> y crea una API key (la capa gratuita alcanza para uso personal).
2. En la app: **Más → Inteligencia artificial**, pega la key y toca **Probar conexión**.

La key se guarda cifrada en el teléfono con `expo-secure-store`. El modelo se puede cambiar desde la app; por defecto se usa `gemini-3.6-flash`.

## Estructura

```
src/
  app/            Pantallas (Expo Router). (tabs) = Hoy, Entreno, Progreso, Más
  components/     UI reutilizable (ui.tsx) y gráficas SVG (charts.tsx)
  data/           Datos semilla: alimentos, ejercicios, rutinas, recetas
  db/             Esquema SQLite, migraciones y todas las consultas
  lib/            IA (Gemini), Open Food Facts, fórmulas, notificaciones, archivos
```

- `src/lib/formulas.ts` contiene las fórmulas puras y tiene pruebas: `npm test`.
- Revisión de tipos: `npm run typecheck`. Lint: `npx expo lint`.
- Para agregar tablas, sube `DB_VERSION` en `src/db/schema.ts` y agrega la migración.

## Ideas para siguientes versiones

- Sincronización en la nube (Supabase) e inicio de sesión
- Health Connect / Apple Health (pasos, calorías activas, peso de básculas)
- Widgets de pantalla de inicio
- Planificador semanal de comidas con lista del súper
- Logros y retos
