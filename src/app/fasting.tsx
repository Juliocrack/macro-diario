import { useState } from 'react';
import { useNow } from '@/lib/useNow';
import { Alert, View } from 'react-native';
import { activeFast, deleteFast, endFast, listFasts, startFast, useQuery, type Fast } from '@/db';
import { cancelFastEnd, scheduleFastEnd } from '@/lib/device';
import { hm, iso, shortDate, timeOf } from '@/lib/dates';
import { useTheme } from '@/theme';
import { Button, Card, ListItem, Pill, Ring, Row, Screen, Section, Seg, Stat, T } from '@/components/ui';

const PLANS = [
  { key: '12', label: '12:12' },
  { key: '14', label: '14:10' },
  { key: '16', label: '16:8' },
  { key: '18', label: '18:6' },
  { key: '20', label: '20:4' },
  { key: '23', label: 'OMAD' },
];

const STAGES = [
  { h: 0, label: 'Digestión', text: 'El cuerpo usa la glucosa de tu última comida.' },
  { h: 4, label: 'Glucosa estable', text: 'La insulina baja y empieza a usar glucógeno.' },
  { h: 12, label: 'Quema de grasa', text: 'Aumenta el uso de grasa como energía.' },
  { h: 16, label: 'Cetosis ligera', text: 'Mayor producción de cuerpos cetónicos.' },
  { h: 18, label: 'Autofagia (inicio)', text: 'Procesos de reciclaje celular más activos.' },
];

export default function Fasting() {
  const t = useTheme();
  const [plan, setPlan] = useState('16');
  const now = useNow(30000);
  const [fast] = useQuery(activeFast, [], null as Fast | null);
  const [hist] = useQuery(listFasts, [], [] as Fast[]);

  const elapsed = fast ? now - fast.started_at : 0;
  const target = (fast?.target_h ?? Number(plan)) * 3600000;
  const hours = elapsed / 3600000;
  const stage = [...STAGES].reverse().find(s => hours >= s.h) ?? STAGES[0];
  const done = hist.filter(f => (f.ended_at! - f.started_at) >= f.target_h * 3600000 * 0.95).length;
  const avgH = hist.length ? hist.reduce((a, f) => a + (f.ended_at! - f.started_at), 0) / hist.length / 3600000 : 0;

  const start = async (hoursAgo = 0) => {
    const at = Date.now() - hoursAgo * 3600000;
    await startFast(Number(plan), at);
    scheduleFastEnd(at + Number(plan) * 3600000).catch(() => {});
  };

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: 14 }}>
        <Ring value={elapsed} max={target} size={210} stroke={16} color={elapsed >= target ? t.ok : t.train}>
          <T v="tiny" muted>{fast ? (elapsed >= target ? '¡Meta cumplida!' : 'Llevas') : 'Listo para empezar'}</T>
          <T v="h1" num>{fast ? hm(elapsed) : `${plan} h`}</T>
          {fast ? <T v="tiny" muted num>{elapsed < target ? `Faltan ${hm(target - elapsed)}` : `+${hm(elapsed - target)} extra`}</T> : null}
        </Ring>
        {fast ? (
          <>
            <Pill text={stage.label} color={t.train} />
            <T v="small" muted center>{stage.text}</T>
            <T v="small" muted>Inicio: {timeOf(fast.started_at)} · Meta: {timeOf(fast.started_at + target)}</T>
            <Button title="Terminar ayuno" color={t.ok} icon="restaurant" style={{ alignSelf: 'stretch' }} onPress={async () => { await endFast(fast.id); cancelFastEnd(); }} />
          </>
        ) : (
          <View style={{ alignSelf: 'stretch', gap: 10 }}>
            <Seg options={PLANS} value={plan} onChange={setPlan} />
            <Button title="Empezar ahora" color={t.train} icon="play" onPress={() => start(0)} />
            <Row gap={8}>
              <Button small kind="soft" title="Empecé hace 1 h" style={{ flex: 1 }} onPress={() => start(1)} />
              <Button small kind="soft" title="Hace 2 h" style={{ flex: 1 }} onPress={() => start(2)} />
              <Button small kind="soft" title="Hace 3 h" style={{ flex: 1 }} onPress={() => start(3)} />
            </Row>
          </View>
        )}
      </Card>

      <Row gap={10}>
        <Stat label="Ayunos completados" value={String(done)} sub={`de ${hist.length}`} />
        <Stat label="Duración promedio" value={`${avgH.toFixed(1)} h`} />
      </Row>

      {hist.length > 0 && (
        <Section title="Historial">
          <Card padded={false} style={{ gap: 0 }}>
            {hist.map((f, i) => {
              const d = f.ended_at! - f.started_at;
              const ok = d >= f.target_h * 3600000 * 0.95;
              return (
                <ListItem key={f.id} title={hm(d)} subtitle={`${shortDate(iso(new Date(f.started_at)))} · meta ${f.target_h} h`} right={<Pill text={ok ? 'Cumplido' : 'Incompleto'} color={ok ? t.ok : t.warn} />}
                  onLongPress={() => Alert.alert('Borrar', '¿Borrar este ayuno?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Borrar', style: 'destructive', onPress: () => deleteFast(f.id) }])} last={i === hist.length - 1} />
              );
            })}
          </Card>
        </Section>
      )}
      <T v="tiny" muted center>El ayuno no es para todos. Si tienes alguna condición médica, estás embarazada o tienes historial de trastornos alimentarios, consulta a un profesional.</T>
    </Screen>
  );
}
