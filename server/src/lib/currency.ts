export function normalizeCurrency(
  value: string | null | undefined,
  fallback = 'PKR'
): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

export function resolveCurrency(
  provided: string | undefined,
  accountCurrency?: string,
  userDefault = 'PKR'
): string {
  if (provided?.trim()) return provided.trim();
  if (accountCurrency?.trim()) return accountCurrency.trim();
  return userDefault;
}

export function currencyMatches(
  stored: string | null | undefined,
  target: string,
  entityDefault: string
): boolean {
  return normalizeCurrency(stored, entityDefault) === normalizeCurrency(target, entityDefault);
}
