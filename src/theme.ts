import { useColorScheme } from 'react-native';

const shared = {
  radius: 16,
  radiusSm: 10,
  gap: 12,
};

export const dark = {
  ...shared,
  dark: true,
  bg: '#0B0D10',
  surface: '#151A20',
  surface2: '#1C222A',
  ink: '#EEF1F5',
  muted: '#8E98A6',
  line: '#262D36',
  kcal: '#FF7A2E',
  prot: '#F06595',
  fat: '#F2C14E',
  carb: '#3CC8B2',
  water: '#5B9CFF',
  train: '#9B7BFF',
  ok: '#51CF66',
  warn: '#FF922B',
  danger: '#FF6B6B',
  onAccent: '#FFFFFF',
};

export const light: typeof dark = {
  ...shared,
  dark: false,
  bg: '#EEF1F4',
  surface: '#FFFFFF',
  surface2: '#F3F5F8',
  ink: '#12161C',
  muted: '#5D6673',
  line: '#DDE2E8',
  kcal: '#E8590C',
  prot: '#D6336C',
  fat: '#C98F00',
  carb: '#16907F',
  water: '#2F74E0',
  train: '#6F4BE0',
  ok: '#2B8A3E',
  warn: '#C2410C',
  danger: '#E03131',
  onAccent: '#FFFFFF',
};

export type Theme = typeof dark;

export function useTheme(): Theme {
  return useColorScheme() === 'light' ? light : dark;
}

export const font = {
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
  tiny: { fontSize: 11 },
  num: { fontVariant: ['tabular-nums' as const] },
};
