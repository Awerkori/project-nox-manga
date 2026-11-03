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

    // 4. Primary & Secondary Actions pointing to official domain projectnox.org
    expect(source).toContain('class="btn-read-chapter"');
    expect(source).toContain("OFFICIAL_SITE_ORIGIN = 'https://projectnox.org';");
    expect(source).toContain('getOfficialReaderUrl(item)');
    expect(source).toContain('class="btn-toggle-details"');
    expect(source).toContain('is-demo-disabled');

    // 5. Strictly no operational task-claiming buttons
    expect(source).not.toContain('Pegar trabalho');
    expect(source).not.toContain('Assumir');
    expect(source).not.toContain('Iniciar edição');
    expect(source).not.toContain('Enviar arquivo');

    // 6. Two-tier expanded details with collapsible technical sub-accordion & 1-click UUID copy
    expect(source).toContain('card-expanded-panel');
    expect(source).toContain('Informações Principais');
    expect(source).toContain('Informações técnicas');
    expect(source).toContain('btn-copy-uuid');
    expect(source).toContain('friendly-catalog-link');

    // 7. Preview Visual Homologation Dropdown ("Cenários de teste")
    expect(source).toContain('homologation-utility-bar');
    expect(source).toContain('Cenários de teste:');
    expect(source).toContain('1 Capítulo');
    expect(source).toContain('5 Capítulos');
    expect(source).toContain('Dezenas (24)');
    expect(source).toContain('Histórico Vazio');

    // 8. Mobile Cover Thumbnail (44x62px) and Horizontal Stage Centering & Scroll Cues
    expect(source).toContain('stages-scroll-cue-left');
    expect(source).toContain('stages-scroll-cue-right');
    expect(source).toContain('cover-thumb-wrapper');
    expect(source).toContain('card-main-info-group');
  });
});
