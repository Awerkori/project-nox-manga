type JsonRecord = Record<string, unknown>;

export type SourceRecord = {
  id: string;
  name: string;
  base_url: string;
  enabled: boolean;
  status: string;
};

export type WorkMappingRecord = {
  id: string;
  source: string;
  source_work_id: string;
  source_slug: string;
  source_title: string;
  sync_status: string;
  last_synced_at: string | null;
  is_primary: boolean | null;
  metadata: unknown;
  updated_at: string;
};

export type ChapterMappingRecord = {
  id: string;
  chapter_id: string | null;
  work_id: string | null;
  work_mapping_id: string;
  source: string;
  source_chapter_id: string;
  status: string;
  is_page_provider: boolean;
  created_at: string;
  updated_at: string;
};

type FieldProvenance = {
  source?: unknown;
  updated_at?: unknown;
};

type WorkFieldProvenance = {
  field: string;
  label: string;
  source: ReturnType<typeof sourceDetails>;
  updatedAt: string | null;
};

const fieldLabels: Record<string, string> = {
  title: 'Título',
  synopsis: 'Sinopse',
  description: 'Descrição',
  author: 'Autor',
  artist: 'Artista',
  cover: 'Capa',
  aliases: 'Títulos alternativos',
  kind: 'Formato',
  status: 'Status',
  year: 'Ano',
  age_rating: 'Classificação etária',
  content_rating: 'Classificação de conteúdo'
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function urlInMetadata(metadata: unknown): string | null {
  const record = asRecord(metadata);
  if (!record) return null;

  for (const key of ['sourceUrl', 'source_url', 'workUrl', 'work_url', 'chapterUrl', 'chapter_url', 'url', 'link']) {
    const url = safeUrl(record[key]);
    if (url) return url;
  }
  return null;
}

function sourceLabel(sourceId: string, sourcesById: Map<string, SourceRecord>) {
  const source = sourcesById.get(sourceId);
  if (source) return source.name || source.id;
  return sourceId === 'manual' ? 'Manual' : sourceId;
}

function sourceDetails(sourceId: string, sourcesById: Map<string, SourceRecord>) {
  const source = sourcesById.get(sourceId);
  return {
    id: sourceId,
    name: sourceLabel(sourceId, sourcesById),
    enabled: source?.enabled ?? null,
    status: source?.status ?? null,
    baseUrl: safeUrl(source?.base_url) || null
  };
}

function statusRank(status: string): number {
  if (status === 'COMPLETED') return 3;
  if (status === 'STAGED') return 2;
  if (status === 'IMPORTING') return 1;
  return 0;
}

function compareChapterMapping(a: ChapterMappingRecord, b: ChapterMappingRecord): number {
  const providerDifference = Number(b.is_page_provider) - Number(a.is_page_provider);
  if (providerDifference) return providerDifference;

  const statusDifference = statusRank(b.status) - statusRank(a.status);
  if (statusDifference) return statusDifference;

  return Date.parse(b.updated_at || '') - Date.parse(a.updated_at || '');
}

export function buildWorkProvenance(
  metadataProvenance: unknown,
  mappings: WorkMappingRecord[],
  sources: SourceRecord[]
) {
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const orderedMappings = [...mappings].sort((a, b) => {
    const primaryDifference = Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary));
    if (primaryDifference) return primaryDifference;
    return Date.parse(b.last_synced_at || b.updated_at || '') - Date.parse(a.last_synced_at || a.updated_at || '');
  });
  const provenance = asRecord(metadataProvenance) || {};

  const fields = Object.entries(provenance)
    .map<WorkFieldProvenance | null>(([field, raw]) => {
      const details = asRecord(raw) as FieldProvenance | null;
      const sourceId = typeof details?.source === 'string' ? details.source : null;
      if (!sourceId) return null;
      return {
        field,
        label: fieldLabels[field] || field,
        source: sourceDetails(sourceId, sourcesById),
        updatedAt: typeof details?.updated_at === 'string' ? details.updated_at : null
      };
    })
    .filter((field): field is WorkFieldProvenance => field !== null);

  return {
    primaryMapping: orderedMappings[0]
      ? {
          ...sourceDetails(orderedMappings[0].source, sourcesById),
          sourceWorkId: orderedMappings[0].source_work_id,
          sourceSlug: orderedMappings[0].source_slug,
          sourceTitle: orderedMappings[0].source_title,
          sourceUrl: urlInMetadata(orderedMappings[0].metadata),
          lastSyncedAt: orderedMappings[0].last_synced_at,
          syncStatus: orderedMappings[0].sync_status,
          isPrimary: Boolean(orderedMappings[0].is_primary)
        }
      : null,
    mappings: orderedMappings.map((mapping) => ({
      ...sourceDetails(mapping.source, sourcesById),
      sourceWorkId: mapping.source_work_id,
      sourceSlug: mapping.source_slug,
      sourceTitle: mapping.source_title,
      sourceUrl: urlInMetadata(mapping.metadata),
      lastSyncedAt: mapping.last_synced_at,
      syncStatus: mapping.sync_status,
      isPrimary: Boolean(mapping.is_primary)
    })),
    fields
  };
}

export function buildChapterProvenance(
  chapterIds: string[],
  mappings: ChapterMappingRecord[],
  sources: SourceRecord[]
) {
  const chapterIdsSet = new Set(chapterIds);
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const mappingsByChapter = new Map<string, ChapterMappingRecord[]>();

  for (const mapping of mappings) {
    if (!mapping.chapter_id || !chapterIdsSet.has(mapping.chapter_id)) continue;
    const chapterMappings = mappingsByChapter.get(mapping.chapter_id) || [];
    chapterMappings.push(mapping);
    mappingsByChapter.set(mapping.chapter_id, chapterMappings);
  }

  return Object.fromEntries(
    [...mappingsByChapter.entries()].map(([chapterId, chapterMappings]) => {
      const ordered = [...chapterMappings].sort(compareChapterMapping);
      const primary = ordered[0];
      const alternatives = ordered.slice(1).map((mapping) => ({
        ...sourceDetails(mapping.source, sourcesById),
        sourceChapterId: mapping.source_chapter_id,
        sourceUrl: safeUrl(mapping.source_chapter_id),
        mappingId: mapping.id,
        status: mapping.status,
        pageProvider: mapping.is_page_provider
      }));

      return [
        chapterId,
        {
          ...sourceDetails(primary.source, sourcesById),
          sourceChapterId: primary.source_chapter_id,
          sourceUrl: safeUrl(primary.source_chapter_id),
          mappingId: primary.id,
          workMappingId: primary.work_mapping_id,
          canonicalChapterId: primary.chapter_id,
          workId: primary.work_id,
          status: primary.status,
          pageProvider: primary.is_page_provider,
          importedAt: primary.created_at,
          updatedAt: primary.updated_at,
          alternatives
        }
      ];
    })
  );
}
