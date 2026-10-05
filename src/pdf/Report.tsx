import { Document, Line, Link, Page, Path, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import type { Inputs } from '../state';
import { compute, EFFORT_LABEL, euriborPath, type Model } from '../model';
import { heroHex } from '../lib/effortColor';
import { withDefaults } from '../state';
import type { SavedScenario } from '../storage';
import { yearly, type LoanResult } from '../lib/loan';
import { duration, eur, eurC, pct } from '../lib/format';
import { BANK_OFFERS, EURIBOR, EURIBOR_SCENARIOS, LISTING, LOCAL_MARKET, RESEARCH_DATE, RULES, SOURCES } from '../data/market';

/*
 * Relatório PDF da simulação (A4). Usa a Helvetica embutida do PDF, por isso os
 * textos passam por `t()` para trocar caracteres fora do WinAnsi.
 */

type Style = Parameters<typeof StyleSheet.create>[0][string];

const C = {
  accent: '#2a78d6',
  accentDark: '#1c5cab',
  accentSoft: '#e3eefb',
  text: '#0b0b0b',
  text2: '#52514e',
  muted: '#7a7974',
  border: '#e2e0da',
  surface: '#f6f5f2',
  warn: '#8a5a00',
  warnSoft: '#fff4dc',
  crit: '#b42f2f',
  critSoft: '#fbe6e6',
  good: '#006300',
  s1: '#2a78d6',
  s2: '#eb6834',
  s3: '#1baf7a',
  s4: '#eda100',
};

/** Normaliza texto para a codificação das fontes base do PDF */
const t = (s: string) =>
  s
    .replace(/[   ]/g, ' ')
    .replace(/≈/g, '~')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/→/g, '->')
    .replace(/−/g, '-')
    .replace(/ⓘ/g, '');

const S = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 9, color: C.text, lineHeight: 1.35 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: C.muted, borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6 },
  h2: { fontSize: 13, lineHeight: 1.2, fontFamily: 'Helvetica-Bold', color: C.text, marginBottom: 6, marginTop: 4 },
  h3: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.text, marginBottom: 4 },
  sub: { fontSize: 9, color: C.text2 },
  muted: { color: C.muted },
  section: { marginBottom: 14 },
  card: { borderWidth: 0.75, borderColor: C.border, borderRadius: 6, padding: 10 },
  row: { flexDirection: 'row' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: C.border, borderBottomStyle: 'dashed' },
  kvTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 5, marginTop: 2, borderTopWidth: 0.75, borderTopColor: C.text2 },
  bold: { fontFamily: 'Helvetica-Bold' },
  note: { fontSize: 7.5, color: C.muted },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.text2 },
});

// ---------------------------------------------------------------------------
// Peças base
// ---------------------------------------------------------------------------

function Footer({ today }: { today: string }) {
  return (
    <View style={S.footer} fixed>
      <Text>{t(`Simulador de compra de casa · gerado em ${today} · dados de mercado de ${RESEARCH_DATE}`)}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Heading({ children, sub }: { children: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 8 }} wrap={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 3, height: 13, backgroundColor: C.accent, marginRight: 6, borderRadius: 1 }} />
        <Text style={[S.h2, { marginBottom: 0, marginTop: 0 }]}>{t(children)}</Text>
      </View>
      {sub && <Text style={[S.note, { marginTop: 2, marginLeft: 9 }]}>{t(sub)}</Text>}
    </View>
  );
}

function KV({ label, value, note, total }: { label: string; value: string; note?: string; total?: boolean }) {
  return (
    <View style={total ? S.kvTotal : S.kv} wrap={false}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={total ? S.bold : undefined}>{t(label)}</Text>
        {note && <Text style={S.note}>{t(note)}</Text>}
      </View>
      <Text style={S.bold}>{t(value)}</Text>
    </View>
  );
}

