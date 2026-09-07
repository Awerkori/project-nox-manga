export const MEMBER_PAGE_SIZE = 20;

export function pageNumber(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(10000, Math.max(1, Math.floor(parsed))) : 1;
}

export function pageLink(path: string, page: number, filters: Record<string, string> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  if (page > 1) query.set('pagina', String(page));
  return `${path}${query.size ? `?${query}` : ''}`;
}
