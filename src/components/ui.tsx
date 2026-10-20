import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { font, useTheme } from '@/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, size = 22, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Ionicons name={name} size={size} color={color ?? t.ink} style={style} />;
}

export const tap = () => Haptics.selectionAsync().catch(() => {});

// ---------- Texto ----------
type TVariant = 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'tiny';
export function T({ v = 'body', muted, color, center, bold, num, style, ...p }: TextProps & { v?: TVariant; muted?: boolean; color?: string; center?: boolean; bold?: boolean; num?: boolean }) {
  const t = useTheme();
  return (
    <Text
      {...p}
      style={[
        font[v],
        { color: color ?? (muted ? t.muted : t.ink) },
        center && { textAlign: 'center' },
        bold && { fontWeight: '700' },
        num && font.num,
        style,
      ]}
    />
  );
}

// ---------- Contenedores ----------
export function Screen({ children, scroll = true, padded = true, style, contentStyle, ...p }: ScrollViewProps & { scroll?: boolean; padded?: boolean; contentStyle?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = padded ? { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 + insets.bottom, gap: 12 } : {};
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: t.bg }, pad, style as ViewStyle]}>{children}</View>;
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: t.bg }, style]}
      contentContainerStyle={[pad, contentStyle]}
      keyboardShouldPersistTaps="handled"
      {...p}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean }) {
  const t = useTheme();
  const s: StyleProp<ViewStyle> = [{ backgroundColor: t.surface, borderRadius: t.radius, padding: padded ? 16 : 0, gap: 10, overflow: 'hidden' }, style];
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.75 }]}>
        {children}
      </Pressable>
    );
  return <View style={s}>{children}</View>;
}

export function Row({ children, gap = 10, style, wrap }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}
export const Spacer = () => <View style={{ flex: 1 }} />;

export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Row>
        <T v="h3" style={{ flex: 1 }}>{title}</T>
        {action && (
          <Pressable onPress={onAction} hitSlop={10}>
            <T v="small" color={t.kcal} bold>{action}</T>
          </Pressable>
        )}
      </Row>
      {children}
    </View>
  );
}

// ---------- Botones ----------
type BtnKind = 'primary' | 'ghost' | 'danger' | 'soft';
export function Button({ title, onPress, kind = 'primary', icon, loading, disabled, color, small, style, ...p }: Omit<PressableProps, 'style'> & { title: string; kind?: BtnKind; icon?: IconName; loading?: boolean; color?: string; small?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const accent = color ?? t.kcal;
  const bg = kind === 'primary' ? accent : kind === 'soft' ? t.surface2 : 'transparent';
  const fg = kind === 'primary' ? t.onAccent : kind === 'danger' ? t.danger : kind === 'soft' ? t.ink : accent;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={e => {
        tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: 14,
          paddingVertical: small ? 8 : 13,
          paddingHorizontal: small ? 12 : 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderWidth: kind === 'ghost' ? 1 : 0,
          borderColor: t.line,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
      {...p}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={small ? 16 : 19} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function IconBtn({ name, onPress, color, bg, size = 20, label }: { name: IconName; onPress?: () => void; color?: string; bg?: string; size?: number; label?: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress?.();
      }}
      hitSlop={8}
      style={({ pressed }) => ({ width: size + 18, height: size + 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: bg ?? t.surface2, opacity: pressed ? 0.7 : 1 })}
    >
      <Icon name={name} size={size} color={color ?? t.ink} />
    </Pressable>
  );
}

// ---------- Formularios ----------
export function Field({ label, hint, style, suffix, ...p }: TextInputProps & { label?: string; hint?: string; suffix?: string }) {
  const t = useTheme();
  return (
    <View style={[{ gap: 5, flex: 1, minWidth: 0 }, style as ViewStyle]}>
      {label ? <T v="small" muted>{label}</T> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface2, borderRadius: 12, borderWidth: 1, borderColor: t.line }}>
        <TextInput
          placeholderTextColor={t.muted}
          style={{ flex: 1, minWidth: 0, color: t.ink, fontSize: 16, paddingHorizontal: 12, paddingVertical: 11, minHeight: 46 }}
          {...p}
        />
        {suffix ? <T v="small" muted style={{ paddingRight: 12 }}>{suffix}</T> : null}
      </View>
      {hint ? <T v="tiny" muted>{hint}</T> : null}
    </View>
  );
}
export const numVal = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
export const numOrNull = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function Seg<K extends string>({ options, value, onChange, scroll }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; scroll?: boolean }) {
  const t = useTheme();
  const content = options.map(o => {
    const on = o.key === value;
    return (
      <Pressable
        key={o.key}
        onPress={() => {
          tap();
          onChange(o.key);
        }}
        style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, backgroundColor: on ? t.ink : t.surface, borderWidth: 1, borderColor: on ? t.ink : t.line, flexGrow: scroll ? 0 : 1, alignItems: 'center' }}
      >
        <Text style={{ color: on ? t.bg : t.ink, fontWeight: '600', fontSize: 13 }}>{o.label}</Text>
      </Pressable>
    );
  });
  if (scroll)
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
        {content}
      </ScrollView>
    );
  return <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>{content}</View>;
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onChange(!value);
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}
    >
      <View style={{ flex: 1 }}>
        <T>{label}</T>
        {hint ? <T v="tiny" muted>{hint}</T> : null}
      </View>
      <View style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: value ? t.kcal : t.surface2, padding: 3, borderWidth: 1, borderColor: value ? t.kcal : t.line }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', transform: [{ translateX: value ? 18 : 0 }] }} />
      </View>
    </Pressable>
  );
}

