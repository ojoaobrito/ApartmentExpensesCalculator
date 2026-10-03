/**
 * IMT e Imposto do Selo na aquisição de habitação própria e permanente
 * (Continente), tabelas de 2026 (OE2026, Lei 73-A/2025).
 */

export interface Bracket {
  upTo: number; // limite superior do escalão
  rate: number; // taxa marginal (%)
  deduct: number; // parcela a abater (€)
}

/** HPP — Continente, 2026 */
export const IMT_HPP_2026: Bracket[] = [
  { upTo: 106_346, rate: 0, deduct: 0 },
  { upTo: 145_470, rate: 2, deduct: 2_126.92 },
  { upTo: 198_347, rate: 5, deduct: 6_491.02 },
  { upTo: 330_539, rate: 7, deduct: 10_457.96 },
  { upTo: 660_982, rate: 8, deduct: 13_763.35 },
];
/** Acima do último escalão marginal aplica-se taxa única */
export const IMT_FLAT_2026 = [
  { upTo: 1_150_853, rate: 6 },
  { upTo: Infinity, rate: 7.5 },
];

/** Habitação secundária / tabela geral — Continente, 2026 */
export const IMT_SECONDARY_2026: Bracket[] = [
  { upTo: 106_346, rate: 1, deduct: 0 },
  { upTo: 145_470, rate: 2, deduct: 1_063.46 },
  { upTo: 198_347, rate: 5, deduct: 5_427.56 },
  { upTo: 330_539, rate: 7, deduct: 9_394.5 },
  { upTo: 633_931, rate: 8, deduct: 12_699.89 },
];

/**
 * IMT na cessão de posição contratual com cláusula de livre cedência
 * (CIMT art. 2.º n.º 3, regra 18.ª do art. 12.º n.º 4, art. 17.º n.º 5):
 * pago pelo cessionário sobre o valor pago ao cedente, à taxa da tabela geral
 * correspondente ao valor total do contrato, sem isenções.
 */
export function imtAssignment(premium: number, contractValue: number): number {
  if (premium <= 0) return 0;
  const b = IMT_SECONDARY_2026.find((x) => contractValue <= x.upTo);
  const rate = b ? b.rate : contractValue <= 1_150_853 ? 6 : 7.5;
  return (premium * rate) / 100;
}

export const IMT_JOVEM_2026 = {
  fullExemptionUpTo: 330_539,
  partialExemptionUpTo: 660_982,
  partialRate: 8,
};

export const STAMP_PURCHASE_PCT = 0.8; // verba 1.1 TGIS
export const STAMP_LOAN_PCT = 0.6; // verba 17.1.4 TGIS (prazo ≥ 5 anos)

export function imtHPP(value: number): number {
  for (const b of IMT_HPP_2026) {
    if (value <= b.upTo) return Math.max(0, (value * b.rate) / 100 - b.deduct);
  }
  for (const f of IMT_FLAT_2026) {
    if (value <= f.upTo) return (value * f.rate) / 100;
  }
  return 0;
}

/** IMT de um comprador elegível ao IMT Jovem (aplicado ao valor total do imóvel) */
export function imtJovem(value: number): number {
  const j = IMT_JOVEM_2026;
  if (value <= j.fullExemptionUpTo) return 0;
  if (value <= j.partialExemptionUpTo) return ((value - j.fullExemptionUpTo) * j.partialRate) / 100;
  return imtHPP(value);
}

export function stampPurchase(value: number, young: boolean): number {
  const j = IMT_JOVEM_2026;
  if (!young || value > j.partialExemptionUpTo) return (value * STAMP_PURCHASE_PCT) / 100;
  return (Math.max(0, value - j.fullExemptionUpTo) * STAMP_PURCHASE_PCT) / 100;
}

export interface AcquisitionTaxes {
  imt: number;
  imtWithoutBenefit: number;
  stamp: number;
  stampWithoutBenefit: number;
  youngShare: number; // 0..1
}

/**
 * Isenção jovem proporcional à quota de cada comprador elegível; os limites
 * de valor aplicam-se ao preço total do imóvel.
 */
export function acquisitionTaxes(
  value: number,
  buyers: { sharePct: number; youngEligible: boolean; age: number }[],
): AcquisitionTaxes {
  const totalShare = buyers.reduce((a, b) => a + b.sharePct, 0) || 100;
  const youngShare =
    buyers.filter((b) => b.youngEligible && b.age <= 35).reduce((a, b) => a + b.sharePct, 0) / totalShare;
  const imtFull = imtHPP(value);
  const stampFull = stampPurchase(value, false);
  return {
    imt: imtFull * (1 - youngShare) + imtJovem(value) * youngShare,
    imtWithoutBenefit: imtFull,
    stamp: stampFull * (1 - youngShare) + stampPurchase(value, true) * youngShare,
    stampWithoutBenefit: stampFull,
    youngShare,
  };
}
