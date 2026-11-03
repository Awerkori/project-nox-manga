import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Publicado Redesign & Zero-Notification Rule', () => {
  it('strictly enforces no notification badge or counter on Publicado in ScanSidebar.svelte', () => {
    const source = readFileSync(resolve('src/routes/scan/components/ScanSidebar.svelte'), 'utf8');
    // Ensure counts['publicado'] is set to 0
    expect(source).toContain("counts['publicado'] = 0;");
    // Ensure template explicitly isolates publicado from receiving any badge
    expect(source).toContain("{:else if matchesStageSlug(st.slug, 'publicado')}");
    expect(source).toContain("<!-- Publicado is historic deliveries - strictly no notification badge -->");
  });

  it('strictly enforces no notification badge on Publicado in PreAprovadoStageView.svelte', () => {
    const source = readFileSync(resolve('src/routes/scan/components/PreAprovadoStageView.svelte'), 'utf8');
    expect(source).toContain("counts['publicado'] = 0;");
    expect(source).toContain("{#if count > 0 && !matchesStageSlug(st.slug, 'publicado')}");
  });

  it('delegates Publicado stage to PublicadoStageView without counter badge in PipelineStageView.svelte', () => {
    const source = readFileSync(resolve('src/routes/scan/components/PipelineStageView.svelte'), 'utf8');
    expect(source).toContain("import PublicadoStageView from './PublicadoStageView.svelte';");
    expect(source).toContain("{:else if matchesStageSlug(activeCanonical.slug, 'publicado')}");
    expect(source).toContain("<PublicadoStageView");
    expect(source).toContain("counts['publicado'].total = 0;");
    expect(source).toContain("counts['publicado'].available = 0;");
    expect(source).toContain("<!-- Publicado is purely historic deliveries - never show notification badge -->");
  });

  it('implements PublicadoStageView with search, filters, direct reader links and no task claiming actions', () => {
    const filePath = resolve('src/routes/scan/components/PublicadoStageView.svelte');
    expect(existsSync(filePath)).toBe(true);
    const source = readFileSync(filePath, 'utf8');

    // 1. Header & Discreet Statistic
    expect(source).toContain('<h1 class="stage-main-title">Publicado</h1>');
    expect(source).toContain('discrete-stat-pill');
    expect(source).toContain('Histórico de capítulos lançados pela scan.');

    // 2. Stage Navigation Strip without Publicado badge
    expect(source).toContain('class="stages-nav-strip"');
    expect(source).toContain('!matchesStageSlug(st.slug, \'publicado\')');

    // 3. Search, Work Filter, Sort and Pagination
    expect(source).toContain('compact-search-input');
    expect(source).toContain('compact-work-select');
    expect(source).toContain('compact-sort-select');
    expect(source).toContain('pagination-bar');

    // 4. Primary & Secondary Actions
    expect(source).toContain('class="btn-read-chapter"');
    expect(source).toContain('href="/ler/{item.targetChapterId || item.id}"');
    expect(source).toContain('class="btn-toggle-details"');

    // 5. Strictly no operational task-claiming buttons
    expect(source).not.toContain('Pegar trabalho');
    expect(source).not.toContain('Assumir');
    expect(source).not.toContain('Iniciar edição');
    expect(source).not.toContain('Enviar arquivo');

    // 6. Expanded details sections
    expect(source).toContain('card-expanded-panel');
    expect(source).toContain('Origem Editorial');
    expect(source).toContain('Link no Catálogo');

    // 7. Preview Visual Homologation Fixtures for isolated testing
    expect(source).toContain('homologation-toolbar');
    expect(source).toContain('1 Capítulo');
    expect(source).toContain('5 Capítulos');
    expect(source).toContain('Dezenas (24)');
    expect(source).toContain('Vazio');
  });
});
