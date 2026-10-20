import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  activeWorkout, addExerciseToWorkout, addSet, deleteSet, discardWorkout, finishWorkout, previousSets, removeExerciseFromWorkout,
  routineExercises, updateSet, useQuery, workoutSets, type Workout, type WorkoutSet,
} from '@/db';
import { duration } from '@/lib/dates';
import { cancelRestEnd, scheduleRestEnd } from '@/lib/device';
import { pickExercisesFor } from '@/lib/picker';
import { useNow } from '@/lib/useNow';
import { useTheme } from '@/theme';
import { Button, Card, Empty, Field, Icon, IconBtn, Loading, numOrNull, Row, Screen, T } from '@/components/ui';

type SetRow = WorkoutSet & { name: string; muscle: string; type: 'w' | 'b' | 't' | 'c' };

export default function ActiveWorkout() {
  useKeepAwake();
  const t = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const [w, , loadingW] = useQuery(activeWorkout, [], null as Workout | null);
  const [sets] = useQuery(() => (w ? workoutSets(w.id) : Promise.resolve([])), [w?.id], [] as SetRow[]);
  const [rests] = useQuery(async () => {
    const m = new Map<number, number>();
    if (w?.routine_id) for (const r of await routineExercises(w.routine_id)) m.set(r.exercise_id, r.rest_sec);
    return m;
  }, [w?.routine_id], new Map<number, number>());
  const [prev, setPrev] = useState<Record<number, WorkoutSet[]>>({});
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(90);
  const [notes, setNotes] = useState('');
  const vibrated = useRef(false);

  useEffect(() => {
    nav.setOptions({ title: w?.name ?? 'Entrenando' });
  }, [w?.name, nav]);

  const groups = useMemo(() => {
    const g = new Map<number, SetRow[]>();
    for (const s of sets) {
      if (!g.has(s.position)) g.set(s.position, []);
      g.get(s.position)!.push(s);
    }
    return [...g.entries()].map(([position, list]) => ({ position, list, ex: list[0] }));
  }, [sets]);

  useEffect(() => {
    if (!w) return;
    const ids = [...new Set(sets.map(s => s.exercise_id))].filter(id => !(id in prev));
    if (!ids.length) return;
    Promise.all(ids.map(async id => [id, await previousSets(id, w.id)] as const)).then(r => setPrev(p => ({ ...p, ...Object.fromEntries(r) })));
  }, [sets, w, prev]);

  const restLeft = restEnd ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : 0;
  useEffect(() => {
    if (restEnd && restLeft === 0 && !vibrated.current) {
      vibrated.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [restEnd, restLeft]);

  if (loadingW) return <Loading />;
  if (!w)
    return (
      <Screen>
        <Empty icon="barbell" title="No hay entrenamiento en curso" text="Inicia una rutina desde la pestaña Entreno.">
          <Button title="Volver" onPress={() => router.back()} />
        </Empty>
      </Screen>
    );

  const startRest = (sec: number, exName: string) => {
    if (sec <= 0) return;
    vibrated.current = false;
    setRestTotal(sec);
    // eslint-disable-next-line react-hooks/purity -- se ejecuta al tocar, no al renderizar
    setRestEnd(Date.now() + sec * 1000);
    scheduleRestEnd(sec, exName).catch(() => {});
  };
  const adjustRest = (d: number) => {
    if (!restEnd) return;
    const ne = Math.max(Date.now(), restEnd + d * 1000);
    setRestEnd(ne);
    setRestTotal(x => Math.max(1, x + d));
    scheduleRestEnd(Math.round((ne - Date.now()) / 1000), 'siguiente serie').catch(() => {});
  };
  const stopRest = () => {
    setRestEnd(null);
    cancelRestEnd();
  };

  const doneSets = sets.filter(s => s.done);
  const volume = doneSets.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0);

  const finish = () => {
    if (!doneSets.length) {
      return Alert.alert('Sin series completadas', '¿Quieres descartar este entrenamiento?', [
        { text: 'Seguir entrenando', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: async () => { stopRest(); await discardWorkout(w.id); router.back(); } },
      ]);
    }
    Alert.alert('Terminar entrenamiento', `${doneSets.length} series · ${Math.round(volume).toLocaleString('es-MX')} kg de volumen. Las series sin marcar se eliminan.`, [
      { text: 'Seguir', style: 'cancel' },
      { text: 'Terminar', onPress: async () => { stopRest(); await finishWorkout(w.id, notes.trim() || null); router.replace({ pathname: '/workout/[id]', params: { id: w.id, done: '1' } }); } },
    ]);
  };

  const addEx = () => {
    pickExercisesFor(async list => {
      for (const e of list) await addExerciseToWorkout(w.id, e.id, 3);
    });
    router.push({ pathname: '/exercise/pick', params: { mode: 'multi' } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen contentStyle={{ paddingBottom: 140 + insets.bottom }}>
        <Row>
          <View style={{ flex: 1 }}>
            <T v="h1" num color={t.train}>{duration(now - w.started_at)}</T>
            <T v="small" muted num>{doneSets.length} series · {Math.round(volume).toLocaleString('es-MX')} kg</T>
          </View>
          <Button title="Terminar" color={t.ok} icon="flag" onPress={finish} />
        </Row>

        {groups.map(({ position, list, ex }) => {
          const p = prev[ex.exercise_id] ?? [];
          const rest = rests.get(ex.exercise_id) ?? 90;
          return (
            <Card key={position} style={{ gap: 6 }}>
              <Row>
                <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: ex.exercise_id } })}>
                  <T v="h3" color={t.train}>{ex.name}</T>
                  <T v="tiny" muted>{ex.muscle} · descanso {rest}s</T>
                </Pressable>
                <IconBtn name="trash-outline" size={15} color={t.danger} label="Quitar ejercicio" onPress={() => Alert.alert('Quitar ejercicio', `¿Quitar ${ex.name} de este entrenamiento?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Quitar', style: 'destructive', onPress: () => removeExerciseFromWorkout(w.id, position) }])} />
              </Row>
              <Row gap={6} style={{ paddingHorizontal: 2 }}>
                <T v="tiny" muted style={{ width: 26 }}>Serie</T>
                <T v="tiny" muted style={{ flex: 1.2 }}>Anterior</T>
                <T v="tiny" muted style={{ flex: 1, textAlign: 'center' }}>{ex.type === 'c' ? 'min' : ex.type === 't' ? 'seg' : ex.type === 'b' ? '+kg' : 'kg'}</T>
                <T v="tiny" muted style={{ flex: 1, textAlign: 'center' }}>{ex.type === 'c' ? 'km' : ex.type === 't' ? '' : 'reps'}</T>
                <View style={{ width: 38 }} />
              </Row>
              {list.map((s, i) => (
                <SetLine key={s.id} s={s} idx={i} prev={p[i]} onDone={() => startRest(rest, ex.name)} />
              ))}
              <Row gap={8}>
                <Button small kind="soft" icon="add" title="Serie" style={{ flex: 1 }} onPress={() => addSet(w.id, ex.exercise_id, position)} />
                {list.length > 1 && <Button small kind="soft" icon="remove" title="Quitar última" style={{ flex: 1 }} onPress={() => deleteSet(list[list.length - 1].id)} />}
              </Row>
            </Card>
          );
        })}

        <Button kind="ghost" icon="add" title="Agregar ejercicio" onPress={addEx} />
        <Field label="Notas del entrenamiento" value={notes} onChangeText={setNotes} placeholder="Cómo te sentiste, energía, dolor…" multiline />
        <Button kind="danger" title="Descartar entrenamiento" onPress={() => Alert.alert('Descartar', 'Se borrará todo lo registrado en esta sesión.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Descartar', style: 'destructive', onPress: async () => { stopRest(); await discardWorkout(w.id); router.back(); } }])} />
      </Screen>

      {restEnd && (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 12, backgroundColor: restLeft ? t.surface : t.ok, borderRadius: 18, padding: 14, gap: 8, borderWidth: 1, borderColor: t.line, elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12 }}>
          <Row>
            <Icon name="timer-outline" color={restLeft ? t.train : '#fff'} />
            <T v="h2" num color={restLeft ? t.ink : '#fff'} style={{ flex: 1 }}>{restLeft ? duration(restLeft * 1000) : '¡A darle!'}</T>
            {restLeft > 0 && <Button small kind="soft" title="−15" onPress={() => adjustRest(-15)} />}
            {restLeft > 0 && <Button small kind="soft" title="+15" onPress={() => adjustRest(15)} />}
            <Button small kind={restLeft ? 'soft' : 'primary'} color={restLeft ? undefined : '#0006'} title={restLeft ? 'Saltar' : 'Cerrar'} onPress={stopRest} />
          </Row>
          {restLeft > 0 && (
            <View style={{ height: 6, borderRadius: 3, backgroundColor: t.surface2, overflow: 'hidden' }}>
              <View style={{ width: `${(restLeft / restTotal) * 100}%`, height: '100%', backgroundColor: t.train }} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function SetLine({ s, idx, prev, onDone }: { s: SetRow; idx: number; prev?: WorkoutSet; onDone: () => void }) {
  const t = useTheme();
  const isCardio = s.type === 'c';
  const isTime = s.type === 't';
  const a0 = isCardio ? (s.seconds != null ? String(Math.round(s.seconds / 60)) : '') : isTime ? (s.seconds != null ? String(s.seconds) : '') : s.weight != null ? String(s.weight) : '';
  const b0 = isCardio ? (s.distance != null ? String(s.distance) : '') : s.reps != null ? String(s.reps) : '';
  const [a, setA] = useState(a0);
  const [b, setB] = useState(b0);
  // Sincroniza con la base cuando cambia desde fuera (ej. al agregar una serie)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setA(a0); setB(b0); }, [a0, b0]);

  const values = () => {
    const av = numOrNull(a), bv = numOrNull(b);
    if (isCardio) return { seconds: av != null ? Math.round(av * 60) : null, distance: bv };
    if (isTime) return { seconds: av != null ? Math.round(av) : null };
    return { weight: av, reps: bv != null ? Math.round(bv) : null };
  };
  const commit = () => updateSet(s.id, values());
  const toggle = async () => {
    const v = values();
    if (!s.done) {
      // Si está vacío, toma el valor anterior
      if (!isCardio && !isTime && v.weight == null && v.reps == null && prev) Object.assign(v, { weight: prev.weight, reps: prev.reps });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await updateSet(s.id, { ...v, done: 1 });
      onDone();
    } else {
      await updateSet(s.id, { ...v, done: 0 });
    }
  };
  const prevText = prev
    ? isCardio ? `${Math.round((prev.seconds ?? 0) / 60)} min${prev.distance ? ` · ${prev.distance} km` : ''}`
      : isTime ? `${prev.seconds ?? 0} s`
      : `${prev.weight ?? 0} × ${prev.reps ?? 0}`
    : '—';
  const inp = { color: t.ink, backgroundColor: s.done ? 'transparent' : t.surface2, borderRadius: 8, paddingVertical: 8, textAlign: 'center' as const, fontSize: 16, fontWeight: '600' as const };
  return (
    <Row gap={6} style={{ backgroundColor: s.done ? t.ok + '22' : 'transparent', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 2 }}>
      <T bold style={{ width: 26, textAlign: 'center' }}>{idx + 1}</T>
      <T v="small" muted num style={{ flex: 1.2 }} numberOfLines={1}>{prevText}</T>
      <TextInput value={a} onChangeText={setA} onEndEditing={commit} keyboardType="decimal-pad" placeholder={prev ? String(isCardio ? Math.round((prev.seconds ?? 0) / 60) : isTime ? prev.seconds ?? '' : prev.weight ?? '') : '0'} placeholderTextColor={t.muted} style={[inp, { flex: 1 }]} selectTextOnFocus />
      {isTime ? <View style={{ flex: 1 }} /> : (
        <TextInput value={b} onChangeText={setB} onEndEditing={commit} keyboardType="decimal-pad" placeholder={prev ? String(isCardio ? prev.distance ?? '' : prev.reps ?? '') : '0'} placeholderTextColor={t.muted} style={[inp, { flex: 1 }]} selectTextOnFocus />
      )}
      <Pressable onPress={toggle} hitSlop={6} style={{ width: 38, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: s.done ? t.ok : t.surface2 }}>
        <Icon name="checkmark" size={20} color={s.done ? '#fff' : t.muted} />
      </Pressable>
    </Row>
  );
}
