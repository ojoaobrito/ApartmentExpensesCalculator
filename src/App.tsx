import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconBook, IconBookmark, IconCalendar, IconChart, IconPie } from './components/icons';
import { useScrollFade } from './components/useScrollFade';
import { applyFinance, useFinanceSync } from './financeSync';
import { useInputs, withDefaults } from './state';
import { useProfile } from './profile';
import { useScenarios } from './storage';
import { compute } from './model';
import { RESEARCH_DATE } from './data/market';
import { duration, eur, eurC } from './lib/format';
import { InputsPanel } from './components/InputsPanel';
import { Alerts, Kpis, SummaryTab } from './components/Summary';
import { ScheduleTable } from './components/ScheduleTable';
import { ChartsTab, ScenariosTab, SourcesTab } from './components/Tabs';
import { AlertsSkeleton, KpisSkeleton, PanelSkeleton } from './components/LoadingSkeletons';
import { Skeleton } from './components/Skeleton';

type Tab = 'resumo' | 'graficos' | 'tabela' | 'cenarios' | 'fontes';
const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'resumo', label: 'Resumo', icon: <IconPie /> },
  { id: 'graficos', label: 'Gráficos', icon: <IconChart /> },
  { id: 'tabela', label: 'Plano de pagamentos', icon: <IconCalendar /> },
  { id: 'cenarios', label: 'Gravar cenário', icon: <IconBookmark /> },
  { id: 'fontes', label: 'Fontes', icon: <IconBook /> },
];

type Theme = 'auto' | 'light' | 'dark';

export default function App() {
  const profile = useProfile();
  const kind = profile.status === 'ready' ? (profile.owner ? 'owner' : 'guest') : null;
  // Até se saber quem é, trata como dono para os números ficarem em esqueleto (não saltam);
  // a ligação à app de Finanças só aparece quando se confirma que é o dono
  const owner = kind !== 'guest';
  const { inputs, awaitingProfile, set, patch, reset, replace } = useInputs(kind);
  const scenarios = useScenarios();
  const finance = useFinanceSync();
  // Com a app de Finanças ligada (só o dono), os capitais próprios e as despesas vêm de lá
  const synced = owner && inputs.useFinanceData && finance.status === 'ready';
  // Enquanto não se sabe quem é (1.ª visita) ou os valores da app de Finanças chegam, os números ficam em esqueleto
  const pending = awaitingProfile || (owner && inputs.useFinanceData && finance.status === 'loading');
  const effective = useMemo(() => (synced && finance.data ? applyFinance(inputs, finance.data) : inputs), [synced, finance, inputs]);
  const model = useMemo(() => compute(effective), [effective]);
  // A mesma simulação sem os outros capitais (para mostrar quanto o bónus alivia por mês)
  const modelNoOther = useMemo(() => (effective.otherCapital.length ? compute({ ...effective, otherCapital: [] }) : null), [effective]);
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
            Crédito à habitação em Portugal · dados de {RESEARCH_DATE}
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
          disabled={exporting || pending}
          onClick={async () => {
            setExporting(true);
            try {
              const { exportPdf } = await import('./pdf/export');
              await exportPdf(effective, model, scenarios.list);
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
        {pending ? (
          [0, 1, 2].map((k) => <Skeleton key={k} w={90} h={12} />)
        ) : (
          <>
            <span>
              <b>{eurC(model.withExtras.firstPayment)}</b>/mês
            </span>
            <span>
              Liquidado em <b>{duration(model.withExtras.payoffMonth)}</b>
            </span>
            <span>
              Juros <b>{eur(model.withExtras.totalInterest)}</b>
            </span>
          </>
        )}
      </div>
      <div className="layout">
        <InputsPanel inputs={effective} set={set} patch={patch} model={model} finance={finance} synced={synced} pending={pending} owner={kind === 'owner'} />
        <main className="results" ref={resultsRef}>
          {pending ? (
            <>
              <KpisSkeleton />
              <AlertsSkeleton />
            </>
          ) : (
            <div className="skel-done results-top">
              <Kpis m={model} i={effective} noOther={modelNoOther} />
              <Alerts m={model} />
            </div>
          )}
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
                <span className="tab-icon" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
              </button>
            ))}
            <span className="tab-indicator" ref={indicatorRef} aria-hidden />
          </nav>
          <div className="tab-panel" key={tab} data-dir={tabDir} role="tabpanel">
          {pending && (tab === 'resumo' || tab === 'graficos' || tab === 'tabela') && <PanelSkeleton />}
          {!pending && tab === 'resumo' && <SummaryTab m={model} i={effective} />}
          {!pending && tab === 'graficos' && <ChartsTab m={model} />}
          {!pending && tab === 'tabela' && <ScheduleTable result={model.withExtras} />}
          {tab === 'cenarios' && (
            <ScenariosTab
              inputs={effective}
              model={model}
              store={scenarios}
              extras={() => ({
                finance: synced && finance.data ? { updatedAt: finance.data.updatedAt, liquid: finance.data.liquid, invested: finance.data.invested } : undefined,
                openSections: [...document.querySelectorAll('details.section[open] .sec-title')].map((el) => el.textContent ?? ''),
              })}
              onLoad={(s) => {
                // Repõe exatamente o que foi gravado: os valores da app de Finanças ficam os da altura
                replace(withDefaults({ ...s.inputs, useFinanceData: false }, kind ?? 'guest'));
                const open = s.extras?.openSections;
                if (open)
                  for (const d of document.querySelectorAll<HTMLDetailsElement>('details.section'))
                    d.open = open.includes(d.querySelector('.sec-title')?.textContent ?? '');
              }}
            />
          )}
          {tab === 'fontes' && <SourcesTab />}
          </div>
          <footer className="footer">Simulação indicativa — não substitui a FINE do banco nem aconselhamento financeiro.</footer>
        </main>
      </div>
    </div>
  );
}
