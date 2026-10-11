/**
 * Public chapter identity helpers.
 *
 * `number` is retained only as a legacy/display compatibility field.  It is
 * not a key: numeric databases intentionally consider 12.1 and 12.10 equal.
 * The importer stores the source-independent identity in
 * `canonical_chapter_key` and an explicit, lexicographically sortable
 * `chapter_order_key`.
 */
export type ChapterIdentityFields = {
  number?: number | string | null;
  display_number?: string | null;
  canonical_chapter_key?: string | null;
  chapter_order_key?: string | null;
  chapter_kind?: string | null;
  edition?: string | null;
  language?: string | null;
  title?: string | null;
};

export type ChapterIdentityInput = {
  displayNumber: string | number | null | undefined;
  title?: string | null;
  kind?: string | null;
  edition?: string | null;
  language?: string | null;
};

const clean = (value: string | number | null | undefined): string =>
  String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();

const folded = (value: string | number | null | undefined): string =>
  clean(value).toLocaleLowerCase('und');

export function chapterKindForInput(input: ChapterIdentityInput): string {
  const explicit = folded(input.kind);
  if (explicit) return explicit;
  return /(?:extra|especial|special|omake|prologue|pr[oó]logo|side)/i.test(folded(input.title))
    ? 'special'
    : 'chapter';
}

/**
 * This is the same opaque contract used by Importer Lite.  It is deliberately
 * textual: never derive it from a JavaScript number or a database numeric.
 */
export function canonicalChapterKey(input: ChapterIdentityInput): string {
  const display = folded(input.displayNumber);
  const title = folded(input.title);
  const kind = chapterKindForInput(input);
  const language = folded(input.language || 'und');
  const edition = folded(input.edition || 'default');
  if (!display && !title) throw new Error('O capítulo precisa de um número ou título');
  const identityTitle = !display || kind !== 'chapter' ? (title || '-') : '-';
  return [language, edition, kind, display || 'unnumbered', identityTitle]
    .map(encodeURIComponent)
    .join('|');
}

export function chapterOrderKey(input: ChapterIdentityInput): string {
  const raw = folded(input.displayNumber);
  const match = raw.match(/^(\d+)(?:\.(\d+))?(.*)$/);
  if (!match) return `z|${encodeURIComponent(raw)}|${encodeURIComponent(folded(input.title))}`;
  const whole = match[1].padStart(12, '0');
  const fraction = (match[2] || '').padEnd(12, '0').slice(0, 12);
  return `n|${whole}|${fraction}|${encodeURIComponent(match[2] || '')}|${encodeURIComponent(match[3].trim())}|${encodeURIComponent(folded(input.title))}`;
}

export function chapterDisplayNumber(chapter: ChapterIdentityFields): string {
  const explicit = String(chapter.display_number ?? '').trim();
  if (explicit) return explicit;
  if (chapter.number !== null && chapter.number !== undefined && String(chapter.number).trim()) {
    return String(chapter.number);
  }
  return 'Especial';
}

/** Stable sort for already-materialised Reader rows. Never parse a label as a float. */
export function compareChapterIdentity(a: ChapterIdentityFields, b: ChapterIdentityFields): number {
  const orderA = String(a.chapter_order_key ?? '');
  const orderB = String(b.chapter_order_key ?? '');
  if (orderA !== orderB) return orderA.localeCompare(orderB);

  const canonicalA = String(a.canonical_chapter_key ?? '');
  const canonicalB = String(b.canonical_chapter_key ?? '');
  if (canonicalA !== canonicalB) return canonicalA.localeCompare(canonicalB);

  return chapterDisplayNumber(a).localeCompare(chapterDisplayNumber(b), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

export function chapterIdentityLabel(chapter: ChapterIdentityFields): string {
  const base = chapterDisplayNumber(chapter);
  const qualifiers = [chapter.edition, chapter.language]
    .map((value) => String(value ?? '').trim())
    .filter((value) => value && value !== 'default' && value !== 'und');
  return qualifiers.length ? `${base} · ${qualifiers.join(' · ')}` : base;
}
