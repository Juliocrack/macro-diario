import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { listExercises, saveRoutine } from '@/db';
import { generateProgram, AiError, type AiRoutineDay } from '@/lib/ai';
import { useTheme } from '@/theme';
import { Button, Card, Field, Loading, numVal, Row, Screen, Seg, T } from '@/components/ui';

export default function GenerateProgram() {
  const t = useTheme();
  const [days, setDays] = useState('4');
  const [level, setLevel] = useState('intermedio');
  const [goal, setGoal] = useState('hipertrofia');
  const [equip, setEquip] = useState('gimnasio completo');
  const [minutes, setMinutes] = useState('60');
  const [focus, setFocus] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<AiRoutineDay[] | null>(null);
  const [saving, setSaving] = useState(false);

  const run = async () => {
    setBusy(true);
    setPlan(null);
    try {
      const lib = await listExercises();
      setPlan(await generateProgram({ days: Number(days), level, goal, equipment: equip, minutes: numVal(minutes) || 60, focus }, lib.map(e => e.name)));
    } catch (e: any) {
      Alert.alert('No se pudo generar', e?.message ?? 'Intenta de nuevo.', e instanceof AiError && e.code === 'no_key' ? [{ text: 'Configurar', onPress: () => router.push('/settings/ai') }, { text: 'Cerrar' }] : undefined);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const lib = await listExercises();
      const byName = new Map(lib.map(e => [e.name.toLowerCase(), e.id]));
      for (const d of plan) {
        const items = d.exercises
          .map(e => ({ exercise_id: byName.get(e.name.toLowerCase()), sets: e.sets, reps: e.reps, rest_sec: e.rest_sec }))
          .filter((x): x is { exercise_id: number; sets: number; reps: string; rest_sec: number } => !!x.exercise_id);
        if (items.length) await saveRoutine({ name: d.name, notes: d.notes || null, items });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <T muted>La IA arma un programa semanal usando los ejercicios de tu biblioteca. Puedes editar cada rutina después.</T>
      <T v="small" bold>Días por semana</T>
      <Seg options={['2', '3', '4', '5', '6'].map(k => ({ key: k, label: k }))} value={days} onChange={setDays} />
      <T v="small" bold>Nivel</T>
      <Seg options={[{ key: 'principiante', label: 'Principiante' }, { key: 'intermedio', label: 'Intermedio' }, { key: 'avanzado', label: 'Avanzado' }]} value={level} onChange={setLevel} />
      <T v="small" bold>Objetivo</T>
      <Seg options={[{ key: 'hipertrofia', label: 'Músculo' }, { key: 'fuerza', label: 'Fuerza' }, { key: 'pérdida de grasa conservando músculo', label: 'Perder grasa' }, { key: 'acondicionamiento general', label: 'Condición' }]} value={goal} onChange={setGoal} />
      <T v="small" bold>Equipo</T>
      <Seg options={[{ key: 'gimnasio completo', label: 'Gimnasio' }, { key: 'mancuernas y banco en casa', label: 'Mancuernas' }, { key: 'solo peso corporal', label: 'Sin equipo' }]} value={equip} onChange={setEquip} />
      <Row gap={10}>
        <Field label="Minutos por sesión" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" />
        <Field label="Enfoque (opcional)" value={focus} onChangeText={setFocus} placeholder="Ej. glúteo, hombros" />
      </Row>
      <Button icon="sparkles" title="Generar programa" color={t.train} onPress={run} loading={busy} />
      {busy && <Loading text="Diseñando tu programa…" />}
      {plan?.map((d, i) => (
        <Card key={i}>
          <T v="h3">{d.name}</T>
          {d.notes ? <T v="small" muted>{d.notes}</T> : null}
          {d.exercises.map((e, j) => (
            <Row key={j}>
              <T style={{ flex: 1 }} v="small">{e.name}</T>
              <T v="small" muted num>{e.sets} × {e.reps} · {e.rest_sec}s</T>
            </Row>
          ))}
        </Card>
      ))}
      {plan && plan.length > 0 && <Button icon="checkmark" title={`Guardar ${plan.length} rutinas`} onPress={save} loading={saving} />}
    </Screen>
  );
}
