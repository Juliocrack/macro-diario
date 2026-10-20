import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getFood, insertFood, updateFood } from '@/db';
import { readNutritionLabel } from '@/lib/ai';
import { pickImage } from '@/lib/device';
import { useTheme } from '@/theme';
import { Button, Card, Field, numOrNull, numVal, Row, Screen, Seg, T } from '@/components/ui';

const str = (n: number | null | undefined) => (n == null ? '' : String(Math.round(n * 10) / 10));

export default function NewFood() {
  const t = useTheme();
  const p = useLocalSearchParams<{ id?: string; barcode?: string; name?: string; date?: string; meal?: string; mode?: string }>();
  const editing = p.id ? Number(p.id) : null;
  const [per, setPer] = useState<'100' | 'serv'>('100');
  const [f, setF] = useState({ name: p.name ?? '', brand: '', serving_name: '', serving_g: '', kcal: '', p: '', f: '', c: '', fiber: '', sugar: '', sodium: '', barcode: p.barcode ?? '' });
  const [reading, setReading] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(s => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!editing) return;
    getFood(editing).then(x => {
      if (!x) return;
      setF({ name: x.name, brand: x.brand ?? '', serving_name: x.serving_name ?? '', serving_g: str(x.serving_g), kcal: str(x.kcal), p: str(x.p), f: str(x.f), c: str(x.c), fiber: str(x.fiber), sugar: str(x.sugar), sodium: str(x.sodium), barcode: x.barcode ?? '' });
    });
  }, [editing]);

  const readLabel = async (from: 'camera' | 'library') => {
    try {
      const img = await pickImage(from, { base64: true });
      if (!img?.base64) return;
      setReading(true);
      const r = await readNutritionLabel({ base64: img.base64, mime: img.mime });
      setPer('100');
      setF(s => ({
        ...s,
        name: s.name || r.name,
        brand: s.brand || r.brand,
        serving_name: r.serving_name,
        serving_g: str(r.serving_g),
        kcal: str(r.kcal), p: str(r.p), f: str(r.f), c: str(r.c), fiber: str(r.fiber), sugar: str(r.sugar), sodium: str(r.sodium),
      }));
    } catch (e: any) {
      Alert.alert('No se pudo leer la etiqueta', e?.message ?? 'Intenta con una foto más clara.');
    } finally {
      setReading(false);
    }
  };

  const save = async () => {
    if (!f.name.trim()) return Alert.alert('Falta el nombre', 'Escribe cómo se llama el alimento.');
    const sg = numOrNull(f.serving_g);
    if (per === 'serv' && !(sg && sg > 0)) return Alert.alert('Falta la porción', 'Para capturar por porción, escribe cuántos gramos pesa.');
    const factor = per === 'serv' ? 100 / (sg as number) : 1;
    const v = (s: string) => (numOrNull(s) == null ? null : (numOrNull(s) as number) * factor);
    const data = {
      name: f.name.trim(), brand: f.brand.trim() || null, category: 'Mis alimentos',
      kcal: numVal(f.kcal) * factor, p: numVal(f.p) * factor, f: numVal(f.f) * factor, c: numVal(f.c) * factor,
      fiber: (v(f.fiber) ?? 0), sugar: v(f.sugar), sodium: v(f.sodium),
      serving_name: f.serving_name.trim() || null, serving_g: sg, barcode: f.barcode.trim() || null,
    };
    if (editing) {
      await updateFood(editing, data);
      router.back();
    } else {
      const id = await insertFood({ ...data, source: 'custom' });
      router.replace({ pathname: '/food/[id]', params: { id, date: p.date ?? '', meal: p.meal ?? '', mode: p.mode ?? '' } });
    }
  };

  const kc = numVal(f.p) * 4 + numVal(f.f) * 9 + numVal(f.c) * 4;

  return (
    <Screen>
      <Card style={{ backgroundColor: t.kcal + '18' }}>
        <T bold>Lee la etiqueta con IA</T>
        <T v="small" muted>Toma foto a la tabla nutrimental y se llenan los campos solos.</T>
        <Row gap={8}>
          <Button small icon="camera" title="Tomar foto" style={{ flex: 1 }} loading={reading} onPress={() => readLabel('camera')} />
          <Button small kind="soft" icon="images" title="Galería" style={{ flex: 1 }} disabled={reading} onPress={() => readLabel('library')} />
        </Row>
      </Card>

      <Field label="Nombre" value={f.name} onChangeText={set('name')} placeholder="Ej. Barra de proteína chocolate" />
      <Row gap={10}>
        <Field label="Marca (opcional)" value={f.brand} onChangeText={set('brand')} />
        <Field label="Código de barras" value={f.barcode} onChangeText={set('barcode')} keyboardType="number-pad" />
      </Row>
      <Row gap={10}>
        <Field label="Porción" value={f.serving_name} onChangeText={set('serving_name')} placeholder="barra, vaso, pieza…" />
        <Field label="Gramos por porción" value={f.serving_g} onChangeText={set('serving_g')} keyboardType="decimal-pad" suffix="g" />
      </Row>

      <T v="small" muted>Los valores que escribes son:</T>
      <Seg options={[{ key: '100', label: 'Por 100 g' }, { key: 'serv', label: 'Por porción' }]} value={per} onChange={setPer} />
      <Row gap={10}>
        <Field label="Calorías" value={f.kcal} onChangeText={set('kcal')} keyboardType="decimal-pad" suffix="kcal" />
        <Field label="Proteína" value={f.p} onChangeText={set('p')} keyboardType="decimal-pad" suffix="g" />
      </Row>
      <Row gap={10}>
        <Field label="Grasas" value={f.f} onChangeText={set('f')} keyboardType="decimal-pad" suffix="g" />
        <Field label="Carbohidratos" value={f.c} onChangeText={set('c')} keyboardType="decimal-pad" suffix="g" />
      </Row>
      <Row gap={10}>
        <Field label="Fibra" value={f.fiber} onChangeText={set('fiber')} keyboardType="decimal-pad" suffix="g" />
        <Field label="Azúcar" value={f.sugar} onChangeText={set('sugar')} keyboardType="decimal-pad" suffix="g" />
        <Field label="Sodio" value={f.sodium} onChangeText={set('sodium')} keyboardType="decimal-pad" suffix="mg" />
      </Row>
      {kc > 0 && Math.abs(kc - numVal(f.kcal)) > Math.max(25, numVal(f.kcal) * 0.15) && (
        <T v="small" color={t.warn}>Ojo: los macros suman {Math.round(kc)} kcal y escribiste {f.kcal || 0}. Revisa los valores.</T>
      )}
      <Button title={editing ? 'Guardar cambios' : 'Guardar alimento'} icon="checkmark" onPress={save} />
    </Screen>
  );
}
