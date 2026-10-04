import type { Inputs } from '../state';
import { ChevronsDownUp, ChevronsUpDown, ExternalLink, X } from 'lucide-react';
import type { Model } from '../model';
import { BANK_OFFERS, EURIBOR, EURIBOR_SCENARIOS, IMI_PRESETS, LISTING, LOCAL_MARKET, RULES, YOUNG_REGISTRY_DISCOUNT } from '../data/market';
import { eur, pct } from '../lib/format';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, InlineNumber, NumberField, Section, Segmented, SelectField, SourceLink } from './ui';
import { NumberInput } from './NumberInput';
import { useScrollFade } from './useScrollFade';
import { LivingCostsSection } from './LivingCostsSection';
import { FINANCE_APP_URL, type FinanceSync } from '../financeSync';
import { animateDetails } from './motion';
import { IconArrowDownCircle, IconBank, IconHome, IconPie, IconReceipt, IconSearch, IconTrend, IconUmbrella, IconWallet } from './icons';
import { translateEuriborPath } from '../lib/loan';
import { applySearch, SearchContext } from './search';
import { Skeleton } from './Skeleton';

interface Props {
  finance: FinanceSync;
  synced: boolean;
  inputs: Inputs;
  set: <K extends keyof Inputs>(k: K, v: Inputs[K]) => void;
  patch: (p: Partial<Inputs>) => void;
  model: Model;
}

const FREQ = [
  { value: 1, label: 'Mensal' },
  { value: 3, label: 'Trimestral' },
  { value: 6, label: 'Semestral' },
  { value: 12, label: 'Anual' },
];

const EFFORT_PILL: Record<Model['effortStatus'], string> = { none: '', ok: 'good', tight: 'warn', hard: 'warn', impossible: 'crit' };

const SECTION_KEYWORDS = {
  despesas: 'despesas do dia a dia orçamento salário gastos mensais anuais compras supermercado luz gás água internet ginásio carro combustível seguro iuc software subscrições investimentos etf poupança folha google sheet',
  imovel: 'imóvel preço avaliação bancária área m2 metro quadrado anúncio idealista vpt valor patrimonial condomínio imi isenção obras cedência posição contratual prémio cedente',
  capitais: 'capitais próprios e entrada decoração recheio móveis mobília mobiliário eletrodomésticos disponível poupança liquidez investimentos resgatar mais-valia imposto fundo de emergência entrada ltv capital próprio dinheiro',
  custos: 'custos de escritura e banco escritura registos casa pronta solicitador advogado avaliação comissões dossier formalização imposto do selo crédito custos iniciais',
  credito: 'crédito banco proposta cgd bcp millennium santander novobanco bpi bankinter activobank ctt crédito agrícola montepio abanca spread taxa variável mista fixa tan prazo anos contrato',
  euribor: 'euribor — cenário euribor indexante 3 6 12 meses cenário forward mercado subida descida stress trajetória bce juros',
  amortizacoes: 'amortizações antecipadas amortização antecipada abate objetivo liquidar anos reduzir prazo prestação frequência mensal anual começar parar pontual comissão reembolso',
  seguros: 'seguros e encargos do crédito seguro vida multirriscos comissões mensais conta à ordem',
  rendimento: 'rendimento e taxa de esforço rendimento salário ordenado taxa de esforço dsti dívidas stress test banco de portugal',
};

/** "ano 2, mês 1" para o mês 13 do contrato */
const monthLabel = (m: number) => `Ano ${Math.ceil(m / 12)}, mês ${((m - 1) % 12) + 1}`;

