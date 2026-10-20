import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Card, Icon, ListItem, Screen, Section, T, type IconName } from '@/components/ui';

type Item = { icon: IconName; title: string; sub: string; href: string; color?: string };

export default function More() {
  const t = useTheme();
  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Nutrición',
      items: [
        { icon: 'book', title: 'Recetas', sub: 'Recetas fit con macros por porción y creador con IA', href: '/recipes', color: t.carb },
        { icon: 'timer', title: 'Ayuno intermitente', sub: '16:8, 18:6, OMAD y personalizado', href: '/fasting', color: t.train },
        { icon: 'chatbubble-ellipses', title: 'Coach IA', sub: 'Pregunta sobre dieta, entreno o tu progreso', href: '/coach', color: t.kcal },
      ],
    },
    {
      title: 'Herramientas',
      items: [
        { icon: 'calculator', title: 'Calculadoras', sub: 'IMC, TMB, TDEE, % grasa, 1RM, FFMI, peso ideal y más', href: '/calc', color: t.water },
        { icon: 'person-circle', title: 'Perfil y metas', sub: 'Tus datos y objetivos diarios de calorías y macros', href: '/goals', color: t.prot },
      ],
    },
    {
      title: 'Ajustes',
      items: [
        { icon: 'sparkles', title: 'Inteligencia artificial', sub: 'API key de Gemini y modelo', href: '/settings/ai' },
        { icon: 'notifications', title: 'Recordatorios', sub: 'Comidas, agua, pesaje y entreno', href: '/settings/reminders' },
        { icon: 'cloud-download', title: 'Respaldo y datos', sub: 'Exportar, importar y restaurar', href: '/settings/data' },
      ],
    },
  ];
  return (
    <Screen>
      {groups.map(g => (
        <Section key={g.title} title={g.title}>
          <Card padded={false} style={{ gap: 0 }}>
            {g.items.map((it, i) => (
              <ListItem
                key={it.href}
                title={it.title}
                subtitle={it.sub}
                left={<Icon name={it.icon} color={it.color ?? t.ink} />}
                right={<Icon name="chevron-forward" size={16} color={t.muted} />}
                onPress={() => router.push(it.href as any)}
                last={i === g.items.length - 1}
              />
            ))}
          </Card>
        </Section>
      ))}
      <T v="tiny" muted center>Macro Diario 1.0 · Tus datos viven en este teléfono.</T>
    </Screen>
  );
}