/** Mistura uma cor hex com branco (tom subtil, como o cartão da app) */
const tint = (hex: string, amount: number) => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * amount + 255 * (1 - amount));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, '0')).join('')}`;
};

function Kpi({ label, value, sub, hero, heroBg }: { label: string; value: string; sub?: string; hero?: boolean; heroBg?: string }) {
  const tone = heroBg ?? C.accent;
  return (
    <View
      style={{
        width: '24%',
        marginBottom: 8,
        borderRadius: 6,
        padding: 9,
        backgroundColor: hero ? tint(tone, 0.1) : '#ffffff',
        borderWidth: 0.75,
        borderColor: hero ? tint(tone, 0.45) : C.border,
      }}
    >
      <Text style={{ fontSize: 7.5, color: C.text2 }}>{t(label)}</Text>
      <Text style={{ fontSize: 14, lineHeight: 1.2, fontFamily: 'Helvetica-Bold', color: C.text, marginTop: 3, marginBottom: 1 }}>{t(value)}</Text>
      {sub && <Text style={{ fontSize: 7, color: hero ? tone : C.muted, fontFamily: hero ? 'Helvetica-Bold' : 'Helvetica', marginTop: 2 }}>{t(sub)}</Text>}
    </View>
  );
}

function Table({ head, rows, widths, total, zebra = true, fixedHead }: { head: string[]; rows: string[][]; widths: number[]; total?: string[]; zebra?: boolean; fixedHead?: boolean }) {
  const cell = (i: number, bold?: boolean): Style => ({ width: `${widths[i]}%`, textAlign: i === 0 ? 'left' : 'right', paddingHorizontal: 4, fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica' });
  return (
    <View style={{ borderWidth: 0.75, borderColor: C.border, borderRadius: 4 }}>
      <View style={{ flexDirection: 'row', backgroundColor: C.surface, paddingVertical: 4, borderBottomWidth: 0.75, borderBottomColor: C.border }} fixed={fixedHead}>
        {head.map((h, i) => (
          <Text key={i} style={[cell(i), S.th]}>
            {t(h)}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} wrap={false} style={{ flexDirection: 'row', paddingVertical: 3, backgroundColor: zebra && ri % 2 ? '#fbfbfa' : '#ffffff', borderBottomWidth: ri === rows.length - 1 && !total ? 0 : 0.5, borderBottomColor: C.border }}>
          {r.map((c, i) => (
            <Text key={i} style={[cell(i), { fontSize: 8 }]}>
              {t(c)}
            </Text>
          ))}
        </View>
      ))}
      {total && (
        <View style={{ flexDirection: 'row', paddingVertical: 4, backgroundColor: C.surface }} wrap={false}>
          {total.map((c, i) => (
            <Text key={i} style={[cell(i, true), { fontSize: 8 }]}>
              {t(c)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function Callout({ kind, children }: { kind: 'warn' | 'crit' | 'info' | 'ok'; children: string }) {
  const bg = { warn: C.warnSoft, crit: C.critSoft, info: C.accentSoft, ok: '#e7f5e7' }[kind];
  const fg = { warn: C.warn, crit: C.crit, info: C.accentDark, ok: C.good }[kind];
  const tag = { warn: 'Atenção', crit: 'Crítico', info: 'Nota', ok: 'OK' }[kind];
  return (
    <View style={{ flexDirection: 'row', backgroundColor: bg, borderRadius: 4, padding: 7, marginBottom: 5 }} wrap={false}>
      <Text style={{ fontFamily: 'Helvetica-Bold', color: fg, width: 44, fontSize: 8 }}>{tag}</Text>
      <Text style={{ flex: 1, fontSize: 8.5 }}>{t(children)}</Text>
    </View>
  );
}

function Legend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
          <View style={{ width: it.line ? 12 : 7, height: it.line ? 2 : 7, backgroundColor: it.color, borderRadius: 1, marginRight: 4 }} />
          <Text style={{ fontSize: 7.5, color: C.text2 }}>{t(it.label)}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Gráficos (SVG vetorial)
// ---------------------------------------------------------------------------

function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}
const kfmt = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k€` : `${Math.round(v)}€`);

const CW = 515; // largura útil
const PAD = { l: 34, r: 6, t: 6, b: 16 };

