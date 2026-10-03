/**
 * Dados de mercado e regras — pesquisa feita a 3 de outubro de 2026.
 * Cada valor tem uma fonte em SOURCES (ver separador "Fontes" da app).
 */

export interface Source {
  id: string;
  title: string;
  publisher: string;
  date: string;
  urls: string[];
  used: string; // o que a app usa desta fonte
}

export const RESEARCH_DATE = '3 de outubro de 2026';

// ---------------------------------------------------------------------------
// Imóvel (anúncio idealista 34828508, consultado a 3/out/2026)
// ---------------------------------------------------------------------------
export const LISTING = {
  url: 'https://www.idealista.pt/imovel/34828508/',
  title: 'T1 em Covilhã e Canhoso, Covilhã',
  price: 220_000,
  areaM2: 62,
  features: [
    '62 m² área bruta',
    '2.º andar c/ elevador',
    'garagem',
    'condomínio fechado c/ piscina',
    'construção 2025 (fase final)',
    'cedência de posição contratual',
    'orientação sul, A/C',
  ],
};

/** Mercado local — INE e anúncios comparáveis */
export const LOCAL_MARKET = {
  area: 'Covilhã',
  asOf: 'INE, ago/2026',
  medianValuationPerM2: 1_449, // avaliação bancária, apartamentos, concelho da Covilhã
  medianNewSalePerM2: 1_542, // preço mediano de habitações novas vendidas (12 meses até T1 2026)
};

// ---------------------------------------------------------------------------
// Euribor
// ---------------------------------------------------------------------------
export const EURIBOR = {
  asOf: '2/out/2026',
  m3: 2.598,
  m6: 3.058,
  m12: 3.323,
  septAvg: { m3: 2.635, m6: 2.922, m12: 3.247 },
  ecbDeposit: 2.5,
};

type Tenor = 3 | 6 | 12;
export interface EuriborScenario {
  id: string;
  label: string;
  description: string;
  paths: Record<Tenor, number[]>; // valor médio por ano do contrato
}

const spot: Record<Tenor, number> = { 3: EURIBOR.m3, 6: EURIBOR.m6, 12: EURIBOR.m12 };
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const fromSpot = (deltas: number[]) =>
  ({ 3: deltas.map((d) => r3(spot[3] + d)), 6: deltas.map((d) => r3(spot[6] + d)), 12: deltas.map((d) => r3(spot[12] + d)) }) as Record<Tenor, number[]>;
const glideTo = (target: Record<Tenor, number>, years: number) =>
  ({
    3: Array.from({ length: years + 1 }, (_, i) => r3(spot[3] + ((target[3] - spot[3]) * i) / years)),
    6: Array.from({ length: years + 1 }, (_, i) => r3(spot[6] + ((target[6] - spot[6]) * i) / years)),
    12: Array.from({ length: years + 1 }, (_, i) => r3(spot[12] + ((target[12] - spot[12]) * i) / years)),
  }) as Record<Tenor, number[]>;

export const EURIBOR_SCENARIOS: EuriborScenario[] = [
  {
    id: 'forward',
    label: 'Mercado — curva forward (base)',
    description:
      'Expectativa implícita nos swaps a 2/out/2026: Euribor 6M ≈ 3,2% (dez/26) → 3,5% (2027–29); 12M ≈ 3,5–3,66%. 3M estimada a partir da 6M (diferencial atual). Depois mantém-se.',
    paths: {
      3: [2.9, 3.04, 3.01, 2.99],
      6: [3.36, 3.5, 3.47, 3.45],
      12: [3.49, 3.56, 3.63, 3.6],
    },
  },
  {
    id: 'constant',
    label: 'Euribor constante (valor de hoje)',
    description: 'Mantém o valor atual durante todo o contrato.',
    paths: fromSpot([0]),
  },
  {
    id: 'up',
    label: 'Subida — BCE continua a subir (+1 p.p.)',
    description: 'Mais duas a quatro subidas do BCE: +0,5 p.p. no ano 1 e +1 p.p. a partir do ano 2.',
    paths: fromSpot([0.5, 1]),
  },
  {
    id: 'down',
    label: 'Descida — regresso a ~2% em 4 anos',
    description: 'Inflação controlada e BCE volta à taxa neutra (~2%), como em 2025.',
    paths: glideTo({ 3: 1.9, 6: 2.0, 12: 2.1 }, 4),
  },
  {
    id: 'stress',
    label: 'Stress BdP (+1,5 p.p. permanente)',
    description: 'Choque usado pelo Banco de Portugal para testar a taxa de esforço em créditos > 10 anos.',
    paths: fromSpot([1.5]),
  },
];

