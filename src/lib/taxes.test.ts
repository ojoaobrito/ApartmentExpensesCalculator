import { describe, expect, it } from 'vitest';
import { acquisitionTaxes, imtHPP, imtJovem } from './taxes';

describe('IMT 2026', () => {
  it('matches the worked example at 230k', () => {
    expect(imtHPP(230_000)).toBeCloseTo(5_642.04, 2);
    expect(imtHPP(100_000)).toBe(0);
    expect(imtHPP(700_000)).toBeCloseTo(42_000, 2);
  });
  it('IMT Jovem', () => {
    expect(imtJovem(230_000)).toBe(0);
    expect(imtJovem(340_539)).toBeCloseTo(800, 2);
  });
  it('splits the benefit by share', () => {
    const t = acquisitionTaxes(230_000, [
      { sharePct: 50, youngEligible: true, age: 30 },
      { sharePct: 50, youngEligible: false, age: 40 },
    ]);
    expect(t.imt).toBeCloseTo(5_642.04 / 2, 2);
    expect(t.stamp).toBeCloseTo(920, 2);
    const solo = acquisitionTaxes(230_000, [{ sharePct: 100, youngEligible: true, age: 36 }]);
    expect(solo.youngShare).toBe(0);
  });
});
