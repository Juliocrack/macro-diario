import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';

// ---------- Conexión y bus de cambios ----------
let _db: SQLiteDatabase | null = null;
export function setDb(db: SQLiteDatabase) {
  _db = db;
}
export function db(): SQLiteDatabase {
  if (!_db) throw new Error('Base de datos no inicializada');
  return _db;
}

let version = 0;
const listeners = new Set<() => void>();
/** Avisa a todas las pantallas que los datos cambiaron. */
export function bump() {
  version++;
  listeners.forEach(l => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const useDataVersion = () => useSyncExternalStore(subscribe, () => version);

/** Ejecuta una consulta y la repite cuando cambian los datos o la pantalla recupera el foco. */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[], initial: T): [T, () => void, boolean] {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const v = useDataVersion();
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });
  const key = JSON.stringify(deps);
  const run = useCallback(() => {
    let alive = true;
    fnRef.current()
      .then(r => alive && setData(r))
      .catch(e => console.warn('query', e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // `key` cambia cuando cambian los parámetros de la consulta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(run, [run, v]);
  useFocusEffect(run);
  return [data, run, loading];
}

// ---------- Tipos ----------
export type Meal = 'des' | 'com' | 'cen' | 'sna';
export const MEALS: { key: Meal; label: string }[] = [
  { key: 'des', label: 'Desayuno' },
  { key: 'com', label: 'Comida' },
  { key: 'cen', label: 'Cena' },
  { key: 'sna', label: 'Snacks' },
];
export const mealLabel = (m: string) => MEALS.find(x => x.key === m)?.label ?? m;

export type Macros = { kcal: number; p: number; f: number; c: number; fiber?: number };
export type Food = Macros & {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  fiber: number;
  sugar: number | null;
  sodium: number | null;
  serving_name: string | null;
  serving_g: number | null;
  source: 'base' | 'custom' | 'off' | 'ai';
  barcode: string | null;
  favorite: number;
};
export type LogEntry = Macros & {
  id: number;
  date: string;
  meal: Meal;
  name: string;
  grams: number;
  qty_label: string | null;
  fiber: number;
  food_id: number | null;
  recipe_id: number | null;
  photo_uri: string | null;
  source: string | null;
};
export type RecipeItem = Macros & { food_id: number | null; name: string; grams: number };
export type Recipe = {
  id: number;
  name: string;
  servings: number;
  minutes: number | null;
  tags: string | null;
  steps: string | null;
  photo_uri: string | null;
  items: RecipeItem[];
  builtin: number;
  favorite: number;
};
export type SavedMeal = { id: number; name: string; items: Omit<LogEntry, 'id' | 'date' | 'meal'>[] };

export type Goals = { kcal: number; p: number; f: number; c: number; waterMl: number; fiber: number };
export const DEFAULT_GOALS: Goals = { kcal: 2300, p: 125, f: 65, c: 304, waterMl: 2500, fiber: 30 };

export type Profile = {
  name: string;
  sex: 'h' | 'm';
  birthYear: number;
  heightCm: number;
  activity: 'sed' | 'lig' | 'mod' | 'alt' | 'muy';
  goal: 'cut_fast' | 'cut' | 'maint' | 'lean_bulk' | 'bulk';
  targetKg: number | null;
};
export const DEFAULT_PROFILE: Profile = {
  name: '',
  sex: 'h',
  birthYear: 2002,
  heightCm: 175,
  activity: 'mod',
  goal: 'maint',
  targetKg: null,
};

export type AiSettings = { model: string };
export const DEFAULT_AI: AiSettings = { model: 'gemini-3.6-flash' };

export type Reminders = {
  meals: boolean;
  mealTimes: string[]; // "HH:MM"
  water: boolean;
  waterEvery: number; // horas
  waterFrom: string;
  waterTo: string;
  weigh: boolean;
  weighTime: string;
  workout: boolean;
  workoutTime: string;
};
export const DEFAULT_REMINDERS: Reminders = {
  meals: false,
  mealTimes: ['08:30', '14:30', '20:30'],
  water: false,
  waterEvery: 2,
  waterFrom: '09:00',
  waterTo: '21:00',
  weigh: false,
  weighTime: '07:30',
  workout: false,
  workoutTime: '18:00',
};

// ---------- Ajustes ----------
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const r = await db().getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  if (!r) return fallback;
  try {
    const v = JSON.parse(r.value);
    return typeof fallback === 'object' && fallback && !Array.isArray(fallback) ? { ...fallback, ...v } : v;
  } catch {
    return fallback;
  }
}
export async function setSetting(key: string, value: unknown) {
  await db().runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, JSON.stringify(value));
  bump();
}
export const getGoals = () => getSetting<Goals>('goals', DEFAULT_GOALS);
export const getProfile = () => getSetting<Profile>('profile', DEFAULT_PROFILE);

// ---------- Alimentos ----------
function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
export async function searchFoods(q: string, limit = 60): Promise<Food[]> {
  const all = await db().getAllAsync<Food>(
    "SELECT * FROM foods ORDER BY favorite DESC, CASE source WHEN 'custom' THEN 0 WHEN 'off' THEN 1 WHEN 'ai' THEN 2 ELSE 3 END, name"
  );
  const terms = normalize(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return all.slice(0, limit);
  return all
    .map(f => {
      const n = normalize(f.name + ' ' + (f.brand ?? ''));
      if (!terms.every(t => n.includes(t))) return null;
      const score = (n.startsWith(terms[0]) ? 0 : 1) + n.length / 1000;
      return { f, score };
    })
    .filter((x): x is { f: Food; score: number } => !!x)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(x => x.f);
}
export const getFood = (id: number) => db().getFirstAsync<Food>('SELECT * FROM foods WHERE id = ?', id);
export const getFoodByBarcode = (code: string) => db().getFirstAsync<Food>('SELECT * FROM foods WHERE barcode = ?', code);
export async function insertFood(f: Omit<Food, 'id' | 'favorite'> & { favorite?: number }) {
  const r = await db().runAsync(
    'INSERT INTO foods (name, brand, category, kcal, p, f, c, fiber, sugar, sodium, serving_name, serving_g, source, barcode, favorite) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    f.name, f.brand ?? null, f.category ?? null, f.kcal, f.p, f.f, f.c, f.fiber ?? 0, f.sugar ?? null, f.sodium ?? null,
    f.serving_name ?? null, f.serving_g ?? null, f.source, f.barcode ?? null, f.favorite ?? 0
  );
  bump();
  return r.lastInsertRowId;
}
export async function updateFood(id: number, f: Partial<Food>) {
  const keys = Object.keys(f).filter(k => k !== 'id');
  if (!keys.length) return;
  await db().runAsync(
    `UPDATE foods SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
    ...keys.map(k => (f as any)[k] ?? null), id
  );
  bump();
}
export async function deleteFood(id: number) {
  await db().runAsync('DELETE FROM foods WHERE id = ?', id);
  bump();
}
export const toggleFavoriteFood = async (id: number, fav: boolean) => updateFood(id, { favorite: fav ? 1 : 0 });
export const customFoods = () => db().getAllAsync<Food>("SELECT * FROM foods WHERE source != 'base' ORDER BY created_at DESC");

// ---------- Diario ----------
export const entriesFor = (date: string) =>
  db().getAllAsync<LogEntry>('SELECT * FROM log_entries WHERE date = ? ORDER BY created_at, id', date);
export const getEntry = (id: number) => db().getFirstAsync<LogEntry>('SELECT * FROM log_entries WHERE id = ?', id);
export type NewEntry = Omit<LogEntry, 'id'>;
export async function addEntry(e: NewEntry) {
  const r = await db().runAsync(
    'INSERT INTO log_entries (date, meal, name, grams, qty_label, kcal, p, f, c, fiber, food_id, recipe_id, photo_uri, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    e.date, e.meal, e.name, e.grams, e.qty_label, e.kcal, e.p, e.f, e.c, e.fiber ?? 0, e.food_id, e.recipe_id, e.photo_uri, e.source
  );
  bump();
  return r.lastInsertRowId;
}
export async function addEntries(list: NewEntry[]) {
  await db().withTransactionAsync(async () => {
    for (const e of list) {
      await db().runAsync(
        'INSERT INTO log_entries (date, meal, name, grams, qty_label, kcal, p, f, c, fiber, food_id, recipe_id, photo_uri, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        e.date, e.meal, e.name, e.grams, e.qty_label, e.kcal, e.p, e.f, e.c, e.fiber ?? 0, e.food_id, e.recipe_id, e.photo_uri, e.source
      );
    }
  });
  bump();
}
export async function updateEntry(id: number, e: Partial<LogEntry>) {
  const keys = Object.keys(e).filter(k => k !== 'id');
  if (!keys.length) return;
  await db().runAsync(
    `UPDATE log_entries SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
    ...keys.map(k => (e as any)[k] ?? null), id
  );
  bump();
}
export async function deleteEntry(id: number) {
  await db().runAsync('DELETE FROM log_entries WHERE id = ?', id);
  bump();
}
export async function copyDay(from: string, to: string, meal?: Meal) {
  const src = (await entriesFor(from)).filter(e => !meal || e.meal === meal);
  await addEntries(src.map(({ id, ...e }) => ({ ...e, date: to })));
  return src.length;
}
export type Recent = Macros & { name: string; grams: number; qty_label: string | null; food_id: number | null; recipe_id: number | null; fiber: number; times: number };
export const recentEntries = () =>
  db().getAllAsync<Recent>(
    `SELECT name, grams, qty_label, kcal, p, f, c, fiber, food_id, recipe_id, COUNT(*) AS times, MAX(created_at) AS last
     FROM log_entries GROUP BY name, ROUND(grams) ORDER BY last DESC LIMIT 40`
  );
export type DayTotal = Macros & { date: string; n: number };
export const dailyTotals = (from: string, to: string) =>
  db().getAllAsync<DayTotal>(
    `SELECT date, SUM(kcal) kcal, SUM(p) p, SUM(f) f, SUM(c) c, SUM(fiber) fiber, COUNT(*) n
     FROM log_entries WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
    from, to
  );
export const loggedDates = () =>
  db().getAllAsync<{ date: string }>('SELECT DISTINCT date FROM log_entries ORDER BY date DESC LIMIT 400');

// ---------- Agua ----------
export async function getWater(date: string) {
  const r = await db().getFirstAsync<{ ml: number }>('SELECT ml FROM water WHERE date = ?', date);
  return r?.ml ?? 0;
}
export async function addWater(date: string, ml: number) {
  await db().runAsync(
    'INSERT INTO water (date, ml) VALUES (?, MAX(0, ?)) ON CONFLICT(date) DO UPDATE SET ml = MAX(0, ml + ?)',
    date, ml, ml
  );
  bump();
}

// ---------- Comidas guardadas ----------
export async function savedMeals(): Promise<SavedMeal[]> {
  const rows = await db().getAllAsync<{ id: number; name: string; items: string }>('SELECT * FROM saved_meals ORDER BY created_at DESC');
  return rows.map(r => ({ ...r, items: JSON.parse(r.items) }));
}
export async function saveMeal(name: string, items: LogEntry[]) {
  const clean = items.map(({ id, date, meal, ...rest }) => rest);
  await db().runAsync('INSERT INTO saved_meals (name, items) VALUES (?, ?)', name, JSON.stringify(clean));
  bump();
}
export async function deleteSavedMeal(id: number) {
  await db().runAsync('DELETE FROM saved_meals WHERE id = ?', id);
  bump();
}

// ---------- Recetas ----------
function parseRecipe(r: any): Recipe {
  return { ...r, items: JSON.parse(r.items || '[]') };
}
export async function listRecipes(): Promise<Recipe[]> {
  return (await db().getAllAsync<any>('SELECT * FROM recipes ORDER BY favorite DESC, builtin, name')).map(parseRecipe);
}
export async function getRecipe(id: number): Promise<Recipe | null> {
  const r = await db().getFirstAsync<any>('SELECT * FROM recipes WHERE id = ?', id);
  return r ? parseRecipe(r) : null;
}
export async function saveRecipe(r: Omit<Recipe, 'id' | 'builtin' | 'favorite'> & { id?: number }) {
  const items = JSON.stringify(r.items);
  if (r.id) {
    await db().runAsync(
      'UPDATE recipes SET name=?, servings=?, minutes=?, tags=?, steps=?, photo_uri=?, items=? WHERE id=?',
      r.name, r.servings, r.minutes, r.tags, r.steps, r.photo_uri, items, r.id
    );
    bump();
    return r.id;
  }
  const res = await db().runAsync(
    'INSERT INTO recipes (name, servings, minutes, tags, steps, photo_uri, items) VALUES (?,?,?,?,?,?,?)',
    r.name, r.servings, r.minutes, r.tags, r.steps, r.photo_uri, items
  );
  bump();
  return res.lastInsertRowId;
}
export async function deleteRecipe(id: number) {
  await db().runAsync('DELETE FROM recipes WHERE id = ?', id);
  bump();
}
export async function toggleFavoriteRecipe(id: number, fav: boolean) {
  await db().runAsync('UPDATE recipes SET favorite = ? WHERE id = ?', fav ? 1 : 0, id);
  bump();
}
export function recipeTotals(items: RecipeItem[]) {
  return items.reduce(
    (t, i) => ({ kcal: t.kcal + i.kcal, p: t.p + i.p, f: t.f + i.f, c: t.c + i.c, fiber: t.fiber + (i.fiber ?? 0), grams: t.grams + i.grams }),
    { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, grams: 0 }
  );
}

// ---------- Ejercicios y rutinas ----------
export type Exercise = { id: number; name: string; muscle: string; equipment: string | null; type: 'w' | 'b' | 't' | 'c'; notes: string | null; builtin: number };
export type Routine = { id: number; name: string; notes: string | null; position: number };
export type RoutineExercise = { id: number; routine_id: number; exercise_id: number; position: number; sets: number; reps: string; rest_sec: number; name: string; muscle: string; type: Exercise['type'] };

export const listExercises = () => db().getAllAsync<Exercise>('SELECT * FROM exercises ORDER BY muscle, name');
export const getExercise = (id: number) => db().getFirstAsync<Exercise>('SELECT * FROM exercises WHERE id = ?', id);
export async function addExercise(e: Omit<Exercise, 'id' | 'builtin'>) {
  const r = await db().runAsync('INSERT INTO exercises (name, muscle, equipment, type, notes) VALUES (?,?,?,?,?)', e.name, e.muscle, e.equipment, e.type, e.notes);
  bump();
  return r.lastInsertRowId;
}
export const listRoutines = () =>
  db().getAllAsync<Routine & { n: number; muscles: string | null }>(
    `SELECT r.*, COUNT(re.id) n, GROUP_CONCAT(DISTINCT e.muscle) muscles FROM routines r
     LEFT JOIN routine_exercises re ON re.routine_id = r.id LEFT JOIN exercises e ON e.id = re.exercise_id
     GROUP BY r.id ORDER BY r.position, r.id`
  );
export const getRoutine = (id: number) => db().getFirstAsync<Routine>('SELECT * FROM routines WHERE id = ?', id);
export const routineExercises = (id: number) =>
  db().getAllAsync<RoutineExercise>(
    `SELECT re.*, e.name, e.muscle, e.type FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id
     WHERE re.routine_id = ? ORDER BY re.position`,
    id
  );
export async function saveRoutine(r: { id?: number; name: string; notes: string | null; items: { exercise_id: number; sets: number; reps: string; rest_sec: number }[] }) {
  let id = r.id;
  await db().withTransactionAsync(async () => {
    if (id) {
      await db().runAsync('UPDATE routines SET name=?, notes=? WHERE id=?', r.name, r.notes, id);
      await db().runAsync('DELETE FROM routine_exercises WHERE routine_id = ?', id);
    } else {
      const max = await db().getFirstAsync<{ m: number | null }>('SELECT MAX(position) m FROM routines');
      id = (await db().runAsync('INSERT INTO routines (name, notes, position) VALUES (?,?,?)', r.name, r.notes, (max?.m ?? 0) + 1)).lastInsertRowId;
    }
    let i = 0;
    for (const it of r.items) {
      await db().runAsync(
        'INSERT INTO routine_exercises (routine_id, exercise_id, position, sets, reps, rest_sec) VALUES (?,?,?,?,?,?)',
        id!, it.exercise_id, i++, it.sets, it.reps, it.rest_sec
      );
    }
  });
  bump();
  return id!;
}
export async function deleteRoutine(id: number) {
  await db().runAsync('DELETE FROM routines WHERE id = ?', id);
  bump();
}

// ---------- Entrenamientos ----------
export type Workout = { id: number; routine_id: number | null; name: string; started_at: number; ended_at: number | null; notes: string | null };
export type WorkoutSet = { id: number; workout_id: number; exercise_id: number; position: number; set_index: number; weight: number | null; reps: number | null; seconds: number | null; distance: number | null; done: number; kind: string };

export const listWorkouts = (limit = 100) =>
  db().getAllAsync<Workout & { volume: number; sets: number }>(
    `SELECT w.*, COALESCE(SUM(CASE WHEN s.done THEN COALESCE(s.weight,0) * COALESCE(s.reps,0) END),0) volume,
            COALESCE(SUM(s.done),0) sets
     FROM workouts w LEFT JOIN workout_sets s ON s.workout_id = w.id
     WHERE w.ended_at IS NOT NULL GROUP BY w.id ORDER BY w.started_at DESC LIMIT ?`,
    limit
  );
export const activeWorkout = () => db().getFirstAsync<Workout>('SELECT * FROM workouts WHERE ended_at IS NULL ORDER BY started_at DESC');
export const getWorkout = (id: number) => db().getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', id);
export const workoutSets = (id: number) =>
  db().getAllAsync<WorkoutSet & { name: string; muscle: string; type: Exercise['type'] }>(
    `SELECT s.*, e.name, e.muscle, e.type FROM workout_sets s JOIN exercises e ON e.id = s.exercise_id
     WHERE s.workout_id = ? ORDER BY s.position, s.set_index`,
    id
  );

/** Último registro de cada serie para un ejercicio (para mostrar "anterior"). */
export async function previousSets(exerciseId: number, excludeWorkout?: number) {
  const w = await db().getFirstAsync<{ workout_id: number }>(
    `SELECT s.workout_id FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
     WHERE s.exercise_id = ? AND s.done = 1 AND w.ended_at IS NOT NULL AND s.workout_id != ?
     ORDER BY w.started_at DESC LIMIT 1`,
    exerciseId, excludeWorkout ?? -1
  );
  if (!w) return [];
  return db().getAllAsync<WorkoutSet>(
    'SELECT * FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND done = 1 ORDER BY set_index',
    w.workout_id, exerciseId
  );
}

export async function startWorkout(routineId: number | null) {
  const existing = await activeWorkout();
  if (existing) return existing.id;
  const now = Date.now();
  let name = 'Entrenamiento libre';
  let id = 0;
  await db().withTransactionAsync(async () => {
    if (routineId) {
      const r = await getRoutine(routineId);
      if (r) name = r.name;
    }
    id = (await db().runAsync('INSERT INTO workouts (routine_id, name, started_at) VALUES (?,?,?)', routineId, name, now)).lastInsertRowId;
    if (routineId) {
      const items = await routineExercises(routineId);
      for (const it of items) {
        const prev = await previousSets(it.exercise_id);
        for (let s = 0; s < it.sets; s++) {
          const p = prev[s] ?? prev[prev.length - 1];
          await db().runAsync(
            'INSERT INTO workout_sets (workout_id, exercise_id, position, set_index, weight, reps, seconds) VALUES (?,?,?,?,?,?,?)',
            id, it.exercise_id, it.position, s, p?.weight ?? null, p?.reps ?? null, p?.seconds ?? null
          );
        }
      }
    }
  });
  bump();
  return id;
}
export async function addExerciseToWorkout(workoutId: number, exerciseId: number, sets = 3) {
  const pos = await db().getFirstAsync<{ m: number | null }>('SELECT MAX(position) m FROM workout_sets WHERE workout_id = ?', workoutId);
  const position = (pos?.m ?? -1) + 1;
  const prev = await previousSets(exerciseId);
  for (let s = 0; s < sets; s++) {
    const p = prev[s] ?? prev[prev.length - 1];
    await db().runAsync(
      'INSERT INTO workout_sets (workout_id, exercise_id, position, set_index, weight, reps, seconds) VALUES (?,?,?,?,?,?,?)',
      workoutId, exerciseId, position, s, p?.weight ?? null, p?.reps ?? null, p?.seconds ?? null
    );
  }
  bump();
}
export async function addSet(workoutId: number, exerciseId: number, position: number) {
  const last = await db().getFirstAsync<WorkoutSet>(
    'SELECT * FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND position = ? ORDER BY set_index DESC LIMIT 1',
    workoutId, exerciseId, position
  );
  await db().runAsync(
    'INSERT INTO workout_sets (workout_id, exercise_id, position, set_index, weight, reps, seconds, distance) VALUES (?,?,?,?,?,?,?,?)',
    workoutId, exerciseId, position, (last?.set_index ?? -1) + 1, last?.weight ?? null, last?.reps ?? null, last?.seconds ?? null, last?.distance ?? null
  );
  bump();
}
export async function updateSet(id: number, s: Partial<WorkoutSet>) {
  const keys = Object.keys(s).filter(k => k !== 'id');
  await db().runAsync(`UPDATE workout_sets SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map(k => (s as any)[k] ?? null), id);
  bump();
}
export async function deleteSet(id: number) {
  await db().runAsync('DELETE FROM workout_sets WHERE id = ?', id);
  bump();
}
export async function removeExerciseFromWorkout(workoutId: number, position: number) {
  await db().runAsync('DELETE FROM workout_sets WHERE workout_id = ? AND position = ?', workoutId, position);
  bump();
}
export async function finishWorkout(id: number, notes: string | null) {
  await db().runAsync('DELETE FROM workout_sets WHERE workout_id = ? AND done = 0', id);
  await db().runAsync('UPDATE workouts SET ended_at = ?, notes = ? WHERE id = ?', Date.now(), notes, id);
  bump();
}
export async function discardWorkout(id: number) {
  await db().runAsync('DELETE FROM workouts WHERE id = ?', id);
  bump();
}
export async function deleteWorkout(id: number) {
  await discardWorkout(id);
}

/** Historial de un ejercicio: mejor serie por entrenamiento. */
export const exerciseHistory = (exerciseId: number) =>
  db().getAllAsync<{ workout_id: number; started_at: number; best_weight: number; best_reps: number; e1rm: number; volume: number; sets: number }>(
    `SELECT w.id workout_id, w.started_at,
            MAX(COALESCE(s.weight,0)) best_weight, MAX(COALESCE(s.reps,0)) best_reps,
            MAX(COALESCE(s.weight,0) * (1 + COALESCE(s.reps,0) / 30.0)) e1rm,
            SUM(COALESCE(s.weight,0) * COALESCE(s.reps,0)) volume, COUNT(*) sets
     FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
     WHERE s.exercise_id = ? AND s.done = 1 AND w.ended_at IS NOT NULL
     GROUP BY w.id ORDER BY w.started_at`,
    exerciseId
  );
export const personalRecords = () =>
  db().getAllAsync<{ exercise_id: number; name: string; muscle: string; weight: number; reps: number; e1rm: number; date: number }>(
    `SELECT e.id exercise_id, e.name, e.muscle, s.weight, s.reps,
            MAX(s.weight * (1 + s.reps / 30.0)) e1rm, w.started_at date
     FROM workout_sets s JOIN exercises e ON e.id = s.exercise_id JOIN workouts w ON w.id = s.workout_id
     WHERE s.done = 1 AND s.weight > 0 AND s.reps > 0 AND w.ended_at IS NOT NULL
     GROUP BY e.id ORDER BY e1rm DESC`
  );
export const trainedDays = (fromMs: number) =>
  db().getAllAsync<{ started_at: number }>('SELECT started_at FROM workouts WHERE ended_at IS NOT NULL AND started_at >= ?', fromMs);

// ---------- Cuerpo ----------
export type Weight = { date: string; kg: number };
export type Measurement = { id: number; date: string; waist: number | null; chest: number | null; hips: number | null; arm: number | null; thigh: number | null; neck: number | null; calf: number | null; shoulders: number | null; body_fat: number | null; notes: string | null };
export type ProgressPhoto = { id: number; date: string; uri: string; pose: string | null; weight: number | null };

export const listWeights = () => db().getAllAsync<Weight>('SELECT * FROM body_weights ORDER BY date');
export const latestWeight = () => db().getFirstAsync<Weight>('SELECT * FROM body_weights ORDER BY date DESC LIMIT 1');
export async function setWeight(date: string, kg: number) {
  await db().runAsync('INSERT OR REPLACE INTO body_weights (date, kg) VALUES (?, ?)', date, kg);
  bump();
}
export async function deleteWeight(date: string) {
  await db().runAsync('DELETE FROM body_weights WHERE date = ?', date);
  bump();
}
export const listMeasurements = () => db().getAllAsync<Measurement>('SELECT * FROM measurements ORDER BY date DESC, id DESC');
export async function addMeasurement(m: Omit<Measurement, 'id'>) {
  await db().runAsync(
    'INSERT INTO measurements (date, waist, chest, hips, arm, thigh, neck, calf, shoulders, body_fat, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    m.date, m.waist, m.chest, m.hips, m.arm, m.thigh, m.neck, m.calf, m.shoulders, m.body_fat, m.notes
  );
  bump();
}
export async function deleteMeasurement(id: number) {
  await db().runAsync('DELETE FROM measurements WHERE id = ?', id);
  bump();
}
export const listPhotos = () => db().getAllAsync<ProgressPhoto>('SELECT * FROM progress_photos ORDER BY date DESC, id DESC');
export async function addPhoto(p: Omit<ProgressPhoto, 'id'>) {
  await db().runAsync('INSERT INTO progress_photos (date, uri, pose, weight) VALUES (?,?,?,?)', p.date, p.uri, p.pose, p.weight);
  bump();
}
export async function deletePhoto(id: number) {
  await db().runAsync('DELETE FROM progress_photos WHERE id = ?', id);
  bump();
}

// ---------- Ayuno ----------
export type Fast = { id: number; started_at: number; ended_at: number | null; target_h: number };
export const activeFast = () => db().getFirstAsync<Fast>('SELECT * FROM fasts WHERE ended_at IS NULL ORDER BY started_at DESC');
export const listFasts = () => db().getAllAsync<Fast>('SELECT * FROM fasts WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT 60');
export async function startFast(targetH: number, startedAt = Date.now()) {
  await db().runAsync('INSERT INTO fasts (started_at, target_h) VALUES (?, ?)', startedAt, targetH);
  bump();
}
export async function endFast(id: number) {
  await db().runAsync('UPDATE fasts SET ended_at = ? WHERE id = ?', Date.now(), id);
  bump();
}
export async function deleteFast(id: number) {
  await db().runAsync('DELETE FROM fasts WHERE id = ?', id);
  bump();
}

// ---------- Respaldo ----------
const TABLES = ['settings', 'foods', 'log_entries', 'water', 'saved_meals', 'recipes', 'exercises', 'routines', 'routine_exercises', 'workouts', 'workout_sets', 'body_weights', 'measurements', 'progress_photos', 'fasts'];
export async function exportAll() {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) out[t] = await db().getAllAsync(`SELECT * FROM ${t}`);
  return { app: 'macro-diario', version: 1, exportedAt: new Date().toISOString(), data: out };
}
export async function importAll(json: { app?: string; data?: Record<string, Record<string, unknown>[]> }) {
  if (json.app !== 'macro-diario' || !json.data) throw new Error('El archivo no es un respaldo de Macro Diario.');
  await db().execAsync('PRAGMA foreign_keys = OFF');
  try {
    await db().withTransactionAsync(async () => {
      for (const t of TABLES) {
        const rows = json.data![t];
        if (!Array.isArray(rows)) continue;
        await db().runAsync(`DELETE FROM ${t}`);
        for (const row of rows) {
          const cols = Object.keys(row);
          if (!cols.length) continue;
          await db().runAsync(
            `INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
            ...cols.map(c => row[c] as any)
          );
        }
      }
    });
  } finally {
    await db().execAsync('PRAGMA foreign_keys = ON');
  }
  bump();
}
