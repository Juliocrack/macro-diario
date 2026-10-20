import { useEffect, useState } from 'react';
import { Alert, Image } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { addEntry, deleteRecipe, getRecipe, MEALS, recipeTotals, toggleFavoriteRecipe, useQuery, type Meal, type Recipe } from '@/db';
import { guessMeal, today } from '@/lib/dates';
import { useTheme } from '@/theme';
import { Button, Card, Field, IconBtn, Loading, MacroGrid, numVal, Row, Screen, Seg, T } from '@/components/ui';

export default function RecipeDetail() {
  const t = useTheme();
  const nav = useNavigation();
  const p = useLocalSearchParams<{ id: string; date?: string; meal?: string }>();
  const [r, , loading] = useQuery(() => getRecipe(Number(p.id)), [p.id], null as Recipe | null);
  const [portions, setPortions] = useState('1');
  const [meal, setMeal] = useState<Meal>((p.meal as Meal) || guessMeal());

  useEffect(() => {
    if (!r) return;
    nav.setOptions({
      title: '',
      headerRight: () => (
        <Row gap={6}>
          <IconBtn name={r.favorite ? 'heart' : 'heart-outline'} color={r.favorite ? t.prot : t.ink} onPress={() => toggleFavoriteRecipe(r.id, !r.favorite)} label="Favorita" />
          <IconBtn name="create-outline" onPress={() => router.push({ pathname: '/recipes/edit', params: { id: r.id } })} label="Editar" />
        </Row>
      ),
    });
  }, [r, nav, t]);

  if (loading) return <Loading />;
  if (!r) return <Screen><T muted>Receta no encontrada.</T></Screen>;

  const tt = recipeTotals(r.items);
  const s = r.servings || 1;
  const k = numVal(portions) / s;
  const per = { kcal: tt.kcal / s, p: tt.p / s, f: tt.f / s, c: tt.c / s };

  const log = async () => {
    if (!(k > 0)) return;
    await addEntry({ date: p.date || today(), meal, name: r.name, grams: tt.grams * k, qty_label: `${numVal(portions)} porción${numVal(portions) === 1 ? '' : 'es'}`, kcal: tt.kcal * k, p: tt.p * k, f: tt.f * k, c: tt.c * k, fiber: tt.fiber * k, food_id: null, recipe_id: r.id, photo_uri: r.photo_uri, source: 'recipe' });
    router.dismissTo('/');
  };

  return (
    <Screen>
      {r.photo_uri ? <Image source={{ uri: r.photo_uri }} style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: t.radius }} /> : null}
      <T v="h2">{r.name}</T>
      <T muted>{[r.tags, r.minutes ? `${r.minutes} min` : null, `${s} ${s === 1 ? 'porción' : 'porciones'}`].filter(Boolean).join(' · ')}</T>
      <T v="small" bold>Por porción ({Math.round(tt.grams / s)} g)</T>
      <MacroGrid {...per} />

      <Card>
        <T v="h3">Registrar en mi diario</T>
        <Seg options={MEALS} value={meal} onChange={setMeal} />
        <Row gap={10} style={{ alignItems: 'flex-end' }}>
          <Field label="Porciones" value={portions} onChangeText={setPortions} keyboardType="decimal-pad" selectTextOnFocus />
          <Button title={`Agregar · ${Math.round(tt.kcal * k)} kcal`} icon="add" onPress={log} style={{ flex: 1.4 }} />
        </Row>
      </Card>

      <Card>
        <T v="h3">Ingredientes</T>
        {r.items.map((i, j) => (
          <Row key={j}>
            <T style={{ flex: 1 }}>{i.name}</T>
            <T v="small" muted num>{Math.round(i.grams)} g · {Math.round(i.kcal)} kcal</T>
          </Row>
        ))}
        <T v="tiny" muted num>Total: {Math.round(tt.grams)} g · {Math.round(tt.kcal)} kcal · {Math.round(tt.p)} g proteína</T>
      </Card>

      {r.steps ? (
        <Card>
          <T v="h3">Preparación</T>
          <T style={{ lineHeight: 22 }}>{r.steps}</T>
        </Card>
      ) : null}

      <Button kind="danger" title="Eliminar receta" onPress={() => Alert.alert('Eliminar', `¿Eliminar "${r.name}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: async () => { await deleteRecipe(r.id); router.back(); } },
      ])} />
    </Screen>
  );
}
