import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { getGoals, getProfile, latestWeight, setSetting, DEFAULT_GOALS, type Goals, type Profile } from '@/db';
import { ageFrom } from '@/lib/dates';
import * as F from '@/lib/formulas';
import { Button, Card, Field, numOrNull, numVal, Row, Screen, Section, Seg, T } from '@/components/ui';

export default function GoalsScreen() {
  const [p, setP] = useState<Profile | null>(null);
  const [g, setG] = useState<Record<keyof Goals, string>>({ kcal: '', p: '', f: '', c: '', waterMl: '', fiber: '' });
  const [kg, setKg] = useState<number | null>(null);
  const [height, setHeight] = useState('');
  const [birth, setBirth] = useState('');
  const [target, setTarget] = useState('');

  useEffect(() => {
    (async () => {
      const pr = await getProfile();
      const go = await getGoals();
      const w = await latestWeight();
      setP(pr);
      setHeight(String(pr.heightCm));
      setBirth(String(pr.birthYear));
      setTarget(pr.targetKg ? String(pr.targetKg) : '');
      setKg(w?.kg ?? null);
      setG({ kcal: String(go.kcal), p: String(go.p), f: String(go.f), c: String(go.c), waterMl: String(go.waterMl), fiber: String(go.fiber) });
    })();
  }, []);
  if (!p) return null;

  const upd = (patch: Partial<Profile>) => setP(s => ({ ...(s as Profile), ...patch }));
  const sum = numVal(g.p) * 4 + numVal(g.f) * 9 + numVal(g.c) * 4;

  const saveProfile = async () => {
    await setSetting('profile', { ...p, heightCm: numVal(height) || 170, birthYear: Math.round(numVal(birth)) || 2000, targetKg: numOrNull(target) });
    Alert.alert('Perfil guardado');
  };
  const saveGoals = async () => {
    const next: Goals = { kcal: Math.round(numVal(g.kcal)) || DEFAULT_GOALS.kcal, p: Math.round(numVal(g.p)), f: Math.round(numVal(g.f)), c: Math.round(numVal(g.c)), waterMl: Math.round(numVal(g.waterMl)) || 2500, fiber: Math.round(numVal(g.fiber)) || 30 };
    await setSetting('goals', next);
    Alert.alert('Metas guardadas', `${next.kcal} kcal · ${next.p} P · ${next.f} G · ${next.c} C`);
  };
  const auto = () => {
    const w = kg ?? 75;
    const age = ageFrom(Math.round(numVal(birth)) || 2000);
    const td = F.tdee(F.bmrMifflin(p.sex, w, numVal(height) || 170, age), p.activity);
    const adj = F.GOALS.find(x => x.key === p.goal)!.kcalAdj;
    const m = F.macrosFor(td * (1 + adj), w, p.goal.startsWith('cut') ? 2.2 : 1.8, 0.25);
    setG(s => ({ ...s, kcal: String(m.kcal), p: String(m.p), f: String(m.f), c: String(m.c), waterMl: String(Math.round(F.waterMl(w) / 250) * 250) }));
    if (!kg) Alert.alert('Sin peso registrado', 'Usé 75 kg. Registra tu peso en Progreso para un cálculo exacto.');
  };

  return (
    <Screen>
      <Section title="Mis datos">
        <Card>
          <Field label="Nombre" value={p.name} onChangeText={v => upd({ name: v })} placeholder="¿Cómo te llamas?" />
          <Seg options={[{ key: 'h', label: 'Hombre' }, { key: 'm', label: 'Mujer' }]} value={p.sex} onChange={sex => upd({ sex })} />
          <Row gap={10}>
            <Field label="Año de nacimiento" value={birth} onChangeText={setBirth} keyboardType="number-pad" />
            <Field label="Estatura" value={height} onChangeText={setHeight} keyboardType="decimal-pad" suffix="cm" />
            <Field label="Peso meta" value={target} onChangeText={setTarget} keyboardType="decimal-pad" suffix="kg" />
          </Row>
          <T v="small" muted>Actividad</T>
          <Seg options={F.ACTIVITY.map(a => ({ key: a.key, label: a.label.split(' (')[0] }))} value={p.activity} onChange={activity => upd({ activity })} scroll />
          <T v="small" muted>Objetivo</T>
          <Seg options={F.GOALS.map(x => ({ key: x.key, label: x.label }))} value={p.goal} onChange={goal => upd({ goal })} scroll />
          <Button kind="soft" title="Guardar perfil" icon="checkmark" onPress={saveProfile} />
        </Card>
      </Section>

      <Section title="Objetivos por día">
        <Card>
          <Field label="Calorías" value={g.kcal} onChangeText={v => setG(s => ({ ...s, kcal: v }))} keyboardType="number-pad" suffix="kcal" />
          <Row gap={10}>
            <Field label="Proteína" value={g.p} onChangeText={v => setG(s => ({ ...s, p: v }))} keyboardType="number-pad" suffix="g" />
            <Field label="Grasas" value={g.f} onChangeText={v => setG(s => ({ ...s, f: v }))} keyboardType="number-pad" suffix="g" />
            <Field label="Carbos" value={g.c} onChangeText={v => setG(s => ({ ...s, c: v }))} keyboardType="number-pad" suffix="g" />
          </Row>
          <Row gap={10}>
            <Field label="Agua" value={g.waterMl} onChangeText={v => setG(s => ({ ...s, waterMl: v }))} keyboardType="number-pad" suffix="ml" />
            <Field label="Fibra" value={g.fiber} onChangeText={v => setG(s => ({ ...s, fiber: v }))} keyboardType="number-pad" suffix="g" />
          </Row>
          <T v="small" muted num>Las macros suman {Math.round(sum).toLocaleString('es-MX')} kcal (P {Math.round(numVal(g.p) * 4)} · G {Math.round(numVal(g.f) * 9)} · C {Math.round(numVal(g.c) * 4)}).</T>
          {Math.abs(sum - numVal(g.kcal)) > 50 && (
            <Button small kind="ghost" title="Ajustar carbohidratos para que cuadre" onPress={() => setG(s => ({ ...s, c: String(Math.max(0, Math.round((numVal(s.kcal) - numVal(s.p) * 4 - numVal(s.f) * 9) / 4))) }))} />
          )}
          <Row gap={8}>
            <Button kind="soft" icon="calculator" title="Calcular por mi perfil" style={{ flex: 1 }} onPress={auto} />
            <Button kind="soft" title="2300/125/65/304" style={{ flex: 1 }} onPress={() => setG(s => ({ ...s, kcal: '2300', p: '125', f: '65', c: '304' }))} />
          </Row>
          <Button icon="checkmark" title="Guardar metas" onPress={saveGoals} />
        </Card>
      </Section>
      <T v="tiny" muted center>Tip: ajusta las calorías ±100–200 cada 2–3 semanas según tu tendencia de peso.</T>
    </Screen>
  );
}