// ---------------------------------------------------------------------------
// Ofertas dos bancos (spread mínimo com produtos associados)
// ---------------------------------------------------------------------------
export interface BankOffer {
  id: string;
  label: string;
  spread: number; // spread mínimo com vendas associadas (variável)
  baseSpread?: number; // spread sem produtos
  mixedRate?: number; // TAN do período fixo (mista) com spread mínimo
  mixedYears?: number;
  fixedRate?: number; // TAN fixa todo o prazo (melhor caso)
  note: string;
}

export const BANK_OFFERS: BankOffer[] = [
  { id: 'bdp-avg', label: 'Média de mercado (BdP 2025)', spread: 0.73, mixedRate: 2.81, mixedYears: 3, note: 'Spread médio dos novos contratos em 2025: 0,73 p.p.; TAN fixa inicial média nas mistas 2,81% (3,1 anos).' },
  { id: 'cgd', label: 'CGD — spread 0,70%', spread: 0.7, baseSpread: 2.9, fixedRate: 5.1, note: 'Preçário 2/out/2026: spread 0,70–2,90%, indexado à Euribor 6M. Fixa 25–40 anos: 4,40% + spread. Sem mista a 2 anos.' },
  { id: 'bcp', label: 'Millennium bcp — spread 0,70%', spread: 0.7, baseSpread: 1.25, mixedRate: 3.45, mixedYears: 2, fixedRate: 5.05, note: 'Preçário 1/out/2026: spread 0,70–1,50% (LTV ≤ 80%). Mista 2 anos: 2,75% + spread (3,45% no mínimo).' },
  { id: 'santander', label: 'Santander — spread 0,80%', spread: 0.8, baseSpread: 1.9, mixedRate: 3.7, mixedYears: 3, fixedRate: 5.0, note: 'Preçário 1/out/2026: spread 0,80–1,90% (0,50% nos primeiros 36 meses em variável, com domiciliação + 2 produtos). Mista 2/3/4 anos: 2,90% + spread.' },
  { id: 'novobanco', label: 'Novobanco — spread 0,65%', spread: 0.65, baseSpread: 1.4, mixedRate: 4.2, mixedYears: 2, fixedRate: 5.35, note: 'Preçário 1/out/2026: spread 0,65–2,00%. Mista 2 anos: 3,553% + spread. Fixa: 5,35–6,70%.' },
  { id: 'bpi', label: 'BPI — spread 0,75%', spread: 0.75, baseSpread: 1.5, mixedRate: 2.95, mixedYears: 3, fixedRate: 4.35, note: 'FINE 1/set/2026: spread 1,50% / 0,75% com produtos. Mista 3 anos 2,95% com produtos. Fixa 30 anos 4,35%.' },
  { id: 'bankinter', label: 'Bankinter — spread 0,70%', spread: 0.7, baseSpread: 1.05, mixedRate: 2.5, mixedYears: 2, note: 'FINE 1/set/2026: spread 1,05% / 0,70%. Mista 2 anos 2,50% com produtos. Conta sem comissão de manutenção.' },
  { id: 'activobank', label: 'ActivoBank — spread 0,70%', spread: 0.7, baseSpread: 1.25, note: 'Spread 1,25% base, 0,70% com domiciliação + 3 de 5 produtos. Campanha 0% durante 24 meses só para escrituras até 31/out/2026.' },
  { id: 'ctt', label: 'Banco CTT — spread 0,70%', spread: 0.7, baseSpread: 1.3, fixedRate: 4.15, note: 'FINE 1/set/2026: spread 1,30% / 0,70%. Fixa 30 anos 4,15% com produtos.' },
  { id: 'ca', label: 'Crédito Agrícola — spread 0,80%', spread: 0.8, baseSpread: 1.65, note: 'FINE 1/set/2026: spread 1,65% / 0,80% com produtos.' },
  { id: 'montepio', label: 'Montepio — spread 0,70%', spread: 0.7, baseSpread: 1.5, note: 'FINE 1/set/2026: spread 1,50% / 0,70% com produtos.' },
  { id: 'abanca', label: 'Abanca — spread 0,70%', spread: 0.7, baseSpread: 1.7, note: 'FINE 1/set/2026: spread 1,70% / 0,70% com produtos.' },
];

