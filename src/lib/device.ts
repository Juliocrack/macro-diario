import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { exportAll, importAll, type Reminders } from '@/db';

// ---------- Fotos ----------
export type Picked = { uri: string; base64: string | null; mime: string };

/** Abre cámara o galería. Devuelve null si el usuario cancela o niega el permiso. */
export async function pickImage(from: 'camera' | 'library', opts: { base64?: boolean; edit?: boolean } = {}): Promise<Picked | null> {
  const perm = from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(from === 'camera' ? 'Permite el acceso a la cámara en los ajustes del teléfono.' : 'Permite el acceso a tus fotos en los ajustes del teléfono.');
  const o: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 0.5, base64: !!opts.base64, allowsEditing: !!opts.edit, aspect: opts.edit ? [3, 4] : undefined };
  const r = from === 'camera' ? await ImagePicker.launchCameraAsync(o) : await ImagePicker.launchImageLibraryAsync(o);
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  return { uri: a.uri, base64: a.base64 ?? null, mime: a.mimeType ?? 'image/jpeg' };
}

/** Copia una imagen temporal a la carpeta permanente de la app. */
export async function persistImage(uri: string, folder: 'progress' | 'meals' | 'recipes') {
  const dir = new Directory(Paths.document, folder);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`);
  await new File(uri).copy(dest);
  return dest.uri;
}
export function deleteImage(uri: string | null) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {}
}

// ---------- Respaldo ----------
export async function shareBackup() {
  const data = await exportAll();
  const f = new File(Paths.cache, `macro-diario-${new Date().toISOString().slice(0, 10)}.json`);
  if (f.exists) f.delete();
  f.create();
  await f.write(JSON.stringify(data));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Compartir no está disponible en este dispositivo.');
  await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'Guardar respaldo' });
}
export async function restoreBackup() {
  const r = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.length) return false;
  const text = await new File(r.assets[0].uri).text();
  await importAll(JSON.parse(text));
  return true;
}

export async function shareCsv(name: string, rows: (string | number | null)[][]) {
  const csv = rows.map(r => r.map(v => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(',')).join('\n');
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  await f.write('﻿' + csv);
  await Sharing.shareAsync(f.uri, { mimeType: 'text/csv', dialogTitle: 'Exportar' });
}

// ---------- Notificaciones ----------
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function ensurePermission() {
  if (Platform.OS === 'android') {
    /* eslint-disable import/namespace -- AndroidImportance sí se exporta (re-export de tipos) */
    await Notifications.setNotificationChannelAsync('default', { name: 'Recordatorios', importance: Notifications.AndroidImportance.HIGH });
    await Notifications.setNotificationChannelAsync('rest', { name: 'Descanso entre series', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 400, 200, 400] });
    /* eslint-enable import/namespace */
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

const hhmm = (s: string) => {
  const [h, m] = s.split(':').map(n => parseInt(n, 10));
  return { hour: Math.min(23, Math.max(0, h || 0)), minute: Math.min(59, Math.max(0, m || 0)) };
};

async function daily(id: string, title: string, body: string, time: string) {
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, ...hhmm(time), channelId: 'default' },
  });
}

/** Reprograma todos los recordatorios diarios según la configuración. */
export async function applyReminders(r: Reminders) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) if (n.identifier.startsWith('rem-')) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  const any = r.meals || r.water || r.weigh || r.workout;
  if (!any) return true;
  if (!(await ensurePermission())) return false;
  const mealNames = ['desayuno', 'comida', 'cena', 'snack'];
  if (r.meals) {
    for (let i = 0; i < r.mealTimes.length; i++) {
      await daily(`rem-meal-${i}`, `Registra tu ${mealNames[i] ?? 'comida'}`, 'Tómale foto al platillo y la IA calcula los macros.', r.mealTimes[i]);
    }
  }
  if (r.water) {
    const from = hhmm(r.waterFrom).hour;
    const to = hhmm(r.waterTo).hour;
    for (let h = from, i = 0; h <= to; h += Math.max(1, r.waterEvery), i++) {
      await daily(`rem-water-${i}`, 'Hora de tomar agua 💧', 'Un vaso de 250 ml te acerca a tu meta.', `${h}:00`);
    }
  }
  if (r.weigh) await daily('rem-weigh', 'Pésate', 'En ayunas y después del baño para comparar mejor.', r.weighTime);
  if (r.workout) await daily('rem-workout', 'Toca entrenar 🏋️', 'Abre tu rutina y registra tus series.', r.workoutTime);
  return true;
}

let restId: string | null = null;
export async function scheduleRestEnd(seconds: number, exercise: string) {
  await cancelRestEnd();
  if (seconds < 5) return;
  if (!(await ensurePermission())) return;
  restId = await Notifications.scheduleNotificationAsync({
    content: { title: 'Descanso terminado', body: `Siguiente serie: ${exercise}` },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: 'rest' },
  });
}
export async function cancelRestEnd() {
  if (restId) {
    await Notifications.cancelScheduledNotificationAsync(restId).catch(() => {});
    restId = null;
  }
}
export async function scheduleFastEnd(atMs: number) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) if (n.identifier === 'fast-end') await Notifications.cancelScheduledNotificationAsync(n.identifier);
  if (atMs <= Date.now()) return;
  if (!(await ensurePermission())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: 'fast-end',
    content: { title: '¡Ayuno completado!', body: 'Llegaste a tu meta de ayuno. Ya puedes abrir tu ventana de comida.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: atMs, channelId: 'default' },
  });
}
export async function cancelFastEnd() {
  await Notifications.cancelScheduledNotificationAsync('fast-end').catch(() => {});
}
