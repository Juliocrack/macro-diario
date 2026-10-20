import { useState } from 'react';
import { Image, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { listRecipes, recipeTotals, useQuery, type Recipe } from '@/db';
import { useTheme } from '@/theme';
import { Button, Card, Icon, MacroLine, Row, Screen, T } from '@/components/ui';

export default function Recipes() {
  const t = useTheme();
  const [list] = useQuery(listRecipes, [], [] as Recipe[]);
  const [q, setQ] = useState('');
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const shown = list.filter(r => !q || norm(r.name + ' ' + (r.tags ?? '')).includes(norm(q)));

  return (
    <Screen>
      <Row gap={8}>
        <Button icon="add" title="Nueva receta" style={{ flex: 1 }} onPress={() => router.push('/recipes/edit')} />
        <Button icon="sparkles" kind="soft" title="Con IA" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/recipes/edit', params: { ai: '1' } })} />
      </Row>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: t.line }}>
        <Icon name="search" size={18} color={t.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar: desayuno, pollo, alta en proteína…" placeholderTextColor={t.muted} style={{ flex: 1, color: t.ink, fontSize: 16, paddingVertical: 12, paddingHorizontal: 8 }} />
      </View>
      {shown.map(r => {
        const tt = recipeTotals(r.items);
        const s = r.servings || 1;
        return (
          <Card key={r.id} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: r.id } })} style={{ flexDirection: 'row', gap: 12 }}>
            {r.photo_uri ? <Image source={{ uri: r.photo_uri }} style={{ width: 64, height: 64, borderRadius: 12 }} /> : (
              <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: t.carb + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="restaurant" color={t.carb} />
              </View>
            )}
            <View style={{ flex: 1, gap: 3 }}>
              <Row gap={6}>
                <T bold style={{ flex: 1 }} numberOfLines={2}>{r.name}</T>
                {r.favorite ? <Icon name="heart" size={16} color={t.prot} /> : null}
              </Row>
              {r.tags ? <T v="tiny" muted numberOfLines={1}>{r.tags}{r.minutes ? ` · ${r.minutes} min` : ''}</T> : null}
              <Row>
                <T v="small" bold num color={t.kcal}>{Math.round(tt.kcal / s)} kcal</T>
                <MacroLine p={tt.p / s} f={tt.f / s} c={tt.c / s} small />
              </Row>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
