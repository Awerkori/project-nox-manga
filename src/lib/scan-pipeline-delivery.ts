export interface PipelineDeliveryFile {
  id: string;
  production_chapter_id: string;
  stage_id: string;
  delivery_key?: string | null;
  file_name: string;
  version: number;
  is_current: boolean;
}

const filenameCollator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/** Current files for a stage, naturally sorted for human delivery order. */
export function currentDeliveryFiles<T extends PipelineDeliveryFile>(
  files: T[],
  productionChapterId: string,
  stageId: string
): T[] {
  return files
    .filter((file) => file.production_chapter_id === productionChapterId && file.stage_id === stageId && file.is_current)
    .sort((a, b) => filenameCollator.compare(a.file_name, b.file_name));
}

/** Versions are isolated by delivery key, never by an entire pipeline stage. */
export function nextDeliveryVersion<T extends Pick<PipelineDeliveryFile, 'delivery_key' | 'version'>>(
  files: T[],
  deliveryKey: string
): number {
  return files
    .filter((file) => file.delivery_key === deliveryKey)
    .reduce((highest, file) => Math.max(highest, file.version), 0) + 1;
}

/** Replacing one file only retires the records in that file's lineage. */
export function retireDeliveryVersion<T extends PipelineDeliveryFile>(files: T[], deliveryKey: string): T[] {
  return files.map((file) => file.delivery_key === deliveryKey && file.is_current ? { ...file, is_current: false } : file);
}
