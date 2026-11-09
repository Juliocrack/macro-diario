import * as SecureStore from 'expo-secure-store';
import { getSetting, DEFAULT_AI, type AiSettings } from '@/db';

// Integración con Gemini (Google AI Studio). La API key vive cifrada en el dispositivo.
const KEY = 'gemini_api_key';
export const getApiKey = () => SecureStore.getItemAsync(KEY);
export const setApiKey = (v: string) => (v ? SecureStore.setItemAsync(KEY, v.trim()) : SecureStore.deleteItemAsync(KEY));

export const GEMINI_MODELS = [
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (recomendado)' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (más reciente)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (más rápido)' },
];

export class AiError extends Error {
  code: 'no_key' | 'network' | 'quota' | 'auth' | 'parse' | 'blocked' | 'busy' | 'other';
  constructor(code: AiError['code'], msg: string) {
    super(msg);
    this.code = code;
  }
}

type Img = { base64: string; mime?: string };

async function call(prompt: string, images: Img[] = [], json = true, history: { role: 'user' | 'model'; text: string }[] = []) {
  const key = await getApiKey();
  if (!key) throw new AiError('no_key', 'Agrega tu API key de Gemini en Más → Inteligencia artificial.');
  const { model } = await getSetting<AiSettings>('ai', DEFAULT_AI);
  const contents = [
    ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
    {
      role: 'user',
      parts: [...images.map(i => ({ inline_data: { mime_type: i.mime || 'image/jpeg', data: i.base64 } })), { text: prompt }],
    },
  ];
  const body = JSON.stringify({
    contents,
    generationConfig: { temperature: json ? 0.2 : 0.6, ...(json ? { response_mime_type: 'application/json' } : {}) },
  });
  // Si el modelo elegido está saturado (503/500), reintenta y luego prueba los demás modelos
  const order = [model, ...GEMINI_MODELS.map(m => m.id).filter(id => id !== model)];
  let data: any = null;
  let lastBusy = false;
  for (let i = 0; i < order.length * 2 && !data; i++) {
    const m = order[Math.floor(i / 2)];
    if (i > 0) await new Promise(r => setTimeout(r, i % 2 ? 1500 : 300));
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body,
      });
    } catch {
      throw new AiError('network', 'Sin conexión. Revisa tu internet e intenta de nuevo.');
    }
    const j: any = await res.json().catch(() => null);
    if (res.ok) {
      data = j;
      break;
    }
    const msg: string = j?.error?.message ?? `Error ${res.status}`;
    if (res.status === 503 || res.status === 500 || /high demand|overloaded/i.test(msg)) {
      lastBusy = true;
      continue;
    }
    if (res.status === 404 && m !== model) continue; // ese modelo alterno no existe en tu cuenta
    if (res.status === 429) throw new AiError('quota', 'Se alcanzó el límite de uso de Gemini. Espera un minuto o revisa tu cuota en AI Studio.');
    if (res.status === 400 && /api key/i.test(msg)) throw new AiError('auth', 'La API key no es válida. Revísala en Más → Inteligencia artificial.');
    if (res.status === 403 || res.status === 401) throw new AiError('auth', 'La API key no tiene permiso para este modelo.');
    if (res.status === 404) throw new AiError('other', `El modelo "${m}" no está disponible. Elige otro en Más → Inteligencia artificial.`);
    throw new AiError('other', msg);
  }
  if (!data) {
    throw new AiError('busy', lastBusy ? 'Los modelos de Gemini están saturados en este momento. Intenta de nuevo en unos minutos.' : 'No se pudo conectar con Gemini. Intenta de nuevo.');
  }
  const cand = data?.candidates?.[0];
  if (!cand) throw new AiError('blocked', 'Gemini no devolvió respuesta. Intenta con otra foto o descripción.');
  const text: string = (cand.content?.parts ?? [])
    .filter((p: any) => typeof p.text === 'string' && !p.thought)
    .map((p: any) => p.text)
    .join('');
  return text;
}

function parseJson<T>(text: string): T {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const m = clean.match(/[[{][\s\S]*[\]}]/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {}
    }
    throw new AiError('parse', 'No pude interpretar la respuesta. Intenta de nuevo.');
  }
}

