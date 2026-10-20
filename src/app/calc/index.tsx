import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Card, Icon, ListItem, Screen } from '@/components/ui';
import { CALCS } from '@/data/calcs';



export default function CalcIndex() {
  const t = useTheme();
  return (
    <Screen>
      <Card padded={false} style={{ gap: 0 }}>
        {CALCS.map((c, i) => (
          <ListItem key={c.key} title={c.title} subtitle={c.sub} left={<Icon name={c.icon} color={t.water} />} right={<Icon name="chevron-forward" size={16} color={t.muted} />} onPress={() => router.push({ pathname: '/calc/[key]', params: { key: c.key } })} last={i === CALCS.length - 1} />
        ))}
      </Card>
    </Screen>
  );
}
