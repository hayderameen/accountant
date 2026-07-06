export function resolveCurrency(
  provided: string | undefined,
  accountCurrency?: string,
  userDefault = "PKR",
): string {
  return provided ?? accountCurrency ?? userDefault;
}
