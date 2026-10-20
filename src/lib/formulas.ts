// Fórmulas de composición corporal, energía y fuerza.
// Todas las unidades son métricas: kg, cm, años.

export type Sex = 'h' | 'm'; // hombre / mujer

export const ACTIVITY = [
  { key: 'sed', label: 'Sedentario (poco o nada de ejercicio)', factor: 1.2 },
  { key: 'lig', label: 'Ligero (1–3 días/semana)', factor: 1.375 },
  { key: 'mod', label: 'Moderado (3–5 días/semana)', factor: 1.55 },
  { key: 'alt', label: 'Alto (6–7 días/semana)', factor: 1.725 },
  { key: 'muy', label: 'Muy alto (doble sesión o trabajo físico)', factor: 1.9 },
] as const;
export type ActivityKey = (typeof ACTIVITY)[number]['key'];
export const activityFactor = (k: ActivityKey) => ACTIVITY.find(a => a.key === k)?.factor ?? 1.2;

// ---------- IMC ----------
export function bmi(kg: number, cm: number) {
  const m = cm / 100;
  return kg / (m * m);
}
export function bmiCategory(v: number) {
  if (v < 18.5) return 'Bajo peso';
  if (v < 25) return 'Normal';
  if (v < 30) return 'Sobrepeso';
  if (v < 35) return 'Obesidad grado I';
  if (v < 40) return 'Obesidad grado II';
  return 'Obesidad grado III';
}
export function healthyWeightRange(cm: number) {
  const m = cm / 100;
  return { min: 18.5 * m * m, max: 24.9 * m * m };
}

// ---------- Metabolismo basal (TMB / BMR) ----------
export function bmrMifflin(sex: Sex, kg: number, cm: number, age: number) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'h' ? 5 : -161);
}
export function bmrHarrisBenedict(sex: Sex, kg: number, cm: number, age: number) {
  // Revisión de Roza y Shizgal (1984)
  return sex === 'h'
    ? 88.362 + 13.397 * kg + 4.799 * cm - 5.677 * age
    : 447.593 + 9.247 * kg + 3.098 * cm - 4.33 * age;
}
export function bmrKatchMcArdle(kg: number, bodyFatPct: number) {
  const lean = kg * (1 - bodyFatPct / 100);
  return 370 + 21.6 * lean;
}
export function tdee(bmrValue: number, act: ActivityKey) {
  return bmrValue * activityFactor(act);
}

// ---------- Objetivo y macros ----------
export const GOALS = [
  { key: 'cut_fast', label: 'Definición agresiva', kcalAdj: -0.25 },
  { key: 'cut', label: 'Definición', kcalAdj: -0.15 },
  { key: 'maint', label: 'Mantenimiento', kcalAdj: 0 },
  { key: 'lean_bulk', label: 'Volumen limpio', kcalAdj: 0.1 },
  { key: 'bulk', label: 'Volumen', kcalAdj: 0.2 },
] as const;
export type GoalKey = (typeof GOALS)[number]['key'];

export function macrosFor(kcal: number, kg: number, proteinPerKg: number, fatPct: number) {
  const p = Math.round(kg * proteinPerKg);
  const f = Math.round((kcal * fatPct) / 9);
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  return { kcal: Math.round(kcal), p, f, c };
}
export const macroKcal = (p: number, f: number, c: number) => p * 4 + f * 9 + c * 4;

// ---------- Grasa corporal ----------
/** Método de la Marina de EE. UU. (versión métrica). Mujeres requieren cadera. */
export function bodyFatNavy(sex: Sex, cm: number, waist: number, neck: number, hip = 0) {
  if (sex === 'h') {
    if (waist - neck <= 0) return NaN;
    return 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(cm)) - 450;
  }
  if (waist + hip - neck <= 0) return NaN;
  return 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(cm)) - 450;
}
/** Estimación por IMC (Deurenberg 1991). */
export function bodyFatFromBmi(sex: Sex, bmiValue: number, age: number) {
  return 1.2 * bmiValue + 0.23 * age - 10.8 * (sex === 'h' ? 1 : 0) - 5.4;
}
export function bodyFatCategory(sex: Sex, pct: number) {
  const t = sex === 'h' ? [6, 14, 18, 25] : [14, 21, 25, 32];
  if (pct < t[0]) return 'Grasa esencial';
  if (pct < t[1]) return 'Atlético';
  if (pct < t[2]) return 'Fitness';
  if (pct < t[3]) return 'Promedio';
  return 'Elevado';
}

// ---------- FFMI ----------
export function ffmi(kg: number, cm: number, bodyFatPct: number) {
  const m = cm / 100;
  const lean = kg * (1 - bodyFatPct / 100);
  const v = lean / (m * m);
  return { lean, ffmi: v, normalized: v + 6.1 * (1.8 - m) };
}

// ---------- Peso ideal ----------
export function idealWeights(sex: Sex, cm: number) {
  const inchesOver5ft = Math.max(0, cm / 2.54 - 60);
  const h = sex === 'h';
  return {
    Devine: (h ? 50 : 45.5) + 2.3 * inchesOver5ft,
    Robinson: (h ? 52 : 49) + (h ? 1.9 : 1.7) * inchesOver5ft,
    Miller: (h ? 56.2 : 53.1) + (h ? 1.41 : 1.36) * inchesOver5ft,
    Hamwi: (h ? 48 : 45.5) + (h ? 2.7 : 2.2) * inchesOver5ft,
  };
}

