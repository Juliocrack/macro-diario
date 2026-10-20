export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const today = () => iso(new Date());
export function parse(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export function dayLabel(s: string) {
  const t = today();
  if (s === t) return 'Hoy';
  if (s === addDays(t, -1)) return 'Ayer';
  if (s === addDays(t, 1)) return 'Mañana';
  return parse(s).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}
export const shortDate = (s: string) => parse(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
export const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
export const timeOf = (ms: number) => new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
export function duration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}
export function hm(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
export function ageFrom(birthYear: number) {
  return new Date().getFullYear() - birthYear;
}
export function guessMeal(): 'des' | 'com' | 'cen' | 'sna' {
  const h = new Date().getHours();
  if (h < 11) return 'des';
  if (h < 17) return 'com';
  if (h < 22) return 'cen';
  return 'sna';
}