// ---------- Datos ----------
export function Bar({ value, max, color, height = 8 }: { value: number; max: number; color: string; height?: number }) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: t.surface2, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function Ring({ value, max, size = 150, stroke = 13, color, children }: { value: number; max: number; size?: number; stroke?: number; color: string; children?: React.ReactNode }) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.surface2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={C * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 140, backgroundColor: t.surface, borderRadius: t.radius, padding: 14, gap: 2 }}>
      <T v="tiny" muted>{label}</T>
      <T v="h2" num color={color}>{value}</T>
      {sub ? <T v="tiny" muted>{sub}</T> : null}
    </View>
  );
}

export function ListItem({ title, subtitle, right, onPress, onLongPress, left, last }: { title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; onLongPress?: () => void; left?: React.ReactNode; last?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: t.line, backgroundColor: pressed ? t.surface2 : 'transparent' })}
    >
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T numberOfLines={2} style={{ fontWeight: '500' }}>{title}</T>
        {subtitle ? <T v="small" muted numberOfLines={2} num>{subtitle}</T> : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Empty({ icon, title, text, children }: { icon: IconName; title: string; text?: string; children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 24, gap: 8 }}>
      <Icon name={icon} size={36} color={t.muted} />
      <T v="h3" center>{title}</T>
      {text ? <T v="small" muted center>{text}</T> : null}
      {children}
    </View>
  );
}

export function MacroLine({ p, f, c, small }: { p: number; f: number; c: number; small?: boolean }) {
  const t = useTheme();
  const dot = (col: string) => <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: col }} />;
  const s = small ? 'tiny' : 'small';
  return (
    <Row gap={5}>
      {dot(t.prot)}<T v={s} muted num>{Math.round(p)}P</T>
      {dot(t.fat)}<T v={s} muted num>{Math.round(f)}G</T>
      {dot(t.carb)}<T v={s} muted num>{Math.round(c)}C</T>
    </Row>
  );
}

export function MacroGrid({ kcal, p, f, c }: { kcal: number; p: number; f: number; c: number }) {
  const t = useTheme();
  const cell = (l: string, v: string, col: string) => (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <T v="h2" num color={col}>{v}</T>
      <T v="tiny" muted>{l}</T>
    </View>
  );
  return (
    <Card>
      <Row>
        {cell('kcal', String(Math.round(kcal)), t.kcal)}
        {cell('proteína', `${Math.round(p * 10) / 10} g`, t.prot)}
        {cell('grasa', `${Math.round(f * 10) / 10} g`, t.fat)}
        {cell('carbos', `${Math.round(c * 10) / 10} g`, t.carb)}
      </Row>
    </Card>
  );
}

export function Pill({ text, color }: { text: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: t.surface2 }}>
      <T v="tiny" bold color={color ?? t.muted}>{text}</T>
    </View>
  );
}

/** "1 taza (160 g)" o "1/2 pieza (70 g)" según cómo esté escrita la porción. */
export function servingLabel(name: string | null, g: number | null, n = 1) {
  if (!name || !g) return `${Math.round(g ?? 100)} g`;
  const qty = /^\d/.test(name) ? (n === 1 ? name : `${n} × ${name}`) : `${n} ${name}`;
  return `${qty} (${Math.round(g * n)} g)`;
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.line }} />;
}

export function Loading({ text }: { text?: string }) {
  const t = useTheme();
  return (
    <View style={{ padding: 24, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={t.kcal} size="large" />
      {text ? <T muted center>{text}</T> : null}
    </View>
  );
}
