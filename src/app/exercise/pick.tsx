import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { addExercise, listExercises, useQuery, type Exercise } from '@/db';
import { MUSCLES } from '@/data/exercises';
import { deliverExercises } from '@/lib/picker';
import { useTheme } from '@/theme';
import { Button, Card, Field, Icon, ListItem, Row, Screen, Seg, T } from '@/components/ui';

const TYPES = [
  { key: 'w' as const, label: 'Peso × reps' },
  { key: 'b' as const, label: 'Peso corporal' },
  { key: 't' as const, label: 'Tiempo' },
  { key: 'c' as const, label: 'Cardio' },
];

export default function PickExercise() {
  const t = useTheme();
  const { mode } = useLocalSearchParams<{ mode?: 'multi' | 'single' | 'browse' }>();
  const browse = mode === 'browse';
  const [all] = useQuery(listExercises, [], [] as Exercise[]);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string>('Todos');
  const [sel, setSel] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [nw, setNw] = useState({ name: '', muscle: 'Pecho', equipment: '', type: 'w' as Exercise['type'] });

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = all.filter(e => (muscle === 'Todos' || e.muscle === muscle) && (!q || norm(e.name).includes(norm(q))));

  const toggle = (e: Exercise) => {
    if (browse) return router.push({ pathname: '/exercise/[id]', params: { id: e.id } });
    if (mode === 'single') {
      deliverExercises([e]);
      router.back();
      return;
    }
    setSel(s => (s.includes(e.id) ? s.filter(x => x !== e.id) : [...s, e.id]));
  };
  const done = () => {
    deliverExercises(sel.map(id => all.find(e => e.id === id)!).filter(Boolean));
    router.back();
  };
  const create = async () => {
    if (!nw.name.trim()) return Alert.alert('Falta el nombre');
    const id = await addExercise({ name: nw.name.trim(), muscle: nw.muscle, equipment: nw.equipment || null, type: nw.type, notes: null });
    setCreating(false);
    setNw({ name: '', muscle: 'Pecho', equipment: '', type: 'w' });
    if (!browse) setSel(s => [...s, id]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: t.line }}>
          <Icon name="search" size={18} color={t.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar ejercicio" placeholderTextColor={t.muted} style={{ flex: 1, color: t.ink, fontSize: 16, paddingVertical: 12, paddingHorizontal: 8 }} />
        </View>
        <Seg options={['Todos', ...MUSCLES].map(m => ({ key: m, label: m }))} value={muscle} onChange={setMuscle} scroll />
        {creating ? (
          <Card>
            <T v="h3">Nuevo ejercicio</T>
            <Field label="Nombre" value={nw.name} onChangeText={v => setNw(s => ({ ...s, name: v }))} />
            <Field label="Equipo" value={nw.equipment} onChangeText={v => setNw(s => ({ ...s, equipment: v }))} placeholder="Barra, mancuernas, máquina…" />
            <T v="small" muted>Músculo</T>
            <Seg options={MUSCLES.map(m => ({ key: m, label: m }))} value={nw.muscle} onChange={m => setNw(s => ({ ...s, muscle: m }))} scroll />
            <T v="small" muted>Tipo de registro</T>
            <Seg options={TYPES} value={nw.type} onChange={ty => setNw(s => ({ ...s, type: ty }))} />
            <Row gap={8}>
              <Button kind="soft" title="Cancelar" style={{ flex: 1 }} onPress={() => setCreating(false)} />
              <Button title="Crear" style={{ flex: 1 }} onPress={create} />
            </Row>
          </Card>
        ) : (
          <Button kind="ghost" small icon="add" title="Crear ejercicio propio" onPress={() => setCreating(true)} />
        )}
        <Card padded={false} style={{ gap: 0 }}>
          {list.map((e, i) => {
            const on = sel.includes(e.id);
            return (
              <ListItem
                key={e.id}
                title={e.name}
                subtitle={`${e.muscle}${e.equipment ? ` · ${e.equipment}` : ''}`}
                onPress={() => toggle(e)}
                right={browse ? <Icon name="chevron-forward" size={16} color={t.muted} /> : <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} color={on ? t.train : t.muted} />}
                last={i === list.length - 1}
              />
            );
          })}
        </Card>
      </Screen>
      {!browse && mode !== 'single' && sel.length > 0 && (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24 }}>
          <Button title={`Agregar ${sel.length} ${sel.length === 1 ? 'ejercicio' : 'ejercicios'}`} color={t.train} icon="checkmark" onPress={done} />
        </View>
      )}
    </View>
  );
}
