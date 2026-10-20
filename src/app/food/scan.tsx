import { useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getFoodByBarcode, insertFood } from '@/db';
import { lookupBarcode } from '@/lib/off';
import { useTheme } from '@/theme';
import { Button, Empty, IconBtn, Loading, Row, Screen, T } from '@/components/ui';

export default function Scan() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const p = useLocalSearchParams<{ date?: string; meal?: string }>();
  const [perm, request] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState('');
  const lock = useRef(false);

  const open = (id: number) => router.replace({ pathname: '/food/[id]', params: { id, date: p.date ?? '', meal: p.meal ?? '' } });

  const handle = async (code: string) => {
    if (lock.current) return;
    lock.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setBusy(true);
    try {
      const local = await getFoodByBarcode(code);
      if (local) return open(local.id);
      const prod = await lookupBarcode(code);
      if (prod) {
        const id = await insertFood({ name: prod.name, brand: prod.brand || null, category: 'Empaquetados', kcal: prod.kcal, p: prod.p, f: prod.f, c: prod.c, fiber: prod.fiber, sugar: prod.sugar, sodium: prod.sodium, serving_name: prod.serving_name, serving_g: prod.serving_g, source: 'off', barcode: code });
        return open(id);
      }
      Alert.alert('Producto no encontrado', `El código ${code} no está en la base abierta. Puedes darlo de alta tomando foto a su etiqueta.`, [
        { text: 'Escanear otro', onPress: () => { lock.current = false; } },
        { text: 'Dar de alta', onPress: () => router.replace({ pathname: '/food/new', params: { barcode: code, date: p.date ?? '', meal: p.meal ?? '' } }) },
      ]);
    } catch (e: any) {
      Alert.alert('Sin conexión', e?.message ?? 'No se pudo consultar el producto.', [{ text: 'OK', onPress: () => { lock.current = false; } }]);
    } finally {
      setBusy(false);
    }
  };

  if (!perm) return <Loading />;
  if (!perm.granted)
    return (
      <Screen contentStyle={{ paddingTop: insets.top + 40 }}>
        <Empty icon="barcode" title="Necesito la cámara" text="Para escanear el código de barras de tus productos.">
          <Button title="Permitir cámara" onPress={request} />
          <Button kind="ghost" title="Cerrar" onPress={() => router.back()} />
        </Empty>
      </Screen>
    );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
        onBarcodeScanned={busy ? undefined : r => handle(r.data)}
      />
      <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16 }}>
        <Row>
          <IconBtn name="close" color="#fff" bg="#0008" onPress={() => router.back()} label="Cerrar" />
          <View style={{ flex: 1 }} />
          <IconBtn name={torch ? 'flash' : 'flash-off'} color="#fff" bg="#0008" onPress={() => setTorch(v => !v)} label="Linterna" />
        </Row>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', top: '32%', left: '10%', right: '10%', height: 160, borderRadius: 18, borderWidth: 3, borderColor: t.kcal }} />
      <View style={{ position: 'absolute', bottom: insets.bottom + 20, left: 16, right: 16, gap: 10 }}>
        {busy ? <Loading text="Buscando producto…" /> : <T center color="#fff" bold>Apunta al código de barras</T>}
        <Row gap={8}>
          <TextInput
            value={manual}
            onChangeText={setManual}
            placeholder="O escribe el código"
            placeholderTextColor="#bbb"
            keyboardType="number-pad"
            style={{ flex: 1, color: '#fff', backgroundColor: '#0009', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 }}
          />
          <Button title="Buscar" small onPress={() => manual.trim() && handle(manual.trim())} />
        </Row>
      </View>
    </View>
  );
}