// ---------- Índices de riesgo ----------
export const waistToHeight = (waist: number, cm: number) => waist / cm;
export function waistToHeightCategory(r: number) {
  if (r < 0.4) return 'Bajo';
  if (r < 0.5) return 'Saludable';
  if (r < 0.6) return 'Riesgo aumentado';
  return 'Riesgo alto';
}
export const waistToHip = (waist: number, hip: number) => waist / hip;
export function waistToHipCategory(sex: Sex, r: number) {
  const lim = sex === 'h' ? 0.9 : 0.85;
  return r < lim ? 'Riesgo bajo' : 'Riesgo cardiovascular aumentado';
}

// ---------- Fuerza ----------
export function oneRM(weight: number, reps: number) {
  if (reps <= 1) return { epley: weight, brzycki: weight, lombardi: weight, avg: weight };
  const epley = weight * (1 + reps / 30);
  const brzycki = reps < 37 ? (weight * 36) / (37 - reps) : NaN;
  const lombardi = weight * Math.pow(reps, 0.1);
  const vals = [epley, brzycki, lombardi].filter(Number.isFinite);
  return { epley, brzycki, lombardi, avg: vals.reduce((a, b) => a + b, 0) / vals.length };
}
/** Porcentajes de 1RM y reps aproximadas. */
export const RM_TABLE = [
  [100, 1], [95, 2], [93, 3], [90, 4], [87, 5], [85, 6], [83, 7], [80, 8], [77, 9], [75, 10], [70, 12], [67, 15],
] as const;

// ---------- Cardio ----------
export const maxHeartRate = (age: number) => 208 - 0.7 * age; // Tanaka
export function hrZones(age: number, resting?: number) {
  const max = maxHeartRate(age);
  const zones = [
    { z: 1, name: 'Recuperación', lo: 0.5, hi: 0.6 },
    { z: 2, name: 'Quema de grasa / base', lo: 0.6, hi: 0.7 },
    { z: 3, name: 'Aeróbico', lo: 0.7, hi: 0.8 },
    { z: 4, name: 'Umbral', lo: 0.8, hi: 0.9 },
    { z: 5, name: 'Máximo', lo: 0.9, hi: 1.0 },
  ];
  return zones.map(z => {
    const f = (p: number) => (resting ? resting + (max - resting) * p : max * p); // Karvonen si hay FC reposo
    return { ...z, from: Math.round(f(z.lo)), to: Math.round(f(z.hi)) };
  });
}
export const MET_ACTIVITIES = [
  { label: 'Caminar (5 km/h)', met: 3.5 },
  { label: 'Caminata rápida (6.5 km/h)', met: 5 },
  { label: 'Trotar (8 km/h)', met: 8.3 },
  { label: 'Correr (10 km/h)', met: 9.8 },
  { label: 'Correr (12 km/h)', met: 11.8 },
  { label: 'Bicicleta moderada', met: 6.8 },
  { label: 'Bicicleta intensa', met: 10 },
  { label: 'Pesas moderado', met: 3.5 },
  { label: 'Pesas intenso', met: 6 },
  { label: 'HIIT / circuito', met: 8 },
  { label: 'Natación moderada', met: 5.8 },
  { label: 'Fútbol', met: 7 },
  { label: 'Basquetbol', met: 6.5 },
  { label: 'Box / artes marciales', met: 9 },
  { label: 'Yoga', met: 2.5 },
  { label: 'Saltar la cuerda', met: 11 },
  { label: 'Escaladora / stairmaster', met: 9 },
  { label: 'Bailar', met: 5 },
];
export const metKcal = (met: number, kg: number, minutes: number) => (met * 3.5 * kg * minutes) / 200;

// ---------- Hidratación y proteína ----------
export const waterMl = (kg: number, exerciseMin = 0) => kg * 35 + (exerciseMin / 30) * 350;
export function proteinRange(kg: number, goal: GoalKey) {
  const r = goal.startsWith('cut') ? [1.8, 2.4] : goal === 'maint' ? [1.4, 2.0] : [1.6, 2.2];
  return { min: kg * r[0], max: kg * r[1] };
}

// ---------- Proyección de peso ----------
export const KCAL_PER_KG = 7700;
export function weightProjection(currentKg: number, targetKg: number, dailyBalance: number) {
  // dailyBalance: consumo - gasto (negativo = déficit)
  const diff = targetKg - currentKg;
  if (diff === 0 || dailyBalance === 0 || Math.sign(diff) !== Math.sign(dailyBalance)) return null;
  const days = (Math.abs(diff) * KCAL_PER_KG) / Math.abs(dailyBalance);
  return { days, weeks: days / 7, kgPerWeek: (dailyBalance * 7) / KCAL_PER_KG };
}

export const round = (x: number, d = 0) => {
  const p = Math.pow(10, d);
  return Math.round(x * p) / p;
};
