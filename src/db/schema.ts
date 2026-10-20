import type { SQLiteDatabase } from 'expo-sqlite';
import { SEED_FOODS } from '@/data/foods';
import { SEED_EXERCISES, SEED_ROUTINES } from '@/data/exercises';
import { SEED_RECIPES } from '@/data/recipes';

const DB_VERSION = 1;

const SCHEMA_V1 = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS foods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  kcal REAL NOT NULL, p REAL NOT NULL, f REAL NOT NULL, c REAL NOT NULL,
  fiber REAL DEFAULT 0, sugar REAL, sodium REAL,
  serving_name TEXT, serving_g REAL,
  source TEXT NOT NULL DEFAULT 'base',
  barcode TEXT,
  favorite INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);
CREATE INDEX IF NOT EXISTS idx_foods_barcode ON foods(barcode);

CREATE TABLE IF NOT EXISTS log_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  meal TEXT NOT NULL,
  name TEXT NOT NULL,
  grams REAL NOT NULL DEFAULT 0,
  qty_label TEXT,
  kcal REAL NOT NULL, p REAL NOT NULL, f REAL NOT NULL, c REAL NOT NULL, fiber REAL DEFAULT 0,
  food_id INTEGER, recipe_id INTEGER,
  photo_uri TEXT,
  source TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_log_date ON log_entries(date);

CREATE TABLE IF NOT EXISTS water (date TEXT PRIMARY KEY NOT NULL, ml REAL NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS saved_meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  items TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  servings REAL NOT NULL DEFAULT 1,
  minutes INTEGER,
  tags TEXT,
  steps TEXT,
  photo_uri TEXT,
  items TEXT NOT NULL,
  builtin INTEGER NOT NULL DEFAULT 0,
  favorite INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  muscle TEXT NOT NULL,
  equipment TEXT,
  type TEXT NOT NULL DEFAULT 'w',
  notes TEXT,
  builtin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS routine_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  sets INTEGER NOT NULL DEFAULT 3,
  reps TEXT DEFAULT '8-12',
  rest_sec INTEGER NOT NULL DEFAULT 90
);

CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER,
  name TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS workout_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  set_index INTEGER NOT NULL,
  weight REAL, reps INTEGER, seconds INTEGER, distance REAL,
  done INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'n'
);
CREATE INDEX IF NOT EXISTS idx_sets_ex ON workout_sets(exercise_id);

CREATE TABLE IF NOT EXISTS body_weights (date TEXT PRIMARY KEY NOT NULL, kg REAL NOT NULL);
CREATE TABLE IF NOT EXISTS measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  waist REAL, chest REAL, hips REAL, arm REAL, thigh REAL, neck REAL, calf REAL, shoulders REAL,
  body_fat REAL, notes TEXT
);
CREATE TABLE IF NOT EXISTS progress_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  uri TEXT NOT NULL,
  pose TEXT,
  weight REAL
);
CREATE TABLE IF NOT EXISTS fasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  target_h REAL NOT NULL DEFAULT 16
);
`;

export async function migrate(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= DB_VERSION) return;
  if (current < 1) {
    await db.execAsync(SCHEMA_V1);
    await seed(db);
  }
  await db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);
}

async function seed(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    const insFood = await db.prepareAsync(
      'INSERT INTO foods (name, category, kcal, p, f, c, fiber, serving_name, serving_g, source) VALUES (?,?,?,?,?,?,?,?,?,\'base\')'
    );
    try {
      for (const [n, cat, k, p, f, c, fib, sn, sg] of SEED_FOODS) {
        await insFood.executeAsync(n, cat, k, p, f, c, fib, sn ?? null, sg ?? null);
      }
    } finally {
      await insFood.finalizeAsync();
    }

    const insEx = await db.prepareAsync('INSERT INTO exercises (name, muscle, equipment, type, builtin) VALUES (?,?,?,?,1)');
    try {
      for (const [n, m, e, t] of SEED_EXERCISES) await insEx.executeAsync(n, m, e, t);
    } finally {
      await insEx.finalizeAsync();
    }

    const exIds = new Map<string, number>();
    for (const r of await db.getAllAsync<{ id: number; name: string }>('SELECT id, name FROM exercises')) exIds.set(r.name, r.id);
    let pos = 0;
    for (const [name, notes, items] of SEED_ROUTINES) {
      const res = await db.runAsync('INSERT INTO routines (name, notes, position) VALUES (?,?,?)', name, notes, pos++);
      let i = 0;
      for (const [ex, sets, reps, rest] of items) {
        const exId = exIds.get(ex);
        if (!exId) continue;
        await db.runAsync(
          'INSERT INTO routine_exercises (routine_id, exercise_id, position, sets, reps, rest_sec) VALUES (?,?,?,?,?,?)',
          res.lastInsertRowId, exId, i++, sets, reps, rest
        );
      }
    }

    const foods = new Map<string, { id: number; kcal: number; p: number; f: number; c: number; fiber: number }>();
    for (const r of await db.getAllAsync<any>('SELECT id, name, kcal, p, f, c, fiber FROM foods')) foods.set(r.name, r);
    for (const r of SEED_RECIPES) {
      const items = r.items
        .map(([name, g]) => {
          const fd = foods.get(name);
          if (!fd) return null;
          const k = g / 100;
          return { food_id: fd.id, name, grams: g, kcal: fd.kcal * k, p: fd.p * k, f: fd.f * k, c: fd.c * k, fiber: (fd.fiber ?? 0) * k };
        })
        .filter(Boolean);
      await db.runAsync(
        'INSERT INTO recipes (name, servings, minutes, tags, steps, items, builtin) VALUES (?,?,?,?,?,?,1)',
        r.name, r.servings, r.minutes, r.tags, r.steps, JSON.stringify(items)
      );
    }
  });
}
