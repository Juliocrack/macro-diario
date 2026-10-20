import { useState } from 'react';
import { Alert } from 'react-native';
import { db, bump } from '@/db';
import { restoreBackup, shareBackup } from '@/lib/device';
import { Button, Card, Screen, T } from '@/components/ui';

export default function DataScreen() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (k: string, fn: () => Promise<void>) => {
    setBusy(k);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert('Algo falló', e?.message ?? 'Intenta de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Card>
        <T bold>Respaldo completo</T>
        <T v="small" muted>Genera un archivo .json con todo: diario, alimentos, recetas, rutinas, entrenamientos, peso, medidas y ajustes. Guárdalo en Drive o mándatelo por WhatsApp. Las fotos no se incluyen.</T>
        <Button icon="share-outline" title="Crear y compartir respaldo" loading={busy === 'exp'} onPress={() => run('exp', shareBackup)} />
      </Card>
      <Card>
        <T bold>Restaurar</T>
        <T v="small" muted>Reemplaza todos los datos actuales por los del respaldo elegido.</T>
        <Button kind="soft" icon="cloud-download-outline" title="Restaurar desde archivo" loading={busy === 'imp'} onPress={() => Alert.alert('Restaurar respaldo', 'Se reemplazarán todos tus datos actuales. ¿Continuar?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Restaurar', style: 'destructive', onPress: () => run('imp', async () => { if (await restoreBackup()) Alert.alert('Listo', 'Datos restaurados.'); }) },
        ])} />
      </Card>
      <Card>
        <T bold>Borrar historial de comidas</T>
        <T v="small" muted>Elimina todos los registros del diario y del agua. Conserva alimentos, recetas, rutinas y progreso.</T>
        <Button kind="danger" title="Borrar diario" onPress={() => Alert.alert('Borrar diario', 'Esta acción no se puede deshacer.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Borrar', style: 'destructive', onPress: () => run('del', async () => { await db().execAsync('DELETE FROM log_entries; DELETE FROM water;'); bump(); }) },
        ])} />
      </Card>
    </Screen>
  );
}
