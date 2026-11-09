import { Suspense } from 'react';
import { Stack, ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { migrate } from '@/db/schema';
import { setDb } from '@/db';
import { useTheme } from '@/theme';
import { Loading } from '@/components/ui';
import { notificationsAvailable } from '@/lib/device';

// Registra el manejador de notificaciones (no hace nada en Expo Go para Android)
notificationsAvailable();

async function init(db: SQLiteDatabase) {
  setDb(db);
  await migrate(db);
}

export default function RootLayout() {
  const t = useTheme();
  const base = t.dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: t.bg, card: t.bg, text: t.ink, border: t.line, primary: t.kcal },
  };
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <Suspense fallback={<Loading text="Preparando tu diario…" />}>
          <SQLiteProvider databaseName="macrodiario.db" onInit={init} useSuspense>
            <StatusBar style={t.dark ? 'light' : 'dark'} />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: t.bg },
                headerTintColor: t.ink,
                headerShadowVisible: false,
                headerTitleStyle: { fontWeight: '700' },
                contentStyle: { backgroundColor: t.bg },
                headerBackButtonDisplayMode: 'minimal',
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="food/add" options={{ title: 'Agregar alimento' }} />
              <Stack.Screen name="food/[id]" options={{ title: 'Porción' }} />
              <Stack.Screen name="food/new" options={{ title: 'Alimento' }} />
              <Stack.Screen name="food/photo" options={{ title: 'Analizar con IA' }} />
              <Stack.Screen name="food/scan" options={{ title: 'Escanear código', headerShown: false }} />
              <Stack.Screen name="food/suggest" options={{ title: '¿Qué como?' }} />
              <Stack.Screen name="entry/[id]" options={{ title: 'Editar registro', presentation: 'modal' }} />
              <Stack.Screen name="recipes/index" options={{ title: 'Recetas' }} />
              <Stack.Screen name="recipes/[id]" options={{ title: 'Receta' }} />
              <Stack.Screen name="recipes/edit" options={{ title: 'Editar receta' }} />
              <Stack.Screen name="routine/[id]" options={{ title: 'Rutina' }} />
              <Stack.Screen name="routine/generate" options={{ title: 'Programa con IA' }} />
              <Stack.Screen name="workout/active" options={{ title: 'Entrenando', gestureEnabled: false }} />
              <Stack.Screen name="workout/[id]" options={{ title: 'Entrenamiento' }} />
              <Stack.Screen name="exercise/pick" options={{ title: 'Ejercicios', presentation: 'modal' }} />
              <Stack.Screen name="exercise/[id]" options={{ title: 'Ejercicio' }} />
              <Stack.Screen name="body/measure" options={{ title: 'Medidas corporales' }} />
              <Stack.Screen name="body/photos" options={{ title: 'Fotos de progreso' }} />
              <Stack.Screen name="calc/index" options={{ title: 'Calculadoras' }} />
              <Stack.Screen name="calc/[key]" options={{ title: 'Calculadora' }} />
              <Stack.Screen name="fasting" options={{ title: 'Ayuno intermitente' }} />
              <Stack.Screen name="goals" options={{ title: 'Perfil y metas' }} />
              <Stack.Screen name="coach" options={{ title: 'Coach IA' }} />
              <Stack.Screen name="settings/ai" options={{ title: 'Inteligencia artificial' }} />
              <Stack.Screen name="settings/reminders" options={{ title: 'Recordatorios' }} />
              <Stack.Screen name="settings/data" options={{ title: 'Respaldo y datos' }} />
            </Stack>
          </SQLiteProvider>
        </Suspense>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
