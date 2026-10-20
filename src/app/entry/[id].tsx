import { useEffect, useState } from 'react';
import { Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { addEntry, deleteEntry, getEntry, MEALS, updateEntry, useQuery, type LogEntry, type Meal } from '@/db';
import { useTheme } from '@/theme';
import { Button, Field, Loading, MacroGrid, numVal, Row, Screen, Seg, T } from '@/components/ui';

export default function EditEntry() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [e, , loading] = useQuery(() => getEntry(Number(id)), [id], null as LogEntry | null);
  const [name, setName] = useState('');
  const [factor, setFactor] = useState('1');
  const [grams, setGrams] = useState('');
  const [meal, setMeal] = useState<Meal>('des');

  // Llena el formulario cuando el registro termina de cargar
  useEffect(() => {
    if (e) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(e.name);
      setMeal(e.meal);
      setGrams(e.grams ? String(Math.round(e.grams)) : '');
    }
  }, [e]);

  if (loading) return <Loading />;
  if (!e) return <Screen><T muted>Este registro ya no existe.</T></Screen>;

  const k = e.grams > 0 && grams ? numVal(grams) / e.grams : numVal(factor) || 0;
  const m = { kcal: e.kcal * k, p: e.p * k, f: e.f * k, c: e.c * k, fiber: (e.fiber ?? 0) * k };

  const save = async () => {
    const changed = Math.abs(k - 1) > 0.001;
    await updateEntry(e.id, {
      name: name.trim() || e.name,
      meal,
      ...(changed ? { ...m, grams: e.grams * k, qty_label: e.grams > 0 ? `${Math.round(e.grams * k)} g` : `${k}× ${e.qty_label ?? 'porción'}` } : {}),
    });
    router.back();
  };

  return (
    <Screen>
      {e.photo_uri ? <Image source={{ uri: e.photo_uri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: t.radius }} /> : null}
      <Field label="Nombre" value={name} onChangeText={setName} />
      <T v="small" muted>Registrado: {e.qty_label || `${Math.round(e.grams)} g`}</T>
      {e.grams > 0 ? (
        <Field label="Cantidad" value={grams} onChangeText={setGrams} keyboardType="decimal-pad" suffix="g" selectTextOnFocus />
      ) : (
        <Field label="Porciones (1 = como se registró)" value={factor} onChangeText={setFactor} keyboardType="decimal-pad" selectTextOnFocus />
      )}
      <MacroGrid {...m} />
      <Seg options={MEALS} value={meal} onChange={setMeal} />
      <Button title="Guardar cambios" icon="checkmark" onPress={save} />
      <Row gap={8}>
        <Button kind="soft" title="Duplicar" icon="copy-outline" style={{ flex: 1 }} onPress={async () => { const { id: _id, ...rest } = e; await addEntry(rest); router.back(); }} />
        <Button kind="danger" title="Eliminar" icon="trash-outline" style={{ flex: 1 }} onPress={() => Alert.alert('Eliminar', `¿Quitar "${e.name}" de tu diario?`, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: async () => { await deleteEntry(e.id); router.back(); } },
        ])} />
      </Row>
    </Screen>
  );
}
