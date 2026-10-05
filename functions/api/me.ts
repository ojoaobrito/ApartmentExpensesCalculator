/**
 * Cloudflare Pages Function — /api/me
 * Diz ao browser quem está a usar a app (email do Cloudflare Access) e se é o
 * dono, para escolher os valores iniciais e mostrar (ou não) a ligação à app
 * de Finanças.
 */
import { verifyAccess, type AccessEnv } from '../lib/access';
import { isOwner, type OwnerEnv } from '../lib/owner';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export const onRequestGet = async ({ request, env }: { request: Request; env: AccessEnv & OwnerEnv }): Promise<Response> => {
  const auth = await verifyAccess(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  return json({ email: auth.email, owner: isOwner(auth.email, env) });
};
