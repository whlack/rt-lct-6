export function catalogName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}
export function catalogKey(value: string): string {
  return catalogName(value).toLowerCase();
}
