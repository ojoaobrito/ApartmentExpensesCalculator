import type { ReactNode } from 'react';

/** Ícones preenchidos das secções e da pesquisa (16×16, herdam a cor do texto) */

const Svg = ({ children, size = 16 }: { children: ReactNode; size?: number }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden>
    {children}
  </svg>
);

export const IconHome = () => (
  <Svg>
    <path d="M7.36 1.73a1 1 0 0 1 1.28 0l5.5 4.6c.23.19.36.47.36.77V13.5A1.5 1.5 0 0 1 13 15h-2.5a.5.5 0 0 1-.5-.5V11a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v3.5a.5.5 0 0 1-.5.5H3a1.5 1.5 0 0 1-1.5-1.5V7.1c0-.3.13-.58.36-.77z" />
  </Svg>
);

export const IconWallet = () => (
  <Svg>
    <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h7A1.5 1.5 0 0 1 13 3.5V4h.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A2.5 2.5 0 0 1 2 11.5zM4.5 3.5a1 1 0 0 0 0 2h7v-2zM11.5 8a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5" />
  </Svg>
);

export const IconReceipt = () => (
  <Svg>
    <path d="M3.5 1h9A1.5 1.5 0 0 1 14 2.5v12a.5.5 0 0 1-.8.4L11.5 13.6l-1.7 1.3a.5.5 0 0 1-.6 0L8 14l-1.2.9a.5.5 0 0 1-.6 0l-1.7-1.3-1.7 1.3a.5.5 0 0 1-.8-.4v-12A1.5 1.5 0 0 1 3.5 1M5 4.75a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5zm0 3a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5zm0 3a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5z" />
  </Svg>
);

export const IconBank = () => (
  <Svg>
    <path d="M7.55 1.1a1 1 0 0 1 .9 0l6 3A.75.75 0 0 1 14.1 5.5H1.9a.75.75 0 0 1-.35-1.4zM2.5 7h2v5h-2zm4.5 0h2v5H7zm4.5 0h2v5h-2zM1.75 13h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5" />
  </Svg>
);

export const IconTrend = () => (
  <Svg>
    <path d="M2.5 1.75a.75.75 0 0 1 .75.75v10.25H13.5a.75.75 0 0 1 0 1.5H2.5a.75.75 0 0 1-.75-.75v-11a.75.75 0 0 1 .75-.75" />
    <path d="M10.25 3.5h3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-1.2L9.53 9.03a.75.75 0 0 1-1.06 0L7 7.56l-1.97 1.97a.75.75 0 0 1-1.06-1.06l2.5-2.5a.75.75 0 0 1 1.06 0L9 7.44 11.44 5h-1.19a.75.75 0 0 1 0-1.5" />
  </Svg>
);

export const IconArrowDownCircle = () => (
  <Svg>
    <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1m0 3.25a.75.75 0 0 0-.75.75v4.19L5.78 7.72a.75.75 0 0 0-1.06 1.06l2.75 2.75a.75.75 0 0 0 1.06 0l2.75-2.75a.75.75 0 1 0-1.06-1.06L8.75 9.19V5A.75.75 0 0 0 8 4.25" />
  </Svg>
);

export const IconUmbrella = () => (
  <Svg>
    <path d="M8 1a.75.75 0 0 1 .75.75v.3A6.75 6.75 0 0 1 14.75 8.5a.75.75 0 0 1-.75.75H8.75v3.5a2 2 0 0 1-4 0 .75.75 0 0 1 1.5 0 .5.5 0 0 0 1 0v-3.5H2a.75.75 0 0 1-.75-.75A6.75 6.75 0 0 1 7.25 2.05v-.3A.75.75 0 0 1 8 1" />
  </Svg>
);

export const IconPie = () => (
  <Svg>
    <path d="M7.25 2.04A6.5 6.5 0 1 0 13.96 8.75H8a.75.75 0 0 1-.75-.75z" />
    <path d="M8.75 1.04v5.71h5.71A6.5 6.5 0 0 0 8.75 1.04" />
  </Svg>
);

export const IconSearch = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
    <circle cx="7" cy="7" r="4.75" />
    <path d="m10.5 10.5 3.5 3.5" />
  </svg>
);

export const IconCart = () => (
  <Svg>
    <path d="M1 1.75A.75.75 0 0 1 1.75 1h1.1a1.25 1.25 0 0 1 1.22.98L4.24 3H13.6a1 1 0 0 1 .97 1.24l-1.1 4.5a1.5 1.5 0 0 1-1.46 1.14H5.6l.25 1.12h6.4a.75.75 0 0 1 0 1.5H5.65a1.25 1.25 0 0 1-1.22-.98L2.66 2.5h-.91A.75.75 0 0 1 1 1.75M6 13.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m6 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
  </Svg>
);
