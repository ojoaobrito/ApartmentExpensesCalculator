/**
 * Cloudflare Pages Function — /api/finance
 * Vai buscar o resumo da app de Finanças (FinanceHub) no servidor, para a chave
 * de sincronização e o token de serviço do Access nunca chegarem ao browser.
 *
 * Exige Cloudflare Access também no simulador (ACCESS_TEAM_DOMAIN + ACCESS_AUD):
 * sem isso responde 503 e nenhum valor pessoal sai.
 *
 * Só responde a emails em OWNER_EMAILS (os restantes recebem 403 not_owner).
 *
 * Segredos: OWNER_EMAILS, FINANCE_URL, FINANCE_SYNC_KEY, FINANCE_ACCESS_CLIENT_ID, FINANCE_ACCESS_CLIENT_SECRET
 */
import { verifyAccess, type AccessEnv } from '../lib/access';
import { isOwner, type OwnerEnv } from '../lib/owner';

interface Env extends AccessEnv, OwnerEnv {
  FINANCE_URL?: string;
  FINANCE_SYNC_KEY?: string;
  FINANCE_ACCESS_CLIENT_ID?: string;
  FINANCE_ACCESS_CLIENT_SECRET?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const auth = await verifyAccess(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  // Os valores pessoais só vão para o dono (OWNER_EMAILS); outras pessoas usam valores de exemplo
  if (!isOwner(auth.email, env)) return json({ error: 'not_owner' }, 403);
  if (!env.FINANCE_URL || !env.FINANCE_SYNC_KEY) return json({ error: 'finance_not_configured' }, 503);

  const headers: Record<string, string> = { 'x-sync-key': env.FINANCE_SYNC_KEY };
  if (env.FINANCE_ACCESS_CLIENT_ID && env.FINANCE_ACCESS_CLIENT_SECRET) {
    headers['CF-Access-Client-Id'] = env.FINANCE_ACCESS_CLIENT_ID;
    headers['CF-Access-Client-Secret'] = env.FINANCE_ACCESS_CLIENT_SECRET;
  }
  try {
    const res = await fetch(`${env.FINANCE_URL.replace(/\/$/, '')}/api/sync`, { headers });
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
    if (!res.ok || !isJson) return json({ error: 'upstream', status: res.status }, 502);
    return json(await res.json());
  } catch (e) {
    return json({ error: 'upstream', detail: (e as Error).message }, 502);
  }
};