function ChartFrame({ height, yTicks, yFmt, xTicks, xPos, yPos, children }: { height: number; yTicks: number[]; yFmt: (v: number) => string; xTicks: number[]; xPos: (x: number) => number; yPos: (y: number) => number; children: ReactNode }) {
  return (
    <View style={{ position: 'relative', width: CW, height }}>
      <Svg width={CW} height={height}>
        {yTicks.map((v) => (
          <Line key={v} x1={PAD.l} x2={CW - PAD.r} y1={yPos(v)} y2={yPos(v)} stroke={v === 0 ? '#b9b7b0' : '#ebe9e4'} strokeWidth={0.6} />
        ))}
        {children}
      </Svg>
      {yTicks.map((v) => (
        <Text key={`y${v}`} style={{ position: 'absolute', left: 0, width: PAD.l - 4, top: yPos(v) - 4, fontSize: 6.5, color: C.muted, textAlign: 'right' }}>
          {t(yFmt(v))}
        </Text>
      ))}
      {xTicks.map((x) => (
        <Text key={`x${x}`} style={{ position: 'absolute', left: xPos(x) - 10, width: 20, top: height - PAD.b + 4, fontSize: 6.5, color: C.muted, textAlign: 'center' }}>
          {String(x)}
        </Text>
      ))}
    </View>
  );
}

function LineChartPdf({ series, height = 150, yFmt = kfmt }: { series: { label: string; color: string; dashed?: boolean; points: { x: number; y: number }[] }[]; height?: number; yFmt?: (v: number) => string }) {
  const all = series.flatMap((s) => s.points);
  const xMax = Math.max(...all.map((p) => p.x));
  const xMin = Math.min(...all.map((p) => p.x));
  const yTicks = niceTicks(Math.max(...all.map((p) => p.y)));
  const yMax = yTicks[yTicks.length - 1] || 1;
  const xPos = (x: number) => PAD.l + ((x - xMin) / Math.max(1, xMax - xMin)) * (CW - PAD.l - PAD.r);
  const yPos = (y: number) => PAD.t + (1 - y / yMax) * (height - PAD.t - PAD.b);
  const step = xMax - xMin <= 12 ? 1 : 5;
  const xTicks: number[] = [];
  for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) xTicks.push(x);
  return (
    <ChartFrame height={height} yTicks={yTicks} yFmt={yFmt} xTicks={xTicks} xPos={xPos} yPos={yPos}>
      {series.map((s) => (
        <Path
          key={s.label}
          d={s.points.map((p, i) => `${i ? 'L' : 'M'}${xPos(p.x).toFixed(2)},${yPos(p.y).toFixed(2)}`).join(' ')}
          stroke={s.color}
          strokeWidth={1.6}
          strokeDasharray={s.dashed ? '4 3' : undefined}
          fill="none"
        />
      ))}
    </ChartFrame>
  );
}

function StackedBarsPdf({ data, keys, height = 160 }: { data: { x: number; values: number[] }[]; keys: { label: string; color: string }[]; height?: number }) {
  const totals = data.map((d) => d.values.reduce((a, v) => a + v, 0));
  const yTicks = niceTicks(Math.max(...totals, 1));
  const yMax = yTicks[yTicks.length - 1] || 1;
  const n = data.length;
  const slot = (CW - PAD.l - PAD.r) / n;
  const bw = Math.min(26, slot * 0.7);
  const xPos = (x: number) => PAD.l + (x - data[0].x + 0.5) * slot;
  const yPos = (y: number) => PAD.t + (1 - y / yMax) * (height - PAD.t - PAD.b);
  const xTicks = data.map((d) => d.x).filter((x) => n <= 15 || x % 5 === 0 || x === 1);
  return (
    <ChartFrame height={height} yTicks={yTicks} yFmt={kfmt} xTicks={xTicks} xPos={xPos} yPos={yPos}>
      {data.map((d) => {
        let acc = 0;
        return d.values.map((v, i) => {
          const y0 = yPos(acc);
          acc += v;
          const y1 = yPos(acc);
          const h = Math.max(0, y0 - y1 - 0.8);
          return h > 0 ? <Rect key={`${d.x}-${i}`} x={xPos(d.x) - bw / 2} y={y1} width={bw} height={h} fill={keys[i].color} /> : null;
        });
      })}
    </ChartFrame>
  );
}

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

const FREQ_LABEL: Record<number, string> = { 1: 'mensal', 3: 'trimestral', 6: 'semestral', 12: 'anual' };

function rateDescription(i: Inputs) {
  if (i.rateType === 'fixa') return `Taxa fixa ${pct(i.fixedRate)}`;
  const variable = `Euribor ${i.euriborTenor}M + spread ${pct(i.spread)}`;
  if (i.rateType === 'mista') return `Mista: ${pct(i.fixedRate)} fixa ${i.mixedFixedYears} anos, depois ${variable}`;
  return `Variável: ${variable}`;
}

