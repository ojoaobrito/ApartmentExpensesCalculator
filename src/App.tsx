import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useScrollFade } from './components/useScrollFade';
import { useInputs, withDefaults } from './state';
import { useScenarios } from './storage';
import { compute } from './model';
import { RESEARCH_DATE, EURIBOR } from './data/market';
import { duration, eur, eurC, pct } from './lib/format';
import { InputsPanel } from './components/InputsPanel';
import { Alerts, Kpis, SummaryTab } from './components/Summary';
import { ScheduleTable } from './components/ScheduleTable';
import { ChartsTab, ScenariosTab, SourcesTab } from './components/Tabs';

type Tab = 'resumo' | 'graficos' | 'tabela' | 'cenarios' | 'fontes';
const TABS: { id: Tab; label: string }[] = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'graficos', label: 'Gráficos' },
  { id: 'tabela', label: 'Plano de pagamentos' },
  { id: 'cenarios', label: 'Gravar cenário' },
  { id: 'fontes', label: 'Fontes' },
];

type Theme = 'auto' | 'light' | 'dark';

export default function App() {
  const { inputs, set, patch, reset, replace } = useInputs();
  const scenarios = useScenarios();
  const model = useMemo(() => compute(inputs), [inputs]);
  const [tab, setTabState] = useState<Tab>('resumo');
  const [tabDir, setTabDir] = useState<'left' | 'right'>('right');
  // Muda de separador guardando a direção (para a animação de entrada)
  const setTab = (next: Tab) => {
    const a = TABS.findIndex((t) => t.id === tab);
    const b = TABS.findIndex((t) => t.id === next);
    if (a !== b) setTabDir(b > a ? 'right' : 'left');
    setTabState(next);
  };
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  // Sublinhado deslizante: posiciona-o por baixo do separador ativo
  useLayoutEffect(() => {
    const place = () => {
      const btn = navRef.current?.querySelector<HTMLElement>('button.on');
      const ind = indicatorRef.current;
      if (!btn || !ind) return;
      ind.style.transform = `translateX(${btn.offsetLeft}px)`;
      ind.style.width = `${btn.offsetWidth}px`;
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [tab]);
  const [exporting, setExporting] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  useScrollFade(resultsRef);
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('casa-sim:theme') as Theme) || 'auto';
    } catch {
      return 'auto';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('casa-sim:theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // Links "[fonte]" abrem o separador de fontes e fazem scroll até à fonte
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash;
      if (!h.startsWith('#fonte-')) return;
      setTabDir('right'); // "Fontes" é o último separador
      setTabState('fontes');
      requestAnimationFrame(() => document.getElementById(h.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Simulador de compra de casa</h1>
          <div className="sub">
            Crédito à habitação em Portugal · dados de {RESEARCH_DATE} · Euribor 12M {pct(EURIBOR.m12, 3)} · BCE {pct(EURIBOR.ecbDeposit)}
          </div>
        </div>
        <div className="spacer" />
        <div style={{ width: 210 }} className="seg" role="radiogroup" aria-label="Tema">
          {(['auto', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} type="button" className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>
              {{ auto: 'Auto', light: 'Claro', dark: 'Escuro' }[t]}
            </button>
          ))}
        </div>
        <button
          className="btn primary"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              const { exportPdf } = await import('./pdf/export');
              await exportPdf(inputs, model, scenarios.list);
            } catch (e) {
              alert(`Não foi possível gerar o PDF: ${(e as Error).message}`);
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? 'A gerar PDF…' : 'Exportar PDF'}
        </button>
        <button
          className="btn"
          onClick={() => {
            if (confirm('Repor todos os valores por defeito? Os cenários gravados mantêm-se.')) reset();
          }}
        >
          Repor valores
        </button>
      </header>

      <div className="mobile-bar" aria-hidden>
        <span>
          <b>{eurC(model.withExtras.firstPayment)}</b>/mês
        </span>
        <span>
          Liquidado em <b>{duration(model.withExtras.payoffMonth)}</b>
        </span>
        <span>
          Juros <b>{eur(model.withExtras.totalInterest)}</b>
        </span>
      </div>
      <div className="layout">
        <InputsPanel inputs={inputs} set={set} patch={patch} model={model} />
        <main className="results" ref={resultsRef}>
          <Kpis m={model} i={inputs} />
          <Alerts m={model} />
          <nav className="tabs" role="tablist" ref={navRef}>
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'on' : ''}
                onClick={() => {
                  setTab(t.id);
                  if (window.location.hash) history.replaceState(null, '', window.location.pathname);
                }}
              >
                {t.label}
              </button>
            ))}
            <span className="tab-indicator" ref={indicatorRef} aria-hidden />
          </nav>
          <div className="tab-panel" key={tab} data-dir={tabDir} role="tabpanel">
          {tab === 'resumo' && <SummaryTab m={model} i={inputs} />}
          {tab === 'graficos' && <ChartsTab m={model} />}
          {tab === 'tabela' && <ScheduleTable result={model.withExtras} />}
          {tab === 'cenarios' && (
            <ScenariosTab inputs={inputs} model={model} store={scenarios} onLoad={(s) => replace(withDefaults(s.inputs))} />
          )}
          {tab === 'fontes' && <SourcesTab />}
          </div>
          <footer className="footer">Simulação indicativa — não substitui a FINE do banco nem aconselhamento financeiro.</footer>
        </main>
      </div>
    </div>
  );
}
