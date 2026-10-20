import { useMemo } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { db, deleteWorkout, getWorkout, getProfile, latestWeight, useQuery, workoutSets, DEFAULT_PROFILE, type Workout, type WorkoutSet } from '@/db';
import { duration, longDate, timeOf } from '@/lib/dates';
import { metKcal } from '@/lib/formulas';
import { useNow } from '@/lib/useNow';
import { useTheme } from '@/theme';
import { Button, Card, Icon, Loading, Pill, Row, Screen, Stat, T } from '@/components/ui';

type S = WorkoutSet & { name: string; muscle: string; type: string };

export default function WorkoutDetail() {
  const t = useTheme();
  const { id, done } = useLocalSearchParams<{ id: string; done?: string }>();
  const [w, , loading] = useQuery(() => getWorkout(Number(id)), [id], null as Workout | null);
  const [sets] = useQuery(() => workoutSets(Number(id)), [id], [] as S[]);
  const [weight] = useQuery(latestWeight, [], null);
  const [profile] = useQuery(getProfile, [], DEFAULT_PROFILE);
  const now = useNow(60000);
  // Mejor 1RM estimado previo por ejercicio para detectar récords
  const [prevBest] = useQuery(async () => {
    if (!w) return {} as Record<number, number>;
    const rows = await db().getAllAsync<{ exercise_id: number; best: number }>(
      `SELECT s.exercise_id, MAX(s.weight * (1 + s.reps / 30.0)) best FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
       WHERE s.done = 1 AND w.ended_at IS NOT NULL AND w.started_at < ? GROUP BY s.exercise_id`,
      w.started_at
    );
    return Object.fromEntries(rows.map(r => [r.exercise_id, r.best]));
  }, [w?.started_at], {} as Record<number, number>);

  const groups = useMemo(() => {
    const g = new Map<number, S[]>();
    for (const s of sets) {
      if (!g.has(s.position)) g.set(s.position, []);
      g.get(s.position)!.push(s);
    }
    return [...g.values()];
  }, [sets]);

  if (loading) return <Loading />;
  if (!w) return <Screen><T muted>Entrenamiento no encontrado.</T></Screen>;

  const mins = ((w.ended_at ?? now) - w.started_at) / 60000;
  const volume = sets.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0);
  const kg = weight?.kg ?? (profile.sex === 'h' ? 75 : 62);
  const kcal = metKcal(5, kg, mins);
  const prs = groups.filter(list => {
    const best = Math.max(...list.map(s => (s.weight ?? 0) * (1 + (s.reps ?? 0) / 30)));
    const prev = prevBest[list[0].exercise_id];
    return best > 0 && (prev == null || best > prev + 0.01) && prev != null;
  });

  return (
    <Screen>
      {done && (
        <Card style={{ backgroundColor: t.ok + '22', alignItems: 'center' }}>
          <Icon name="trophy" size={34} color={t.ok} />
          <T v="h2" center>¡Entrenamiento completado!</T>
          {prs.length > 0 && <T center>Rompiste {prs.length} {prs.length === 1 ? 'récord' : 'récords'} 🔥</T>}
        </Card>
      )}
      <View>
        <T v="h2">{w.name}</T>
        <T muted>{longDate(w.started_at)} · {timeOf(w.started_at)}</T>
      </View>
      <Row gap={10} style={{ flexWrap: 'wrap' }}>
        <Stat label="Duración" value={duration(mins * 60000)} />
        <Stat label="Volumen" value={`${Math.round(volume).toLocaleString('es-MX')} kg`} />
        <Stat label="Series" value={String(sets.length)} />
        <Stat label="Gasto estimado" value={`${Math.round(kcal)} kcal`} sub="MET 5 · pesas" />
      </Row>
      {w.notes ? <Card><T v="small" muted>Notas</T><T>{w.notes}</T></Card> : null}
      {groups.map(list => {
        const ex = list[0];
        const isPr = prs.includes(list);
        return (
          <Card key={ex.position} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: ex.exercise_id } })}>
            <Row>
              <T v="h3" style={{ flex: 1 }}>{ex.name}</T>
              {isPr && <Pill text="Récord" color={t.ok} />}
            </Row>
            {list.map((s, i) => (
              <Row key={s.id}>
                <T muted style={{ width: 24 }}>{i + 1}</T>
                <T num>
                  {ex.type === 'c' ? `${Math.round((s.seconds ?? 0) / 60)} min${s.distance ? ` · ${s.distance} km` : ''}`
                    : ex.type === 't' ? `${s.seconds ?? 0} s`
                    : `${s.weight ?? 0} kg × ${s.reps ?? 0}`}
                </T>
                {ex.type === 'w' && s.weight && s.reps ? <T v="tiny" muted num>  1RM≈{Math.round(s.weight * (1 + s.reps / 30))}</T> : null}
              </Row>
            ))}
          </Card>
        );
      })}
      <Button kind="danger" title="Eliminar del historial" onPress={() => Alert.alert('Eliminar', '¿Eliminar este entrenamiento del historial?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: async () => { await deleteWorkout(w.id); router.back(); } },
      ])} />
    </Screen>
  );
}
