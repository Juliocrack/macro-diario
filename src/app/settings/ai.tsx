import { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { getSetting, setSetting, DEFAULT_AI, type AiSettings } from '@/db';
import { GEMINI_MODELS, getApiKey, setApiKey, testConnection } from '@/lib/ai';
import { useTheme } from '@/theme';
import { Button, Card, Field, Icon, Row, Screen, Section, T } from '@/components/ui';

export default function AiSettingsScreen() {
  const t = useTheme();
  const [key, setKey] = useState('');
  const [has, setHas] = useState(false);
  const [model, setModel] = useState(DEFAULT_AI.model);
  const [custom, setCustom] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    getApiKey().then(k => setHas(!!k));
    getSetting<AiSettings>('ai', DEFAULT_AI).then(s => {
      setModel(s.model);
      if (!GEMINI_MODELS.some(m => m.id === s.model)) setCustom(s.model);
    });
  }, []);

  const saveKey = async () => {
    if (!key.trim()) return;
    await setApiKey(key.trim());
    setKey('');
    setHas(true);
    test();
  };
  const pick = async (id: string) => {
    setModel(id);
    await setSetting('ai', { model: id });
  };
  const test = async () => {
    setTesting(true);
    try {
      await testConnection();
      Alert.alert('¡Listo!', 'La conexión con Gemini funciona.');
    } catch (e: any) {
      Alert.alert('No funcionó', e?.message ?? 'Revisa la API key y el modelo.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Screen>
      <Card style={{ backgroundColor: t.kcal + '18' }}>
        <T bold>¿Para qué se usa?</T>
        <T v="small" muted>Analizar fotos de platillos, leer etiquetas, describir comidas, sugerir qué comer, crear recetas y rutinas, y el Coach. Las fotos se envían a Google solo cuando tú pides un análisis.</T>
      </Card>

      <Section title="API key de Gemini">
        <Card>
          <Row>
            <Icon name={has ? 'checkmark-circle' : 'alert-circle'} color={has ? t.ok : t.warn} />
            <T style={{ flex: 1 }}>{has ? 'API key guardada de forma cifrada en el teléfono' : 'Aún no tienes una API key'}</T>
          </Row>
          <T v="small" muted>1. Entra a aistudio.google.com/apikey con tu cuenta de Google.{'\n'}2. Toca “Create API key” y cópiala.{'\n'}3. Pégala aquí. La capa gratuita alcanza para uso personal.</T>
          <Button kind="soft" small icon="open-outline" title="Abrir Google AI Studio" onPress={() => Linking.openURL('https://aistudio.google.com/apikey')} />
          <Field value={key} onChangeText={setKey} placeholder="AIza…" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <Row gap={8}>
            <Button title="Guardar key" icon="key" style={{ flex: 1 }} onPress={saveKey} disabled={!key.trim()} />
            {has && <Button kind="danger" title="Borrar" style={{ flex: 0.6 }} onPress={async () => { await setApiKey(''); setHas(false); }} />}
          </Row>
        </Card>
      </Section>

      <Section title="Modelo">
        <Card>
          {GEMINI_MODELS.map(m => (
            <Button key={m.id} kind={model === m.id ? 'primary' : 'soft'} title={m.label} onPress={() => pick(m.id)} style={{ justifyContent: 'flex-start' }} />
          ))}
          <Row gap={8} style={{ alignItems: 'flex-end' }}>
            <Field label="Otro modelo (código exacto)" value={custom} onChangeText={setCustom} autoCapitalize="none" placeholder="gemini-…" />
            <Button small kind="soft" title="Usar" onPress={() => custom.trim() && pick(custom.trim())} />
          </Row>
          <T v="tiny" muted>Si Google retira un modelo, elige otro de la lista o escribe el código que aparezca en AI Studio.</T>
        </Card>
      </Section>
      <Button kind="ghost" icon="pulse" title="Probar conexión" onPress={test} loading={testing} disabled={!has} />
    </Screen>
  );
}
