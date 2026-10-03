import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { currentDeliveryFiles, nextDeliveryVersion, retireDeliveryVersion } from '../src/lib/scan-pipeline-delivery';

const base = { production_chapter_id: 'chapter-1', stage_id: 'translation', is_current: true };

describe('scan pipeline multi-file delivery', () => {
  it('keeps sibling files current when only one delivery lineage is replaced', () => {
    const files = [
      { ...base, id: 'part-1-v1', delivery_key: 'part-1', file_name: 'Parte 1.txt', version: 1 },
      { ...base, id: 'part-2-v1', delivery_key: 'part-2', file_name: 'Parte 2.txt', version: 1 },
      { ...base, id: 'notes-v1', delivery_key: 'notes', file_name: 'Notas.txt', version: 1 }
    ];
    const retired = retireDeliveryVersion(files, 'part-1');
    const replaced = [...retired, { ...base, id: 'part-1-v2', delivery_key: 'part-1', file_name: 'Parte 1.txt', version: nextDeliveryVersion(files, 'part-1') }];

    expect(currentDeliveryFiles(replaced, 'chapter-1', 'translation').map((file) => `${file.file_name}:v${file.version}`)).toEqual([
      'Notas.txt:v1', 'Parte 1.txt:v2', 'Parte 2.txt:v1'
    ]);
  });

  it('uses natural ordering, so Parte 2 precedes Parte 10', () => {
    const files = [
      { ...base, id: 'ten', delivery_key: 'ten', file_name: 'Parte 10.txt', version: 1 },
      { ...base, id: 'two', delivery_key: 'two', file_name: 'Parte 2.txt', version: 1 }
    ];
    expect(currentDeliveryFiles(files, 'chapter-1', 'translation').map((file) => file.file_name)).toEqual(['Parte 2.txt', 'Parte 10.txt']);
  });

  it('keeps version counters independent across a single stage delivery', () => {
    const files = [
      { ...base, id: 'one-v2', delivery_key: 'part-1', file_name: 'Parte 1.txt', version: 2 },
      { ...base, id: 'two-v1', delivery_key: 'part-2', file_name: 'Parte 2.txt', version: 1 }
    ];
    expect(nextDeliveryVersion(files, 'part-1')).toBe(3);
    expect(nextDeliveryVersion(files, 'part-2')).toBe(2);
  });

  it('keeps completion guarded while failed or in-progress upload intents exist', () => {
    const migration = readFileSync(resolve('yugabyte/migrations/20261002200000_scan_pipeline_multifile_deliverables.sql'), 'utf8');
    expect(migration).toContain("status IN ('UPLOADING', 'FAILED')");
    expect(migration).toContain('delivery_key');
    expect(migration).toContain("jsonb_agg(jsonb_build_object(");
  });

  it('finalizes replacements atomically and rejects a stale competing writer', () => {
    const migration = readFileSync(resolve('yugabyte/migrations/20261002200000_scan_pipeline_multifile_deliverables.sql'), 'utf8');
    expect(migration).toContain('finalize_scan_pipeline_file_ysql');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain("FOR UPDATE;");
    expect(migration).toContain("RAISE EXCEPTION 'REPLACEMENT_NOT_CURRENT'");
    expect(migration).toContain("RAISE EXCEPTION 'STAGE_NO_LONGER_ACCEPTS_UPLOAD'");
    expect(migration).toContain("SET status = 'SUCCEEDED', file_id = v_file.id");
    expect(migration).toContain('withdraw_scan_pipeline_file_ysql');
    expect(migration).toContain('Um insumo usado nesta entrega foi removido ou atualizado.');
  });

  it('keeps stage claiming atomic for two simultaneous staff members', () => {
    const latestClaim = readFileSync(resolve('supabase/migrations/20260912160000_definitive_scan_roles_functions_and_pipeline.sql'), 'utf8');
    expect(latestClaim).toContain('claim_scan_chapter_stage');
    expect(latestClaim).toContain('WHERE id = p_chapter_stage_id');
    expect(latestClaim).toContain("AND status IN ('AVAILABLE', 'REWORK')");
    expect(latestClaim).toContain("AND (assigned_to IS NULL OR assigned_to = v_caller)");
  });

  it('does not retain the old whole-stage overwrite query', () => {
    const endpoint = readFileSync(resolve('src/routes/api/scan/production/upload/+server.ts'), 'utf8');
    const filesEndpoint = readFileSync(resolve('src/routes/api/scan/production/files/[id]/+server.ts'), 'utf8');
    expect(endpoint).toContain('finalize_scan_pipeline_file_ysql');
    expect(endpoint).not.toContain(".update({ is_current: false })\n      .eq('production_chapter_id', productionChapterId)");
    expect(endpoint).toContain("Assuma esta etapa antes de enviar ou alterar arquivos.");
    expect(filesEndpoint).toContain('withdraw_scan_pipeline_file_ysql');
  });
});
