import { View } from 'react-native';
import { router } from 'expo-router';
import {
  activeWorkout, listRoutines, listWorkouts, personalRecords, startWorkout, trainedDays, useQuery,
  type Routine, type Workout,
} from '@/db';
import { duration, iso, shortDate } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import { useTheme } from '@/theme';
import { Button, Card, Empty, Icon, ListItem, Pill, Row, Screen, Section, Stat, T } from '@/components/ui';

type RoutineRow = Routine & { n: number; muscles: string | null };
type WorkoutRow = Workout & { volume: number; sets: number };
type PR = { exercise_id: number; name: string; muscle: string; weight: number; reps: number; e1rm: number; date: number };

export default function Train() {
  const t = useTheme();
  const [active] = useQuery(activeWorkout, [], null as Workout | null);
  const [routines] = useQuery(listRoutines, [], [] as RoutineRow[]);
  const [history] = useQuery(() => listWorkouts(30), [], [] as WorkoutRow[]);
  const [prs] = useQuery(personalRecords, [], [] as PR[]);
  const now = useNow(30000);
  const weekStart = (() => {
    const d = new Date(now);
    const day = (d.getDay() + 6) % 7;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d.getTime();
  })();
  const [week] = useQuery(() => trainedDays(weekStart - 27 * 86400000), [weekStart], [] as { started_at: number }[]);

  const start = async (routineId: number | null) => {
    if (active) {
      router.push('/workout/active');
      return;
    }
    await startWorkout(routineId);
    router.push('/workout/active');
  };

  // Calendario de las últimas 4 semanas
  const trained = new Set(week.map(w => iso(new Date(w.started_at))));
  const days: { d: string; on: boolean; future: boolean }[] = [];
  for (let i = 0; i < 28; i++) {
    const d = new Date(weekStart - 21 * 86400000 + i * 86400000);
    days.push({ d: iso(d), on: trained.has(iso(d)), future: d.getTime() > now });
  }
  const thisWeek = week.filter(w => w.started_at >= weekStart).length;
  const volumeWeek = history.filter(w => w.started_at >= weekStart).reduce((a, w) => a + w.volume, 0);

  return (
    <Screen>
      {active ? (
        <Card style={{ backgroundColor: t.train + '22' }} onPress={() => router.push('/workout/active')}>
          <Row>
            <Icon name="flame" color={t.train} />
            <View style={{ flex: 1 }}>
              <T bold>{active.name}</T>
              <T v="small" muted>En curso · {duration(now - active.started_at)}</T>
            </View>
            <Button small title="Continuar" color={t.train} onPress={() => router.push('/workout/active')} />
          </Row>
        </Card>
      ) : (
        <Row gap={8}>
          <Button icon="play" title="Entreno libre" color={t.train} style={{ flex: 1 }} onPress={() => start(null)} />
          <Button icon="sparkles" kind="soft" title="Programa IA" style={{ flex: 1 }} onPress={() => router.push('/routine/generate')} />
        </Row>
      )}

      <Row gap={10}>
        <Stat label="Esta semana" value={`${thisWeek} ${thisWeek === 1 ? 'sesión' : 'sesiones'}`} />
        <Stat label="Volumen semanal" value={`${Math.round(volumeWeek).toLocaleString('es-MX')} kg`} />
      </Row>

      <Card>
        <T v="small" bold>Últimas 4 semanas</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, i) => (
            <View key={'h' + i} style={{ width: '12%', alignItems: 'center' }}><T v="tiny" muted>{l}</T></View>
          ))}
          {days.map(x => (
            <View key={x.d} style={{ width: '12%', aspectRatio: 1, borderRadius: 8, backgroundColor: x.on ? t.train : t.surface2, opacity: x.future ? 0.35 : 1, alignItems: 'center', justifyContent: 'center' }}>
              <T v="tiny" color={x.on ? '#fff' : t.muted}>{Number(x.d.slice(8))}</T>
            </View>
          ))}
        </View>
      </Card>

      <Section title="Mis rutinas" action="+ Nueva" onAction={() => router.push({ pathname: '/routine/[id]', params: { id: 'new' } })}>
        {routines.length === 0 && <Empty icon="barbell" title="Sin rutinas" text="Crea una o genera un programa con IA." />}
        {routines.map(r => (
          <Card key={r.id} onPress={() => router.push({ pathname: '/routine/[id]', params: { id: r.id } })}>
            <Row>
              <View style={{ flex: 1 }}>
                <T v="h3">{r.name}</T>
                <T v="small" muted numberOfLines={1}>{r.n} ejercicios{r.muscles ? ` · ${r.muscles.split(',').slice(0, 4).join(', ')}` : ''}</T>
              </View>
              <Button small title="Iniciar" color={t.train} icon="play" onPress={() => start(r.id)} />
            </Row>
          </Card>
        ))}
      </Section>

      {prs.length > 0 && (
        <Section title="Récords personales">
          <Card padded={false} style={{ gap: 0 }}>
            {prs.slice(0, 8).map((p, i, a) => (
              <ListItem key={p.exercise_id} title={p.name} subtitle={`${p.weight} kg × ${p.reps} · ${shortDate(iso(new Date(p.date)))}`} right={<Pill text={`1RM ≈ ${Math.round(p.e1rm)} kg`} color={t.train} />} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: p.exercise_id } })} last={i === a.length - 1} />
            ))}
          </Card>
        </Section>
      )}

      <Section title="Historial">
        {history.length === 0 ? (
          <Empty icon="calendar-outline" title="Aún no hay entrenamientos" text="Inicia una rutina y registra tus series." />
        ) : (
          <Card padded={false} style={{ gap: 0 }}>
            {history.map((w, i) => (
              <ListItem key={w.id} title={w.name} subtitle={`${shortDate(iso(new Date(w.started_at)))} · ${duration((w.ended_at ?? w.started_at) - w.started_at)} · ${w.sets} series · ${Math.round(w.volume).toLocaleString('es-MX')} kg`} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })} last={i === history.length - 1} right={<Icon name="chevron-forward" size={16} color={t.muted} />} />
            ))}
          </Card>
        )}
      </Section>
      <Button kind="ghost" icon="library-outline" title="Biblioteca de ejercicios" onPress={() => router.push({ pathname: '/exercise/pick', params: { mode: 'browse' } })} />
    </Screen>
  );
}

