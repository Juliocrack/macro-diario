import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme';

type Pt = { label: string; value: number; highlight?: boolean };

function useWidth(): [number, (e: any) => void] {
  const [w, setW] = useState(0);
  return [w, e => setW(e.nativeEvent.layout.width)];
}

export function BarChart({ data, goal, color, height = 170, unit = '' }: { data: Pt[]; goal?: number; color: string; height?: number; unit?: string }) {
  const t = useTheme();
  const [W, onLayout] = useWidth();
  const L = 36, B = 20, T = 10;
  const max = Math.max(goal ? goal * 1.2 : 0, ...data.map(d => d.value), 1);
  const y = (v: number) => T + (height - T - B) * (1 - v / max);
  const bw = W > L ? (W - L - 4) / Math.max(1, data.length) : 0;
  const every = Math.ceil(data.length / 8);
  return (
    <View onLayout={onLayout} style={{ height }}>
      {W > 0 && (
        <Svg width={W} height={height}>
          <Line x1={L} x2={W} y1={y(0)} y2={y(0)} stroke={t.line} />
          <SvgText x={L - 6} y={y(0) + 4} fontSize={10} fill={t.muted} textAnchor="end">0</SvgText>
          <SvgText x={L - 6} y={y(max) + 8} fontSize={10} fill={t.muted} textAnchor="end">{Math.round(max)}</SvgText>
          {data.map((d, i) => {
            const x = L + i * bw + bw * 0.18;
            const h = Math.max(0, y(0) - y(d.value));
            return (
              <React.Fragment key={i}>
                <Rect x={x} y={y(d.value)} width={bw * 0.64} height={h} rx={3} fill={color} opacity={d.highlight ? 1 : 0.55} />
                {i % every === (data.length - 1) % every && (
                  <SvgText x={x + bw * 0.32} y={height - 5} fontSize={10} fill={t.muted} textAnchor="middle">{d.label}</SvgText>
                )}
              </React.Fragment>
            );
          })}
          {goal ? (
            <>
              <Line x1={L} x2={W} y1={y(goal)} y2={y(goal)} stroke={t.ink} strokeDasharray="4 4" opacity={0.5} />
              <SvgText x={L - 6} y={y(goal) + 4} fontSize={10} fill={t.ink} textAnchor="end">{Math.round(goal)}</SvgText>
            </>
          ) : null}
        </Svg>
      )}
    </View>
  );
}

export function LineChart({ data, color, height = 170, decimals = 1, target }: { data: Pt[]; color: string; height?: number; decimals?: number; target?: number | null }) {
  const t = useTheme();
  const [W, onLayout] = useWidth();
  const L = 40, B = 20, T = 12, R = 10;
  const vals = data.map(d => d.value).concat(target ? [target] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const x = (i: number) => L + (W - L - R) * (data.length <= 1 ? 0.5 : i / (data.length - 1));
  const y = (v: number) => T + (height - T - B) * (1 - (v - lo) / (hi - lo));
  const fmt = (v: number) => v.toFixed(decimals);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ');
  const area = data.length ? `${path} L${x(data.length - 1)},${y(lo)} L${x(0)},${y(lo)} Z` : '';
  const last = data[data.length - 1];
  return (
    <View onLayout={onLayout} style={{ height }}>
      {W > 0 && data.length > 0 && (
        <Svg width={W} height={height}>
          {[lo + pad, (lo + hi) / 2, hi - pad].map((v, i) => (
            <React.Fragment key={i}>
              <Line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={t.line} />
              <SvgText x={L - 6} y={y(v) + 4} fontSize={10} fill={t.muted} textAnchor="end">{fmt(v)}</SvgText>
            </React.Fragment>
          ))}
          {target ? <Line x1={L} x2={W - R} y1={y(target)} y2={y(target)} stroke={t.ok} strokeDasharray="5 4" /> : null}
          <Path d={area} fill={color} opacity={0.12} />
          <Path d={path} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
          {last && <Circle cx={x(data.length - 1)} cy={y(last.value)} r={4.5} fill={color} />}
          <SvgText x={x(0)} y={height - 5} fontSize={10} fill={t.muted} textAnchor="start">{data[0].label}</SvgText>
          {data.length > 1 && <SvgText x={x(data.length - 1)} y={height - 5} fontSize={10} fill={t.muted} textAnchor="end">{last.label}</SvgText>}
        </Svg>
      )}
    </View>
  );
}

/** Dona de distribución de macros (proteína/grasa/carbos en kcal). */
export function MacroDonut({ p, f, c, size = 96 }: { p: number; f: number; c: number; size?: number }) {
  const t = useTheme();
  const parts = [
    { v: p * 4, col: t.prot },
    { v: f * 9, col: t.fat },
    { v: c * 4, col: t.carb },
  ];
  const total = parts.reduce((a, b) => a + b.v, 0) || 1;
  const r = size / 2 - 8;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.surface2} strokeWidth={12} fill="none" />
      {parts.map((s, i) => {
        const len = (s.v / total) * C;
        const el = (
          <Circle key={i} cx={size / 2} cy={size / 2} r={r} stroke={s.col} strokeWidth={12} fill="none"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        );
        acc += len;
        return el;
      })}
    </Svg>
  );
}