// ---------------------------------------------------------------------------
// Regras (Banco de Portugal, fiscalidade)
// ---------------------------------------------------------------------------
export const RULES = {
  maxLtvHpp: 90,
  dstiLimit: 45, // Recomendação Macroprudencial 1/2026 (desde 1/ago/2026)
  dstiComfort: 35,
  /** Choque de taxa do stress test (variável / fase variável da mista) */
  stressPpForTerm: (termYears: number) => (termYears > 10 ? 1.5 : termYears > 5 ? 1 : 0.5),
  stressPpAfter70: 0.75,
  maxTermForAge: (age: number) => (age <= 35 ? 40 : 35),
  maxAgeAtEnd: 75,
  youngFullExemption: 330_539,
  youngPartialExemption: 660_982,
  youngGuaranteePriceCap: 450_000,
  imiExemptionVpt: 125_000,
  imiExemptionIncome: 153_300,
};

/** Redução de emolumentos Casa Pronta para jovens (> 1 ato: compra + hipoteca) */
export const YOUNG_REGISTRY_DISCOUNT = 450;

export const IMI_PRESETS = [
  { label: 'Covilhã / Lisboa (mínimo legal)', rate: 0.3 },
  { label: 'Porto (HPP)', rate: 0.27 },
  { label: 'Porto (geral)', rate: 0.324 },
  { label: 'Intermédia', rate: 0.375 },
  { label: 'Máximo legal (ex.: Oeiras)', rate: 0.45 },
];

export const DEFAULTS = {
  furnishing: 7_500, // estimativa para mobilar um T1 que já traz cozinha equipada e A/C
  valuation: 200_000, // estimativa: comparáveis novos com piscina a 195–200 k€; substituir pela avaliação real
  vpt: 65_000, // estimativa pela fórmula do CIMI (54–81 k€)
  imiRatePct: 0.3,
  condoMonthly: 75, // condomínio fechado com piscina, interior — estimativa

  deedAndRegistry: 700,
  valuationFee: 230,
  bankSetupFees: 490,
  spread: 0.75,
  fixedRate: 3.45,
  mixedFixedYears: 2,
  feeVariableWaived: false,
  lifeInsurancePct: 0.15,
  homeInsuranceAnnual: 200,
  monthlyBankFee: 0,
};

