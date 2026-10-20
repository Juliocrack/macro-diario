import { useEffect, useRef, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import {
  addEntries, addEntry, insertFood, getFoodByBarcode, listRecipes, MEALS, recentEntries, recipeTotals, savedMeals, searchFoods, deleteSavedMeal,
  useQuery, type Food, type Meal, type Recipe, type Recent, type SavedMeal,
} from '@/db';
import { guessMeal, today } from '@/lib/dates';
import { searchOff, type OffProduct } from '@/lib/off';
import { clearFoodPicker } from '@/lib/picker';
import { useTheme } from '@/theme';
import { Button, Card, Empty, Icon, IconBtn, ListItem, Row, Screen, Seg, T, servingLabel } from '@/components/ui';

type Tab = 'buscar' | 'recientes' | 'frecuentes' | 'recetas' | 'mios';

export default function AddFood() {
  const t = useTheme();
  const nav = useNavigation();
  const params = useLocalSearchParams<{ date?: string; meal?: string; mode?: string }>();
  const mode = params.mode === 'recipe' ? 'recipe' : 'log';
  const date = params.date || today();
  const [meal, setMeal] = useState<Meal>((params.meal as Meal) || guessMeal());
  const [tab, setTab] = useState<Tab>('buscar');
  const [q, setQ] = useState('');
  const [flash, setFlash] = useState('');
  const [off, setOff] = useState<OffProduct[] | null>(null);
  const [offLoading, setOffLoading] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    nav.setOptions({ title: mode === 'recipe' ? 'Agregar ingrediente' : 'Agregar alimento' });
    return () => {
      if (mode === 'recipe') clearFoodPicker();
    };
  }, [mode, nav]);

  const [foods] = useQuery(() => searchFoods(q, tab === 'mios' ? 400 : 60), [q, tab], [] as Food[]);
  const [recents] = useQuery(recentEntries, [], [] as Recent[]);
  const [saved] = useQuery(savedMeals, [], [] as SavedMeal[]);
  const [recipes] = useQuery(listRecipes, [], [] as Recipe[]);

  const show = (msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(''), 1800);
  };
  const openFood = (id: number) => router.push({ pathname: '/food/[id]', params: { id, date, meal, mode } });

  const addRecent = async (r: Recent) => {
    await addEntry({ date, meal, name: r.name, grams: r.grams, qty_label: r.qty_label, kcal: r.kcal, p: r.p, f: r.f, c: r.c, fiber: r.fiber ?? 0, food_id: r.food_id, recipe_id: r.recipe_id, photo_uri: null, source: 'recent' });
    show(`${r.name} agregado`);
  };
  const addSaved = async (s: SavedMeal) => {
    await addEntries(s.items.map(i => ({ ...i, date, meal, photo_uri: null } as any)));
    show(`${s.name} agregada`);
  };
  const runOff = async () => {
    if (!q.trim()) return;
    setOffLoading(true);
    try {
      setOff(await searchOff(q.trim()));
    } catch (e: any) {
      Alert.alert('Sin resultados en línea', e?.message ?? 'Revisa tu conexión.');
    } finally {
      setOffLoading(false);
    }
  };
  const pickOff = async (p: OffProduct) => {
    const existing = p.barcode ? await getFoodByBarcode(p.barcode) : null;
    const id = existing?.id ?? (await insertFood({ name: p.name, brand: p.brand || null, category: 'Empaquetados', kcal: p.kcal, p: p.p, f: p.f, c: p.c, fiber: p.fiber, sugar: p.sugar, sodium: p.sodium, serving_name: p.serving_name, serving_g: p.serving_g, source: 'off', barcode: p.barcode || null }));
    openFood(id);
  };

  const tabs: { key: Tab; label: string }[] =
    mode === 'recipe'
      ? [{ key: 'buscar', label: 'Buscar' }, { key: 'mios', label: 'Mis alimentos' }]
      : [
          { key: 'buscar', label: 'Buscar' },
          { key: 'recientes', label: 'Recientes' },
          { key: 'frecuentes', label: 'Frecuentes' },
          { key: 'recetas', label: 'Recetas' },
          { key: 'mios', label: 'Mis alimentos' },
        ];

  const header = (
    <View style={{ gap: 12, paddingBottom: 8 }}>
      {mode === 'log' && <Seg options={MEALS} value={meal} onChange={setMeal} />}
      {mode === 'log' && (
        <Row gap={8}>
          <Button kind="soft" small icon="camera" title="Foto" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/food/photo', params: { date, meal } })} />
          <Button kind="soft" small icon="barcode" title="Código" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/food/scan', params: { date, meal } })} />
          <Button kind="soft" small icon="create" title="Describir" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/food/photo', params: { date, meal, text: '1' } })} />
        </Row>
      )}
      <Seg options={tabs} value={tab} onChange={setTab} scroll />
      {(tab === 'buscar' || tab === 'mios') && (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: t.line }}>
          <Icon name="search" size={18} color={t.muted} />
          <TextInput
            value={q}
            onChangeText={s => { setQ(s); setOff(null); }}
            placeholder="Pollo, tortilla, avena, marca…"
            placeholderTextColor={t.muted}
            style={{ flex: 1, color: t.ink, fontSize: 16, paddingVertical: 12, paddingHorizontal: 8 }}
            returnKeyType="search"
            onSubmitEditing={runOff}
            autoCorrect={false}
          />
          {q ? <IconBtn name="close" size={14} onPress={() => { setQ(''); setOff(null); }} label="Borrar búsqueda" /> : null}
        </View>
      )}
      {flash ? (
        <Card style={{ backgroundColor: t.ok + '22', padding: 10 }}>
          <Row><Icon name="checkmark-circle" color={t.ok} size={18} /><T v="small" bold>{flash}</T></Row>
        </Card>
      ) : null}
    </View>
  );

  const foodRow = (f: Food, i: number, arr: Food[]) => {
    const g = f.serving_g ?? 100;
    const k = g / 100;
    return (
      <ListItem
        key={f.id}
        title={f.name + (f.brand ? ` · ${f.brand}` : '')}
        subtitle={`${f.serving_name ? servingLabel(f.serving_name, g) : '100 g'} · ${Math.round(f.p * k)}P ${Math.round(f.f * k)}G ${Math.round(f.c * k)}C`}
        right={<T v="small" bold num>{Math.round(f.kcal * k)} kcal</T>}
        left={f.favorite ? <Icon name="star" size={16} color={t.fat} /> : f.source !== 'base' ? <Icon name={f.source === 'off' ? 'barcode' : f.source === 'ai' ? 'sparkles' : 'person'} size={16} color={t.muted} /> : undefined}
        onPress={() => openFood(f.id)}
        last={i === arr.length - 1}
      />
    );
  };

  let body: React.ReactNode = null;
  if (tab === 'buscar' || tab === 'mios') {
    const list = tab === 'mios' ? foods.filter(f => f.source !== 'base') : foods;
    body = (
      <View style={{ gap: 12 }}>
        <Card padded={false} style={{ gap: 0 }}>
          {list.length ? list.map(foodRow) : (
            <Empty icon="search" title={tab === 'mios' ? 'Aún no tienes alimentos propios' : 'Sin resultados'} text={tab === 'mios' ? 'Crea uno con los datos de la etiqueta o escaneando su código.' : 'Busca en línea, escanea el código o créalo.'} />
          )}
        </Card>
        {q.trim().length > 1 && tab === 'buscar' && (
          <Card padded={false} style={{ gap: 0 }}>
            {off === null ? (
              <View style={{ padding: 12 }}>
                <Button kind="ghost" icon="globe-outline" title={`Buscar "${q.trim()}" en productos de México`} onPress={runOff} loading={offLoading} />
              </View>
            ) : off.length === 0 ? (
              <Empty icon="globe-outline" title="Sin productos en línea" text="Prueba con la marca o escanea el código de barras." />
            ) : (
              off.map((p, i) => (
                <ListItem key={p.barcode + i} title={p.name + (p.brand ? ` · ${p.brand}` : '')} subtitle={`100 g · ${Math.round(p.p)}P ${Math.round(p.f)}G ${Math.round(p.c)}C`} right={<T v="small" bold num>{Math.round(p.kcal)} kcal</T>} left={<Icon name="globe-outline" size={16} color={t.muted} />} onPress={() => pickOff(p)} last={i === off.length - 1} />
              ))
            )}
          </Card>
        )}
        <Button kind="ghost" icon="add-circle-outline" title="Crear alimento" onPress={() => router.push({ pathname: '/food/new', params: { date, meal, mode, name: q } })} />
      </View>
    );
  } else if (tab === 'recientes') {
    body = (
      <Card padded={false} style={{ gap: 0 }}>
        {recents.length ? recents.map((r, i) => (
          <ListItem key={i} title={r.name} subtitle={`${r.qty_label || `${Math.round(r.grams)} g`} · ${Math.round(r.p)}P ${Math.round(r.f)}G ${Math.round(r.c)}C`} right={<Row gap={6}><T v="small" bold num>{Math.round(r.kcal)}</T><Icon name="add-circle" color={t.kcal} /></Row>} onPress={() => addRecent(r)} last={i === recents.length - 1} />
        )) : <Empty icon="time-outline" title="Sin recientes" text="Lo que registres aparecerá aquí para agregarlo con un toque." />}
      </Card>
    );
  } else if (tab === 'frecuentes') {
    body = (
      <Card padded={false} style={{ gap: 0 }}>
        {saved.length ? saved.map((s, i) => {
          const tt = s.items.reduce((a, x) => ({ kcal: a.kcal + x.kcal, p: a.p + x.p, f: a.f + x.f, c: a.c + x.c }), { kcal: 0, p: 0, f: 0, c: 0 });
          return (
            <ListItem key={s.id} title={s.name} subtitle={`${s.items.length} alimentos · ${Math.round(tt.p)}P ${Math.round(tt.f)}G ${Math.round(tt.c)}C`} right={<Row gap={6}><T v="small" bold num>{Math.round(tt.kcal)}</T><Icon name="add-circle" color={t.kcal} /></Row>} onPress={() => addSaved(s)}
              onLongPress={() => Alert.alert('Eliminar', `¿Eliminar "${s.name}"?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: () => deleteSavedMeal(s.id) }])}
              last={i === saved.length - 1} />
          );
        }) : <Empty icon="bookmark-outline" title="Sin comidas frecuentes" text="En Hoy, mantén presionada una comida y elige “Guardar como comida frecuente”." />}
      </Card>
    );
  } else if (tab === 'recetas') {
    body = (
      <Card padded={false} style={{ gap: 0 }}>
        {recipes.map((r, i) => {
          const tt = recipeTotals(r.items);
          const s = r.servings || 1;
          return (
            <ListItem key={r.id} title={r.name} subtitle={`Por porción · ${Math.round(tt.p / s)}P ${Math.round(tt.f / s)}G ${Math.round(tt.c / s)}C`} right={<T v="small" bold num>{Math.round(tt.kcal / s)} kcal</T>} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: r.id, date, meal } })} last={i === recipes.length - 1} />
          );
        })}
      </Card>
    );
  }

  return (
    <Screen>
      {header}
      {body}
    </Screen>
  );
}

