/**
 * Comprehensive HTML Entity Decoder
 * Decodes named entities, decimal numeric entities (&#8211;), and hex numeric entities (&#x2013;).
 */
export function decodeHtmlEntities(str?: string | null): string {
  if (!str) return '';

  return str
    // Common typographic entities
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8230;/g, '…')
    .replace(/&hellip;/g, '…')
    .replace(/\[&hellip;\]/g, '…')
    // Common HTML characters
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    // Generic numeric decimal entities
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return !isNaN(code) && code > 0 && code < 65536 ? String.fromCharCode(code) : '';
    })
    // Generic numeric hex entities
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return !isNaN(code) && code > 0 && code < 65536 ? String.fromCharCode(code) : '';
    })
    .trim();
}
