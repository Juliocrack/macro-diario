import { useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { addPhoto, deletePhoto, latestWeight, listPhotos, useQuery, type ProgressPhoto } from '@/db';
import { deleteImage, persistImage, pickImage } from '@/lib/device';
import { shortDate, today } from '@/lib/dates';
import { useTheme } from '@/theme';
import { Button, Card, Empty, Row, Screen, Seg, T } from '@/components/ui';

const POSES = [{ key: 'frente', label: 'Frente' }, { key: 'lado', label: 'Lado' }, { key: 'espalda', label: 'Espalda' }];

export default function Photos() {
  const t = useTheme();
  const [photos] = useQuery(listPhotos, [], [] as ProgressPhoto[]);
  const [w] = useQuery(latestWeight, [], null);
  const [pose, setPose] = useState('frente');
  const [compare, setCompare] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const add = async (from: 'camera' | 'library') => {
    try {
      const img = await pickImage(from, { edit: true });
      if (!img) return;
      setBusy(true);
      const uri = await persistImage(img.uri, 'progress');
      await addPhoto({ date: today(), uri, pose, weight: w?.kg ?? null });
    } catch (e: any) {
      Alert.alert('No se pudo guardar', e?.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: number) => setCompare(c => (c.includes(id) ? c.filter(x => x !== id) : [...c.slice(-1), id]));
  const filtered = photos.filter(p => (p.pose ?? 'frente') === pose);
  const pair = compare.map(id => photos.find(p => p.id === id)).filter(Boolean) as ProgressPhoto[];
  const sorted = [...pair].sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <Screen>
      <Seg options={POSES} value={pose} onChange={p => { setPose(p); setCompare([]); }} />
      <Row gap={8}>
        <Button icon="camera" title="Tomar foto" style={{ flex: 1 }} onPress={() => add('camera')} loading={busy} />
        <Button kind="soft" icon="images" title="Galería" style={{ flex: 1 }} onPress={() => add('library')} disabled={busy} />
      </Row>
      <T v="tiny" muted>Tus fotos se guardan solo en este teléfono. Toca dos fotos para compararlas lado a lado; mantén presionada para borrar.</T>

      {sorted.length === 2 && (
        <Card>
          <T v="h3">Comparación</T>
          <Row gap={8} style={{ alignItems: 'flex-start' }}>
            {sorted.map(p => (
              <View key={p.id} style={{ flex: 1, gap: 4 }}>
                <Image source={{ uri: p.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }} />
                <T v="small" bold center>{shortDate(p.date)}</T>
                {p.weight ? <T v="tiny" muted center>{p.weight} kg</T> : null}
              </View>
            ))}
          </Row>
          {sorted[0].weight && sorted[1].weight ? (
            <T center bold num>
              {sorted[1].weight - sorted[0].weight > 0 ? '+' : ''}{Math.round((sorted[1].weight - sorted[0].weight) * 10) / 10} kg en {Math.round((new Date(sorted[1].date).getTime() - new Date(sorted[0].date).getTime()) / 86400000)} días
            </T>
          ) : null}
        </Card>
      )}

      {filtered.length === 0 ? (
        <Empty icon="body-outline" title="Sin fotos de esta pose" text="Usa la misma luz, distancia y ropa en cada foto." />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {filtered.map(p => {
            const on = compare.includes(p.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => toggle(p.id)}
                onLongPress={() => Alert.alert('Borrar foto', '¿Borrar esta foto de progreso?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Borrar', style: 'destructive', onPress: async () => { deleteImage(p.uri); await deletePhoto(p.id); } }])}
                style={{ width: '31.5%' }}
              >
                <Image source={{ uri: p.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 10, borderWidth: on ? 3 : 0, borderColor: t.kcal }} />
                <T v="tiny" muted center>{shortDate(p.date)}{p.weight ? ` · ${p.weight} kg` : ''}</T>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