function planDescription(i: Inputs, m: Model) {
  const p = m.params.extraPlan;
  const parts: string[] = [];
  if (p.enabled && p.amount > 0) {
    parts.push(
      `${eur(p.amount)} ${FREQ_LABEL[p.everyMonths] ?? `a cada ${p.everyMonths} meses`} a partir do mês ${p.startMonth}${p.endMonth > 0 ? ` até ao mês ${p.endMonth}` : ''}`,
    );
  }
  if (i.goalEnabled) parts.unshift(`Objetivo: liquidar em ${i.targetYears} anos`);
  if (i.lumpSums.length) parts.push(`${i.lumpSums.length} amortização(ões) pontual(is): ${i.lumpSums.map((l) => `${eur(l.amount)} no mês ${l.month}`).join(', ')}`);
  return parts.length ? parts.join(' · ') : 'Sem amortizações antecipadas';
}

function yearlyRows(r: LoanResult) {
  return yearly(r.rows).map((y) => [
    String(y.year),
    pct(y.tanAvg),
    eur(y.payment),
    eur(y.interest),
    eur(y.principal),
    y.extra ? eur(y.extra) : '-',
    y.extraFee ? eur(y.extraFee) : '-',
    eur(y.lifeInsurance + y.homeInsurance + y.bankFee + y.stampInterest),
    eur(y.outflow),
    eur(y.closingBalance),
  ]);
}

