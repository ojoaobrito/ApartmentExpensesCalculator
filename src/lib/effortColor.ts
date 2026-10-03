/**
 * Cor do cartão principal em função do esforço total (% do rendimento):
 * verde → âmbar → laranja → vermelho, interpolada de forma contínua em HSL.
 * As luminosidades ficam baixas o suficiente para o texto branco se ler bem.
 */

interface Stop {
  at: number; // % do rendimento
  h: number;
  s: number;
  l: number;
}

// Cada estado tem a sua cor, que se intensifica dentro da faixa; a mudança de cor
// acontece nos limites dos estados (35%, 50%, 100%), sem tons "lama" pelo meio.
const STOPS: Stop[] = [
  { at: 0, h: 156, s: 52, l: 30 }, // verde — confortável
  { at: 35, h: 148, s: 60, l: 32 },
  { at: 35.01, h: 38, s: 84, l: 34 }, // âmbar — apertado
  { at: 50, h: 30, s: 80, l: 35 },
  { at: 50.01, h: 22, s: 78, l: 38 }, // laranja — muito apertado
  { at: 99.99, h: 10, s: 72, l: 41 },
  { at: 100, h: 2, s: 66, l: 42 }, // vermelho — impossível
];

/** Escala usada na régua do cartão (0% → 120% do rendimento) */
export const METER_MAX = 120;

function hslAt(pct: number) {
  if (pct <= STOPS[0].at) return STOPS[0];
  for (let k = 1; k < STOPS.length; k++) {
    const a = STOPS[k - 1];
    const b = STOPS[k];
    if (pct <= b.at) {
      const f = (pct - a.at) / (b.at - a.at);
      return { at: pct, h: a.h + (b.h - a.h) * f, s: a.s + (b.s - a.s) * f, l: a.l + (b.l - a.l) * f };
    }
  }
  return STOPS[STOPS.length - 1];
}

const hsl = (c: { h: number; s: number; l: number }, dl = 0, alpha = 1) =>
  `hsl(${c.h.toFixed(1)} ${c.s.toFixed(1)}% ${(c.l + dl).toFixed(1)}%${alpha < 1 ? ` / ${alpha}` : ''})`;

/** Cor do estado (tom do cartão) e a sua versão para texto; sem rendimento usa o azul da plataforma */
export function heroColors(effortPct: number | null) {
  if (effortPct === null) return { solid: 'var(--accent)', ink: 'var(--accent)' };
  const c = hslAt(effortPct);
  // "ink": o mesmo tom, legível como texto nos dois temas
  return { solid: hsl(c, 6), ink: `light-dark(${hsl(c, -4)}, ${hsl(c, 26)})` };
}

/** Gradiente da régua (mesmas paragens, ao longo de 0–METER_MAX %) */
export function meterGradient() {
  const stops = STOPS.map((s) => `${hsl(s, 6)} ${((s.at / METER_MAX) * 100).toFixed(1)}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/** Cor sólida em hex (para o PDF, que não aceita hsl) */
export function heroHex(effortPct: number | null) {
  if (effortPct === null) return '#2a78d6';
  const { h, s, l } = hslAt(effortPct);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
