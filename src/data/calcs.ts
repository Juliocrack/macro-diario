import type { IconName } from '@/components/ui';

export const CALCS: { key: string; title: string; sub: string; icon: IconName }[] = [
  { key: 'tdee', title: 'Calorías y macros', sub: 'TMB, gasto diario (TDEE) y macros según tu objetivo', icon: 'flame' },
  { key: 'imc', title: 'IMC', sub: 'Índice de masa corporal y rango de peso saludable', icon: 'body' },
  { key: 'tmb', title: 'Metabolismo basal', sub: 'Mifflin-St Jeor, Harris-Benedict y Katch-McArdle', icon: 'pulse' },
  { key: 'grasa', title: '% de grasa corporal', sub: 'Método Marina de EE. UU. y estimación por IMC', icon: 'water' },
  { key: 'ffmi', title: 'FFMI', sub: 'Índice de masa libre de grasa (potencial muscular)', icon: 'barbell' },
  { key: 'ideal', title: 'Peso ideal', sub: 'Devine, Robinson, Miller y Hamwi', icon: 'scale' },
  { key: 'cintura', title: 'Cintura-altura y cintura-cadera', sub: 'Indicadores de riesgo cardiometabólico', icon: 'resize' },
  { key: 'rm', title: '1RM y tabla de cargas', sub: 'Epley, Brzycki y Lombardi', icon: 'trophy' },
  { key: 'fc', title: 'Zonas de frecuencia cardiaca', sub: 'FC máxima (Tanaka) y zonas Karvonen', icon: 'heart' },
  { key: 'met', title: 'Calorías quemadas', sub: 'Por actividad, duración y peso (METs)', icon: 'bicycle' },
  { key: 'agua', title: 'Hidratación', sub: 'Agua diaria según peso y ejercicio', icon: 'beer' },
  { key: 'proyeccion', title: 'Proyección de peso', sub: '¿Cuándo llegas a tu meta con tu déficit o superávit?', icon: 'calendar' },
  { key: 'proteina', title: 'Proteína diaria', sub: 'Rango recomendado según tu objetivo', icon: 'egg' },
];