export function Report({ inputs: i, model: m, scenarios, generatedAt }: { inputs: Inputs; model: Model; scenarios: SavedScenario[]; generatedAt: Date }) {
  const w = m.withExtras;
  const b = m.noExtras;
  const lifetime = (r: LoanResult) => m.downPayment + m.upfrontTotal + r.totalOutflow;
  const isListing = i.listingUrl === LISTING.url;
  const scenario = EURIBOR_SCENARIOS.find((s) => s.id === i.euriborScenario);
  const bank = BANK_OFFERS.find((x) => x.id === i.bankPreset);
  const today = generatedAt.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
  const totalMonthly = m.monthlyTotal + m.extraMonthlyEquivalent;

  const wy = yearly(w.rows);
  const by = yearly(b.rows);
  const balancePts = (ys: typeof wy) => [{ x: 0, y: m.principal }, ...ys.map((y) => ({ x: y.year, y: y.closingBalance }))];
  const path = euriborPath(i);

  const saved = scenarios.slice(0, 4).map((s) => {
    const inp = withDefaults(s.inputs);
    return { name: s.name, inputs: inp, model: compute(inp) };
  });
  const cols = [{ name: 'Atual', inputs: i, model: m }, ...saved];

  return (
    <Document title="Simulação de crédito à habitação" author="Simulador de compra de casa" subject={isListing ? LISTING.title : 'Simulação'} language="pt-PT">
      {/* ============ 1. RESUMO ============ */}
      <Page size="A4" style={S.page}>
        <View style={{ backgroundColor: C.accent, marginHorizontal: -40, marginTop: -44, paddingHorizontal: 40, paddingTop: 34, paddingBottom: 22, marginBottom: 18 }}>
          <Text style={{ fontSize: 8, color: '#dce9fa', letterSpacing: 1 }}>{t('SIMULAÇÃO DE CRÉDITO À HABITAÇÃO')}</Text>
          <Text style={{ fontSize: 22, lineHeight: 1.2, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginTop: 4 }}>{t(isListing ? LISTING.title : 'Compra de habitação própria')}</Text>
          <Text style={{ fontSize: 9.5, color: '#eef4fd', marginTop: 4 }}>
            {t(`${eur(i.price)} · ${i.areaM2 ? `${i.areaM2} m² · ${eur(m.pricePerM2)}/m² · ` : ''}${rateDescription(i)} · ${today}`)}
          </Text>
        </View>

        {isListing && (
          <View style={[S.card, { marginBottom: 12, flexDirection: 'row' }]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={S.h3}>{t('Imóvel')}</Text>
              <Text style={{ color: C.text2 }}>{t(LISTING.features.join(' · '))}</Text>
              <Link src={i.listingUrl} style={{ color: C.accent, fontSize: 8, marginTop: 3 }}>
                {i.listingUrl}
              </Link>
            </View>
            <View style={{ width: 170 }}>
              <KV label="Preço anunciado" value={eur(LISTING.price)} />
              <KV label="Preço simulado" value={eur(i.price)} />
              <KV label="Avaliação bancária" value={eur(m.valuation)} />
              <KV label={`Mediana avaliação ${LOCAL_MARKET.area}`} value={`${eur(LOCAL_MARKET.medianValuationPerM2)}/m²`} />
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Kpi
            hero
            heroBg={heroHex(m.effortStatus === 'none' ? null : m.effortTotal)}
            label={m.extraMonthlyEquivalent > 0 ? 'Total por mês (c/ amortizações)' : 'Total da casa por mês'}
            value={eurC(totalMonthly)}
            sub={m.effortStatus === 'none' ? `Casa ${eur(m.monthlyTotal)} + amortizações ${eur(m.extraMonthlyEquivalent)}` : `${EFFORT_LABEL[m.effortStatus]} · ${pct(m.effortTotal, 0)} do rendimento`}
          />
          <Kpi label="Prestação inicial" value={eurC(w.firstPayment)} sub={`TAN ${pct(m.firstTan)}`} />
          <Kpi label="Dinheiro na escritura" value={eur(m.cashNeeded)} sub={`Entrada ${eur(m.downPayment)} + custos ${eur(m.upfrontTotal)}`} />
          <Kpi label="Crédito liquidado em" value={duration(w.payoffMonth)} sub={`${eur(m.principal)} (LTV ${m.ltv.toFixed(0)}%) · ${i.termYears} anos`} />
          <Kpi label="Fica de reserva" value={eur(m.cashLeft)} sub={`Liquidez${m.investmentsLeft > 0 ? ` + ${eur(m.investmentsLeft)} investidos` : ''}`} />
          <Kpi label="Juros totais" value={eur(w.totalInterest)} sub={m.interestSaved > 1 ? `Poupa ${eur(m.interestSaved)} em juros` : undefined} />
          <Kpi label="Custo total da compra" value={eur(lifetime(w))} sub="Entrada, custos, juros, seguros" />
          <Kpi label="TAEG estimada" value={pct(m.taeg)} sub={i.netMonthlyIncome > 0 ? `Esforço ${pct(m.dsti, 1)} (stress ${pct(m.dstiStress, 1)})` : undefined} />
        </View>

        <View style={[S.section, { marginTop: 6 }]}>
          <Heading>Pontos de atenção</Heading>
          {m.alerts.length === 0 && <Callout kind="ok">Tudo dentro das regras do Banco de Portugal e com o fundo de emergência intacto.</Callout>}
          {m.alerts.map((a, k) => (
            <Callout key={k} kind={a.kind}>
              {a.text}
            </Callout>
          ))}
        </View>

        <View style={S.section} wrap={false}>
          <Heading sub="Com o plano de amortizações vs pagar só a prestação.">Com vs sem amortizações</Heading>
          <Table
            head={['', 'Sem amortizar', 'Com o plano']}
            widths={[46, 27, 27]}
            rows={[
              ['Prazo efetivo', duration(b.payoffMonth), duration(w.payoffMonth)],
              ['Juros pagos', eur(b.totalInterest), eur(w.totalInterest)],
              ['Amortizado antecipadamente', '-', eur(w.totalExtra)],
              ['Comissões de amortização (c/ IS)', '-', eur(w.totalExtraFees)],
              ['Seguros', eur(b.totalInsurance), eur(w.totalInsurance)],
              ['Prestação máxima', eurC(b.maxPayment), eurC(w.maxPayment)],
            ]}
            total={['Custo total da compra', eur(lifetime(b)), eur(lifetime(w))]}
          />
        </View>
        <Footer today={generatedAt.toLocaleDateString('pt-PT')} />
      </Page>

      {/* ============ 2. PRESSUPOSTOS E CUSTOS ============ */}
      <Page size="A4" style={S.page}>
        <Heading sub="Parâmetros usados nesta simulação.">Pressupostos</Heading>
        <View style={[S.row, { marginBottom: 14 }]}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={S.h3}>{t('Imóvel e capitais próprios')}</Text>
            <KV label="Preço de compra" value={eur(i.price)} />
            <KV label="Avaliação bancária" value={eur(m.valuation)} note={m.valuation < i.price ? 'Abaixo do preço: LTV calculado sobre a avaliação' : undefined} />
            <KV label="VPT / taxa de IMI" value={`${eur(i.vpt)} · ${pct(i.imiRatePct, 3)}`} note={i.imiExemption ? `Isenção de IMI ${i.imiExemptionYears} anos` : undefined} />
            <KV label="Condomínio" value={`${eur(i.condoMonthly)}/mês`} />
            <KV label="Poupança / investimentos" value={`${eur(i.cash)} / ${eur(i.investments)}`} />
            <KV label="Investimentos resgatados" value={eur(i.investmentsUsed)} />
            <KV label="Fundo de emergência" value={eur(i.emergencyReserve)} />
            <KV label="Recheio e obras" value={eur(i.furnishing)} note={i.worksAndFurniture ? `+ obras ${eur(i.worksAndFurniture)}` : undefined} />
            <KV label="Disponível para a entrada" value={eur(m.availableForDownPayment)} note="Depois de impostos, custos, recheio e fundo de emergência" />
            <KV label={m.autoDownPayment ? 'Entrada (automática)' : 'Entrada'} value={eur(m.downPayment)} note={`Mínimo: ${eur(m.minDownPayment)} (LTV ${RULES.maxLtvHpp}%)`} />
            <KV label="Compradores" value={i.buyers.map((x) => `${x.age} anos${x.youngEligible && x.age <= 35 ? ' (IMT Jovem)' : ''}`).join(', ')} />
            {i.assignment && <KV label="Cedência de posição contratual" value={i.assignmentClause ? `Sim · prémio ${eur(i.assignmentPremium)}` : 'Sim'} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.h3}>{t('Crédito')}</Text>
            <KV label="Montante" value={eur(m.principal)} />
            <KV label="Taxa" value={rateDescription(i)} note={bank ? bank.label : undefined} />
            <KV label="TAN inicial" value={pct(m.firstTan)} />
            {i.rateType !== 'fixa' && <KV label="Cenário Euribor" value={i.euriborScenario === 'custom' ? 'Personalizado' : scenario?.label ?? ''} note={`Por ano: ${path.slice(0, 6).map((v) => pct(v, 2)).join(' · ')}${path.length > 6 ? ' …' : ''}`} />}
            <KV label="Euribor hoje (3M / 6M / 12M)" value={`${pct(EURIBOR.m3, 3)} / ${pct(EURIBOR.m6, 3)} / ${pct(EURIBOR.m12, 3)}`} />
            <KV label="Prazo do contrato" value={`${i.termYears} anos`} note={`Máximo BdP para ${m.oldest} anos: ${m.maxTermYears} anos`} />
            <KV label="Amortizações" value={i.amortMode === 'prazo' ? 'Reduzir prazo' : 'Reduzir prestação'} note={planDescription(i, m)} />
            <KV label="Comissão amortização" value={`${pct(i.feeVariablePct, 1)} variável · ${pct(i.feeFixedPct, 1)} fixa`} note={i.feeVariableWaived ? 'Simulada como suspensa na variável' : '+ 4% de Imposto do Selo'} />
            <KV label="Seguro de vida / multirriscos" value={`${pct(i.lifeInsurancePct)}/ano · ${eur(i.homeInsuranceAnnual)}/ano`} />
            <KV label="Rendimento líquido" value={i.netMonthlyIncome ? `${eur(i.netMonthlyIncome)}/mês` : '-'} />
          </View>
        </View>

        <View style={S.row}>
          <View style={{ flex: 1, marginRight: 10 }} wrap={false}>
            <Heading>Dinheiro no dia da escritura</Heading>
            <KV label={`Entrada (${pct((m.downPayment / i.price) * 100, 1)} do preço · LTV ${pct(m.ltv, 1)})`} value={eur(m.downPayment)} />
            {m.upfront.map((c) => (
              <KV key={c.key} label={c.label} value={eurC(c.value)} note={c.note} />
            ))}
            <KV total label="Total necessário" value={eur(m.cashNeeded)} />
            <View style={{ height: 8 }} />
            <KV label="Liquidez disponível" value={eur(m.available)} />
            <KV total label="Liquidez depois da escritura" value={eur(m.cashLeft)} />
            {m.youngSavings > 0 && <Text style={[S.note, { marginTop: 4 }]}>{t(`O IMT Jovem poupa ${eur(m.youngSavings)} (IMT, Imposto do Selo e emolumentos).`)}</Text>}
          </View>
          <View style={{ flex: 1 }} wrap={false}>
            <Heading>Encargos mensais</Heading>
            {m.monthly.map((c) => (
              <KV key={c.key} label={c.label} value={eurC(c.value)} />
            ))}
            <KV total label="Total da casa por mês" value={eurC(m.monthlyTotal)} />
            {m.extraMonthlyEquivalent > 0 && (
              <>
                <KV label="+ Amortizações (média mensal)" value={eurC(m.extraMonthlyEquivalent)} />
                <KV total label="Esforço mensal total" value={eurC(totalMonthly)} />
              </>
            )}
            {m.living && m.spareAfterLiving !== null && i.netMonthlyIncome > 0 && (
              <>
                <View style={{ height: 8 }} />
                <Text style={S.h3}>{t('Orçamento do mês')}</Text>
                <KV label="Rendimento líquido" value={eurC(i.netMonthlyIncome)} />
                <KV label="- Casa e amortizações" value={`-${eurC(totalMonthly + i.otherDebtMonthly)}`} />
                <KV label="- Despesas do dia a dia" value={`-${eurC(m.living.expensesMonthly)}`} note={m.living.byCategory.map((c) => `${c.category} ${eur(c.monthly)}`).join(' · ')} />
                <KV total label="Sobra antes de investir" value={eurC(m.spareAfterLiving)} />
                {m.living.investMonthly > 0 && m.spareAfterAll !== null && (
                  <>
                    <KV label="- Investimentos e poupança" value={`-${eurC(m.living.investMonthly)}`} />
                    <KV total label="Sobra no fim do mês" value={eurC(m.spareAfterAll)} />
                  </>
                )}
              </>
            )}
            {i.netMonthlyIncome > 0 && (
              <Text style={[S.note, { marginTop: 6 }]}>
                {t(`Taxa de esforço: ${pct(m.dsti, 1)}; com stress test de +${m.stressPp.toFixed(2).replace('.', ',')} p.p.: ${pct(m.dstiStress, 1)} (limite BdP ${RULES.dstiLimit}%). Com tudo incluído: ${pct(m.effortTotal, 1)} do rendimento.`)}
              </Text>
            )}
          </View>
        </View>
        <Footer today={generatedAt.toLocaleDateString('pt-PT')} />
      </Page>

      {/* ============ 3. GRÁFICOS ============ */}
      <Page size="A4" style={S.page}>
        <View style={S.section} wrap={false}>
          <Heading sub="No fim de cada ano do contrato.">Capital em dívida</Heading>
          <Legend
            items={[
              { label: 'Com o plano', color: C.s1, line: true },
              { label: 'Sem amortizações', color: C.s2, line: true },
            ]}
          />
          <LineChartPdf
            height={170}
            series={[
              { label: 'Com o plano', color: C.s1, points: balancePts(wy) },
              { label: 'Sem amortizações', color: C.s2, dashed: true, points: balancePts(by) },
            ]}
          />
        </View>
        <View style={S.section} wrap={false}>
          <Heading sub="Tudo o que é pago em cada ano, com o plano de amortizações.">Pagamentos por ano</Heading>
          <Legend
            items={[
              { label: 'Capital', color: C.s1 },
              { label: 'Juros', color: C.s2 },
              { label: 'Amortização antecipada + comissão', color: C.s3 },
              { label: 'Seguros e comissões', color: C.s4 },
            ]}
          />
          <StackedBarsPdf
            height={180}
            keys={[
              { label: 'Capital', color: C.s1 },
              { label: 'Juros', color: C.s2 },
              { label: 'Amortização', color: C.s3 },
              { label: 'Outros', color: C.s4 },
            ]}
            data={wy.map((y) => ({ x: y.year, values: [y.principal, y.interest, y.extra + y.extraFee, y.lifeInsurance + y.homeInsurance + y.bankFee + y.stampInterest] }))}
          />
        </View>
        <View style={S.section} wrap={false}>
          <Heading sub="Média anual, segundo o cenário de Euribor escolhido (sem amortizações, prazo completo).">TAN ao longo do contrato</Heading>
          <LineChartPdf height={120} yFmt={(v) => `${v.toFixed(1).replace('.', ',')}%`} series={[{ label: 'TAN', color: C.s1, points: by.map((y) => ({ x: y.year, y: y.tanAvg })) }]} />
        </View>
        <Footer today={generatedAt.toLocaleDateString('pt-PT')} />
      </Page>

      {/* ============ 4. PLANO DE PAGAMENTOS ============ */}
      <Page size="A4" style={S.page}>
        <Heading sub="Valores anuais com o plano de amortizações. Prestações = capital + juros.">Plano de pagamentos</Heading>
        <Table
          fixedHead
          head={['Ano', 'TAN', 'Prestações', 'Juros', 'Capital', 'Amort. antec.', 'Comissão', 'Seguros', 'Total pago', 'Em dívida']}
          widths={[5, 8, 11, 10, 10, 12, 10, 9, 12, 13]}
          rows={yearlyRows(w)}
          total={['Total', '', eur(w.totalInterest + w.totalPrincipal), eur(w.totalInterest), eur(w.totalPrincipal), eur(w.totalExtra), eur(w.totalExtraFees), eur(w.totalInsurance + w.totalBankFees + w.totalStampInterest), eur(w.totalOutflow), '']}
        />
        {saved.length > 0 && (
          <View style={{ marginTop: 18 }} wrap={false}>
            <Heading sub={scenarios.length > 4 ? `Primeiros 4 de ${scenarios.length} cenários gravados.` : 'Simulação atual lado a lado com os cenários gravados.'}>Cenários gravados</Heading>
            <Table
              zebra
              head={['', ...cols.map((c) => c.name)]}
              widths={[100 - cols.length * Math.floor(72 / cols.length), ...cols.map(() => Math.floor(72 / cols.length))]}
              rows={[
                ['Entrada', ...cols.map((c) => eur(c.model.downPayment))],
                ['Financiamento (LTV)', ...cols.map((c) => `${eur(c.model.principal)} (${c.model.ltv.toFixed(0)}%)`)],
                ['Taxa', ...cols.map((c) => (c.inputs.rateType === 'variavel' ? `Var. +${pct(c.inputs.spread)}` : c.inputs.rateType === 'fixa' ? `Fixa ${pct(c.inputs.fixedRate)}` : `Mista ${pct(c.inputs.fixedRate)}`))],
                ['Prestação inicial', ...cols.map((c) => eurC(c.model.withExtras.firstPayment))],
                ['Total da casa / mês', ...cols.map((c) => eur(c.model.monthlyTotal))],
                ['Liquidado em', ...cols.map((c) => duration(c.model.withExtras.payoffMonth))],
                ['Juros totais', ...cols.map((c) => eur(c.model.withExtras.totalInterest))],
                ['Custo total', ...cols.map((c) => eur(c.model.downPayment + c.model.upfrontTotal + c.model.withExtras.totalOutflow))],
                ['TAEG', ...cols.map((c) => pct(c.model.taeg))],
              ]}
            />
          </View>
        )}
        <Footer today={generatedAt.toLocaleDateString('pt-PT')} />
      </Page>

      {/* ============ 5. FONTES ============ */}
      <Page size="A4" style={S.page}>
        <Heading sub={`Pesquisa feita a ${RESEARCH_DATE}. Confirma sempre a FINE do banco.`}>Fontes</Heading>
        {SOURCES.map((s, k) => (
          <View key={s.id} style={{ marginBottom: 6 }} wrap={false}>
            <Text style={{ fontSize: 8.5 }}>
              <Text style={S.bold}>{`${k + 1}. `}</Text>
              {t(s.title)}
            </Text>
            <Text style={S.note}>{t(`${s.publisher} · ${s.date}`)}</Text>
            {s.urls.slice(0, 2).map((u) => (
              <Link key={u} src={u} style={{ fontSize: 7, color: C.accent }}>
                {u}
              </Link>
            ))}
          </View>
        ))}
        <View style={[S.card, { marginTop: 8, backgroundColor: C.surface, borderWidth: 0 }]} wrap={false}>
          <Text style={S.h3}>{t('Aviso')}</Text>
          <Text style={{ fontSize: 8, color: C.text2 }}>
            {t(
              'Simulação indicativa. A Euribor futura é incerta (a curva forward é a expectativa do mercado, não uma previsão). Prestação calculada pelo sistema francês com revisão periódica do indexante; TAEG estimada a partir dos fluxos sem amortizações. Valores de avaliação, VPT e condomínio são estimativas até haver documentos. Não substitui a FINE do banco nem aconselhamento financeiro ou jurídico.',
            )}
          </Text>
        </View>
        <Footer today={generatedAt.toLocaleDateString('pt-PT')} />
      </Page>
    </Document>
  );
}
