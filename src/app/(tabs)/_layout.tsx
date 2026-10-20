import { Tabs } from 'expo-router/js-tabs';
import { Icon } from '@/components/ui';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.ink,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', fontSize: 22 },
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line },
        tabBarActiveTintColor: t.kcal,
        tabBarInactiveTintColor: t.muted,
        tabBarLabelStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoy', headerShown: false, tabBarIcon: ({ color, size }) => <Icon name="restaurant" color={color as string} size={size} /> }} />
      <Tabs.Screen name="train" options={{ title: 'Entreno', tabBarIcon: ({ color, size }) => <Icon name="barbell" color={color as string} size={size} /> }} />
      <Tabs.Screen name="progress" options={{ title: 'Progreso', tabBarIcon: ({ color, size }) => <Icon name="trending-up" color={color as string} size={size} /> }} />
      <Tabs.Screen name="more" options={{ title: 'Más', tabBarIcon: ({ color, size }) => <Icon name="grid" color={color as string} size={size} /> }} />
    </Tabs>
  );
}
