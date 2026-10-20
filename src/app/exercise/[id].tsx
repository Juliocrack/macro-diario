import { useEffect, useState } from 'react';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { exerciseHistory, getExercise, useQuery, type Exercise } from '@/db';
import { iso, shortDate } from '@/lib/dates';
import { RM_TABLE } from '@/lib/formulas';
import { useTheme } from '@/theme';
import { Card, Empty, ListItem, Loading, Row, Screen, Seg, Stat, T } from '@/components/ui';
import { LineChart } from '@/components/charts';

type H = { workout_id: number; started_at: number; best_weight: number; best_reps: number; e1rm: number; volume: number; sets: number };

export default function ExerciseDetail() {
  const t = useTheme();
  const nav = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ex, , loading] = useQuery(() => getExercise(Number(id)), [id], null as Exercise | null);
  const [hist] = useQuery(() => exerciseHistory(Number(id)), [id], [] as H[]);
  const [metric, setMetric] = useState<'e1rm' | 'best_weight' | 'volume'>('e1rm');

  useEffect(() => {
    if (ex) nav.setOptions({ title: ex.name });
  }, [ex, nav]);

  if (loading) return <Loading />;
  if (!ex) return <Screen><T muted>Ejercicio no encontrado.</T></Screen>;

  const best = hist.reduce((a, h) => Math.max(a, h.e1rm), 0);
  const bestW = hist.reduce((a, h) => Math.max(a, h.best_weight), 0);
  const data = hist.map(h => ({ label: shortDate(iso(new Date(h.started_at))), value: h[metric] }));

  return (
    <Screen>
      <T muted>{ex.muscle}{ex.equipment ? ` · ${ex.equipment}` : ''}</T>
      {hist.length === 0 ? (
        <Empty icon="analytics-outline" title="Sin historial todavía" text="Cuando registres series de este ejercicio verás tu progreso aquí." />
      ) : (
        <>
          <Row gap={10}>
            <Stat label="1RM estimado" value={`${Math.round(best)} kg`} color={t.train} />
            <Stat label="Peso máximo" value={`${bestW} kg`} />
          </Row>
          <Card>
            <Seg options={[{ key: 'e1rm', label: '1RM est.' }, { key: 'best_weight', label: 'Peso máx.' }, { key: 'volume', label: 'Volumen' }]} value={metric} onChange={setMetric} />
            <LineChart data={data} color={t.train} decimals={0} />
          </Card>
          {best > 0 && ex.type === 'w' && (
            <Card>
              <T v="h3">Tabla de cargas (según tu 1RM)</T>
              <Row wrap gap={8}>
                {RM_TABLE.map(([pct, reps]) => (
                  <Card key={pct} style={{ backgroundColor: t.surface2, padding: 10, minWidth: 92, gap: 2 }}>
                    <T bold num>{Math.round((best * pct) / 100 / 2.5) * 2.5} kg</T>
                    <T v="tiny" muted>{pct}% · ~{reps} reps</T>
                  </Card>
                ))}
              </Row>
            </Card>
          )}
          <Card padded={false} style={{ gap: 0 }}>
            {[...hist].reverse().map((h, i, a) => (
              <ListItem key={h.workout_id} title={shortDate(iso(new Date(h.started_at)))} subtitle={`${h.sets} series · mejor ${h.best_weight} kg × ${h.best_reps} · vol ${Math.round(h.volume)} kg`} right={<T v="small" bold num>{Math.round(h.e1rm)}</T>} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: h.workout_id } })} last={i === a.length - 1} />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
