import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { getSetting, setSetting, DEFAULT_REMINDERS, type Reminders } from '@/db';
import { applyReminders } from '@/lib/device';
import { Button, Card, Field, Row, Screen, T, Toggle } from '@/components/ui';

const valid = (s: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(s.trim());

export default function RemindersScreen() {
  const [r, setR] = useState<Reminders | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    getSetting<Reminders>('reminders', DEFAULT_REMINDERS).then(setR);
  }, []);
  if (!r) return null;
  const upd = (p: Partial<Reminders>) => setR(s => ({ ...(s as Reminders), ...p }));

  const save = async () => {
    const times = [...r.mealTimes, r.waterFrom, r.waterTo, r.weighTime, r.workoutTime];
    if (!times.every(valid)) return Alert.alert('Hora inválida', 'Usa el formato 24 h, por ejemplo 08:30 o 20:15.');
    setSaving(true);
    try {
      await setSetting('reminders', r);
      const ok = await applyReminders(r);
      Alert.alert(ok ? 'Recordatorios guardados' : 'Permiso denegado', ok ? 'Te avisaremos a las horas elegidas.' : 'Activa las notificaciones de Macro Diario en los ajustes del teléfono.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Toggle label="Registrar comidas" hint="Desayuno, comida y cena" value={r.meals} onChange={meals => upd({ meals })} />
        {r.meals && (
          <Row gap={8}>
            {r.mealTimes.map((tm, i) => (
              <Field key={i} label={['Desayuno', 'Comida', 'Cena'][i]} value={tm} onChangeText={v => upd({ mealTimes: r.mealTimes.map((x, j) => (j === i ? v : x)) })} keyboardType="numbers-and-punctuation" />
            ))}
          </Row>
        )}
      </Card>
      <Card>
        <Toggle label="Tomar agua" value={r.water} onChange={water => upd({ water })} />
        {r.water && (
          <Row gap={8}>
            <Field label="Desde" value={r.waterFrom} onChangeText={waterFrom => upd({ waterFrom })} keyboardType="numbers-and-punctuation" />
            <Field label="Hasta" value={r.waterTo} onChangeText={waterTo => upd({ waterTo })} keyboardType="numbers-and-punctuation" />
            <Field label="Cada (h)" value={String(r.waterEvery)} onChangeText={v => upd({ waterEvery: Math.max(1, parseInt(v, 10) || 1) })} keyboardType="number-pad" />
          </Row>
        )}
      </Card>
      <Card>
        <Toggle label="Pesarme" hint="Mejor en ayunas" value={r.weigh} onChange={weigh => upd({ weigh })} />
        {r.weigh && <Field label="Hora" value={r.weighTime} onChangeText={weighTime => upd({ weighTime })} keyboardType="numbers-and-punctuation" />}
      </Card>
      <Card>
        <Toggle label="Entrenar" value={r.workout} onChange={workout => upd({ workout })} />
        {r.workout && <Field label="Hora" value={r.workoutTime} onChangeText={workoutTime => upd({ workoutTime })} keyboardType="numbers-and-punctuation" />}
      </Card>
      <Button title="Guardar recordatorios" icon="notifications" onPress={save} loading={saving} />
      <T v="tiny" muted center>El aviso de fin de descanso entre series y el de fin de ayuno se programan automáticamente.</T>
    </Screen>
  );
}
