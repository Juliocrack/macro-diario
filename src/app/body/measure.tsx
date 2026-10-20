import { useState } from 'react';
import { Alert, View } from 'react-native';
import { addMeasurement, deleteMeasurement, getProfile, latestWeight, listMeasurements, useQuery, DEFAULT_PROFILE, type Measurement } from '@/db';
import { shortDate, today } from '@/lib/dates';
import { bodyFatCategory, bodyFatNavy, round } from '@/lib/formulas';
import { useTheme } from '@/theme';
import { Button, Card, Field, numOrNull, Row, Screen, Section, T } from '@/components/ui';
import { LineChart } from '@/components/charts';

const KEYS = [
  ['waist', 'Cintura', 'A la altura del ombligo'],
  ['chest', 'Pecho', 'Parte más ancha'],
  ['hips', 'Cadera', 'Parte más ancha del glúteo'],
  ['shoulders', 'Hombros', 'Contorno completo'],
  ['arm', 'Brazo', 'Bíceps contraído'],
  ['thigh', 'Muslo', 'Parte más ancha'],
  ['calf', 'Pantorrilla', 'Parte más ancha'],
  ['neck', 'Cuello', 'Debajo de la manzana de Adán'],
] as const;
type K = (typeof KEYS)[number][0];

export default function Measure() {
  const t = useTheme();
  const [list] = useQuery(listMeasurements, [], [] as Measurement[]);
  const [profile] = useQuery(getProfile, [], DEFAULT_PROFILE);
  const [w] = useQuery(latestWeight, [], null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [bf, setBf] = useState('');
  const [chart, setChart] = useState<K>('waist');

  const navy = (() => {
    const waist = numOrNull(vals.waist ?? ''), neck = numOrNull(vals.neck ?? ''), hips = numOrNull(vals.hips ?? '');
    if (!waist || !neck || (profile.sex === 'm' && !hips)) return null;
    const v = bodyFatNavy(profile.sex, profile.heightCm, waist, neck, hips ?? 0);
    return Number.isFinite(v) && v > 2 && v < 60 ? round(v, 1) : null;
  })();

  const save = async () => {
    const m: any = { date: today(), notes: null, body_fat: numOrNull(bf) ?? navy };
    let any = false;
    for (const [k] of KEYS) {
      m[k] = numOrNull(vals[k] ?? '');
      if (m[k] != null) any = true;
    }
    if (!any && m.body_fat == null) return Alert.alert('Sin datos', 'Escribe al menos una medida.');
    await addMeasurement(m);
    setVals({});
    setBf('');
  };

  const series = [...list].reverse().filter(m => m[chart] != null).map(m => ({ label: shortDate(m.date), value: m[chart] as number }));

  return (
    <Screen>
      <T v="small" muted>Mide en centímetros, en la mañana y siempre con la cinta al mismo nivel. Con cintura y cuello{profile.sex === 'm' ? ' y cadera' : ''} calculo tu % de grasa (método Marina de EE. UU.).</T>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {KEYS.map(([k, label, hint]) => (
            <View key={k} style={{ width: '47%' }}>
              <Field label={label} hint={hint} value={vals[k] ?? ''} onChangeText={v => setVals(s => ({ ...s, [k]: v }))} keyboardType="decimal-pad" suffix="cm" placeholder={list[0]?.[k] != null ? String(list[0][k]) : ''} />
            </View>
          ))}
        </View>
        <Field label="% de grasa (opcional, de báscula o plicómetro)" value={bf} onChangeText={setBf} keyboardType="decimal-pad" suffix="%" placeholder={navy ? `${navy} (calculado)` : ''} />
        {navy != null && <T v="small" color={t.ok}>Grasa estimada: {navy}% · {bodyFatCategory(profile.sex, navy)}{w ? ` · masa magra ≈ ${round(w.kg * (1 - navy / 100), 1)} kg` : ''}</T>}
        <Button title="Guardar medidas" icon="checkmark" onPress={save} />
      </Card>

      {list.length > 0 && (
        <Section title="Evolución">
          <Card>
            <Row wrap gap={6}>
              {[...KEYS.map(([k, l]) => ({ k, l })), { k: 'body_fat' as const, l: '% grasa' }].map(({ k, l }) => (
                <Button key={k} small kind={chart === k ? 'primary' : 'soft'} title={l} onPress={() => setChart(k as K)} />
              ))}
            </Row>
            {series.length >= 2 ? <LineChart data={series} color={t.prot} /> : <T v="small" muted>Necesitas al menos dos registros de esta medida.</T>}
          </Card>
          {list.map(m => (
            <Card key={m.id} style={{ gap: 4 }}>
              <Row>
                <T bold style={{ flex: 1 }}>{shortDate(m.date)}</T>
                <Button small kind="danger" title="Borrar" onPress={() => Alert.alert('Borrar', '¿Borrar este registro de medidas?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Borrar', style: 'destructive', onPress: () => deleteMeasurement(m.id) }])} />
              </Row>
              <T v="small" muted num>
                {[...KEYS.map(([k, l]) => (m[k] != null ? `${l} ${m[k]}` : null)), m.body_fat != null ? `Grasa ${m.body_fat}%` : null].filter(Boolean).join(' · ')}
              </T>
            </Card>
          ))}
        </Section>
      )}
    </Screen>
  );
}
