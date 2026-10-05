/**
 * Dono da app: emails (segredo OWNER_EMAILS, separados por vírgulas) que têm
 * acesso aos dados pessoais da app de Finanças e aos cenários "principais".
 * Qualquer outra pessoa autorizada pelo Access usa o simulador com valores de
 * exemplo e cenários só seus.
 */
export interface OwnerEnv {
  OWNER_EMAILS?: string;
  DEV_BYPASS_AUTH?: string;
}

export function isOwner(email: string, env: OwnerEnv): boolean {
  if (env.DEV_BYPASS_AUTH === '1' && email === 'dev@localhost') return true;
  const list = (env.OWNER_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
