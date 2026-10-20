// Open Food Facts: base de datos abierta de productos empaquetados (códigos de barras).
const UA = 'MacroDiario/1.0 (app personal)';

export type OffProduct = {
  barcode: string;
  name: string;
  brand: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  fiber: number;
  sugar: number | null;
  sodium: number | null;
  serving_name: string | null;
  serving_g: number | null;
  image: string | null;
};

const n = (x: unknown) => {
  const v = typeof x === 'number' ? x : parseFloat(String(x));
  return Number.isFinite(v) ? v : null;
};

function map(p: any, code?: string): OffProduct | null {
  if (!p) return null;
  const nu = p.nutriments ?? {};
  let kcal = n(nu['energy-kcal_100g']);
  if (kcal == null && n(nu['energy_100g']) != null) kcal = (n(nu['energy_100g']) as number) / 4.184;
  if (kcal == null) return null;
  const name = p.product_name_es || p.product_name || p.generic_name_es || p.generic_name;
  if (!name) return null;
  const sq = n(p.serving_quantity);
  return {
    barcode: String(code ?? p.code ?? ''),
    name: String(name).trim(),
    brand: String(p.brands ?? '').split(',')[0].trim(),
    kcal,
    p: n(nu.proteins_100g) ?? 0,
    f: n(nu.fat_100g) ?? 0,
    c: n(nu.carbohydrates_100g) ?? 0,
    fiber: n(nu.fiber_100g) ?? 0,
    sugar: n(nu.sugars_100g),
    sodium: n(nu.sodium_100g) != null ? (n(nu.sodium_100g) as number) * 1000 : null,
    serving_name: p.serving_size ? String(p.serving_size) : null,
    serving_g: sq && sq > 0 ? sq : null,
    image: p.image_front_small_url ?? null,
  };
}

const FIELDS = 'code,product_name,product_name_es,generic_name,generic_name_es,brands,nutriments,serving_size,serving_quantity,image_front_small_url';

export async function lookupBarcode(code: string): Promise<OffProduct | null> {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, {
    headers: { 'User-Agent': UA },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Open Food Facts respondió ${r.status}`);
  const j: any = await r.json();
  if (j.status !== 1) return null;
  return map(j.product, code);
}

export async function searchOff(q: string): Promise<OffProduct[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}&countries_tags_en=mexico`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Open Food Facts respondió ${r.status}`);
  const j: any = await r.json();
  return (j.products ?? []).map((p: any) => map(p)).filter(Boolean) as OffProduct[];
}
