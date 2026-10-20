import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { addEntry, deleteFood, getFood, getGoals, MEALS, toggleFavoriteFood, useQuery, DEFAULT_GOALS, type Food, type Meal } from '@/db';
import { guessMeal, today } from '@/lib/dates';
import { deliverFood, hasFoodPicker } from '@/lib/picker';
import { useTheme } from '@/theme';
import { Bar, Button, Card, Field, IconBtn, Loading, MacroGrid, numVal, Row, Screen, Seg, T, tap, servingLabel } from '@/components/ui';

export default function Portion() {
  const t = useTheme();
  const nav = useNavigation();
  const { id, date: pDate, meal: pMeal, mode } = useLocalSearchParams<{ id: string; date?: string; meal?: string; mode?: string }>();
  const recipeMode = mode === 'recipe';
  const [food, , loading] = useQuery(() => getFood(Number(id)), [id], null as Food | null);
  const [goals] = useQuery(getGoals, [], DEFAULT_GOALS);
  const [unit, setUnit] = useState<'g' | 'u'>('g');
  const [amount, setAmount] = useState('100');
  const [meal, setMeal] = useState<Meal>((pMeal as Meal) || guessMeal());
  const [init, setInit] = useState(false);

  // Inicializa la unidad una sola vez, cuando el alimento termina de cargar
  useEffect(() => {
    if (food && !init) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInit(true);
      if (food.serving_g) {
        setUnit('u');
        setAmount('1');
      }
    }
  }, [food, init]);

  useEffect(() => {
    if (!food) return;
    nav.setOptions({
      title: '',
      headerRight: () => (
        <Row gap={6}>
          <IconBtn name={food.favorite ? 'star' : 'star-outline'} color={food.favorite ? t.fat : t.ink} onPress={() => toggleFavoriteFood(food.id, !food.favorite)} label="Favorito" />
          {food.source !== 'base' && (
            <IconBtn name="create-outline" onPress={() => router.push({ pathname: '/food/new', params: { id: food.id } })} label="Editar" />
          )}
        </Row>
      ),
    });
  }, [food, nav, t]);

  if (loading || !food) return <Loading />;

  const grams = unit === 'u' && food.serving_g ? numVal(amount) * food.serving_g : numVal(amount);
  const k = grams / 100;
  const m = { kcal: food.kcal * k, p: food.p * k, f: food.f * k, c: food.c * k, fiber: (food.fiber ?? 0) * k };
  const qty = unit === 'u' && food.serving_name ? servingLabel(food.serving_name, food.serving_g, numVal(amount)) : `${Math.round(grams)} g`;

  const submit = async () => {
    if (!(grams > 0)) return Alert.alert('Cantidad inválida', 'Escribe una cantidad mayor a 0.');
    if (recipeMode && hasFoodPicker()) {
      deliverFood({ food_id: food.id, name: food.name, grams, ...m });
      router.dismiss(2);
      return;
    }
    await addEntry({ date: pDate || today(), meal, name: food.name + (food.brand ? ` (${food.brand})` : ''), grams, qty_label: qty, ...m, food_id: food.id, recipe_id: null, photo_uri: null, source: food.source });
    router.dismissTo('/');
  };

  const pctRow = (label: string, v: number, g: number, col: string) => (
    <View style={{ gap: 4 }}>
      <Row><T v="small" style={{ flex: 1 }}>{label}</T><T v="small" muted num>{Math.round((v / (g || 1)) * 100)}% de tu meta</T></Row>
      <Bar value={v} max={g} color={col} height={6} />
    </View>
  );

  return (
    <Screen>
      <View>
        <T v="h2">{food.name}</T>
        {food.brand ? <T muted>{food.brand}</T> : null}
      </View>

      {!recipeMode && <Seg options={MEALS} value={meal} onChange={setMeal} />}

      <Row gap={10} style={{ alignItems: 'flex-end' }}>
        <Field label="Cantidad" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" selectTextOnFocus />
        <View style={{ flex: 1.3 }}>
          <Seg
            options={[{ key: 'g', label: 'gramos' }, ...(food.serving_g ? [{ key: 'u' as const, label: `${food.serving_name ?? 'porción'} (${Math.round(food.serving_g)} g)` }] : [])]}
            value={unit}
            onChange={u => {
              if (u === unit) return;
              if (u === 'u' && food.serving_g) setAmount(String(Math.round((numVal(amount) / food.serving_g) * 4) / 4 || 1));
              if (u === 'g' && food.serving_g) setAmount(String(Math.round(numVal(amount) * food.serving_g)));
              setUnit(u);
            }}
          />
        </View>
      </Row>
      <Row gap={6} wrap>
        {(unit === 'u' ? [0.5, 1, 1.5, 2, 3] : [50, 100, 150, 200, 250]).map(v => (
          <Pressable key={v} onPress={() => { tap(); setAmount(String(v)); }} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.surface }}>
            <T v="small" bold>{v}{unit === 'g' ? ' g' : ''}</T>
          </Pressable>
        ))}
      </Row>

      <MacroGrid {...m} />

      {!recipeMode && (
        <Card>
          {pctRow('Calorías', m.kcal, goals.kcal, t.kcal)}
          {pctRow('Proteína', m.p, goals.p, t.prot)}
          {pctRow('Grasas', m.f, goals.f, t.fat)}
          {pctRow('Carbohidratos', m.c, goals.c, t.carb)}
        </Card>
      )}

      <Button title={recipeMode ? 'Agregar a la receta' : `Agregar a ${MEALS.find(x => x.key === meal)!.label.toLowerCase()}`} icon="add" onPress={submit} />

      <Card>
        <T v="small" bold>Por 100 g</T>
        <T v="small" muted num>
          {Math.round(food.kcal)} kcal · {food.p} g proteína · {food.f} g grasa · {food.c} g carbohidratos · {food.fiber ?? 0} g fibra
          {food.sugar != null ? ` · ${food.sugar} g azúcar` : ''}{food.sodium != null ? ` · ${Math.round(food.sodium)} mg sodio` : ''}
        </T>
        {food.category ? <T v="tiny" muted>Categoría: {food.category}{food.barcode ? ` · Código ${food.barcode}` : ''}</T> : null}
      </Card>

      {food.source !== 'base' && (
        <Button kind="danger" title="Eliminar alimento" onPress={() => Alert.alert('Eliminar', `¿Eliminar "${food.name}" de tus alimentos? Los registros pasados se conservan.`, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: async () => { await deleteFood(food.id); router.back(); } },
        ])} />
      )}
    </Screen>
  );
}
