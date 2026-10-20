import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { getProfile, latestWeight, setSetting, getGoals, type Goals } from '@/db';
import { CALCS } from '@/data/calcs';
import { ageFrom } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import * as F from '@/lib/formulas';
import { useTheme } from '@/theme';
import { Button, Card, Field, numVal, Row, Screen, Seg, T } from '@/components/ui';

type S = Record<string, string>;

export default function Calc() {
  const t = useTheme();
  const nav = useNavigation();
  const { key } = useLocalSearchParams<{ key: string }>();
  const meta = CALCS.find(c => c.key === key);
  const now = useNow(60000);
  const [sex, setSex] = useState<F.Sex>('h');
  const [act, setAct] = useState<F.ActivityKey>('mod');
  const [goal, setGoal] = useState<F.GoalKey>('maint');
  const [metIdx, setMetIdx] = useState('0');
  const [v, setV] = useState<S>({ age: '24', height: '175', weight: '75', bf: '', waist: '', neck: '', hip: '', lift: '80', reps: '8', rhr: '', minutes: '45', target: '', intake: '', exmin: '45', protkg: '2', fatpct: '25' });
  const set = (k: string) => (x: string) => setV(s => ({ ...s, [k]: x }));
  const n = (k: string) => numVal(v[k] ?? '');

  useEffect(() => {
    nav.setOptions({ title: meta?.title ?? 'Calculadora' });
    (async () => {
      const p = await getProfile();
      const w = await latestWeight();
      setSex(p.sex);
      setAct(p.activity);
      setGoal(p.goal);
      setV(s => ({ ...s, age: String(ageFrom(p.birthYear)), height: String(p.heightCm), weight: w ? String(w.kg) : s.weight, target: p.targetKg ? String(p.targetKg) : s.target }));
    })();
  }, [meta, nav]);

  const res = (label: string, value: string, sub?: string, color?: string) => (
    <View style={{ flex: 1, minWidth: 140, gap: 2 }}>
      <T v="tiny" muted>{label}</T>
      <T v="h2" num color={color ?? t.ink}>{value}</T>
      {sub ? <T v="tiny" muted>{sub}</T> : null}
    </View>
  );
  const sexSeg = <Seg options={[{ key: 'h', label: 'Hombre' }, { key: 'm', label: 'Mujer' }]} value={sex} onChange={setSex} />;
  const basics = (
    <Row gap={10}>
      <Field label="Edad" value={v.age} onChangeText={set('age')} keyboardType="number-pad" suffix="años" />
      <Field label="Estatura" value={v.height} onChangeText={set('height')} keyboardType="decimal-pad" suffix="cm" />
      <Field label="Peso" value={v.weight} onChangeText={set('weight')} keyboardType="decimal-pad" suffix="kg" />
    </Row>
  );
  const actSeg = (
    <View style={{ gap: 6 }}>
      <T v="small" muted>Actividad</T>
      {F.ACTIVITY.map(a => (
        <Button key={a.key} small kind={act === a.key ? 'primary' : 'soft'} title={`${a.label} · ×${a.factor}`} onPress={() => setAct(a.key)} style={{ justifyContent: 'flex-start' }} />
      ))}
    </View>
  );

  let body: React.ReactNode = null;
  const age = n('age'), cm = n('height'), kg = n('weight');

  switch (key) {
    case 'imc': {
      const b = F.bmi(kg, cm);
      const r = F.healthyWeightRange(cm);
      body = (<>{basics}<Card><Row wrap>{res('IMC', b ? F.round(b, 1).toString() : '—', b ? F.bmiCategory(b) : undefined, t.water)}{res('Peso saludable', `${F.round(r.min, 1)}–${F.round(r.max, 1)} kg`, 'IMC 18.5–24.9')}</Row>
        <T v="tiny" muted>El IMC no distingue músculo de grasa: en personas musculosas puede marcar sobrepeso sin haberlo. Compleméntalo con % de grasa y cintura.</T></Card></>);
      break;
    }
    case 'tmb': {
      const m = F.bmrMifflin(sex, kg, cm, age);
      const h = F.bmrHarrisBenedict(sex, kg, cm, age);
      const k = n('bf') ? F.bmrKatchMcArdle(kg, n('bf')) : null;
      body = (<>{sexSeg}{basics}<Field label="% de grasa (opcional, para Katch-McArdle)" value={v.bf} onChangeText={set('bf')} keyboardType="decimal-pad" suffix="%" />
        <Card><Row wrap>{res('Mifflin-St Jeor', `${Math.round(m)} kcal`, 'La más precisa en general', t.kcal)}{res('Harris-Benedict', `${Math.round(h)} kcal`, 'Revisada 1984')}{k ? res('Katch-McArdle', `${Math.round(k)} kcal`, 'Usa masa magra') : null}</Row>
        <T v="tiny" muted>Es lo que gastas en reposo absoluto. Para tu gasto real usa la calculadora de calorías y macros.</T></Card></>);
      break;
    }
    case 'tdee': {
      const bmr = F.bmrMifflin(sex, kg, cm, age);
      const td = F.tdee(bmr, act);
      const g = F.GOALS.find(x => x.key === goal)!;
      const target = td * (1 + g.kcalAdj);
      const m = F.macrosFor(target, kg, n('protkg') || 2, (n('fatpct') || 25) / 100);
      body = (<>{sexSeg}{basics}{actSeg}
        <T v="small" muted>Objetivo</T>
        <Seg options={F.GOALS.map(x => ({ key: x.key, label: x.label }))} value={goal} onChange={setGoal} scroll />
        <Row gap={10}>
          <Field label="Proteína" value={v.protkg} onChangeText={set('protkg')} keyboardType="decimal-pad" suffix="g/kg" hint="1.6–2.2 recomendado" />
          <Field label="Grasa" value={v.fatpct} onChangeText={set('fatpct')} keyboardType="decimal-pad" suffix="% kcal" hint="20–35 %" />
        </Row>
        <Card>
          <Row wrap>{res('TMB', `${Math.round(bmr)} kcal`)}{res('Gasto diario (TDEE)', `${Math.round(td)} kcal`)}</Row>
          <Row wrap>{res(`Meta · ${g.label}`, `${m.kcal} kcal`, g.kcalAdj ? `${g.kcalAdj > 0 ? '+' : ''}${Math.round(g.kcalAdj * 100)}% del TDEE · ≈${F.round((td * g.kcalAdj * 7) / F.KCAL_PER_KG, 2)} kg/sem` : undefined, t.kcal)}</Row>
          <Row wrap>{res('Proteína', `${m.p} g`, undefined, t.prot)}{res('Grasas', `${m.f} g`, undefined, t.fat)}{res('Carbohidratos', `${m.c} g`, undefined, t.carb)}</Row>
          <Button icon="checkmark" title="Usar como mis metas diarias" onPress={async () => {
            const cur = await getGoals();
            const next: Goals = { ...cur, kcal: m.kcal, p: m.p, f: m.f, c: m.c, waterMl: Math.round(F.waterMl(kg) / 250) * 250 };
            await setSetting('goals', next);
            Alert.alert('Metas actualizadas', `${m.kcal} kcal · ${m.p} P · ${m.f} G · ${m.c} C`);
          }} />
        </Card></>);
      break;
    }
    case 'grasa': {
      const navy = n('waist') && n('neck') ? F.bodyFatNavy(sex, cm, n('waist'), n('neck'), n('hip')) : NaN;
      const byBmi = F.bodyFatFromBmi(sex, F.bmi(kg, cm), age);
      body = (<>{sexSeg}{basics}
        <Row gap={10}>
          <Field label="Cintura" value={v.waist} onChangeText={set('waist')} keyboardType="decimal-pad" suffix="cm" hint="Altura del ombligo" />
          <Field label="Cuello" value={v.neck} onChangeText={set('neck')} keyboardType="decimal-pad" suffix="cm" />
          {sex === 'm' && <Field label="Cadera" value={v.hip} onChangeText={set('hip')} keyboardType="decimal-pad" suffix="cm" />}
        </Row>
        <Card><Row wrap>
          {res('Marina de EE. UU.', Number.isFinite(navy) ? `${F.round(navy, 1)} %` : '—', Number.isFinite(navy) ? F.bodyFatCategory(sex, navy) : 'Escribe cintura y cuello', t.prot)}
          {res('Estimación por IMC', `${F.round(byBmi, 1)} %`, 'Deurenberg · menos precisa')}
        </Row>
        {Number.isFinite(navy) && <Row wrap>{res('Masa grasa', `${F.round((kg * navy) / 100, 1)} kg`)}{res('Masa magra', `${F.round(kg * (1 - navy / 100), 1)} kg`)}</Row>}
        </Card></>);
      break;
    }
    case 'ffmi': {
      const r = n('bf') ? F.ffmi(kg, cm, n('bf')) : null;
      const cat = (x: number) => (x < 18 ? 'Por debajo del promedio' : x < 20 ? 'Promedio' : x < 22 ? 'Por encima del promedio' : x < 23 ? 'Excelente' : x < 25 ? 'Superior' : 'Cerca del límite natural');
      body = (<>{basics}<Field label="% de grasa" value={v.bf} onChangeText={set('bf')} keyboardType="decimal-pad" suffix="%" />
        <Card>{r ? <Row wrap>{res('FFMI ajustado', F.round(r.normalized, 1).toString(), cat(r.normalized), t.train)}{res('Masa magra', `${F.round(r.lean, 1)} kg`)}{res('FFMI', F.round(r.ffmi, 1).toString())}</Row> : <T muted>Escribe tu % de grasa.</T>}
        <T v="tiny" muted>Referencia en hombres: 18–20 promedio, 22+ muy musculoso, ~25 se considera el límite natural. En mujeres restar ~3 puntos.</T></Card></>);
      break;
    }
    case 'ideal': {
      const w = F.idealWeights(sex, cm);
      const r = F.healthyWeightRange(cm);
      body = (<>{sexSeg}<Field label="Estatura" value={v.height} onChangeText={set('height')} keyboardType="decimal-pad" suffix="cm" />
        <Card><Row wrap>{Object.entries(w).map(([k, x]) => <View key={k} style={{ width: '45%' }}>{res(k, `${F.round(x, 1)} kg`)}</View>)}</Row>
        <T v="small" muted>Rango por IMC saludable: {F.round(r.min, 1)}–{F.round(r.max, 1)} kg. Las fórmulas son referencias poblacionales, no metas obligatorias.</T></Card></>);
      break;
    }
    case 'cintura': {
      const whtr = n('waist') && cm ? F.waistToHeight(n('waist'), cm) : null;
      const whr = n('waist') && n('hip') ? F.waistToHip(n('waist'), n('hip')) : null;
      body = (<>{sexSeg}<Row gap={10}><Field label="Estatura" value={v.height} onChangeText={set('height')} keyboardType="decimal-pad" suffix="cm" /><Field label="Cintura" value={v.waist} onChangeText={set('waist')} keyboardType="decimal-pad" suffix="cm" /><Field label="Cadera" value={v.hip} onChangeText={set('hip')} keyboardType="decimal-pad" suffix="cm" /></Row>
        <Card><Row wrap>{res('Cintura / altura', whtr ? F.round(whtr, 2).toString() : '—', whtr ? F.waistToHeightCategory(whtr) : 'Meta: menor a 0.5', t.water)}{res('Cintura / cadera', whr ? F.round(whr, 2).toString() : '—', whr ? F.waistToHipCategory(sex, whr) : `Límite: ${sex === 'h' ? '0.90' : '0.85'}`)}</Row></Card></>);
      break;
    }
    case 'rm': {
      const r = F.oneRM(n('lift'), n('reps'));
      body = (<><Row gap={10}><Field label="Peso levantado" value={v.lift} onChangeText={set('lift')} keyboardType="decimal-pad" suffix="kg" /><Field label="Repeticiones" value={v.reps} onChangeText={set('reps')} keyboardType="number-pad" hint="Más preciso con 2–10" /></Row>
        <Card><Row wrap>{res('1RM promedio', `${F.round(r.avg, 1)} kg`, undefined, t.train)}{res('Epley', `${F.round(r.epley, 1)}`)}{res('Brzycki', Number.isFinite(r.brzycki) ? `${F.round(r.brzycki, 1)}` : '—')}{res('Lombardi', `${F.round(r.lombardi, 1)}`)}</Row></Card>
        <Card><T v="h3">Tabla de cargas</T>{F.RM_TABLE.map(([p, reps]) => <Row key={p}><T style={{ width: 60 }} num>{p}%</T><T bold num style={{ flex: 1 }}>{F.round((r.avg * p) / 100, 1)} kg</T><T muted num>~{reps} reps</T></Row>)}</Card></>);
      break;
    }
    case 'fc': {
      const z = F.hrZones(age, n('rhr') || undefined);
      body = (<><Row gap={10}><Field label="Edad" value={v.age} onChangeText={set('age')} keyboardType="number-pad" /><Field label="FC en reposo (opcional)" value={v.rhr} onChangeText={set('rhr')} keyboardType="number-pad" suffix="lpm" /></Row>
        <Card>{res('FC máxima (Tanaka)', `${Math.round(F.maxHeartRate(age))} lpm`, n('rhr') ? 'Zonas con método Karvonen' : 'Zonas por % de FC máxima', t.danger)}
        {z.map(x => <Row key={x.z}><T bold style={{ width: 30 }}>Z{x.z}</T><T style={{ flex: 1 }}>{x.name}</T><T num muted>{x.from}–{x.to} lpm</T></Row>)}</Card></>);
      break;
    }
    case 'met': {
      const a = F.MET_ACTIVITIES[Number(metIdx)];
      const kc = F.metKcal(a.met, kg, n('minutes'));
      body = (<><Row gap={10}><Field label="Peso" value={v.weight} onChangeText={set('weight')} keyboardType="decimal-pad" suffix="kg" /><Field label="Duración" value={v.minutes} onChangeText={set('minutes')} keyboardType="number-pad" suffix="min" /></Row>
        <Seg options={F.MET_ACTIVITIES.map((x, i) => ({ key: String(i), label: x.label }))} value={metIdx} onChange={setMetIdx} scroll />
        <Card><Row wrap>{res(a.label, `${Math.round(kc)} kcal`, `${a.met} METs`, t.kcal)}</Row><T v="tiny" muted>Estimación promedio; la intensidad real cambia el resultado.</T></Card></>);
      break;
    }
    case 'agua': {
      const ml = F.waterMl(kg, n('exmin'));
      body = (<><Row gap={10}><Field label="Peso" value={v.weight} onChangeText={set('weight')} keyboardType="decimal-pad" suffix="kg" /><Field label="Ejercicio hoy" value={v.exmin} onChangeText={set('exmin')} keyboardType="number-pad" suffix="min" /></Row>
        <Card><Row wrap>{res('Agua recomendada', `${F.round(ml / 1000, 1)} L`, `≈ ${Math.round(ml / 250)} vasos de 250 ml`, t.water)}</Row>
        <Button kind="soft" title="Usar como meta de agua" onPress={async () => { const g = await getGoals(); await setSetting('goals', { ...g, waterMl: Math.round(ml / 250) * 250 }); Alert.alert('Meta de agua actualizada'); }} /></Card></>);
      break;
    }
    case 'proyeccion': {
      const bmr = F.bmrMifflin(sex, kg, cm, age);
      const td = F.tdee(bmr, act);
      const intake = n('intake') || td;
      const p = n('target') ? F.weightProjection(kg, n('target'), intake - td) : null;
      const date = p ? new Date(now + p.days * 86400000).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
      body = (<>{sexSeg}{basics}{actSeg}
        <Row gap={10}><Field label="Peso meta" value={v.target} onChangeText={set('target')} keyboardType="decimal-pad" suffix="kg" /><Field label="Calorías diarias" value={v.intake} onChangeText={set('intake')} keyboardType="number-pad" suffix="kcal" placeholder={String(Math.round(td))} /></Row>
        <Card>{res('Gasto diario estimado', `${Math.round(td)} kcal`, `Balance: ${Math.round(intake - td)} kcal/día`)}
        {p ? <Row wrap>{res('Llegarías aprox.', date!, `${Math.round(p.weeks)} semanas`, t.ok)}{res('Ritmo', `${F.round(p.kgPerWeek, 2)} kg/sem`)}</Row> : <T muted>{n('target') ? 'Con esas calorías no te acercas a la meta. Ajusta el consumo.' : 'Escribe tu peso meta.'}</T>}
        <T v="tiny" muted>Usa 7,700 kcal ≈ 1 kg. El progreso real se frena con el tiempo por adaptación metabólica; revisa tu tendencia cada 2–3 semanas.</T></Card></>);
      break;
    }
    case 'proteina': {
      const r = F.proteinRange(kg, goal);
      body = (<><Field label="Peso" value={v.weight} onChangeText={set('weight')} keyboardType="decimal-pad" suffix="kg" />
        <Seg options={F.GOALS.map(x => ({ key: x.key, label: x.label }))} value={goal} onChange={setGoal} scroll />
        <Card><Row wrap>{res('Proteína diaria', `${Math.round(r.min)}–${Math.round(r.max)} g`, `${F.round(r.min / kg, 1)}–${F.round(r.max / kg, 1)} g/kg`, t.prot)}{res('Por comida (4 comidas)', `${Math.round(r.min / 4)}–${Math.round(r.max / 4)} g`)}</Row>
        <T v="tiny" muted>En déficit conviene la parte alta del rango para conservar músculo.</T></Card></>);
      break;
    }
    default:
      body = <T muted>Calculadora no encontrada.</T>;
  }

  return (
    <Screen>
      {meta ? <T v="small" muted>{meta.sub}</T> : null}
      {body}
      <Button kind="ghost" small title="Editar mi perfil" icon="person-outline" onPress={() => router.push('/goals')} />
    </Screen>
  );
}
