import { useEffect, useState } from 'react';
import { Alert, Image, TextInput } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { getGoals, getRecipe, recipeTotals, saveRecipe, type RecipeItem } from '@/db';
import { generateRecipe, AiError } from '@/lib/ai';
import { persistImage, pickImage } from '@/lib/device';
import { pickFoodFor } from '@/lib/picker';
import { useTheme } from '@/theme';
import { Button, Card, Field, IconBtn, Loading, MacroGrid, numVal, Row, Screen, T } from '@/components/ui';

export default function EditRecipe() {
  const t = useTheme();
  const nav = useNavigation();
  const p = useLocalSearchParams<{ id?: string; ai?: string }>();
  const id = p.id ? Number(p.id) : undefined;
  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const [minutes, setMinutes] = useState('');
  const [tags, setTags] = useState('');
  const [steps, setSteps] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [aiReq, setAiReq] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    nav.setOptions({ title: id ? 'Editar receta' : 'Nueva receta' });
    if (!id) return;
    getRecipe(id).then(r => {
      if (!r) return;
      setName(r.name);
      setServings(String(r.servings));
      setMinutes(r.minutes ? String(r.minutes) : '');
      setTags(r.tags ?? '');
      setSteps(r.steps ?? '');
      setPhoto(r.photo_uri);
      setItems(r.items);
    });
  }, [id, nav]);

  const addIngredient = () => {
    pickFoodFor(item => setItems(l => [...l, item]));
    router.push({ pathname: '/food/add', params: { mode: 'recipe' } });
  };
  const setGrams = (i: number, g: number) =>
    setItems(l => l.map((x, j) => {
      if (j !== i || x.grams <= 0) return x;
      const k = g / x.grams;
      return { ...x, grams: g, kcal: x.kcal * k, p: x.p * k, f: x.f * k, c: x.c * k, fiber: (x.fiber ?? 0) * k };
    }));

  const runAi = async () => {
    if (!aiReq.trim()) return Alert.alert('Describe la receta', 'Ej. "desayuno alto en proteína con avena y huevo, 500 kcal".');
    setBusy(true);
    try {
      const g = await getGoals();
      const r = await generateRecipe(aiReq, { kcal: Math.round(g.kcal / 4), p: Math.round(g.p / 4) });
      setName(r.name);
      setServings(String(r.servings));
      setMinutes(r.minutes ? String(r.minutes) : '');
      setTags(r.tags);
      setSteps(r.steps);
      setItems(r.items.map(i => ({ food_id: null, name: `${i.name}`, grams: i.grams, kcal: i.kcal, p: i.p, f: i.f, c: i.c, fiber: i.fiber })));
    } catch (e: any) {
      Alert.alert('No se pudo crear', e?.message ?? 'Intenta de nuevo.', e instanceof AiError && e.code === 'no_key' ? [{ text: 'Configurar', onPress: () => router.push('/settings/ai') }, { text: 'Cerrar' }] : undefined);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!name.trim()) return Alert.alert('Falta el nombre');
    if (!items.length) return Alert.alert('Sin ingredientes', 'Agrega al menos un ingrediente.');
    const rid = await saveRecipe({ id, name: name.trim(), servings: Math.max(1, numVal(servings)), minutes: numVal(minutes) || null, tags: tags.trim() || null, steps: steps.trim() || null, photo_uri: photo, items });
    if (id) router.back();
    else router.replace({ pathname: '/recipes/[id]', params: { id: rid } });
  };

  const tt = recipeTotals(items);
  const s = Math.max(1, numVal(servings));

  return (
    <Screen>
      {(p.ai || !id) && (
        <Card style={{ backgroundColor: t.kcal + '18' }}>
          <T bold>Crear con IA</T>
          <Field value={aiReq} onChangeText={setAiReq} placeholder="Ej. cena alta en proteína con atún, sin lácteos" multiline />
          <Button small icon="sparkles" title="Generar receta" onPress={runAi} loading={busy} />
        </Card>
      )}
      {busy && <Loading text="Creando tu receta…" />}

      <Field label="Nombre" value={name} onChangeText={setName} />
      <Row gap={10}>
        <Field label="Porciones" value={servings} onChangeText={setServings} keyboardType="decimal-pad" />
        <Field label="Minutos" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" />
      </Row>
      <Field label="Etiquetas" value={tags} onChangeText={setTags} placeholder="Desayuno · Alta en proteína" />

      <Row gap={8}>
        {photo ? <Image source={{ uri: photo }} style={{ width: 64, height: 64, borderRadius: 12 }} /> : null}
        <Button small kind="soft" icon="camera" title={photo ? 'Cambiar foto' : 'Agregar foto'} style={{ flex: 1 }} onPress={async () => {
          try {
            const img = await pickImage('library', { edit: true });
            if (img) setPhoto(await persistImage(img.uri, 'recipes'));
          } catch (e: any) { Alert.alert('Foto', e?.message); }
        }} />
      </Row>

      <T v="small" bold>Por porción</T>
      <MacroGrid kcal={tt.kcal / s} p={tt.p / s} f={tt.f / s} c={tt.c / s} />

      <Card padded={false} style={{ gap: 0 }}>
        {items.map((it, i) => (
          <Row key={i} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: t.line }}>
            <T style={{ flex: 1 }} numberOfLines={2}>{it.name}</T>
            <TextInput value={String(Math.round(it.grams))} onChangeText={v => setGrams(i, numVal(v))} keyboardType="number-pad" style={{ minWidth: 56, textAlign: 'center', color: t.ink, backgroundColor: t.surface2, borderRadius: 8, paddingVertical: 4, fontSize: 15 }} />
            <T v="small" muted>g</T>
            <T v="small" muted num style={{ width: 52, textAlign: 'right' }}>{Math.round(it.kcal)}</T>
            <IconBtn name="trash-outline" size={14} color={t.danger} onPress={() => setItems(l => l.filter((_, j) => j !== i))} label="Quitar" />
          </Row>
        ))}
        <Button kind="ghost" icon="add" title="Agregar ingrediente" onPress={addIngredient} style={{ margin: 12 }} />
      </Card>

      <Field label="Preparación" value={steps} onChangeText={setSteps} multiline placeholder={'1. …\n2. …'} style={{ minHeight: 120 }} />
      <Button icon="checkmark" title="Guardar receta" onPress={save} />
    </Screen>
  );
}