export function InputsPanel({ inputs: i, set, patch, model: m, finance, synced }: Props) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  useScrollFade(asideRef);
  const emptyRef = useRef<HTMLDivElement>(null);
  // Valores da app de Finanças ainda a chegar: esqueletos no que depende deles
  const pending = i.useFinanceData && finance.status === 'loading';

  // Filtra secções, destaca os campos encontrados e faz scroll até ao primeiro
  useLayoutEffect(() => {
    const root = asideRef.current;
    if (!root) return;
    const { visible, firstHit } = applySearch(root, query);
    emptyRef.current?.classList.toggle('show', query.trim() !== '' && visible === 0);
    if (firstHit) firstHit.scrollIntoView({ block: 'center', behavior: 'smooth' });
    else if (query.trim()) root.scrollTo({ top: 0, behavior: 'smooth' });
  }, [query]);

  const setAllOpen = (open: boolean) =>
    asideRef.current?.querySelectorAll<HTMLDetailsElement>('details.section').forEach((d) => animateDetails(d, open));

  // "/" foca a pesquisa (fora de campos de texto); Esc limpa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const scenario = EURIBOR_SCENARIOS.find((s) => s.id === i.euriborScenario);
  const path = i.euriborScenario === 'custom' ? i.customEuriborPath : scenario?.paths[i.euriborTenor] ?? [];

  return (
    <aside className="inputs" aria-label="Parâmetros da simulação" ref={asideRef}>
      <div className="search-box">
        <span className="input-wrap">
          <span className="search-icon" aria-hidden>
            <IconSearch />
          </span>
          <input
            ref={searchRef}
            type="search"
            placeholder="Pesquisar (ex.: spread, seguro, euribor)…  /"
            aria-label="Pesquisar parâmetros"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('');
            }}
          />
          {query && (
            <button type="button" className="btn small ghost" onClick={() => setQuery('')} aria-label="Limpar pesquisa">
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </span>
        <button type="button" className="btn icon-btn" title="Expandir todas as secções" aria-label="Expandir todas as secções" onClick={() => setAllOpen(true)}>
          <ChevronsUpDown size={16} strokeWidth={2} />
        </button>
        <button type="button" className="btn icon-btn" title="Colapsar todas as secções" aria-label="Colapsar todas as secções" onClick={() => setAllOpen(false)}>
          <ChevronsDownUp size={16} strokeWidth={2} />
        </button>
      </div>
      <div ref={emptyRef} className="empty search-empty">
        Nada encontrado para “{query}”.
      </div>
      <SearchContext.Provider value={query}>
      {/* ---------------- IMÓVEL ---------------- */}
      <Section icon={<IconHome />} title="Imóvel" keywords={SECTION_KEYWORDS.imovel} badge={<span className="pill">{eur(i.price)}</span>}>
        <NumberField label="Preço de compra" value={i.price} onChange={(v) => set('price', v)} suffix="€" step={1000} min={0} />
        <PropertyCard i={i} m={m} />
        <div className="row2">
          <NumberField
            label="Avaliação bancária"
            value={i.valuation > 0 ? i.valuation : i.price}
            onChange={(v) => set('valuation', v === i.price ? 0 : v)}
            suffix="€"
            step={1000}
            min={0}
            source="mercado-local"
            hint={i.valuation > 0 && i.valuation !== i.price ? `${eur(m.valuationPerM2)}/m² · LTV sobre a avaliação` : 'Igual ao preço até saberes o valor'}
          />
          <NumberField label="Área" value={i.areaM2} onChange={(v) => set('areaM2', v)} suffix="m²" step={1} min={0} hint={`${eur(m.pricePerM2)}/m² pedido`} />
        </div>
        <label className="field">
          <span className="field-label">Anúncio</span>
          <span className="input-wrap">
            <input value={i.listingUrl} onChange={(e) => set('listingUrl', e.target.value)} />
          </span>
          {i.listingUrl && (
            <a className="hint" href={i.listingUrl} target="_blank" rel="noreferrer">
              Abrir anúncio <ExternalLink size={12} strokeWidth={2} />
            </a>
          )}
        </label>
        <div className="row2">
          <NumberField label="VPT" value={i.vpt} onChange={(v) => set('vpt', v)} suffix="€" step={1000} min={0} source="vpt" hint="Valor fiscal do imóvel (caderneta predial). Só mexe no IMI" />
          <NumberField label="Condomínio" value={i.condoMonthly} onChange={(v) => set('condoMonthly', v)} suffix="€/mês" step={5} min={0} source="condominio" />
        </div>
        <div className="row2">
          <SelectField
            label="Taxa de IMI"
            value={String(i.imiRatePct)}
            onChange={(v) => set('imiRatePct', parseFloat(v))}
            options={[
              ...IMI_PRESETS.map((p) => ({ value: String(p.rate), label: `${p.label} — ${pct(p.rate, 3)}` })),
              ...(IMI_PRESETS.some((p) => p.rate === i.imiRatePct) ? [] : [{ value: String(i.imiRatePct), label: pct(i.imiRatePct, 3) }]),
            ]}
            source="imi"
          />
          <NumberField label="Obras" value={i.worksAndFurniture} onChange={(v) => set('worksAndFurniture', v)} suffix="€" step={500} min={0} />
        </div>
        <Check checked={i.imiExemption} onChange={(v) => set('imiExemption', v)}>
          Isenção de IMI na habitação própria (VPT ≤ {eur(RULES.imiExemptionVpt)}, rendimento ≤ {eur(RULES.imiExemptionIncome)}) <SourceLink id="imi-covilha" />
          {i.imiExemption && i.vpt > RULES.imiExemptionVpt && <span className="pill crit"> VPT acima do limite</span>}
        </Check>
        {i.imiExemption && (
          <Segmented
            value={i.imiExemptionYears}
            onChange={(v) => set('imiExemptionYears', v)}
            options={[
              { value: 3, label: '3 anos (nacional)' },
              { value: 5, label: '5 anos (Covilhã jovem)' },
            ]}
          />
        )}
        <Check checked={i.assignment} onChange={(v) => set('assignment', v)}>
          Compra por cedência de posição contratual <SourceLink id="cedencia" />
        </Check>
        {i.assignment && (
          <>
            <Check checked={i.assignmentClause} onChange={(v) => set('assignmentClause', v)}>
              O contrato-promessa tem cláusula de livre cedência (pagas IMT sobre o prémio, sem isenção)
            </Check>
            {i.assignmentClause && (
              <NumberField
                label="Valor pago ao cedente (prémio)"
                value={i.assignmentPremium}
                onChange={(v) => set('assignmentPremium', v)}
                suffix="€"
                step={1000}
                min={0}
                hint={m.assignmentImt > 0 ? `IMT estimado sobre a cessão: ${eur(m.assignmentImt)}` : 'Pergunta ao mediador quanto do preço vai para o cedente'}
              />
            )}
          </>
        )}
      </Section>

      {/* ---------------- CAPITAIS PRÓPRIOS ---------------- */}
      <Section
        icon={<IconWallet />}
        title="Capitais próprios e entrada"
        keywords={SECTION_KEYWORDS.capitais}
        loading={pending}
        badge={<span className={`pill ${m.cashLeft < 0 ? 'crit' : m.cashLeft < i.emergencyReserve ? 'warn' : 'good'}`}>LTV {m.ltv.toFixed(0)}%</span>}
      >
        <FinanceLink finance={finance} synced={synced} on={i.useFinanceData} setOn={(v) => set('useFinanceData', v)} />
        <div className="row2">
          <NumberField label="Poupança (liquidez)" value={i.cash} onChange={(v) => set('cash', v)} suffix="€" step={1000} min={0} disabled={synced} loading={pending} hint={synced ? 'Da app de Finanças' : undefined} />
          <NumberField label="Investimentos" value={i.investments} onChange={(v) => patch({ investments: v, investmentsUsed: Math.min(i.investmentsUsed, v) })} suffix="€" step={1000} min={0} disabled={synced} loading={pending} hint={synced ? 'Da app de Finanças' : undefined} />
        </div>
        <NumberField
          label="Investimentos a resgatar para a compra"
          value={i.investmentsUsed}
          onChange={(v) => set('investmentsUsed', v)}
          suffix="€"
          step={1000}
          min={0}
          max={i.investments}
          hint={m.investmentsTax > 0 ? `Imposto estimado sobre mais-valias ao resgatar: ${eur(m.investmentsTax)}` : undefined}
        />
        <div className="row2">
          <NumberField label="Mais-valia latente" value={i.investmentsGainPct} onChange={(v) => set('investmentsGainPct', v)} suffix="% do valor" step={1} min={0} max={100} disabled={i.investmentsUsed === 0 || synced} loading={pending} hint={synced ? 'Calculado a partir das mais-valias tributáveis' : i.investmentsUsed === 0 ? 'Só conta se resgatares investimentos' : `Imposto de ${pct(i.capitalGainsTaxPct, 0)} sobre o ganho`} />
          <NumberField label="Fundo de emergência" value={i.emergencyReserve} onChange={(v) => set('emergencyReserve', v)} suffix="€" step={1000} min={0} />
        </div>
        <NumberField
          label="Decoração inicial e recheio"
          value={i.furnishing}
          onChange={(v) => set('furnishing', v)}
          suffix="€"
          step={500}
          min={0}
          hint="Móveis, eletrodomésticos em falta, cortinados, iluminação… Sai da poupança antes da entrada."
        />
        {pending ? <Skeleton h={190} r={10} /> : <AvailableBreakdown i={i} m={m} set={set} />}
        <Segmented
          value={i.autoDownPayment ? 'auto' : 'manual'}
          onChange={(v) => patch(v === 'auto' ? { autoDownPayment: true } : { autoDownPayment: false, downPayment: Math.round(m.downPayment) })}
          options={[
            { value: 'auto', label: 'Entrada automática' },
            { value: 'manual', label: 'Entrada manual' },
          ]}
        />
        <NumberField
          label={i.autoDownPayment ? 'Entrada (calculada)' : 'Entrada (capital próprio na compra)'}
          value={i.autoDownPayment ? Math.round(m.downPayment) : i.downPayment}
          onChange={(v) => patch({ autoDownPayment: false, downPayment: v })}
          disabled={i.autoDownPayment}
          loading={pending && i.autoDownPayment}
          suffix="€"
          step={1000}
          min={0}
          max={i.price}
          hint={
            <>
              Financiamento: <b>{eur(m.principal)}</b> ({pct(m.ltv, 1)} LTV). Entrada mínima: {eur(m.minDownPayment)}
              {m.valuation < i.price ? ' (avaliação abaixo do preço)' : ` (${100 - RULES.maxLtvHpp}%)`}.
              {i.autoDownPayment ? (
                ' Muda com a poupança, os investimentos resgatados, o recheio e o fundo de emergência.'
              ) : (
                <>
                  {' '}
                  <button type="button" className="btn small ghost" title="LTV 80%" onClick={() => set('downPayment', Math.round(i.price - Math.min(i.price, m.valuation) * 0.8))}>
                    LTV 80%
                  </button>
                  <button type="button" className="btn small ghost" title="LTV 90%" onClick={() => set('downPayment', Math.ceil(m.minDownPayment))}>
                    LTV 90%
                  </button>
                </>
              )}
            </>
          }
        />
      </Section>

      {/* ---------------- CRÉDITO ---------------- */}
      <Section icon={<IconBank />} title="Crédito" keywords={SECTION_KEYWORDS.credito} badge={<span className="pill">TAN {pct(m.firstTan)}</span>}>
        <SelectField
          label="Proposta de banco (preenche spread / taxas)"
          value={i.bankPreset}
          onChange={(v) => {
            const b = BANK_OFFERS.find((x) => x.id === v);
            if (!b) return set('bankPreset', '');
            const p: Partial<Inputs> = { bankPreset: v, spread: b.spread };
            if (i.rateType === 'fixa' && b.fixedRate) p.fixedRate = b.fixedRate;
            if (i.rateType === 'mista' && b.mixedRate) Object.assign(p, { fixedRate: b.mixedRate, mixedFixedYears: b.mixedYears ?? i.mixedFixedYears });
            patch(p);
          }}
          options={[{ value: '', label: 'Personalizado' }, ...BANK_OFFERS.map((b) => ({ value: b.id, label: b.label }))]}
          source="spreads"
          hint={BANK_OFFERS.find((b) => b.id === i.bankPreset)?.note}
        />
        <Segmented
          value={i.rateType}
          onChange={(v) => set('rateType', v)}
          options={[
            { value: 'variavel', label: 'Variável' },
            { value: 'mista', label: 'Mista' },
            { value: 'fixa', label: 'Fixa' },
          ]}
        />
        <div className="row2">
          {i.rateType !== 'fixa' && (
            <NumberField label="Spread" value={i.spread} onChange={(v) => set('spread', v)} suffix="p.p." step={0.05} min={0} max={5} source="spreads" />
          )}
          {i.rateType !== 'variavel' && (
            <NumberField label={i.rateType === 'fixa' ? 'TAN fixa' : 'TAN período fixo'} value={i.fixedRate} onChange={(v) => set('fixedRate', v)} suffix="%" step={0.05} min={0} max={15} source="taxa-fixa" />
          )}
          {i.rateType === 'mista' && (
            <NumberField label="Anos em taxa fixa" value={i.mixedFixedYears} onChange={(v) => set('mixedFixedYears', Math.round(v))} suffix="anos" min={1} max={30} />
          )}
        </div>
        <NumberField
          label="Prazo do contrato"
          value={i.termYears}
          onChange={(v) => set('termYears', Math.round(v))}
          suffix="anos"
          min={5}
          max={40}
          slider
          sliderMin={5}
          sliderMax={40}
          hint={`Máximo BdP para ${m.oldest} anos: ${m.maxTermYears} anos. Um prazo longo baixa a prestação e a taxa de esforço; podes encurtá-lo com amortizações.`}
        />
      </Section>

      {/* ---------------- EURIBOR ---------------- */}
      {i.rateType !== 'fixa' && (
        <Section icon={<IconTrend />} title="Euribor — cenário" keywords={SECTION_KEYWORDS.euribor} badge={<span className="pill">{scenario?.label ?? 'Personalizado'}</span>}>
          <SelectField
            label="Indexante"
            value={i.euriborTenor}
            onChange={(v) => {
              // Na trajetória personalizada, desloca os valores pela diferença entre indexantes
              if (i.euriborScenario === 'custom') {
                const spot = { 3: EURIBOR.m3, 6: EURIBOR.m6, 12: EURIBOR.m12 };
                patch({ euriborTenor: v, customEuriborPath: translateEuriborPath(i.customEuriborPath, spot[i.euriborTenor], spot[v]) });
              } else set('euriborTenor', v);
            }}
            options={[
              { value: 3, label: `Euribor 3 meses (hoje ${pct(EURIBOR.m3, 3)})` },
              { value: 6, label: `Euribor 6 meses (hoje ${pct(EURIBOR.m6, 3)})` },
              { value: 12, label: `Euribor 12 meses (hoje ${pct(EURIBOR.m12, 3)})` },
            ]}
            source="euribor"
            hint={`Valores de ${EURIBOR.asOf}. A taxa é revista a cada ${i.euriborTenor} meses${i.euriborTenor === 12 ? ' (fica fixa um ano)' : ' (acompanha a Euribor mais de perto)'}.`}
          />
          <SelectField
            label="Evolução da Euribor"
            value={i.euriborScenario}
            onChange={(v) => {
              const s = EURIBOR_SCENARIOS.find((x) => x.id === v);
              patch({ euriborScenario: v, ...(s ? { customEuriborPath: [...s.paths[i.euriborTenor]] } : {}) });
            }}
            options={[...EURIBOR_SCENARIOS.map((s) => ({ value: s.id, label: s.label })), { value: 'custom', label: 'Personalizado (editar abaixo)' }]}
            hint={scenario?.description}
            source="euribor-forward"
          />
          <div className="field">
            <span className="field-label">Euribor por ano do contrato (%) — o último valor mantém-se</span>
            <div className="euribor-grid">
              {path.map((v, idx) => (
                <div key={idx} className="euribor-cell">
                  <span className="hint">
                    Ano {idx + 1}
                    {idx === path.length - 1 ? '+' : ''}
                  </span>
                  <NumberInput
                    className="inline-number"
                    label={`Euribor no ano ${idx + 1}`}
                    value={v}
                    step={0.05}
                    min={-1}
                    max={15}
                    suffix="%"
                    onChange={(n) => {
                      const next = [...path];
                      next[idx] = n;
                      patch({ euriborScenario: 'custom', customEuriborPath: next });
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn small"
                disabled={path.length >= 40}
                onClick={() => patch({ euriborScenario: 'custom', customEuriborPath: [...path, path[path.length - 1] ?? EURIBOR.m12] })}
              >
                + Ano
              </button>
              <button
                type="button"
                className="btn small"
                disabled={path.length <= 1}
                onClick={() => patch({ euriborScenario: 'custom', customEuriborPath: path.slice(0, -1) })}
              >
                − Ano
              </button>
            </div>
          </div>
        </Section>
      )}

      {/* ---------------- CUSTOS DE AQUISIÇÃO ---------------- */}
      <Section icon={<IconReceipt />} title="Custos de escritura e banco" keywords={SECTION_KEYWORDS.custos} loading={pending} badge={<span className="pill" title="Impostos, escritura e comissões (sem obras nem recheio)">{eur(m.upfrontTotal - i.worksAndFurniture - i.furnishing)}</span>}>
        <div className="row2">
          <NumberField
            label="Escritura + registos"
            value={i.deedAndRegistry}
            onChange={(v) => set('deedAndRegistry', v)}
            suffix="€"
            step={25}
            min={0}
            source="casa-pronta"
            hint={m.registryDiscount > 0 ? `Casa Pronta compra + hipoteca, antes do desconto jovem (−${eur(m.registryDiscount)})` : 'Casa Pronta compra + hipoteca'}
          />
          <NumberField label="Solicitador / advogado" value={i.solicitorFee} onChange={(v) => set('solicitorFee', v)} suffix="€" step={50} min={0} hint="Opcional" />
        </div>
        <div className="row2">
          <NumberField label="Avaliação bancária" value={i.valuationFee} onChange={(v) => set('valuationFee', v)} suffix="€" step={10} min={0} source="precarios" hint="Valor do preçário, sem os 4% de IS" />
          <NumberField label="Dossier e formalização" value={i.bankSetupFees} onChange={(v) => set('bankSetupFees', v)} suffix="€" step={10} min={0} source="precarios" hint="Preçário, sem IS. Muitos bancos isentam até 35 anos" />
        </div>
        <NumberField
          label="Imposto do Selo sobre o crédito"
          value={i.stampLoanPct}
          onChange={(v) => set('stampLoanPct', v)}
          suffix="%"
          step={0.1}
          min={0}
          max={5}
          source="imposto-selo"
          hint="0,6% para prazos ≥ 5 anos; 0,5% entre 1 e 5 anos"
        />
      </Section>

      {/* ---------------- AMORTIZAÇÕES ---------------- */}
      <Section icon={<IconArrowDownCircle />} title="Amortizações antecipadas" keywords={SECTION_KEYWORDS.amortizacoes} badge={<span className="pill">{i.goalEnabled ? `Objetivo ${i.targetYears} anos` : i.extraPlan.enabled ? 'Plano manual' : 'Sem plano'}</span>}>
        <Segmented
          value={i.amortMode}
          onChange={(v) => set('amortMode', v)}
          options={[
            { value: 'prazo', label: 'Reduzir prazo' },
            { value: 'prestacao', label: 'Reduzir prestação' },
          ]}
        />
        <span className="hint">
          {i.amortMode === 'prazo'
            ? 'Mantém a prestação e encurta o crédito — poupa mais juros.'
            : 'Mantém o prazo e baixa a prestação — mais folga mensal, menos juros poupados.'}
        </span>
        <Check checked={i.goalEnabled} onChange={(v) => patch({ goalEnabled: v, extraPlan: { ...i.extraPlan, enabled: true, amount: v ? i.extraPlan.amount : m.params.extraPlan.amount } })}>
          <b>Definir objetivo</b>: calcular quanto amortizar para liquidar em X anos
        </Check>
        {i.goalEnabled && (
          <NumberField
            label="Liquidar o crédito em"
            value={i.targetYears}
            onChange={(v) => set('targetYears', Math.round(v))}
            suffix="anos"
            min={1}
            max={i.termYears}
            slider
            sliderMin={1}
            sliderMax={i.termYears}
            hint={
              m.solvedExtra !== null ? (
                <>
                  Precisas de amortizar <b>{eur(m.solvedExtra)}</b> {FREQ.find((f) => f.value === i.extraPlan.everyMonths)?.label.toLowerCase()} (≈ {eur(m.extraMonthlyEquivalent)}/mês).
                </>
              ) : (
                'Objetivo impossível com estes parâmetros.'
              )
            }
          />
        )}
        {!i.goalEnabled && (
          <Check checked={i.extraPlan.enabled} onChange={(v) => set('extraPlan', { ...i.extraPlan, enabled: v })}>
            Amortização periódica fixa
          </Check>
        )}
        {(i.goalEnabled || i.extraPlan.enabled) && (
          <>
            <div className="row2">
              {!i.goalEnabled && (
                <NumberField label="Valor de cada amortização" value={i.extraPlan.amount} onChange={(v) => set('extraPlan', { ...i.extraPlan, amount: v })} suffix="€" step={500} min={0} />
              )}
              <SelectField label="Frequência" value={i.extraPlan.everyMonths} onChange={(v) => set('extraPlan', { ...i.extraPlan, everyMonths: v })} options={FREQ} />
            </div>
            <div className="row2">
              <NumberField
                label="Começar no mês"
                value={i.extraPlan.startMonth}
                onChange={(v) => set('extraPlan', { ...i.extraPlan, startMonth: Math.max(1, Math.round(v)) })}
                suffix="º mês"
                min={1}
                hint={`${monthLabel(i.extraPlan.startMonth)} após a escritura`}
              />
              <NumberField
                label="Parar no mês"
                value={i.extraPlan.endMonth}
                onChange={(v) => set('extraPlan', { ...i.extraPlan, endMonth: Math.max(0, Math.round(v)) })}
                suffix="º mês"
                min={0}
                hint={i.extraPlan.endMonth > 0 ? monthLabel(i.extraPlan.endMonth) : '0 = continuar até liquidar'}
              />
            </div>
          </>
        )}

        <div className="field">
          <span className="field-label">Amortizações pontuais (ex.: prémios, heranças, venda de investimentos)</span>
          {i.lumpSums.map((l) => (
            <div key={l.id} className="lump-row">
              <NumberField label="Mês" value={l.month} onChange={(v) => set('lumpSums', i.lumpSums.map((x) => (x.id === l.id ? { ...x, month: Math.max(1, Math.round(v)) } : x)))} min={1} hint={`Ano ${Math.ceil(l.month / 12)}`} />
              <NumberField label="Valor" value={l.amount} onChange={(v) => set('lumpSums', i.lumpSums.map((x) => (x.id === l.id ? { ...x, amount: v } : x)))} suffix="€" step={1000} min={0} hint=" " />
              <button type="button" className="btn small" style={{ marginBottom: 22 }} onClick={() => set('lumpSums', i.lumpSums.filter((x) => x.id !== l.id))} aria-label="Remover">
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn small" onClick={() => set('lumpSums', [...i.lumpSums, { id: crypto.randomUUID(), month: 12, amount: 10_000 }])}>
              + Adicionar amortização pontual
            </button>
            {m.investmentsLeft > 0 && (
              <button
                type="button"
                className="btn small"
                title="Simula usar os investimentos que não foram para a entrada"
                onClick={() => set('lumpSums', [...i.lumpSums, { id: crypto.randomUUID(), month: 1, amount: Math.round(m.investmentsLeft) }])}
              >
                + Usar investimentos restantes ({eur(m.investmentsLeft)})
              </button>
            )}
          </div>
        </div>

        <div className="row2">
          <NumberField
            label="Comissão taxa variável"
            value={i.feeVariablePct}
            onChange={(v) => set('feeVariablePct', v)}
            suffix="%"
            step={0.1}
            min={0}
            max={0.5}
            source="amortizacao"
            disabled={i.rateType === 'fixa'}
            hint={i.rateType === 'fixa' ? 'Não se aplica em taxa fixa' : i.rateType === 'mista' ? 'Depois do período fixo' : 'Máximo legal 0,5%'}
          />
          <NumberField
            label="Comissão taxa fixa"
            value={i.feeFixedPct}
            onChange={(v) => set('feeFixedPct', v)}
            suffix="%"
            step={0.1}
            min={0}
            max={2}
            source="amortizacao"
            disabled={i.rateType === 'variavel'}
            hint={i.rateType === 'variavel' ? 'Só em taxa fixa ou mista' : i.rateType === 'mista' ? 'Durante o período fixo' : 'Máximo legal 2%'}
          />
        </div>
        {i.rateType !== 'fixa' && (
          <Check checked={i.feeVariableWaived} onChange={(v) => set('feeVariableWaived', v)}>
            Simular sem a comissão de 0,5% em taxa variável (se o projeto de lei passar) <SourceLink id="amortizacao" />
          </Check>
        )}
        <span className="hint">Comissões sujeitas a Imposto do Selo de 4%. Pré-aviso: 7 dias (parcial), 10 dias (total).</span>
      </Section>

      {/* ---------------- SEGUROS ---------------- */}
      <Section icon={<IconUmbrella />} title="Seguros e encargos do crédito" keywords={SECTION_KEYWORDS.seguros} loading={pending} badge={<span className="pill">{eur(m.monthly.filter((x) => ['vida', 'multirriscos', 'comissao'].includes(x.key)).reduce((a, x) => a + x.value, 0))}/mês</span>}>
        <NumberField
          label="Seguro de vida (% anual do capital em dívida)"
          value={i.lifeInsurancePct}
          onChange={(v) => set('lifeInsurancePct', v)}
          suffix="%/ano"
          step={0.01}
          min={0}
          source="seguros"
          hint={`≈ ${eur((m.principal * i.lifeInsurancePct) / 100 / 12)}/mês no início. Seguradora externa costuma ser 40–60% mais barata.`}
        />
        <div className="row2">
          <NumberField label="Multirriscos" value={i.homeInsuranceAnnual} onChange={(v) => set('homeInsuranceAnnual', v)} suffix="€/ano" step={10} min={0} source="seguros" />
          <NumberField label="Comissões mensais" value={i.monthlyBankFee} onChange={(v) => set('monthlyBankFee', v)} suffix="€/mês" step={0.5} min={0} hint="Processamento proibido; conta à ordem pode cobrar" source="comissoes" />
        </div>
      </Section>

      {/* ---------------- RENDIMENTO ---------------- */}
      <Section
        icon={<IconPie />}
        title="Rendimento e taxa de esforço"
        keywords={SECTION_KEYWORDS.rendimento}
        loading={pending}
        badge={i.netMonthlyIncome > 0 ? <span className={`pill ${EFFORT_PILL[m.effortStatus]}`} title="Esforço total: casa + amortizações + outras dívidas">{m.effortTotal.toFixed(0)}% do rendimento</span> : undefined}
      >
        <div className="row2">
          <NumberField label="Rendimento líquido" value={i.netMonthlyIncome} onChange={(v) => set('netMonthlyIncome', v)} suffix="€/mês" step={100} min={0} />
          <NumberField label="Outras dívidas" value={i.otherDebtMonthly} onChange={(v) => set('otherDebtMonthly', v)} suffix="€/mês" step={25} min={0} />
        </div>
        {i.netMonthlyIncome > 0 && (
          <div className="effort-stats">
            <div>
              <span className="muted small">Esforço total</span>
              <b className={`effort-${m.effortStatus}`}>{pct(m.effortTotal, 0)}</b>
              <span className="hint">
                Casa + amortizações + dívidas ÷ rendimento. {m.monthlySpare >= 0 ? `Sobram ${eur(m.monthlySpare)}/mês` : `Faltam ${eur(-m.monthlySpare)}/mês`}
                {m.spareAfterLiving !== null ? `; ${m.spareAfterLiving >= 0 ? 'sobram' : 'faltam'} ${eur(Math.abs(m.spareAfterLiving))} depois das despesas do dia a dia.` : '.'}
              </span>
            </div>
            <div>
              <span className="muted small">Taxa de esforço BdP</span>
              <b className={m.dstiStress > RULES.dstiLimit ? 'effort-impossible' : 'effort-ok'}>{pct(m.dsti, 0)}</b>
              <span className="hint">
                Só prestação + dívidas. É a que o banco avalia: {pct(m.dstiStress, 0)} com stress test (máx. {RULES.dstiLimit}%).
              </span>
            </div>
          </div>
        )}
        <span className="hint">
          Rendimento líquido mensal (média com subsídios: líquido anual ÷ 12). Desde 1/ago/2026 o BdP limita a taxa de esforço a {RULES.dstiLimit}%, calculada com stress test de +{RULES.stressPpForTerm(i.termYears)} p.p. na taxa variável. <SourceLink id="macroprudencial" />
        </span>
      </Section>

      {/* ---------------- DESPESAS DO DIA A DIA ---------------- */}
      <LivingCostsSection inputs={i} set={set} model={m} keywords={SECTION_KEYWORDS.despesas} synced={synced} loading={pending} />
      </SearchContext.Provider>
    </aside>
  );
}

function PropertyCard({ i, m }: { i: Inputs; m: Model }) {
  const isListing = i.listingUrl === LISTING.url;
  const ref = LOCAL_MARKET.medianValuationPerM2;
  return (
    <div className="card" style={{ padding: 10, boxShadow: 'none', background: 'var(--surface-2)' }}>
      {isListing && (
        <>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{LISTING.title}</div>
          <div className="small muted">{LISTING.features.join(' · ')}</div>
          <div className="small muted" style={{ marginTop: 4 }}>
            Preço anunciado: <b>{eur(LISTING.price)}</b>
            {i.price !== LISTING.price && <> · a simular: <b>{eur(i.price)}</b></>}
          </div>
        </>
      )}
      {ref > 0 && m.pricePerM2 > 0 && (
        <div className="small" style={{ marginTop: 6 }}>
          {eur(m.pricePerM2)}/m² vs avaliação bancária mediana {LOCAL_MARKET.area} <b>{eur(ref)}/m²</b> ({LOCAL_MARKET.asOf}){' '}
          <span className={`pill ${m.pricePerM2 > ref * 1.5 ? 'warn' : 'good'}`}>{m.pricePerM2 > ref ? `+${Math.round((m.pricePerM2 / ref - 1) * 100)}%` : 'em linha'}</span> <SourceLink id="mercado-local" />
        </div>
      )}
    </div>
  );
}

/** Conta, linha a linha, do capital que pode ir para a entrada (cada custo é editável) */
function AvailableBreakdown({ i, m, set }: { i: Inputs; m: Model; set: Props['set'] }) {
  const homeTotal = i.worksAndFurniture + i.furnishing;
  const hasLoan = m.principal > 0;
  const byKey = (k: string) => m.upfront.find((c) => c.key === k)?.value ?? 0;
  // Impostos calculados por lei a partir de outros parâmetros (não editáveis aqui)
  const computed = m.upfront.filter((c) => ['imt', 'imtCessao', 'isCompra'].includes(c.key) && c.value > 0);
  const costsTotal = m.upfront.filter((c) => !['obras', 'recheio'].includes(c.key)).reduce((a, c) => a + c.value, 0);

  return (
    <div className="avail-box">
      <span>Liquidez{i.investmentsUsed > 0 ? ' (inclui investimentos resgatados)' : ''}</span>
      <span className="avail-val">{eur(m.available)}</span>
      <span>− Impostos e custos da compra</span>
      <span className="avail-val">−{eur(costsTotal)}</span>
      <ul className="avail-list">
        {computed.map((c) => (
          <li key={c.key}>
            <span>
              {c.label.replace(/ \(.*\)/, '')} <span className="avail-calc">(calculado)</span>
            </span>
            <span className="avail-fixed">{eur(c.value)}</span>
          </li>
        ))}
        {hasLoan && (
          <li>
            <span>Imposto do Selo — crédito <span className="avail-calc">({pct(i.stampLoanPct, 2)} do crédito)</span></span>
            <InlineNumber
              label="Imposto do Selo sobre o crédito"
              value={Math.round(m.stampLoan)}
              onChange={(v) => set('stampLoanPct', (v / m.principal) * 100)}
              suffix="€"
              step={10}
              min={0}
            />
          </li>
        )}
        <li>
          <span>Escritura e registos</span>
          <InlineNumber
            label="Escritura e registos"
            value={Math.round(byKey('escritura'))}
            onChange={(v) => set('deedAndRegistry', v + YOUNG_REGISTRY_DISCOUNT * m.taxes.youngShare)}
            suffix="€"
            step={25}
            min={0}
          />
        </li>
        {hasLoan && (
          <>
            <li>
              <span>Avaliação bancária</span>
              <InlineNumber label="Avaliação bancária" value={Math.round(byKey('avaliacao'))} onChange={(v) => set('valuationFee', v / 1.04)} suffix="€" step={10} min={0} />
            </li>
            <li>
              <span>Dossier e formalização</span>
              <InlineNumber label="Dossier e formalização" value={Math.round(byKey('dossier'))} onChange={(v) => set('bankSetupFees', v / 1.04)} suffix="€" step={10} min={0} />
            </li>
          </>
        )}
        <li>
          <span>Solicitador / advogado</span>
          <InlineNumber label="Solicitador / advogado" value={i.solicitorFee} onChange={(v) => set('solicitorFee', v)} suffix="€" step={50} min={0} />
        </li>
      </ul>
      <span className="avail-foot">
        Valores finais a pagar.{hasLoan ? ' Avaliação e dossier já incluem 4% de Imposto do Selo.' : ''}
        {m.registryDiscount > 0 ? ` Escritura já com o desconto jovem de ${eur(m.registryDiscount)}.` : ''}
      </span>
      {homeTotal > 0 && (
        <>
          <span>− {i.worksAndFurniture > 0 ? 'Obras, decoração e recheio' : 'Decoração e recheio'}</span>
          <span className="avail-val">−{eur(homeTotal)}</span>
        </>
      )}
      <span>− Fundo de emergência</span>
      <span className="avail-val">−{eur(i.emergencyReserve)}</span>
      <b className="avail-total">Disponível para a entrada</b>
      <b className="avail-total">{eur(m.availableForDownPayment)}</b>
    </div>
  );
}

/** Estado da ligação à app de Finanças (no topo dos capitais próprios) */
function FinanceLink({ finance, synced, on, setOn }: { finance: FinanceSync; synced: boolean; on: boolean; setOn: (v: boolean) => void }) {
  // Em desenvolvimento (sem API) não mostra nada
  if (finance.status === 'loading')
    return on ? (
      <div className="finance-link" aria-busy="true" aria-label="A ligar à app de Finanças">
        <Skeleton w="62%" h={12} style={{ margin: '2px 0' }} />
        <Skeleton w="88%" h={10} />
      </div>
    ) : null;
  if (finance.status === 'unavailable' && finance.reason === 'no_api') return null;
  if (finance.status === 'unavailable')
    return (
      <div className="finance-link off">
        <span>
          App de Finanças não ligada <span className="muted">({finance.reason === 'access_not_configured' ? 'falta configurar o Cloudflare Access' : finance.reason})</span>
        </span>
      </div>
    );
  const d = finance.data;
  return (
    <div className={`finance-link${synced ? ' on' : ''}`}>
      <Check checked={on} onChange={setOn}>
        <b>Usar os valores da app de Finanças</b>
      </Check>
      <span className="small muted">
        {eur(d.liquid)} líquidos · {eur(d.invested)} investidos · {d.recurring.length} despesas recorrentes ·{' '}
        <a href={FINANCE_APP_URL} target="_blank" rel="noreferrer">
          abrir <ExternalLink size={12} strokeWidth={2} />
        </a>
      </span>
    </div>
  );
}
