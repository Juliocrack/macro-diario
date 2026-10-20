// Puente simple para devolver selecciones entre pantallas (ej. elegir un alimento para una receta).
import type { Exercise, RecipeItem } from '@/db';

let foodCb: ((item: RecipeItem) => void) | null = null;
let exCb: ((ex: Exercise[]) => void) | null = null;

export const pickFoodFor = (cb: (item: RecipeItem) => void) => {
  foodCb = cb;
};
export const hasFoodPicker = () => !!foodCb;
export function deliverFood(item: RecipeItem) {
  const cb = foodCb;
  foodCb = null;
  cb?.(item);
}
export const clearFoodPicker = () => {
  foodCb = null;
};

export const pickExercisesFor = (cb: (ex: Exercise[]) => void) => {
  exCb = cb;
};
export function deliverExercises(ex: Exercise[]) {
  const cb = exCb;
  exCb = null;
  cb?.(ex);
}
