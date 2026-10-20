import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dailyTotals, entriesFor, getGoals, getProfile, latestWeight, listWeights, listWorkouts } from '@/db';
import { coachChat, AiError } from '@/lib/ai';
import { addDays, ageFrom, today } from '@/lib/dates';
import { useTheme } from '@/theme';
import { Button, Icon, IconBtn, Loading, T, tap } from '@/components/ui';

type Msg = { role: 'user' | 'model'; text: string };

const STARTERS = [
  '¿Cómo voy esta semana con mis macros?',
  'Dame ideas de desayunos altos en proteína',
  '¿Cuánto debería subir de peso en mis ejercicios?',
  'No estoy bajando de peso, ¿qué ajusto?',
];

async function buildContext() {
  const [p, g, w, ws, todayE, week, wk] = await Promise.all([
    getProfile(), getGoals(), latestWeight(), listWeights(), entriesFor(today()), dailyTotals(addDays(today(), -6), today()), listWorkouts(10),
  ]);
  const tot = todayE.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, f: a.f + e.f, c: a.c + e.c }), { kcal: 0, p: 0, f: 0, c: 0 });
  const prev = ws.filter(x => x.date <= addDays(today(), -14)).pop();
  const avg = week.length ? week.reduce((a, d) => ({ kcal: a.kcal + d.kcal / week.length, p: a.p + d.p / week.length }), { kcal: 0, p: 0 }) : null;
  return [
    `Perfil: ${p.sex === 'h' ? 'hombre' : 'mujer'}, ${ageFrom(p.birthYear)} años, ${p.heightCm} cm, actividad ${p.activity}, objetivo ${p.goal}${p.targetKg ? `, peso meta ${p.targetKg} kg` : ''}.`,
    `Metas diarias: ${g.kcal} kcal, ${g.p} g proteína, ${g.f} g grasa, ${g.c} g carbohidratos.`,
    w ? `Peso actual: ${w.kg} kg (${w.date})${prev ? `; hace 2+ semanas: ${prev.kg} kg (${prev.date})` : ''}.` : 'Sin peso registrado.',
    `Hoy lleva: ${Math.round(tot.kcal)} kcal, ${Math.round(tot.p)} P, ${Math.round(tot.f)} G, ${Math.round(tot.c)} C. Alimentos: ${todayE.map(e => e.name).slice(0, 15).join(', ') || 'ninguno'}.`,
    avg ? `Promedio últimos 7 días registrados (${week.length} días): ${Math.round(avg.kcal)} kcal, ${Math.round(avg.p)} g proteína.` : 'Sin registros esta semana.',
    `Entrenamientos recientes: ${wk.map(x => `${x.name} (${new Date(x.started_at).toLocaleDateString('es-MX')}, ${Math.round(x.volume)} kg vol)`).join('; ') || 'ninguno'}.`,
  ].join('\n');
}

export default function Coach() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const ctx = useRef<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    const history = msgs;
    setMsgs(m => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      if (!ctx.current) ctx.current = await buildContext();
      // La primera vuelta lleva el contexto; las siguientes envían el historial completo
      const firstUser = history.length ? [{ role: 'user' as const, text: `[contexto]\n${ctx.current}\n\n${history[0].text}` }, ...history.slice(1)] : [];
      const answer = await coachChat(ctx.current, firstUser, q);
      setMsgs(m => [...m, { role: 'model', text: answer.trim() }]);
    } catch (e: any) {
      setMsgs(m => [...m, { role: 'model', text: e instanceof AiError ? e.message : 'No pude responder. Intenta de nuevo.' }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {msgs.length === 0 && (
          <View style={{ gap: 10, paddingTop: 10 }}>
            <Icon name="chatbubble-ellipses" size={40} color={t.kcal} style={{ alignSelf: 'center' }} />
            <T v="h3" center>Tu coach de nutrición y entrenamiento</T>
            <T v="small" muted center>Conoce tus metas, lo que comiste hoy, tu peso y tus entrenamientos.</T>
            {STARTERS.map(s => (
              <Pressable key={s} onPress={() => { tap(); send(s); }} style={{ padding: 12, borderRadius: 14, backgroundColor: t.surface }}>
                <T>{s}</T>
              </Pressable>
            ))}
            <Button kind="ghost" small title="Configurar IA" icon="settings-outline" onPress={() => router.push('/settings/ai')} />
          </View>
        )}
        {msgs.map((m, i) => (
          <View key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: m.role === 'user' ? t.kcal : t.surface, padding: 12, borderRadius: 16, borderBottomRightRadius: m.role === 'user' ? 4 : 16, borderBottomLeftRadius: m.role === 'user' ? 16 : 4 }}>
            <T color={m.role === 'user' ? '#fff' : t.ink} selectable style={{ lineHeight: 21 }}>{m.text.replace(/\*\*(.+?)\*\*/g, '$1')}</T>
          </View>
        ))}
        {busy && <Loading />}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, padding: 10, paddingBottom: 10 + insets.bottom, borderTopWidth: 1, borderTopColor: t.line, backgroundColor: t.bg, alignItems: 'flex-end' }}>
        <TextInput value={input} onChangeText={setInput} placeholder="Escribe tu pregunta…" placeholderTextColor={t.muted} multiline style={{ flex: 1, maxHeight: 120, color: t.ink, backgroundColor: t.surface, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 }} />
        <IconBtn name="send" color="#fff" bg={t.kcal} onPress={() => send(input)} label="Enviar" />
      </View>
    </KeyboardAvoidingView>
  );
}
