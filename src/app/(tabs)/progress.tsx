import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import {
  dailyTotals, deleteWeight, getGoals, getProfile, listMeasurements, listPhotos, listWeights, setWeight, useQuery,
  DEFAULT_GOALS, DEFAULT_PROFILE, type DayTotal, type Measurement, type ProgressPhoto, type Weight,
} from '@/db';
import { addDays, shortDate, today } from '@/lib/dates';
import { bmi, bmiCategory, round } from '@/lib/formulas';
import { shareCsv } from '@/lib/device';
import { useTheme } from '@/theme';
import { Button, Card, Field, Icon, ListItem, numVal, Row, Screen, Section, Seg, Stat, T } from '@/components/ui';
import { BarChart, LineChart } from '@/components/charts';

export default function Progress() {
  const t = useTheme();
  const [range, setRange] = useState<'7' | '14' | '30'>('14');
  const [wRange, setWRange] = useState<'30' | '90' | '365' | 'all'>('90');
  const [kg, setKg] = useState('');
  const [weights] = useQuery(listWeights, [], [] as Weight[]);
  const [goals] = useQuery(getGoals, [], DEFAULT_GOALS);
  const [profile] = useQuery(getProfile, [], DEFAULT_PROFILE);
  const [meas] = useQuery(listMeasurements, [], [] as Measurement[]);
  const [photos] = useQuery(listPhotos, [], [] as ProgressPhoto[]);
  const n = Number(range);
  const from = addDays(today(), -(n - 1));
  const [totals] = useQuery(() => dailyTotals(from, today()), [from], [] as DayTotal[]);

  // Serie de días completa (con ceros)
  const days = Array.from({ length: n }, (_, i) => addDays(from, i));
  const map = new Map(totals.map(d => [d.date, d]));
  const series = days.map(d => map.get(d));
  const logged = totals.filter(d => d.n > 0);
  const avg = (k: 'kcal' | 'p' | 'f' | 'c') => (logged.length ? logged.reduce((a, d) => a + d[k], 0) / logged.length : 0);
  const inRange = logged.filter(d => Math.abs(d.kcal - goals.kcal) <= goals.kcal * 0.1).length;
  const protHit = logged.filter(d => d.p >= goals.p * 0.9).length;

  // Peso
  const cutoff = wRange === 'all' ? '0000' : addDays(today(), -Number(wRange));
  const ws = weights.filter(w => w.date >= cutoff);
  const smooth = ws.map((w, i) => {
    const win = ws.slice(Math.max(0, i - 6), i + 1);
    return { label: shortDate(w.date), value: win.reduce((a, x) => a + x.kg, 0) / win.length };
  });
  const last = weights[weights.length - 1];
  const twoWeeksAgo = weights.filter(w => w.date <= addDays(today(), -14)).pop();
  const rate = last && twoWeeksAgo ? (last.kg - twoWeeksAgo.kg) / ((new Date(last.date).getTime() - new Date(twoWeeksAgo.date).getTime()) / (7 * 86400000)) : null;
  const first = ws[0];

  const saveWeight = async () => {
    const v = numVal(kg);
    if (!(v > 20 && v < 400)) return Alert.alert('Peso inválido', 'Escribe tu peso en kg, por ejemplo 72.5');
    await setWeight(today(), round(v, 1));
    setKg('');
  };

  const exportCsv = async () => {
    const all = await dailyTotals('0000-01-01', '9999-12-31');
    const wmap = new Map(weights.map(w => [w.date, w.kg]));
    const dates = [...new Set([...all.map(d => d.date), ...weights.map(w => w.date)])].sort();
    const rows: (string | number | null)[][] = [['fecha', 'kcal', 'proteina_g', 'grasa_g', 'carbos_g', 'fibra_g', 'peso_kg']];
    const am = new Map(all.map(d => [d.date, d]));
    for (const d of dates) {
      const x = am.get(d);
      rows.push([d, x ? Math.round(x.kcal) : null, x ? round(x.p, 1) : null, x ? round(x.f, 1) : null, x ? round(x.c, 1) : null, x ? round(x.fiber ?? 0, 1) : null, wmap.get(d) ?? null]);
    }
    await shareCsv('macro-diario-progreso.csv', rows).catch(e => Alert.alert('No se pudo exportar', e?.message));
  };

  const lm = meas[0];
  const bmiV = last ? bmi(last.kg, profile.heightCm) : null;

  return (
    <Screen>
      <Section title="Peso corporal">
        <Card>
          <Row gap={10} style={{ alignItems: 'flex-end' }}>
            <Field label={`Peso de hoy${last?.date === today() ? ` (registrado: ${last.kg} kg)` : ''}`} value={kg} onChangeText={setKg} keyboardType="decimal-pad" placeholder={last ? String(last.kg) : '72.5'} suffix="kg" />
            <Button title="Guardar" onPress={saveWeight} style={{ marginBottom: 1 }} />
          </Row>
          {ws.length >= 2 ? (
            <>
              <Seg options={[{ key: '30', label: '30 d' }, { key: '90', label: '90 d' }, { key: '365', label: '1 año' }, { key: 'all', label: 'Todo' }]} value={wRange} onChange={setWRange} />
              <LineChart data={smooth} color={t.water} target={profile.targetKg} />
              <T v="tiny" muted>Promedio móvil de 7 días{profile.targetKg ? ' · línea verde: tu meta' : ''}.</T>
            </>
          ) : (
            <T v="small" muted>Registra tu peso al menos dos días para ver la tendencia. Pésate en ayunas para comparar mejor.</T>
          )}
        </Card>
        <Row gap={10} wrap>
          <Stat label="Actual" value={last ? `${last.kg} kg` : '—'} sub={last ? shortDate(last.date) : undefined} />
          <Stat label="Cambio en el periodo" value={first && last ? `${last.kg - first.kg > 0 ? '+' : ''}${round(last.kg - first.kg, 1)} kg` : '—'} />
          <Stat label="Ritmo" value={rate != null ? `${rate > 0 ? '+' : ''}${round(rate, 2)} kg/sem` : '—'} sub="últimas 2 semanas" />
          <Stat label="IMC" value={bmiV ? String(round(bmiV, 1)) : '—'} sub={bmiV ? bmiCategory(bmiV) : 'Agrega tu estatura en Perfil'} />
        </Row>
        {weights.length > 0 && (
          <Card padded={false} style={{ gap: 0 }}>
            {[...weights].reverse().slice(0, 5).map((w, i, a) => (
              <ListItem key={w.date} title={`${w.kg} kg`} subtitle={shortDate(w.date)} last={i === a.length - 1}
                onLongPress={() => Alert.alert('Eliminar registro', `¿Borrar ${w.kg} kg del ${shortDate(w.date)}?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Borrar', style: 'destructive', onPress: () => deleteWeight(w.date) }])} />
            ))}
          </Card>
        )}
      </Section>

      <Section title="Nutrición">
        <Seg options={[{ key: '7', label: '7 días' }, { key: '14', label: '14 días' }, { key: '30', label: '30 días' }]} value={range} onChange={setRange} />
        <Row gap={10} wrap>
          <Stat label="Promedio kcal" value={Math.round(avg('kcal')).toLocaleString('es-MX')} sub={`meta ${goals.kcal.toLocaleString('es-MX')}`} color={t.kcal} />
          <Stat label="Promedio proteína" value={`${Math.round(avg('p'))} g`} sub={`meta ${goals.p} g`} color={t.prot} />
          <Stat label="Días en meta ±10%" value={`${inRange}/${logged.length}`} sub="días registrados" />
          <Stat label="Proteína cumplida" value={`${protHit}/${logged.length}`} sub="≥ 90% de la meta" />
        </Row>
        <Card>
          <T v="small" bold>Calorías</T>
          <BarChart data={series.map((d, i) => ({ label: String(Number(days[i].slice(8))), value: d?.kcal ?? 0, highlight: days[i] === today() }))} goal={goals.kcal} color={t.kcal} />
        </Card>
        <Card>
          <T v="small" bold>Proteína (g)</T>
          <BarChart data={series.map((d, i) => ({ label: String(Number(days[i].slice(8))), value: d?.p ?? 0, highlight: days[i] === today() }))} goal={goals.p} color={t.prot} />
        </Card>
        <Card>
          <T v="small" bold>Promedio de macros</T>
          {([['Proteína', avg('p'), goals.p, t.prot], ['Grasas', avg('f'), goals.f, t.fat], ['Carbohidratos', avg('c'), goals.c, t.carb]] as const).map(([l, v, g, c]) => (
            <Row key={l}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} />
              <T style={{ flex: 1 }}>{l}</T>
              <T num muted>{Math.round(v)} / {g} g</T>
            </Row>
          ))}
        </Card>
      </Section>

      <Section title="Medidas" action="+ Registrar" onAction={() => router.push('/body/measure')}>
        <Card onPress={() => router.push('/body/measure')}>
          {lm ? (
            <>
              <T v="small" muted>Última: {shortDate(lm.date)}</T>
              <Row wrap gap={14}>
                {([['Cintura', lm.waist], ['Pecho', lm.chest], ['Cadera', lm.hips], ['Brazo', lm.arm], ['Muslo', lm.thigh], ['% grasa', lm.body_fat]] as const)
                  .filter(([, v]) => v != null)
                  .map(([l, v]) => (
                    <View key={l}><T v="tiny" muted>{l}</T><T bold num>{v}{l === '% grasa' ? '%' : ' cm'}</T></View>
                  ))}
              </Row>
            </>
          ) : (
            <Row><Icon name="resize" color={t.muted} /><T muted style={{ flex: 1 }}>Registra cintura, pecho, brazo y más para ver cambios que la báscula no muestra.</T></Row>
          )}
        </Card>
      </Section>

      <Section title="Fotos de progreso" action="Ver todas" onAction={() => router.push('/body/photos')}>
        {photos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {photos.slice(0, 10).map(p => (
              <Pressable key={p.id} onPress={() => router.push('/body/photos')}>
                <Image source={{ uri: p.uri }} style={{ width: 96, height: 128, borderRadius: 12, backgroundColor: t.surface }} />
                <T v="tiny" muted center>{shortDate(p.date)}</T>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Card onPress={() => router.push('/body/photos')}>
            <Row><Icon name="images-outline" color={t.muted} /><T muted style={{ flex: 1 }}>Toma fotos cada 2–4 semanas con la misma luz y pose para comparar.</T></Row>
          </Card>
        )}
      </Section>

      <Button kind="ghost" icon="download-outline" title="Exportar progreso (CSV)" onPress={exportCsv} />
    </Screen>
  );
}
