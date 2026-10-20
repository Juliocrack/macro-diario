import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../formulas.ts';

const near = (a: number, b: number, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

test('IMC', () => {
  near(F.bmi(70, 175), 22.86, 0.01);
  assert.equal(F.bmiCategory(22.86), 'Normal');
  assert.equal(F.bmiCategory(31), 'Obesidad grado I');
});

test('TMB Mifflin y Harris-Benedict', () => {
  near(F.bmrMifflin('h', 70, 175, 25), 1673.75, 0.01);
  near(F.bmrMifflin('m', 60, 165, 30), 1320.25, 0.01);
  near(F.bmrHarrisBenedict('h', 70, 175, 25), 1724.1, 1);
  near(F.bmrKatchMcArdle(80, 15), 1838.8, 0.1);
  near(F.tdee(1673.75, 'mod'), 2594.3, 0.1);
});

test('Macros', () => {
  const m = F.macrosFor(2300, 70, 1.8, 0.25);
  assert.equal(m.p, 126);
  assert.equal(m.f, 64);
  assert.equal(F.macroKcal(125, 65, 304), 2301);
});

test('Grasa Navy', () => {
  // Hombre 178 cm, cintura 85, cuello 38 → ~17–19 %
  const h = F.bodyFatNavy('h', 178, 85, 38);
  assert.ok(h > 15 && h < 20, String(h));
  const m = F.bodyFatNavy('m', 165, 75, 33, 100);
  assert.ok(m > 25 && m < 33, String(m));
});

test('1RM', () => {
  const r = F.oneRM(100, 5);
  near(r.epley, 116.67, 0.01);
  near(r.brzycki, 112.5, 0.01);
  assert.equal(F.oneRM(100, 1).avg, 100);
});

test('Peso ideal y FFMI', () => {
  const w = F.idealWeights('h', 175);
  near(w.Devine, 70.5, 0.3);
  const f = F.ffmi(80, 180, 15);
  near(f.ffmi, 20.99, 0.02);
});

test('Proyección', () => {
  const p = F.weightProjection(80, 75, -500)!;
  near(p.days, 77, 0.01);
  assert.equal(F.weightProjection(80, 75, 300), null);
});

test('Zonas FC', () => {
  const z = F.hrZones(30);
  assert.equal(z.length, 5);
  near(F.maxHeartRate(30), 187, 0.01);
});
