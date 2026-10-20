import { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  activeFast, addWater, copyDay, entriesFor, getGoals, getProfile, getWater, MEALS, saveMeal, useQuery, DEFAULT_GOALS, DEFAULT_PROFILE,
  type LogEntry, type Meal,
} from '@/db';
import { addDays, dayLabel, hm, today } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import { useTheme } from '@/theme';
import { Bar, Card, Icon, IconBtn, MacroLine, Ring, Row, Screen, T, tap, type IconName } from '@/components/ui';

export default function Today() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(today());
  const [entries] = useQuery(() => entriesFor(date), [date], [] as LogEntry[]);
  const [goals] = useQuery(getGoals, [], DEFAULT_GOALS);
  const [profile] = useQuery(getProfile, [], DEFAULT_PROFILE);
  const [water] = useQuery(() => getWater(date), [date], 0);
  const [fast] = useQuery(activeFast, [], null);
  const now = useNow(30000);

  const tot = entries.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, f: a.f + e.f, c: a.c + e.c, fiber: a.fiber + (e.fiber ?? 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0 });
  const left = goals.kcal - tot.kcal;
  const over = left < 0;
  const go = (path: string, meal?: Meal) => router.push({ pathname: path as any, params: { date, meal: meal ?? '' } });

  const mealMenu = (m: Meal, items: LogEntry[]) => {
    Alert.alert(MEALS.find(x => x.key === m)!.label, undefined, [
      {
        text: 'Copiar del día anterior',
        onPress: async () => {
          const n = await copyDay(addDays(date, -1), date, m);
          if (!n) Alert.alert('Nada que copiar', 'El día anterior no tiene registros en esta comida.');
        },
      },
      ...(items.length
        ? [{
            text: 'Guardar como comida frecuente',
            onPress: () =>
              Platform.OS === 'ios'
                ? Alert.prompt('Nombre', 'Ej. "Desayuno de siempre"', name => name && saveMeal(name, items))
                : saveMeal(`${MEALS.find(x => x.key === m)!.label} ${dayLabel(date).toLowerCase()}`, items).then(() => Alert.alert('Guardada', 'La encontrarás en Agregar → Frecuentes.')),
          }]
        : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  const macro = (label: string, v: number, g: number, col: string) => {
    const pct = g ? Math.round((v / g) * 100) : 0;
    return (
      <View style={{ gap: 5 }}>
        <Row>
          <T v="small" bold style={{ flex: 1 }}>{label}</T>
          <T v="small" num color={v > g * 1.05 ? t.warn : t.muted}>{Math.round(v)} / {g} g</T>
        </Row>
        <Bar value={v} max={g} color={col} />
        <T v="tiny" muted num>{v >= g ? (v > g * 1.05 ? `${Math.round(v - g)} g de más` : 'Meta cumplida') : `Faltan ${Math.round(g - v)} g · ${pct}%`}</T>
      </View>
    );
  };

  const action = (icon: IconName, label: string, onPress: () => void, color: string) => (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 16, backgroundColor: t.surface, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={color} size={21} />
      </View>
      <T v="tiny" bold>{label}</T>
    </Pressable>
  );

  return (
    <Screen contentStyle={{ paddingTop: insets.top + 8 }}>
      <Row>
        <View style={{ flex: 1 }}>
          <T v="small" muted>{profile.name ? `Hola, ${profile.name}` : 'Macro Diario'}</T>
          <Row gap={6}>
            <IconBtn name="chevron-back" size={18} onPress={() => setDate(addDays(date, -1))} label="Día anterior" />
            <Pressable onPress={() => setDate(today())}>
              <T v="h2" style={{ minWidth: 92, textAlign: 'center' }}>{dayLabel(date)}</T>
            </Pressable>
            <IconBtn name="chevron-forward" size={18} onPress={() => setDate(addDays(date, 1))} label="Día siguiente" />
          </Row>
        </View>
        <IconBtn name="chatbubble-ellipses" color={t.kcal} onPress={() => router.push('/coach')} label="Coach IA" />
      </Row>

      <Card style={{ gap: 16 }}>
        <Row gap={16} style={{ alignItems: 'center' }}>
          <Ring value={tot.kcal} max={goals.kcal} color={over ? t.warn : t.kcal} size={140}>
            <T v="h1" num>{Math.abs(Math.round(left)).toLocaleString('es-MX')}</T>
            <T v="tiny" muted>{over ? 'kcal de más' : 'kcal restantes'}</T>
          </Ring>
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <T v="tiny" muted>Consumidas</T>
              <T v="h3" num>{Math.round(tot.kcal).toLocaleString('es-MX')} kcal</T>
            </View>
            <View>
              <T v="tiny" muted>Meta</T>
              <T v="h3" num>{goals.kcal.toLocaleString('es-MX')} kcal</T>
            </View>
            <View>
              <T v="tiny" muted>Fibra</T>
              <T v="h3" num>{Math.round(tot.fiber)} / {goals.fiber} g</T>
            </View>
          </View>
        </Row>
        {macro('Proteína', tot.p, goals.p, t.prot)}
        {macro('Grasas', tot.f, goals.f, t.fat)}
        {macro('Carbohidratos', tot.c, goals.c, t.carb)}
      </Card>

      <Row gap={8}>
        {action('camera', 'Foto IA', () => go('/food/photo', undefined), t.kcal)}
        {action('barcode', 'Escanear', () => router.push({ pathname: '/food/scan', params: { date, meal: '' } }), t.carb)}
        {action('search', 'Buscar', () => go('/food/add'), t.water)}
        {action('sparkles', '¿Qué como?', () => go('/food/suggest'), t.prot)}
      </Row>

      {fast && (
        <Card onPress={() => router.push('/fasting')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="timer" color={t.train} />
          <View style={{ flex: 1 }}>
            <T bold>Ayuno en curso</T>
            <T v="small" muted>{hm(now - fast.started_at)} de {fast.target_h} h</T>
          </View>
          <Icon name="chevron-forward" color={t.muted} size={18} />
        </Card>
      )}

      <Card>
        <Row>
          <Icon name="water" color={t.water} />
          <View style={{ flex: 1 }}>
            <T bold>Agua</T>
            <T v="small" muted num>{(water / 1000).toFixed(2)} / {(goals.waterMl / 1000).toFixed(1)} L</T>
          </View>
          <IconBtn name="remove" onPress={() => addWater(date, -250)} label="Quitar 250 ml" />
          <IconBtn name="add" color="#fff" bg={t.water} onPress={() => addWater(date, 250)} label="Agregar 250 ml" />
        </Row>
        <Bar value={water} max={goals.waterMl} color={t.water} />
        <Row gap={6} wrap>
          {[500, 750, 1000].map(ml => (
            <Pressable key={ml} onPress={() => { tap(); addWater(date, ml); }} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: t.surface2 }}>
              <T v="tiny" bold>+{ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`}</T>
            </Pressable>
          ))}
        </Row>
      </Card>

      {MEALS.map(({ key, label }) => {
        const items = entries.filter(e => e.meal === key);
        const k = items.reduce((a, e) => a + e.kcal, 0);
        const p = items.reduce((a, e) => a + e.p, 0);
        return (
          <Card key={key} padded={false} style={{ gap: 0 }}>
            <Pressable onLongPress={() => mealMenu(key, items)} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
              <View style={{ flex: 1 }}>
                <T v="h3">{label}</T>
                <T v="small" muted num>{Math.round(k)} kcal{items.length ? ` · ${Math.round(p)} g proteína` : ''}</T>
              </View>
              <IconBtn name="ellipsis-horizontal" size={16} onPress={() => mealMenu(key, items)} label={`Opciones de ${label}`} />
              <IconBtn name="add" color="#fff" bg={t.kcal} onPress={() => go('/food/add', key)} label={`Agregar a ${label}`} />
            </Pressable>
            {items.map(e => (
              <Pressable key={e.id} onPress={() => router.push({ pathname: '/entry/[id]', params: { id: e.id } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.line, backgroundColor: pressed ? t.surface2 : 'transparent' })}>
                {e.source === 'ai' ? <Icon name="sparkles" size={14} color={t.kcal} /> : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T numberOfLines={1} style={{ fontWeight: '500' }}>{e.name}</T>
                  <Row gap={8}>
                    <T v="tiny" muted numberOfLines={1} style={{ flexShrink: 1 }}>{e.qty_label || `${Math.round(e.grams)} g`}</T>
                    <MacroLine p={e.p} f={e.f} c={e.c} small />
                  </Row>
                </View>
                <T bold num>{Math.round(e.kcal)}</T>
              </Pressable>
            ))}
          </Card>
        );
      })}
      <T v="tiny" muted center>Mantén presionada una comida para copiarla del día anterior o guardarla como frecuente.</T>
    </Screen>
  );
}