// ---------------------------------------------------------------------------
// Fontes
// ---------------------------------------------------------------------------
export const SOURCES: Source[] = [
  {
    id: 'euribor',
    title: 'Euribor diária (3M 2,598%, 6M 3,058%, 12M 3,323% a 2/out/2026) e médias de setembro',
    publisher: 'EMMI via euribor-rates.eu; Lusa / Notícias ao Minuto',
    date: '2 e 30 de setembro de 2026',
    urls: [
      'https://www.euribor-rates.eu/en/current-euribor-rates/',
      'https://www.noticiasaominuto.com/pais/3059603/media-da-euribor-a-tres-seis-e-12-meses-volta-a-subir-em-setembro',
      'https://www.dnoticias.pt/2026/9/30/507314-media-da-euribor-a-tres-seis-e-12-meses-volta-a-subir-em-setembro/',
    ],
    used: 'Valor atual dos indexantes e cenário "Euribor constante".',
  },
  {
    id: 'euribor-forward',
    title: 'Previsões Euribor 6M e 12M (curva forward implícita nos swaps) e expectativas para o BCE',
    publisher: 'BlueGamma; Observador',
    date: '2 de outubro de 2026 / 9 de setembro de 2026',
    urls: [
      'https://www.bluegamma.io/pt/previsoes/euribor-6-meses',
      'https://www.bluegamma.io/pt/previsoes/euribor-12-meses',
      'https://observador.pt/especiais/bce-sobe-juros-e-nao-deve-ficar-por-aqui-taxas-euribor-podem-aproximar-se-de-35-nos-proximos-meses/',
    ],
    used: 'Cenário base "Mercado — curva forward" e cenários de subida/descida.',
  },
  {
    id: 'bce',
    title: 'BCE sobe taxas em 25 p.b. — taxa de depósito em 2,50% (10/set/2026); subida anterior em junho',
    publisher: 'Banco Central Europeu; Público',
    date: '10 de setembro de 2026',
    urls: [
      'https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.mp260910~314e508016.pt.html',
      'https://www.publico.pt/2026/06/11/economia/noticia/bce-confirma-expectativas-taxas-juro-sobem-225-2177831',
    ],
    used: 'Contexto dos cenários de taxa.',
  },
  {
    id: 'spreads',
    title: 'Preçários de crédito à habitação (folhetos de taxas de juro) — CGD, Millennium bcp, Santander, Novobanco, ActivoBank',
    publisher: 'Bancos (preçários oficiais)',
    date: '1–2 de outubro de 2026',
    urls: [
      'https://www.cgd.pt/Precario/Documents/18.pdf',
      'https://ind.millenniumbcp.pt/pt/Articles/Documents/precario/SECCAO_18.pdf',
      'https://www.santander.pt/pdfs/precario-banco/folheto-taxas-juro/clientes-particulares/18-operacoes-credito/18_precariofolhetotaxasjuro_cp_opscredito.pdf',
      'https://www.novobanco.pt/content/dam/novobancopublicsites/docs/pdfs/precario/particulares/P_FTJ_opera%C3%A7oes_credito.pdf.coredownload.inline.pdf',
      'https://www.activobank.pt/home-loan',
      'https://www.literaciafinanceira.pt/artigos/melhor-credito-habitacao',
      'https://www.comparaja.pt/credito-habitacao/artigos/spread',
    ],
    used: 'Spreads mínimos e propostas pré-definidas por banco (BPI, Bankinter, CTT, CA, Montepio, Abanca via FINE de 1/set/2026).',
  },
  {
    id: 'taxa-fixa',
    title: 'Taxas fixas e mistas nos preçários + estatísticas BdP de novos créditos (agosto 2026: média 3,00%; mista 2,86%; variável 3,23%)',
    publisher: 'Bancos; Banco de Portugal via ECO',
    date: '1 de outubro de 2026',
    urls: [
      'https://eco.sapo.pt/2026/10/01/taxa-de-juro-dos-novos-creditos-a-habitacao-sobe-para-3-e-o-valor-mais-elevado-desde-abril-de-2025/',
      'https://ind.millenniumbcp.pt/pt/Articles/Documents/precario/SECCAO_18.pdf',
    ],
    used: 'TAN fixa / período fixo da mista por defeito e nas propostas.',
  },
  {
    id: 'bdp-ramc',
    title: 'Relatório de Acompanhamento dos Mercados de Crédito 2025 (spread médio 0,73 p.p.; TAEG média 4,8%; fim da suspensão da comissão)',
    publisher: 'Banco de Portugal',
    date: '22 de junho de 2026',
    urls: ['https://www.bportugal.pt/sites/default/files/documents/2026-06/RAMC_2025.pdf'],
    used: 'Proposta "Média de mercado" e comparação da TAEG.',
  },
  {
    id: 'macroprudencial',
    title: 'Recomendação Macroprudencial n.º 1/2026 — LTV 90%, DSTI 45%, maturidade 40/35 anos; stress test +1,5 p.p. (Instrução 23/2023)',
    publisher: 'Banco de Portugal; Literacia Financeira; Jornal Económico',
    date: 'julho de 2026 (em vigor desde 1/ago/2026)',
    urls: [
      'https://www.bportugal.pt/sites/default/files/documents/2026-07/Recomendacao_Macroprudencial_n.1-2026.pdf',
      'https://www.literaciafinanceira.pt/artigos/taxa-de-esforco-maxima',
      'https://jornaleconomico.sapo.pt/noticias/banco-de-portugal-altera-limite-da-taxa-de-esforco-no-credito-a-habitacao-para-45-mas-mantem-taxa-de-stress/',
    ],
    used: 'Alertas de LTV, taxa de esforço, stress test e prazo máximo por idade.',
  },
  {
    id: 'amortizacao',
    title: 'Comissão de reembolso antecipado (DL 74-A/2017, art. 23.º): 0,5% variável, 2% fixa; suspensão terminou a 31/dez/2025; projeto para abolir aprovado só na generalidade',
    publisher: 'PGDL; Jornal de Negócios; Bem Endividado',
    date: '30 de setembro de 2026',
    urls: [
      'https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?artigo_id=2842A0023&nid=2842&tabela=lei_velhas&pagina=1&ficha=1&so_miolo=&nversao=4',
      'https://www.jornaldenegocios.pt/empresas/detalhe/aprovado-projeto-do-chega-que-elimina-comissao-de-reembolso-no-credito-com-taxa-variavel',
      'https://bemendividado.pt/artigos/fim-comissao-amortizacao-taxa-variavel',
    ],
    used: 'Comissões de amortização antecipada (0,5% / 2%) + IS 4%; opção "suspensa" para simular se o projeto passar.',
  },
  {
    id: 'garantia-jovem',
    title: 'Garantia pública para jovens até 35 anos (DL 44/2024) — até 100% de financiamento, imóveis ≤ 450 mil €, escrituras até 31/dez/2026',
    publisher: 'Observador; Doutor Finanças',
    date: '2 de setembro de 2026',
    urls: [
      'https://observador.pt/2026/09/02/governo-reforca-em-100-milhoes-de-euros-garantia-publica-para-credito-a-habitacao-a-jovens/',
      'https://www.doutorfinancas.pt/creditos/credito-habitacao/metade-dos-jovens-contratou-credito-habitacao-com-garantia-do-estado-em-2026/',
    ],
    used: 'Informação (não necessária com a tua entrada).',
  },
  {
    id: 'imt',
    title: 'Tabelas de IMT 2026 (OE2026, Lei 73-A/2025) — escalões atualizados ~2%',
    publisher: 'Diário da República; Bem Endividado; Doutor Finanças',
    date: '30 de setembro de 2026',
    urls: [
      'https://bemendividado.pt/artigos/imt-2026',
      'https://www.doutorfinancas.pt/impostos/saiba-quanto-vai-pagar-de-imt-em-2026/',
      'https://diariodarepublica.pt/dr/detalhe/lei/73-a-2025-993270096',
    ],
    used: 'Cálculo do IMT para habitação própria permanente.',
  },
  {
    id: 'imt-jovem',
    title: 'IMT Jovem (DL 48-A/2024): isenção de IMT e IS até 330.539 €, parcial até 660.982 €; emolumentos (DL 48-D/2024)',
    publisher: 'Literacia Financeira; PGDL; ECO; Vida Imobiliária',
    date: '24 de setembro de 2026',
    urls: [
      'https://www.literaciafinanceira.pt/artigos/imt-jovem',
      'https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=3814&tabela=leis&so_miolo=',
      'https://eco.sapo.pt/2025/10/09/isencao-de-imt-aos-jovens-alargada-ate-aos-330-539-mil-euros/',
      'https://imojuris.vidaimobiliaria.com/actualidade/noticias/isencao-de-emolumentos-na-primeira-aquisicao-de-ha/',
    ],
    used: 'Isenção jovem de IMT, IS e redução de 450 € nos emolumentos Casa Pronta (proporcional à quota).',
  },
  {
    id: 'imposto-selo',
    title: 'Imposto do Selo: 0,8% na compra, 0,6% sobre o crédito (≥ 5 anos), 4% sobre comissões; juros de crédito habitação isentos',
    publisher: 'CGD Saldo Positivo; preçário BPI',
    date: '8 de setembro de 2025 / 21 de julho de 2026',
    urls: [
      'https://www.cgd.pt/Site/Saldo-Positivo/leis-e-impostos/Pages/o-que-e-o-imposto-do-selo.aspx',
      'https://www.bancobpi.pt/contentservice/getContent?documentName=PP_WCS01_UCM01002181',
    ],
    used: 'Imposto do Selo na compra, no crédito e nas comissões.',
  },
  {
    id: 'casa-pronta',
    title: 'Casa Pronta — 700 € para compra + hipoteca (375 € um só ato); custos de escritura',
    publisher: 'Justiça.gov.pt; CGD Saldo Positivo',
    date: '22 de outubro de 2025 / 3 de julho de 2026',
    urls: [
      'https://justica.gov.pt/Servicos/Balcao-Casa-Pronta',
      'https://www.cgd.pt/Site/Saldo-Positivo/leis-e-impostos/Pages/quanto-custa-uma-escritura-publica.aspx',
    ],
    used: 'Custo de escritura e registos por defeito.',
  },
  {
    id: 'precarios',
    title: 'Comissões de crédito habitação (estudo/dossier ~290 €, avaliação ~230 €, formalização ~195–224 €)',
    publisher: 'Preçários CGD, Millennium bcp, Santander, Novobanco, BPI',
    date: '25 de março a 1 de outubro de 2026',
    urls: [
      'https://www.cgd.pt/Precario/Documents/2.pdf',
      'https://ind.millenniumbcp.pt/pt/Articles/Documents/precario/SECCAO_02.pdf',
      'https://www.santander.pt/pdfs/precario-banco/folheto-comissoes-despesas/clientes-particulares/2-operacoes-credito/2_folhetocomissoesdespesas_cp_opscredito.pdf',
      'https://www.novobanco.pt/content/dam/novobancopublicsites/docs/pdfs/precario/particulares/P_FCD_operacoes_credito.pdf.coredownload.inline.pdf',
      'https://www.santander.pt/salto/despesas-compra-casa',
    ],
    used: 'Avaliação e comissões iniciais (+ IS 4%). Millennium isenta dos 18 aos 35 anos.',
  },
  {
    id: 'comissoes',
    title: 'Proibição da comissão de processamento de prestações no crédito habitação (Lei 57/2020; todos os contratos desde 28/jun/2023)',
    publisher: 'Banco de Portugal — Portal do Cliente Bancário; idealista/news',
    date: '28 de junho de 2023',
    urls: [
      'https://clientebancario.bportugal.pt/pt-pt/noticias/novas-regras-reforcam-direitos-dos-clientes-e-proibem-comissoes-no-credito-habitacao-e-aos',
      'https://www.idealista.pt/news/financas/credito-a-habitacao/2023/06/28/58446-credito-habitacao-comissao-acaba-hoje-para-todos-os-contratos',
    ],
    used: 'Comissão mensal = 0 € por defeito (a conta à ordem pode custar ~4,5–6,9 €/mês se não for isenta).',
  },
  {
    id: 'seguros',
    title: 'Seguro de vida (casal 30 anos, 150 mil €: ~350 €/ano no banco vs ~180 €/ano externo) e multirriscos (~140–290 €/ano)',
    publisher: 'Bem Endividado; DECO Proteste; Oficial Seguros',
    date: '15 de setembro / 12 de maio / 29 de maio de 2026',
    urls: [
      'https://bemendividado.pt/artigos/seguro-vida-credito-habitacao',
      'https://www.deco.proteste.pt/dinheiro/comprar-vender-casa/noticias/seguro-vida-credito-habitacao-escolher-melhor-cobertura',
      'https://www.oficialseguros.pt/quanto-custa-seguro-multirriscos-2026/',
    ],
    used: 'Seguro de vida em % do capital em dívida e multirriscos anual por defeito.',
  },
  {
    id: 'imi',
    title: 'Taxas de IMI 2026: Lisboa 0,3%; Porto 0,324% (0,27% HPP); limites 0,3–0,45%; isenção 3 anos (VPT ≤ 125 mil €)',
    publisher: 'DN; Observador; Doutor Finanças; ComparaJá',
    date: 'dezembro de 2025 a março de 2026',
    urls: [
      'https://www.dn.pt/local-geral/assembleia-municipal-de-lisboa-aprova-devoluo-total-do-irs-e-taxa-mnima-de-imi-para-2026',
      'https://observador.pt/2025/12/09/camara-do-porto-vota-reducao-de-05-no-irs-e-manutencao-do-imi-para-2026/',
      'https://www.doutorfinancas.pt/impostos/imi/31-municipios-descem-imi-a-pagar-em-2026-apenas-6-sobem/',
      'https://www.comparaja.pt/credito-habitacao/artigos/isencao-de-imi',
    ],
    used: 'Taxas de IMI pré-definidas e regra de isenção.',
  },
  {
    id: 'vpt',
    title: 'VPT = Vc × A × Ca × Cl × Cq × Cv (CIMI arts. 38.º–43.º); Vc 2026 = 712,50 €/m² (Portaria 471/2025/1); Cl Covilhã 0,40–1,20 (Portaria 420-A/2015)',
    publisher: 'Público; idealista/news; Informador',
    date: '26 de dezembro de 2025 / 14 de março de 2026',
    urls: [
      'https://www.publico.pt/2025/12/26/economia/noticia/imi-preco-metro-quadrado-fixado-570-euros-2026-2159298',
      'https://www.idealista.pt/news/financas/fiscalidade/2026/03/14/73565-valor-patrimonial-do-imovel-o-que-e-e-como-se-calcula',
      'https://informador.pt/legislacao/diploma/portaria-n-o-420-a-2015/',
    ],
    used: 'VPT por defeito estimado em 65 k€ (intervalo 54–81 k€ para 62 m² + garagem, condomínio fechado com piscina) — confirma na caderneta predial.',
  },
  {
    id: 'mercado-local',
    title: 'Covilhã: avaliação bancária mediana de apartamentos 1.449 €/m² (ago/2026); preço mediano de casas novas vendidas 1.542 €/m²; T1 novos com piscina anunciados a 2.460–3.810 €/m²',
    publisher: 'INE (indicadores 0012248, 0012234); Imovirtual; Doutor Finanças',
    date: 'agosto de 2026 / 3 de outubro de 2026',
    urls: [
      'https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=0012248&lang=PT',
      'https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=0012234&lang=PT',
      'https://www.imovirtual.com/pt/resultados/comprar/apartamento,t1/castelo-branco/covilha/covilha-e-canhoso',
      'https://www.doutorfinancas.pt/wp-content/uploads/2026/04/observatorio-imobiliario-abril-2026.pdf',
    ],
    used: 'Avaliação bancária por defeito (200 k€, estimativa) e comparação do €/m².',
  },
  {
    id: 'imi-covilha',
    title: 'Covilhã: IMI 0,3% em 2026 com IMI Familiar; isenção de IMI de 5 anos para jovens ≤ 35 anos (aprovada em jul/2026, aplicação ainda por concretizar com a AT)',
    publisher: 'Notícias da Covilhã; Rádio Covilhã; Observador; Portal das Finanças (EBF art. 46.º)',
    date: '26 de dezembro de 2025 a 7 de julho de 2026',
    urls: [
      'https://noticiasdacovilha.pt/em-2026-o-imi-vai-manter-valores-minimos-na-covilha/',
      'https://observador.pt/2026/04/22/covilha-isenta-jovens-ate-35-anos-de-imi-durante-cinco-anos-na-compra-da-primeira-casa/',
      'https://radio-covilha.pt/2026/07/noticias/am-covilha-aprova-por-unanimidade-alargamento-da-isencao-de-imi-jovem-para-cinco-anos/',
      'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/bf_rep/Pages/ebf-artigo-46-ordm-.aspx',
    ],
    used: 'Taxa de IMI e anos de isenção.',
  },
  {
    id: 'cedencia',
    title: 'Cedência de posição contratual: IMT (CIMT art. 2.º n.º 3, art. 4.º, regra 18.ª do art. 12.º, art. 17.º n.º 5, art. 22.º n.º 3); Informação vinculativa 13145',
    publisher: 'Portal das Finanças; Gómez-Acebo & Pombo',
    date: '23 de abril de 2018 / setembro de 2025',
    urls: [
      'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/informacoes_vinculativas/patrimonio/cimt/Documents/IMT_IV_13145.pdf',
      'https://ga-p.com/wp-content/uploads/2025/09/Impuesto_transmisiones_patrimoniales_pt.pdf',
      'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cimt/Pages/cimt17.aspx',
    ],
    used: 'IMT sobre o prémio da cessão quando o CPCV tem cláusula de livre cedência (taxa da tabela geral, sem isenção).',
  },
  {
    id: 'condominio',
    title: 'Valores típicos de condomínio (40–80 €/mês com elevador; 80–150 € com garagem)',
    publisher: 'Grupo Urban (indicativo)',
    date: '27 de maio de 2026',
    urls: ['https://grupourban.pt/condominio-barato-o-que-determina-o-valor-da-quota-e-como-escolher-bem/'],
    used: 'Condomínio por defeito (75 €/mês, estimativa para T1 com piscina no interior) — pede o orçamento do condomínio ao promotor.',
  },
  {
    id: 'irs',
    title: 'Sem dedução de juros no IRS para contratos a partir de 2012',
    publisher: 'ComparaJá; DECO Proteste',
    date: '2026',
    urls: [
      'https://www.comparaja.pt/credito-habitacao/artigos/deduzir-despesas-irs',
      'https://www.deco.proteste.pt/dinheiro/comprar-vender-casa/noticias/habitacao-5-propostas-para-orcamento-estado-2026',
    ],
    used: 'Nenhum benefício de IRS considerado.',
  },
];
