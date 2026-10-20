// Recetas base. Los ingredientes hacen referencia a nombres de SEED_FOODS y los macros se calculan al sembrar.
export type SeedRecipe = {
  name: string;
  servings: number;
  minutes: number;
  tags: string;
  items: [food: string, grams: number][];
  steps: string;
};

export const SEED_RECIPES: SeedRecipe[] = [
  {
    name: 'Avena proteica con plátano',
    servings: 1, minutes: 8, tags: 'Desayuno · Alta en proteína',
    items: [['Avena en hojuelas', 60], ['Leche descremada', 240], ['Proteína whey', 30], ['Plátano', 100], ['Crema de cacahuate', 10]],
    steps: '1. Cuece la avena con la leche 3–4 min a fuego medio.\n2. Retira del fuego y deja enfriar 1 min.\n3. Integra la proteína moviendo rápido para que no se haga grumos.\n4. Sirve con el plátano en rodajas y la crema de cacahuate.',
  },
  {
    name: 'Omelette de claras con espinaca y panela',
    servings: 1, minutes: 10, tags: 'Desayuno · Bajo en grasa',
    items: [['Clara de huevo', 200], ['Huevo entero', 50], ['Espinaca', 40], ['Queso panela', 40], ['Tortilla de maíz', 60], ['Salsa verde', 30]],
    steps: '1. Bate las claras con el huevo y una pizca de sal.\n2. Saltea la espinaca en un sartén antiadherente.\n3. Agrega el huevo, cocina a fuego bajo y añade el panela en cubos.\n4. Dobla y sirve con tortillas calientes y salsa.',
  },
  {
    name: 'Bowl de pollo, arroz y frijoles',
    servings: 1, minutes: 15, tags: 'Comida · Meal prep',
    items: [['Pechuga de pollo cocida', 150], ['Arroz blanco cocido', 180], ['Frijoles negros cocidos', 100], ['Aguacate', 50], ['Jitomate', 60], ['Salsa roja', 30]],
    steps: '1. Asa la pechuga sazonada con sal, ajo y comino; córtala en tiras.\n2. Sirve el arroz y los frijoles en un bowl.\n3. Agrega el pollo, el aguacate y el jitomate picado.\n4. Termina con salsa al gusto.',
  },
  {
    name: 'Tacos de pollo al pastor fit',
    servings: 2, minutes: 25, tags: 'Comida · Mexicana',
    items: [['Pechuga de pollo cruda', 300], ['Piña', 100], ['Cebolla', 60], ['Tortilla de maíz', 180], ['Salsa verde', 60]],
    steps: '1. Marina el pollo en tiras con adobo de chile guajillo, achiote, vinagre y especias (30 min o más).\n2. Cocina en sartén muy caliente hasta dorar.\n3. Asa la piña en cubos.\n4. Sirve en tortillas con cebolla, piña y salsa.',
  },
  {
    name: 'Atún a la mexicana',
    servings: 1, minutes: 10, tags: 'Comida · Rápida',
    items: [['Atún en agua', 140], ['Jitomate', 80], ['Cebolla', 30], ['Chile jalapeño', 15], ['Aguacate', 40], ['Tostada horneada', 36]],
    steps: '1. Escurre el atún.\n2. Pica jitomate, cebolla y chile; mezcla con el atún, limón y sal.\n3. Sirve sobre tostadas con aguacate.',
  },
  {
    name: 'Salmón con camote y brócoli',
    servings: 1, minutes: 30, tags: 'Cena · Omega 3',
    items: [['Salmón cocido', 150], ['Camote cocido', 200], ['Brócoli cocido', 150], ['Aceite de oliva', 5]],
    steps: '1. Hornea el camote en cubos a 200 °C por 20 min.\n2. Sella el salmón 4 min por lado.\n3. Cuece el brócoli al vapor 5 min.\n4. Sirve con un chorrito de aceite de oliva y limón.',
  },
  {
    name: 'Picadillo ligero con verduras',
    servings: 4, minutes: 30, tags: 'Comida · Meal prep',
    items: [['Carne molida de res 90/10 cocida', 450], ['Papa cocida', 300], ['Zanahoria', 140], ['Calabacita', 200], ['Jitomate', 240], ['Cebolla', 60]],
    steps: '1. Dora la carne con cebolla.\n2. Licúa el jitomate con ajo y agrégalo.\n3. Añade papa, zanahoria y calabacita en cubos.\n4. Cocina tapado 15 min hasta que las verduras estén suaves.',
  },
  {
    name: 'Licuado de proteína con avena',
    servings: 1, minutes: 3, tags: 'Snack · Post-entreno',
    items: [['Leche descremada', 300], ['Proteína whey', 30], ['Avena en hojuelas', 40], ['Plátano', 120], ['Crema de cacahuate', 16]],
    steps: '1. Licúa todo con hielo hasta que quede homogéneo.\n2. Toma dentro de las 2 horas después de entrenar.',
  },
  {
    name: 'Yogur griego con fruta y granola',
    servings: 1, minutes: 3, tags: 'Snack · Desayuno',
    items: [['Yogur griego natural 0%', 200], ['Fresas', 100], ['Moras azules', 50], ['Granola', 30], ['Miel', 10]],
    steps: '1. Sirve el yogur en un bowl.\n2. Agrega la fruta picada, la granola y la miel.',
  },
  {
    name: 'Hot cakes de avena y plátano',
    servings: 2, minutes: 15, tags: 'Desayuno · Sin harina',
    items: [['Avena en hojuelas', 80], ['Plátano', 120], ['Huevo entero', 100], ['Clara de huevo', 100], ['Leche descremada', 60], ['Miel', 20]],
    steps: '1. Licúa avena, plátano, huevos, claras y leche con canela y polvo para hornear.\n2. Cocina en sartén antiadherente a fuego medio-bajo.\n3. Voltea cuando salgan burbujas.\n4. Sirve con un poco de miel.',
  },
  {
    name: 'Ensalada de pollo y garbanzo',
    servings: 1, minutes: 10, tags: 'Comida · Alta en fibra',
    items: [['Pechuga de pollo cocida', 120], ['Garbanzo cocido', 120], ['Lechuga', 80], ['Pepino', 100], ['Jitomate', 80], ['Aceite de oliva', 10]],
    steps: '1. Corta el pollo y las verduras.\n2. Mezcla con el garbanzo escurrido.\n3. Adereza con aceite de oliva, limón, sal y pimienta.',
  },
  {
    name: 'Tinga de pollo en tostadas',
    servings: 3, minutes: 35, tags: 'Comida · Mexicana',
    items: [['Pollo deshebrado', 360], ['Jitomate', 360], ['Cebolla', 110], ['Tostada horneada', 108], ['Crema ácida', 45], ['Lechuga', 60]],
    steps: '1. Fríe la cebolla en tiras con poco aceite.\n2. Licúa el jitomate con chipotle y ajo; agrégalo a la cebolla.\n3. Incorpora el pollo y cocina 10 min.\n4. Sirve sobre tostadas con lechuga y crema.',
  },
];
