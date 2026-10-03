import { useCallback, useEffect, useState } from 'react';
import type { Inputs } from './state';

/**
 * Cenários gravados. Quando a app corre no Cloudflare Pages, grava na API
 * (/api/scenarios → Workers KV) e fica disponível em qualquer dispositivo.
 * Sem API (p.ex. `yarn dev`), grava só neste browser. Em ambos os casos há
 * uma cópia local, e é possível exportar/importar um ficheiro JSON.
 */

export interface SavedScenario {
  id: string;
  name: string;
  savedAt: string;
  inputs: Inputs;
}

export type StorageMode = 'loading' | 'cloud' | 'local' | 'locked';

const LOCAL_KEY = 'casa-sim:scenarios:v1';
const TOKEN_KEY = 'casa-sim:token';
const API = '/api/scenarios';
/**
 * Código de acesso embutido (projeto pessoal): vai no JavaScript público, por isso
 * quem tiver o link consegue ler e editar os cenários. Tem de coincidir com o
 * segredo APP_TOKEN do Cloudflare Pages.
 */
const BUILT_IN_TOKEN = 'yc69l-5bpua-ssho8-14le4';

function readLocal(): SavedScenario[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as SavedScenario[];
  } catch {
    return [];
  }
}
function writeLocal(list: SavedScenario[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch {
    /* armazenamento indisponível */
  }
}
function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || BUILT_IN_TOKEN;
  } catch {
    return BUILT_IN_TOKEN;
  }
}

async function call(method: string, body?: unknown, id?: string): Promise<Response> {
  const token = getToken();
  return fetch(id ? `${API}?id=${encodeURIComponent(id)}` : API, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const isJson = (r: Response) => (r.headers.get('content-type') ?? '').includes('application/json');

export function useScenarios() {
  const [list, setList] = useState<SavedScenario[]>(readLocal);
  const [mode, setMode] = useState<StorageMode>('loading');
  const [error, setError] = useState('');

  const connect = useCallback(async () => {
    try {
      const res = await call('GET');
      if (res.status === 401) return setMode('locked');
      // Sem API, o servidor de desenvolvimento devolve o index.html
      if (!res.ok || !isJson(res)) return setMode('local');
      const remote = (await res.json()) as SavedScenario[];
      // Primeira ligação: envia para a nuvem os cenários que só existiam neste browser
      const missing = readLocal().filter((l) => !remote.some((r) => r.id === l.id));
      for (const s of missing) await call('PUT', s);
      const merged = [...remote, ...missing].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
      setList(merged);
      writeLocal(merged);
      setMode('cloud');
      setError('');
    } catch {
      setMode('local');
    }
  }, []);

  // Sincroniza com a API (sistema externo); o setState só acontece depois do fetch
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void connect();
  }, [connect]);

  const persist = async (next: SavedScenario[], op: () => Promise<Response>) => {
    setList(next);
    writeLocal(next);
    if (mode !== 'cloud') return;
    try {
      const res = await op();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setError('');
    } catch (e) {
      setError(`Não foi possível gravar na nuvem (${(e as Error).message}). Ficou guardado neste browser.`);
    }
  };

  return {
    list,
    mode,
    error,
    add: (name: string, inputs: Inputs) => {
      const s: SavedScenario = { id: crypto.randomUUID(), name, savedAt: new Date().toISOString(), inputs };
      return persist([...list, s], () => call('PUT', s));
    },
    overwrite: (id: string, inputs: Inputs) => {
      const old = list.find((s) => s.id === id);
      if (!old) return;
      const s = { ...old, inputs, savedAt: new Date().toISOString() };
      return persist(
        list.map((x) => (x.id === id ? s : x)),
        () => call('PUT', s),
      );
    },
    rename: (id: string, name: string) => {
      const old = list.find((s) => s.id === id);
      if (!old) return;
      const s = { ...old, name };
      return persist(
        list.map((x) => (x.id === id ? s : x)),
        () => call('PUT', s),
      );
    },
    remove: (id: string) =>
      persist(
        list.filter((s) => s.id !== id),
        () => call('DELETE', undefined, id),
      ),
    importMany: async (items: SavedScenario[]) => {
      const fresh = items.filter((it) => !list.some((l) => l.id === it.id));
      const next = [...list, ...fresh];
      setList(next);
      writeLocal(next);
      if (mode === 'cloud') for (const s of fresh) await call('PUT', s);
      return fresh.length;
    },
    unlock: async (token: string) => {
      try {
        localStorage.setItem(TOKEN_KEY, token);
      } catch {
        /* ignore */
      }
      await connect();
    },
  };
}

export function exportScenarios(list: SavedScenario[]) {
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cenarios-casa-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function parseScenarioFile(file: File): Promise<SavedScenario[]> {
  const data = JSON.parse(await file.text()) as unknown;
  if (!Array.isArray(data)) throw new Error('O ficheiro não contém uma lista de cenários.');
  return data.filter(
    (d): d is SavedScenario =>
      typeof d === 'object' && d !== null && typeof d.id === 'string' && typeof d.name === 'string' && typeof d.inputs === 'object',
  );
}
