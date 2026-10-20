import { useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { addEntry, entriesFor, getGoals, MEALS, useQuery, DEFAULT_GOALS, type LogEntry, type Meal } from '@/db';
import { suggestMeals, AiError, type AiSuggestion } from '@/lib/ai';
import { guessMeal, today } from '@/lib/dates';
import { useTheme } from '@/theme';
import { Button, Card, Field, Loading, MacroGrid, MacroLine, Row, Screen, Seg, T } from '@/components/ui';

export default function Suggest() {
  const t = useTheme();
  const p = useLocalSearchParams<{ date?: string; meal?: string }>();
  const date = p.date || today();
  const [meal, setMeal] = useState<Meal>((p.meal as Meal) || guessMeal());
  const [prefs, setPrefs] = useState('');
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<AiSuggestion[] | null>(null);
  const [entries] = useQuery(() => entriesFor(date), [date], [] as LogEntry[]);
  const [goals] = useQuery(getGoals, [], DEFAULT_GOALS);

  const tot = entries.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, f: a.f + e.f, c: a.c + e.c }), { kcal: 0, p: 0, f: 0, c: 0 });
  const rem = { kcal: Math.max(0, goals.kcal - tot.kcal), p: Math.max(0, goals.p - tot.p), f: Math.max(0, goals.f - tot.f), c: Math.max(0, goals.c - tot.c) };
  // Reparte lo restante entre las comidas que faltan
  const order: Meal[] = ['des', 'com', 'cen', 'sna'];
  const remainingMeals = order.slice(order.indexOf(meal)).filter(m => m === meal || !entries.some(e => e.meal === m)).length || 1;
  const share = meal === 'sna' ? 0.5 : 1 / Math.max(1, remainingMeals - (order.indexOf(meal) < 3 ? 0.5 : 0));
  const target = { kcal: rem.kcal * Math.min(1, share), p: rem.p * Math.min(1, share), f: rem.f * Math.min(1, share), c: rem.c * Math.min(1, share) };

  const run = async () => {
    setBusy(true);
    try {
      setList(await suggestMeals(target, MEALS.find(m => m.key === meal)!.label.toLowerCase(), prefs));
    } catch (e: any) {
      Alert.alert('No se pudo sugerir', e?.message ?? 'Intenta de nuevo.', e instanceof AiError && e.code === 'no_key' ? [{ text: 'Configurar', onPress: () => router.push('/settings/ai') }, { text: 'Cerrar' }] : undefined);
    } finally {
      setBusy(false);
    }
  };

  const log = async (s: AiSuggestion) => {
    await addEntry({ date, meal, name: s.name, grams: 0, qty_label: '1 porción', kcal: s.kcal, p: s.p, f: s.f, c: s.c, fiber: 0, food_id: null, recipe_id: null, photo_uri: null, source: 'ai' });
    router.dismissTo('/');
  };

  return (
    <Screen>
      <T muted>Te propongo opciones que encajan con lo que te falta del día.</T>
      <Seg options={MEALS} value={meal} onChange={m => { setMeal(m); setList(null); }} />
      <T v="small" bold>Objetivo para esta comida</T>
      <MacroGrid {...target} />
      <T v="tiny" muted num>Te quedan {Math.round(rem.kcal)} kcal y {Math.round(rem.p)} g de proteína en el día.</T>
      <Field label="Preferencias (opcional)" value={prefs} onChangeText={setPrefs} placeholder="Ej. sin lácteos, algo rápido, tengo pollo y arroz" />
      <Button icon="sparkles" title="Sugerir opciones" onPress={run} loading={busy} />
      {busy && <Loading text="Pensando opciones…" />}
      {list?.map((s, i) => (
        <Card key={i}>
          <Row>
            <T v="h3" style={{ flex: 1 }}>{s.name}</T>
            <T bold num color={t.kcal}>{Math.round(s.kcal)} kcal</T>
          </Row>
          <MacroLine p={s.p} f={s.f} c={s.c} />
          {s.why ? <T v="small" muted>{s.why}</T> : null}
          {s.ingredients.map((x, j) => <T key={j} v="small">• {x}</T>)}
          <Button small kind="soft" icon="add" title="Registrar esta opción" onPress={() => log(s)} />
        </Card>
      ))}
    </Screen>
  );
}
