import { useState } from 'react';
import { Alert, Image, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { addEntries, MEALS, type Meal } from '@/db';
import { analyzeMealPhoto, analyzeMealText, AiError, type AiItem, type AiMeal } from '@/lib/ai';
import { pickImage, persistImage, type Picked } from '@/lib/device';
import { guessMeal, today } from '@/lib/dates';
import { useTheme } from '@/theme';
import { Button, Card, Icon, IconBtn, Loading, MacroGrid, MacroLine, numVal, Pill, Row, Screen, Seg, T, Toggle } from '@/components/ui';

export default function PhotoAnalyze() {
  const t = useTheme();
  const p = useLocalSearchParams<{ date?: string; meal?: string; text?: string }>();
  const [mode, setMode] = useState<'foto' | 'texto'>(p.text ? 'texto' : 'foto');
  const [meal, setMeal] = useState<Meal>((p.meal as Meal) || guessMeal());
  const [img, setImg] = useState<Picked | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AiMeal | null>(null);
  const [items, setItems] = useState<(AiItem & { base: AiItem })[]>([]);
  const [single, setSingle] = useState(false);
  const [saving, setSaving] = useState(false);

  const fail = (e: any) => {
    const msg = e instanceof AiError ? e.message : e?.message ?? 'Intenta de nuevo.';
    Alert.alert('No se pudo analizar', msg, e instanceof AiError && e.code === 'no_key' ? [{ text: 'Configurar', onPress: () => router.push('/settings/ai') }, { text: 'Cerrar' }] : undefined);
  };
  const apply = (r: AiMeal) => {
    setRes(r);
    setItems(r.items.map(i => ({ ...i, base: i })));
  };

  const take = async (from: 'camera' | 'library') => {
    try {
      const pic = await pickImage(from, { base64: true });
      if (!pic?.base64) return;
      setImg(pic);
      setRes(null);
      setBusy(true);
      apply(await analyzeMealPhoto({ base64: pic.base64, mime: pic.mime }, note));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const reanalyze = async () => {
    if (mode === 'foto' && !img?.base64) return;
    if (mode === 'texto' && !note.trim()) return Alert.alert('Describe tu comida', 'Ej. "2 quesadillas de harina con queso Oaxaca y un vaso de horchata".');
    setBusy(true);
    try {
      apply(mode === 'foto' ? await analyzeMealPhoto({ base64: img!.base64!, mime: img!.mime }, note) : await analyzeMealText(note));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const setGrams = (i: number, g: number) => {
    setItems(list => list.map((it, j) => {
      if (j !== i) return it;
      const b = it.base;
      const k = b.grams > 0 ? g / b.grams : 1;
      return { ...it, grams: g, kcal: b.kcal * k, p: b.p * k, f: b.f * k, c: b.c * k, fiber: b.fiber * k, qty: `${Math.round(g)} g` };
    }));
  };
  const scaleAll = (k: number) => setItems(list => list.map(it => ({ ...it, grams: it.grams * k, kcal: it.kcal * k, p: it.p * k, f: it.f * k, c: it.c * k, fiber: it.fiber * k, base: { ...it.base, grams: it.base.grams * k, kcal: it.base.kcal * k, p: it.base.p * k, f: it.base.f * k, c: it.base.c * k, fiber: it.base.fiber * k }, qty: `${Math.round(it.grams * k)} g` })));

  const tot = items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.p, f: a.f + i.f, c: a.c + i.c, fiber: a.fiber + i.fiber, grams: a.grams + i.grams }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, grams: 0 });

  const save = async () => {
    if (!items.length) return;
    setSaving(true);
    try {
      const photo = img ? await persistImage(img.uri, 'meals').catch(() => null) : null;
      const date = p.date || today();
      const base = { date, meal, food_id: null, recipe_id: null, photo_uri: photo, source: 'ai' };
      if (single) {
        await addEntries([{ ...base, name: res?.dish || 'Platillo', grams: tot.grams, qty_label: `1 plato (${Math.round(tot.grams)} g)`, kcal: tot.kcal, p: tot.p, f: tot.f, c: tot.c, fiber: tot.fiber }]);
      } else {
        await addEntries(items.map(i => ({ ...base, name: i.name, grams: i.grams, qty_label: i.qty, kcal: i.kcal, p: i.p, f: i.f, c: i.c, fiber: i.fiber })));
      }
      router.dismissTo('/');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Seg options={[{ key: 'foto', label: 'Foto del platillo' }, { key: 'texto', label: 'Describir con texto' }]} value={mode} onChange={m => { setMode(m); setRes(null); setItems([]); }} />

      {mode === 'foto' ? (
        img ? (
          <Image source={{ uri: img.uri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: t.radius, backgroundColor: t.surface }} />
        ) : (
          <Card style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}>
            <Icon name="camera" size={44} color={t.kcal} />
            <T v="h3" center>Tómale foto a tu platillo</T>
            <T v="small" muted center>La IA identifica cada alimento, estima la porción y calcula calorías y macros. Tú revisas y ajustas antes de guardar.</T>
          </Card>
        )
      ) : null}

      <View style={{ gap: 6 }}>
        <T v="small" muted>{mode === 'foto' ? 'Detalles opcionales (ayudan a la precisión)' : '¿Qué comiste?'}</T>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder={mode === 'foto' ? 'Ej. tortillas de harina, frito en poco aceite, porción grande' : 'Ej. 3 tacos al pastor con piña, una coca de 355 ml y guacamole'}
          placeholderTextColor={t.muted}
          style={{ minHeight: mode === 'foto' ? 54 : 100, color: t.ink, fontSize: 16, backgroundColor: t.surface, borderRadius: 14, padding: 12, textAlignVertical: 'top', borderWidth: 1, borderColor: t.line }}
        />
      </View>

      {mode === 'foto' ? (
        <Row gap={8}>
          <Button icon="camera" title={img ? 'Otra foto' : 'Tomar foto'} style={{ flex: 1 }} onPress={() => take('camera')} disabled={busy} />
          <Button kind="soft" icon="images" title="Galería" style={{ flex: 1 }} onPress={() => take('library')} disabled={busy} />
        </Row>
      ) : (
        <Button icon="sparkles" title="Calcular macros" onPress={reanalyze} loading={busy} />
      )}
      {mode === 'foto' && img && res && <Button kind="ghost" icon="refresh" title="Volver a analizar con los detalles" onPress={reanalyze} disabled={busy} />}

      {busy && <Loading text="Analizando tu comida…" />}

      {res && !busy && (
        <>
          <Row>
            <T v="h2" style={{ flex: 1 }}>{res.dish}</T>
            <Pill text={`Confianza ${res.confidence}`} color={res.confidence === 'alta' ? t.ok : res.confidence === 'baja' ? t.warn : t.fat} />
          </Row>
          {res.notes ? <T v="small" muted>{res.notes}</T> : null}
          <MacroGrid {...tot} />
          <Row gap={6} wrap>
            <T v="small" muted>Porción total:</T>
            {[0.5, 0.75, 1.25, 1.5].map(k => <Button key={k} small kind="soft" title={`×${k}`} onPress={() => scaleAll(k)} />)}
          </Row>
          <Card padded={false} style={{ gap: 0 }}>
            {items.length === 0 && <T muted center style={{ padding: 16 }}>No se detectaron alimentos.</T>}
            {items.map((it, i) => (
              <View key={i} style={{ padding: 12, gap: 6, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: t.line }}>
                <Row>
                  <T bold style={{ flex: 1 }} numberOfLines={2}>{it.name}</T>
                  <T bold num>{Math.round(it.kcal)} kcal</T>
                  <IconBtn name="trash-outline" size={15} color={t.danger} onPress={() => setItems(l => l.filter((_, j) => j !== i))} label="Quitar" />
                </Row>
                <Row>
                  <View style={{ flex: 1 }}><MacroLine p={it.p} f={it.f} c={it.c} /></View>
                  <IconBtn name="remove" size={14} onPress={() => setGrams(i, Math.max(5, Math.round(it.grams * 0.8)))} label="Menos" />
                  <TextInput
                    value={String(Math.round(it.grams))}
                    onChangeText={s => setGrams(i, numVal(s))}
                    keyboardType="number-pad"
                    style={{ minWidth: 56, textAlign: 'center', color: t.ink, backgroundColor: t.surface2, borderRadius: 8, paddingVertical: 4, fontSize: 15 }}
                  />
                  <T v="small" muted>g</T>
                  <IconBtn name="add" size={14} onPress={() => setGrams(i, Math.round(it.grams * 1.25))} label="Más" />
                </Row>
              </View>
            ))}
          </Card>
          <Seg options={MEALS} value={meal} onChange={setMeal} />
          <Toggle label="Guardar como un solo platillo" hint={`Se registra como "${res.dish}" en lugar de ${items.length} alimentos separados.`} value={single} onChange={setSingle} />
          <Button icon="checkmark" title={`Guardar en ${MEALS.find(m => m.key === meal)!.label.toLowerCase()}`} onPress={save} loading={saving} disabled={!items.length} />
          <T v="tiny" muted center>Las estimaciones por foto pueden variar ±20%. Ajusta los gramos si conoces la porción.</T>
        </>
      )}
    </Screen>
  );
}
