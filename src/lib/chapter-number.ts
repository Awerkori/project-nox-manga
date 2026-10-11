/** Formats a canonical chapter value for display without mutating storage. */
export function formatChapterNumber(value: unknown): string {
  if (value === null || value === undefined) return '';

  const raw = String(value).trim();
  if (!raw) return '';

  // Work on the lexical representation: Number() can lose meaningful decimal
  // precision or alter a large chapter label.
  const match = raw.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match) return raw;

  const [, sign, integer, fraction] = match;
  if (!fraction) return `${sign}${integer}`;
  const meaningfulFraction = fraction.replace(/0+$/, '');
  return meaningfulFraction ? `${sign}${integer}.${meaningfulFraction}` : `${sign}${integer}`;
}
