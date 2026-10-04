import { useRef, useState } from 'react';
import { withDefaults, type Inputs } from '../state';
import { exportScenarios, parseScenarioFile, type SavedScenario, type useScenarios } from '../storage';
import { compute, type Model } from '../model';
import { yearly } from '../lib/loan';
import { duration, eur, eurC, pct, pctAxis, pctFmt } from '../lib/format';
import { RESEARCH_DATE, SOURCES } from '../data/market';
import { ChartCard, LinesChart, StackedBars } from './Charts';

// ---------------------------------------------------------------------------
export function ChartsTab({ m }: { m: Model }) {
  const w = yearly(m.withExtras.rows);
  const b = yearly(m.noExtras.rows);
  const years = Math.max(w.length, b.length);
  const balance = [{ year: 0, plano: m.principal, base: m.principal }];
  for (let y = 0; y < years; y++)
    balance.push({ year: y + 1, plano: w[y]?.closingBalance ?? 0, base: b[y]?.closingBalance ?? 0 });

  const outflow = w.map((y) => ({
    year: y.year,
    juros: y.interest,
    capital: y.principal,
    extra: y.extra + y.extraFee,
    outros: y.lifeInsurance + y.homeInsurance + y.bankFee + y.stampInterest,
  }));
  const rate = b.map((y) => ({ year: y.year, tan: y.tanAvg }));

  return (
    <div className="chart-grid">
      <ChartCard title="Capital em dívida" sub="No fim de cada ano do contrato.">
        <LinesChart
          data={balance}
          xKey="year"
          series={[
            { key: 'plano', label: 'Com o teu plano', color: 'var(--s1)' },
            { key: 'base', label: 'Sem amortizações', color: 'var(--s2)', dashed: true },
          ]}
        />
      </ChartCard>
      <ChartCard title="Quanto pagas por ano" sub="Com o teu plano de amortizações.">
        <StackedBars
          data={outflow}
          xKey="year"
          series={[
            { key: 'capital', label: 'Capital', color: 'var(--s1)' },
            { key: 'juros', label: 'Juros', color: 'var(--s2)' },
            { key: 'extra', label: 'Amortização antecipada + comissão', color: 'var(--s3)' },
            { key: 'outros', label: 'Seguros e comissões', color: 'var(--s4)' },
          ]}
        />
      </ChartCard>
      <ChartCard title="TAN ao longo do contrato" sub="Média anual, segundo o cenário de Euribor escolhido.">
        <LinesChart data={rate} xKey="year" series={[{ key: 'tan', label: 'TAN', color: 'var(--s1)' }]} yFmt={pctAxis} tooltipFmt={pctFmt} step />
      </ChartCard>
      <ChartCard title="Prestação mensal" sub="Prestação média de cada ano (capital + juros).">
        <LinesChart
          data={Array.from({ length: years }, (_, y) => ({
            year: y + 1,
            plano: w[y] ? w[y].payment / m.withExtras.rows.filter((r) => r.year === y + 1).length : 0,
            base: b[y] ? b[y].payment / m.noExtras.rows.filter((r) => r.year === y + 1).length : 0,
          }))}
          xKey="year"
          series={[
            { key: 'plano', label: 'Com o teu plano', color: 'var(--s1)' },
            { key: 'base', label: 'Sem amortizações', color: 'var(--s2)', dashed: true },
          ]}
          yFmt={(v) => `${Math.round(v)} €`}
          tooltipFmt={eurC}
        />
      </ChartCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
type ScenarioStore = ReturnType<typeof useScenarios>;

export function ScenariosTab(props: { inputs: Inputs; model: Model; store: ScenarioStore; onLoad: (s: SavedScenario) => void }) {
  const { store } = props;
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cols = [
    { id: 'current', name: 'Atual', inputs: props.inputs, model: props.model },
    ...store.list.map((s) => {
      const inputs = withDefaults(s.inputs);
      return { id: s.id, name: s.name, inputs, model: compute(inputs) };
    }),
  ];
  const rateLabel = (x: Inputs) => (x.rateType === 'variavel' ? `Variável E${x.euriborTenor}M + ${pct(x.spread)}` : x.rateType === 'fixa' ? `Fixa ${pct(x.fixedRate)}` : `Mista ${x.mixedFixedYears}a ${pct(x.fixedRate)} + ${pct(x.spread)}`);
  const rows: { label: string; get: (c: (typeof cols)[number]) => string }[] = [
    { label: 'Preço', get: (c) => eur(c.inputs.price) },
    { label: 'Entrada', get: (c) => eur(c.model.downPayment) },
    { label: 'Financiamento (LTV)', get: (c) => `${eur(c.model.principal)} (${c.model.ltv.toFixed(0)}%)` },
    { label: 'Taxa', get: (c) => rateLabel(c.inputs) },
    { label: 'Prazo contrato', get: (c) => `${c.inputs.termYears} anos` },
    { label: 'Prestação inicial', get: (c) => eurC(c.model.withExtras.firstPayment) },
    { label: 'Total da casa por mês', get: (c) => eur(c.model.monthlyTotal) },
    { label: 'Amortização média/mês', get: (c) => eur(c.model.extraMonthlyEquivalent) },
    { label: 'Liquidado em', get: (c) => duration(c.model.withExtras.payoffMonth) },
    { label: 'Juros totais', get: (c) => eur(c.model.withExtras.totalInterest) },
    { label: 'Comissões amortização', get: (c) => eur(c.model.withExtras.totalExtraFees) },
    { label: 'Custos iniciais', get: (c) => eur(c.model.upfrontTotal) },
    { label: 'Custo total', get: (c) => eur(c.model.downPayment + c.model.upfrontTotal + c.model.withExtras.totalOutflow) },
    { label: 'Liquidez após escritura', get: (c) => eur(c.model.cashLeft) },
    { label: 'TAEG', get: (c) => pct(c.model.taeg) },
    { label: 'Sobra no fim do mês', get: (c) => (c.model.spareAfterAll !== null ? eur(c.model.spareAfterAll) : c.inputs.netMonthlyIncome ? `${eur(c.model.monthlySpare)} (sem despesas)` : '—') },
    { label: 'Taxa de esforço (stress)', get: (c) => (c.inputs.netMonthlyIncome ? `${pct(c.model.dsti, 1)} (${pct(c.model.dstiStress, 1)})` : '—') },
  ];
  const status = {
    loading: { cls: '', text: 'A verificar armazenamento…' },
    cloud: { cls: 'good', text: 'Guardado na nuvem — disponível em qualquer dispositivo' },
    local: { cls: 'warn', text: 'Guardado só neste browser — exporta um ficheiro como cópia de segurança' },
    locked: { cls: 'crit', text: 'Nuvem protegida — introduz o código de acesso' },
  }[store.mode];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <h2 style={{ flex: 1 }}>Gravar cenário</h2>
          <span className={`pill ${status.cls}`}>{status.text}</span>
        </div>
        <div className="card-sub">Grava a simulação atual para a comparares com outras — p.ex. variável vs mista, ou entrada maior vs amortizar.</div>
        {store.mode === 'locked' && (
          <form
            style={{ display: 'flex', gap: 8, marginBottom: 12 }}
            onSubmit={(e) => {
              e.preventDefault();
              void store.unlock(token.trim());
            }}
          >
            <span className="input-wrap" style={{ flex: 1 }}>
              <input type="password" placeholder="Código de acesso (APP_TOKEN)" value={token} onChange={(e) => setToken(e.target.value)} />
            </span>
            <button className="btn" type="submit">
              Desbloquear
            </button>
          </form>
        )}
        <form
          style={{ display: 'flex', gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            void store.add(name.trim() || `Cenário ${store.list.length + 1}`, props.inputs);
            setName('');
          }}
        >
          <span className="input-wrap" style={{ flex: 1 }}>
            <input placeholder="Nome (ex.: Variável BCP + 10 anos)" value={name} onChange={(e) => setName(e.target.value)} />
          </span>
          <button className="btn primary" type="submit">
            Gravar
          </button>
        </form>
        {store.error && <p className="small" style={{ color: 'var(--crit)', marginBottom: 0 }}>{store.error}</p>}

        <div className="scenarios-list" style={{ marginTop: 14 }}>
          {store.list.length === 0 && <div className="empty">Ainda não tens cenários gravados.</div>}
          {store.list.map((s) => (
            <div key={s.id} className="scenario-item">
              <span className="name">{s.name}</span>
              <span className="muted small">{new Date(s.savedAt).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <button className="btn small" onClick={() => props.onLoad(s)} title="Substitui os parâmetros atuais por este cenário">
                Carregar
              </button>
              <button
                className="btn small"
                title="Grava os parâmetros atuais por cima deste cenário"
                onClick={() => {
                  if (confirm(`Substituir "${s.name}" pelos parâmetros atuais?`)) void store.overwrite(s.id, props.inputs);
                }}
              >
                Atualizar
              </button>
              <button
                className="btn small"
                onClick={() => {
                  const n = prompt('Novo nome', s.name);
                  if (n && n.trim()) void store.rename(s.id, n.trim());
                }}
              >
                Renomear
              </button>
              <button
                className="btn small"
                aria-label={`Apagar ${s.name}`}
                onClick={() => {
                  if (confirm(`Apagar "${s.name}"?`)) void store.remove(s.id);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          <button className="btn small" disabled={!store.list.length} onClick={() => exportScenarios(store.list)}>
            Exportar ficheiro
          </button>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            Importar ficheiro
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const n = await store.importMany(await parseScenarioFile(f));
                setMsg(n ? `${n} cenário(s) importado(s).` : 'Nada de novo para importar.');
              } catch (err) {
                setMsg(`Ficheiro inválido: ${(err as Error).message}`);
              }
            }}
          />
          {msg && <span className="small muted">{msg}</span>}
        </div>
      </div>

      {store.list.length > 0 && (
        <div className="card">
          <h2>Comparação</h2>
          <div className="card-sub">Simulação atual lado a lado com os cenários gravados.</div>
          <div className="table-wrap" style={{ maxHeight: 'none' }}>
            <table className="data">
              <thead>
                <tr>
                  <th />
                  {cols.map((c) => (
                    <th key={c.id}>{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    {cols.map((c) => (
                      <td key={c.id}>{r.get(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function SourcesTab() {
  return (
    <div className="card sources">
      <h2>Fontes</h2>
      <div className="card-sub">Pesquisa feita a {RESEARCH_DATE}. Os valores mudam — confirma sempre a FINE (Ficha de Informação Normalizada Europeia) do teu banco.</div>
      <ol>
        {SOURCES.map((s) => (
          <li key={s.id} id={`fonte-${s.id}`}>
            <b>{s.title}</b>
            <div className="date">
              {s.publisher} · {s.date}
            </div>
            <div className="small muted">Usado para: {s.used}</div>
            <div className="small" style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
              {s.urls.map((u) => (
                <a key={u} href={u} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>
                  {u}
                </a>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <h2 style={{ marginTop: 20 }}>Pressupostos e limitações</h2>
      <ul className="small muted">
        <li>Sistema francês (prestação constante entre revisões). Na taxa variável a prestação é recalculada em cada revisão do indexante (3, 6 ou 12 meses) com a Euribor do cenário escolhido.</li>
        <li>Euribor futura é incerta: a curva forward é a melhor estimativa do mercado hoje, não uma previsão garantida. A TAN nunca desce abaixo de 0%.</li>
        <li>Amortização antecipada: comissão de 0,5% (variável) ou 2% (fixa / período fixo da mista) sobre o capital amortizado, mais 4% de Imposto do Selo sobre a comissão. A suspensão da comissão terminou a 31/dez/2025; um projeto de lei para a abolir foi aprovado só na generalidade a 30/set/2026.</li>
        <li>"Reduzir prazo" mantém a prestação e recalcula o nº de prestações; "reduzir prestação" mantém o prazo. Na prática escolhes em cada amortização.</li>
        <li>Seguro de vida modelado como % anual do capital em dívida. Na realidade o prémio depende da idade, sobe com os anos e pode ser mais barato fora do banco (mas o banco pode subir o spread se não aceitares os seguros dele).</li>
        <li>IMT e Imposto do Selo calculados sobre o maior entre o preço e o VPT. Tabelas de 2026 para o Continente. Comprador não residente paga 7,5% de IMT (não modelado).</li>
        <li>O LTV usa o preço; o banco usa o menor entre preço e avaliação — se a avaliação vier abaixo, precisas de mais entrada.</li>
        <li>A TAEG é uma estimativa (TIR dos fluxos sem amortizações, com seguros, comissões e Imposto do Selo do crédito).</li>
        <li>Juros de crédito habitação contratado após 2011 não são dedutíveis no IRS. Juros de crédito habitação estão isentos de Imposto do Selo.</li>
        <li>Não consegui ler o anúncio do idealista (o site bloqueia acessos automáticos): confirma VPT, condomínio e município no anúncio / caderneta predial.</li>
      </ul>
    </div>
  );
}