const num = (x: unknown) => {
  const n = typeof x === 'number' ? x : parseFloat(String(x));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// ---------- Platillos ----------
export type AiItem = { name: string; qty: string; grams: number; kcal: number; p: number; f: number; c: number; fiber: number };
export type AiMeal = { dish: string; items: AiItem[]; confidence: 'alta' | 'media' | 'baja'; notes: string };

const MEAL_SCHEMA = `{"dish":"nombre corto del platillo en español","confidence":"alta|media|baja","notes":"1 frase con supuestos (aceite, tamaño de porción) o consejos","items":[{"name":"ingrediente o componente","qty":"cantidad legible, ej. 3 tortillas (90 g)","grams":90,"kcal":196,"p":5,"f":3,"c":40,"fiber":5}]}`;

function normalizeMeal(raw: any): AiMeal {
  const items: AiItem[] = (Array.isArray(raw?.items) ? raw.items : []).map((x: any) => ({
    name: String(x?.name ?? 'Alimento').slice(0, 80),
    qty: String(x?.qty ?? (x?.grams ? `${x.grams} g` : '1 porción')).slice(0, 60),
    grams: num(x?.grams),
    kcal: num(x?.kcal),
    p: num(x?.p),
    f: num(x?.f),
    c: num(x?.c),
    fiber: num(x?.fiber),
  }));
  const conf = ['alta', 'media', 'baja'].includes(raw?.confidence) ? raw.confidence : 'media';
  return { dish: String(raw?.dish ?? items[0]?.name ?? 'Comida'), items, confidence: conf, notes: String(raw?.notes ?? '') };
}

export async function analyzeMealPhoto(img: Img, note = ''): Promise<AiMeal> {
  const prompt = `Eres un nutriólogo experto en comida mexicana y estimación visual de porciones.
Analiza la foto del platillo. Identifica cada componente visible (incluye tortillas, salsas, aceite de cocción, bebidas) y estima su peso en gramos usando referencias del plato, cubiertos o manos.
${note ? `Información adicional del usuario: """${note}"""\n` : ''}Calcula kcal, proteína (p), grasa (f), carbohidratos (c) y fibra en gramos para cada componente con valores realistas (USDA / SMAE).
Si la imagen no contiene comida, devuelve items vacío y explica en notes.
Responde SOLO con JSON con esta forma exacta:
${MEAL_SCHEMA}`;
  return normalizeMeal(parseJson(await call(prompt, [img])));
}

export async function analyzeMealText(text: string): Promise<AiMeal> {
  const prompt = `Eres un nutriólogo experto en comida mexicana. Estima la información nutrimental de lo que la persona comió:
"""${text}"""
Separa cada alimento o bebida. Si no se indica cantidad, usa porciones típicas de México y dilo en notes.
Responde SOLO con JSON con esta forma exacta:
${MEAL_SCHEMA}`;
  return normalizeMeal(parseJson(await call(prompt)));
}

export type AiLabel = { name: string; brand: string; serving_name: string; serving_g: number; kcal: number; p: number; f: number; c: number; fiber: number; sugar: number; sodium: number };
/** Lee una etiqueta nutrimental (tabla) y devuelve valores por 100 g. */
export async function readNutritionLabel(img: Img): Promise<AiLabel> {
  const prompt = `Lee la tabla de información nutrimental de esta etiqueta (México/EE. UU.).
Convierte TODO a valores por 100 g (o 100 ml). sodium en mg por 100 g.
Responde SOLO con JSON: {"name":"nombre del producto","brand":"marca o vacío","serving_name":"porción, ej. 1 barra","serving_g":40,"kcal":0,"p":0,"f":0,"c":0,"fiber":0,"sugar":0,"sodium":0}`;
  const r: any = parseJson(await call(prompt, [img]));
  return {
    name: String(r?.name || 'Producto'),
    brand: String(r?.brand || ''),
    serving_name: String(r?.serving_name || 'porción'),
    serving_g: num(r?.serving_g) || 100,
    kcal: num(r?.kcal), p: num(r?.p), f: num(r?.f), c: num(r?.c), fiber: num(r?.fiber), sugar: num(r?.sugar), sodium: num(r?.sodium),
  };
}

// ---------- Sugerencias ----------
export type AiSuggestion = { name: string; why: string; kcal: number; p: number; f: number; c: number; ingredients: string[] };
export async function suggestMeals(remaining: { kcal: number; p: number; f: number; c: number }, meal: string, prefs: string): Promise<AiSuggestion[]> {
  const prompt = `Soy una persona en México haciendo seguimiento de macros. Para ${meal} me faltan aproximadamente:
${Math.round(remaining.kcal)} kcal, ${Math.round(remaining.p)} g proteína, ${Math.round(remaining.f)} g grasa, ${Math.round(remaining.c)} g carbohidratos.
${prefs ? `Preferencias/restricciones: ${prefs}\n` : ''}Sugiere 4 opciones realistas, fáciles de conseguir o preparar en México, que se acerquen a esos números (prioriza cubrir la proteína).
Responde SOLO con JSON: [{"name":"","why":"1 frase","kcal":0,"p":0,"f":0,"c":0,"ingredients":["cantidad + ingrediente"]}]`;
  const r = parseJson<any>(await call(prompt));
  const arr = Array.isArray(r) ? r : Array.isArray(r?.options) ? r.options : [];
  return arr.slice(0, 6).map((x: any) => ({
    name: String(x?.name ?? ''), why: String(x?.why ?? ''),
    kcal: num(x?.kcal), p: num(x?.p), f: num(x?.f), c: num(x?.c),
    ingredients: Array.isArray(x?.ingredients) ? x.ingredients.map(String) : [],
  }));
}

export type AiRecipe = { name: string; servings: number; minutes: number; tags: string; steps: string; items: AiItem[] };
export async function generateRecipe(request: string, targets?: { kcal: number; p: number }): Promise<AiRecipe> {
  const prompt = `Crea una receta saludable estilo mexicano o internacional según esta petición: """${request}""".
${targets ? `Objetivo aproximado por porción: ${targets.kcal} kcal y ${targets.p} g de proteína.\n` : ''}Da ingredientes con gramos totales (de toda la receta) y sus macros totales por ingrediente.
Pasos numerados y claros.
Responde SOLO con JSON: {"name":"","servings":2,"minutes":20,"tags":"Comida · Alta en proteína","steps":"1. ...\\n2. ...","items":[{"name":"","qty":"","grams":0,"kcal":0,"p":0,"f":0,"c":0,"fiber":0}]}`;
  const r: any = parseJson(await call(prompt));
  const meal = normalizeMeal({ items: r?.items });
  return {
    name: String(r?.name || 'Receta'),
    servings: Math.max(1, Math.round(num(r?.servings)) || 1),
    minutes: Math.round(num(r?.minutes)),
    tags: String(r?.tags || ''),
    steps: String(r?.steps || ''),
    items: meal.items,
  };
}

// ---------- Rutinas ----------
export type AiRoutineDay = { name: string; notes: string; exercises: { name: string; sets: number; reps: string; rest_sec: number }[] };
export async function generateProgram(opts: { days: number; level: string; goal: string; equipment: string; minutes: number; focus: string }, library: string[]): Promise<AiRoutineDay[]> {
  const prompt = `Eres entrenador de fuerza certificado. Diseña un programa semanal de ${opts.days} días.
Nivel: ${opts.level}. Objetivo: ${opts.goal}. Equipo disponible: ${opts.equipment}. Duración por sesión: ${opts.minutes} min.${opts.focus ? ` Enfoque: ${opts.focus}.` : ''}
Usa EXCLUSIVAMENTE ejercicios de esta lista, escritos exactamente igual:
${library.join(' | ')}
Responde SOLO con JSON: [{"name":"Día 1 · Empuje","notes":"1 frase","exercises":[{"name":"","sets":3,"reps":"8-10","rest_sec":90}]}]`;
  const r = parseJson<any>(await call(prompt));
  const arr = Array.isArray(r) ? r : Array.isArray(r?.days) ? r.days : [];
  return arr.map((d: any) => ({
    name: String(d?.name ?? 'Día'),
    notes: String(d?.notes ?? ''),
    exercises: (Array.isArray(d?.exercises) ? d.exercises : []).map((e: any) => ({
      name: String(e?.name ?? ''),
      sets: Math.max(1, Math.round(num(e?.sets)) || 3),
      reps: String(e?.reps ?? '8-12'),
      rest_sec: Math.round(num(e?.rest_sec)) || 90,
    })),
  }));
}

// ---------- Coach ----------
export async function coachChat(context: string, history: { role: 'user' | 'model'; text: string }[], message: string) {
  const prompt = `${history.length ? '' : `Eres "Coach", un entrenador personal y nutriólogo deportivo dentro de la app Macro Diario. Respondes en español de México, claro, breve (máximo ~150 palabras salvo que pidan más) y práctico. Basa tus consejos en evidencia. No diagnostiques enfermedades; si hay síntomas médicos, sugiere ver a un profesional.
Contexto actual del usuario:
${context}

`}${message}`;
  return call(prompt, [], false, history);
}

export async function testConnection() {
  const t = await call('Responde solo con JSON: {"ok":true}');
  return parseJson<{ ok: boolean }>(t).ok === true;
}
