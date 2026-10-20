import { useEffect, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { activeWorkout, deleteRoutine, getRoutine, routineExercises, saveRoutine, startWorkout } from '@/db';
import { pickExercisesFor } from '@/lib/picker';
import { useTheme } from '@/theme';
import { Button, Card, Empty, Field, IconBtn, numVal, Row, Screen, T } from '@/components/ui';

type Item = { exercise_id: number; name: string; muscle: string; sets: number; reps: string; rest_sec: number };

export default function RoutineEditor() {
  const t = useTheme();
  const nav = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    nav.setOptions({ title: isNew ? 'Nueva rutina' : 'Editar rutina' });
    if (isNew) return;
    (async () => {
      const r = await getRoutine(Number(id));
      if (!r) return;
      setName(r.name);
      setNotes(r.notes ?? '');
      setItems((await routineExercises(r.id)).map(x => ({ exercise_id: x.exercise_id, name: x.name, muscle: x.muscle, sets: x.sets, reps: x.reps, rest_sec: x.rest_sec })));
    })();
  }, [id, isNew, nav]);

  const upd = (i: number, patch: Partial<Item>) => {
    setDirty(true);
    setItems(l => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };
  const move = (i: number, d: number) => {
    setDirty(true);
    setItems(l => {
      const n = [...l];
      const j = i + d;
      if (j < 0 || j >= n.length) return l;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  };
  const addExercises = () => {
    pickExercisesFor(list => {
      setDirty(true);
      setItems(l => [...l, ...list.map(e => ({ exercise_id: e.id, name: e.name, muscle: e.muscle, sets: 3, reps: e.type === 't' ? '45' : e.type === 'c' ? '20' : '8-12', rest_sec: e.type === 'c' ? 0 : 90 }))]);
    });
    router.push({ pathname: '/exercise/pick', params: { mode: 'multi' } });
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'Ej. "Push", "Pierna A", "Full body".');
      return null;
    }
    const rid = await saveRoutine({ id: isNew ? undefined : Number(id), name: name.trim(), notes: notes.trim() || null, items });
    setDirty(false);
    return rid;
  };

  return (
    <Screen>
      <Field label="Nombre" value={name} onChangeText={v => { setName(v); setDirty(true); }} placeholder="Ej. Push · Pecho y hombro" />
      <Field label="Notas" value={notes} onChangeText={v => { setNotes(v); setDirty(true); }} placeholder="Opcional" />

      {items.length === 0 && <Empty icon="list" title="Agrega ejercicios" text="Elige de la biblioteca; puedes ajustar series, reps y descanso." />}
      {items.map((it, i) => (
        <Card key={i} style={{ gap: 8 }}>
          <Row>
            <View style={{ flex: 1 }}>
              <T bold>{i + 1}. {it.name}</T>
              <T v="tiny" muted>{it.muscle}</T>
            </View>
            <IconBtn name="arrow-up" size={14} onPress={() => move(i, -1)} label="Subir" />
            <IconBtn name="arrow-down" size={14} onPress={() => move(i, 1)} label="Bajar" />
            <IconBtn name="trash-outline" size={14} color={t.danger} onPress={() => { setDirty(true); setItems(l => l.filter((_, j) => j !== i)); }} label="Quitar" />
          </Row>
          <Row gap={8}>
            <View style={{ flex: 1, gap: 4 }}>
              <T v="tiny" muted>Series</T>
              <Row gap={6}>
                <IconBtn name="remove" size={14} onPress={() => upd(i, { sets: Math.max(1, it.sets - 1) })} label="Menos series" />
                <T bold num style={{ minWidth: 20, textAlign: 'center' }}>{it.sets}</T>
                <IconBtn name="add" size={14} onPress={() => upd(i, { sets: Math.min(10, it.sets + 1) })} label="Más series" />
              </Row>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <T v="tiny" muted>Reps / seg</T>
              <TextInput value={it.reps} onChangeText={v => upd(i, { reps: v })} style={{ color: t.ink, backgroundColor: t.surface2, borderRadius: 8, padding: 8, fontSize: 15 }} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <T v="tiny" muted>Descanso (s)</T>
              <TextInput value={String(it.rest_sec)} onChangeText={v => upd(i, { rest_sec: Math.round(numVal(v)) })} keyboardType="number-pad" style={{ color: t.ink, backgroundColor: t.surface2, borderRadius: 8, padding: 8, fontSize: 15 }} />
            </View>
          </Row>
        </Card>
      ))}
      <Button kind="ghost" icon="add" title="Agregar ejercicios" onPress={addExercises} />
      <Button icon="checkmark" title={dirty || isNew ? 'Guardar rutina' : 'Guardado'} disabled={!dirty && !isNew} onPress={async () => { if (await save()) router.back(); }} />
      {!isNew && (
        <Button kind="soft" icon="play" title="Iniciar entrenamiento" color={t.train} onPress={async () => {
          const rid = dirty ? await save() : Number(id);
          if (!rid) return;
          const act = await activeWorkout();
          if (act) return Alert.alert('Ya tienes un entrenamiento en curso', 'Termínalo o descártalo antes de iniciar otro.', [{ text: 'Ir al entrenamiento', onPress: () => router.push('/workout/active') }, { text: 'Cerrar' }]);
          await startWorkout(rid);
          router.replace('/workout/active');
        }} />
      )}
      {!isNew && (
        <Button kind="danger" title="Eliminar rutina" onPress={() => Alert.alert('Eliminar rutina', `¿Eliminar "${name}"? Tu historial de entrenamientos se conserva.`, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: async () => { await deleteRoutine(Number(id)); router.back(); } },
        ])} />
      )}
    </Screen>
  );
}
