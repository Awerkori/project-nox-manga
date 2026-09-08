<script lang="ts">
  import { untrack } from 'svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { action } from '$lib/actions';
  import { kindLabels, statusLabels, slugify } from '$lib/types';
  import DeleteContent from '$lib/components/DeleteContent.svelte';
  import {
    ArrowLeft,
    ExternalLink,
    UploadCloud,
    Plus,
    CheckCircle2,
    AlertCircle,
    Archive,
    Save,
    ArrowRight,
    BookOpen,
    Clock
  } from '@lucide/svelte';

  let { data } = $props();
  const initial = untrack(() => data);

  let title = $state(initial.work?.title || '');
  let slug = $state(initial.work?.slug || '');
  let cover = $state(initial.work?.cover_id || '');
  let notice = $state('');
  let noticeType = $state<'info' | 'success' | 'error'>('info');
  let busy = $state(false);
  let uploading = $state(false);
  let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  let selected = $state<string[]>(initial.selected);

  async function upload(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    uploading = true;
    notice = '';
    saveState = 'idle';
    try {
      const { normalizePage } = await import('$lib/uploads');
      const image = await normalizePage(file);
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': image.type },
        body: image
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Erro ao enviar capa.');
      cover = result.id;
      notice = 'Capa atualizada com sucesso.';
      noticeType = 'success';
    } catch (e) {
      notice = (e as Error).message;
      noticeType = 'error';
    } finally {
      uploading = false;
    }
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    saveState = 'saving';
    notice = '';
    try {
      const fields = Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement));
      const result = await action('editor', 'work', {
        ...fields,
        id: data.work?.id,
        aliases: String(fields.aliases)
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        tags: selected,
        cover_id: cover
      });

      if (!data.work) {
        goto(`/admin/obras/${result.id}`);
      } else {
        notice = 'Obra salva com sucesso.';
        noticeType = 'success';
        saveState = 'saved';
        await invalidateAll();
        setTimeout(() => {
          if (saveState === 'saved') saveState = 'idle';
        }, 3000);
      }
    } catch (e) {
      notice = (e as Error).message;
      noticeType = 'error';
      saveState = 'error';
    } finally {
      busy = false;
    }
  }

  async function archive() {
    if (!confirm('Deseja realmente arquivar esta obra? Ela deixará de aparecer publicamente no catálogo.')) return;
    busy = true;
    notice = '';
    try {
      await action('editor', 'archive', { id: data.work?.id });
      await invalidateAll();
      notice = 'Obra arquivada. Ela não é mais exibida publicamente aos leitores.';
      noticeType = 'info';
    } catch (e) {
      notice = (e as Error).message;
      noticeType = 'error';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>{data.work ? 'Editar ' + data.work.title : 'Nova Obra'} — Nox Editorial</title>
</svelte:head>

<div class="work-editor-shell">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb-bar" aria-label="Navegação">
    <a href="/admin/obras" class="breadcrumb-link">
      <ArrowLeft size={14} />
      <span>Voltar para Obras</span>
    </a>
    <span class="breadcrumb-sep">/</span>
    <span class="breadcrumb-current">{data.work?.title || 'Cadastrar Nova Obra'}</span>
  </nav>

  <!-- Page Header -->
  <header class="page-header">
    <div class="header-titles">
      <span class="eyebrow">FICHA DA OBRA</span>
      <h1 class="page-title">{data.work ? data.work.title : 'Cadastrar Nova Obra'}</h1>
      {#if data.work}
        <span class="slug-preview">/obra/{data.work.slug}</span>
      {/if}
    </div>

    {#if data.work?.published}
      <div class="header-actions">
        <a
          href="/obra/{data.work.slug}"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-view-public"
        >
          <span>Ver no site público</span>
          <ExternalLink size={14} />
        </a>
      </div>
    {/if}
  </header>

  <!-- Feedback Notice Banner -->
  {#if notice}
    <div
      class="notice-banner"
      class:notice-success={noticeType === 'success'}
      class:notice-error={noticeType === 'error'}
      role="status"
    >
      {#if noticeType === 'success'}
        <CheckCircle2 size={16} />
      {:else if noticeType === 'error'}
        <AlertCircle size={16} />
      {/if}
      <span>{notice}</span>
    </div>
  {/if}

  <!-- Main Work Form -->
  <form class="editor-panel-form" onsubmit={save}>
    <!-- Cover Section Studio -->
    <div class="cover-studio-row">
      <div class="cover-preview-box">
        {#if cover}
          <img src="/media/{cover}" alt="Prévia da capa" width="140" height="198" class="cover-image" />
        {:else}
          <div class="cover-empty-box">
            <BookOpen size={28} />
            <span>Sem capa</span>
          </div>
        {/if}
      </div>

      <div class="cover-actions-col">
        <h3 class="cover-heading">Capa Oficial</h3>
        <p class="cover-hint">
          Selecione uma imagem vertical de alta resolução (proporção aproximada 1:1.4). Formatos suportados: WebP, PNG ou JPEG.
        </p>

        <label class="btn-select-cover" class:disabled={uploading}>
          <UploadCloud size={15} />
          <span>{uploading ? 'Processando capa…' : 'Selecionar Imagem da Capa'}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            onchange={upload}
            style="display:none"
          />
        </label>
      </div>
    </div>

    <!-- Metadata Fields Grid -->
    <div class="fields-grid">
      <!-- Title -->
      <label class="field-wrap col-full">
        <span class="field-label">Título da Obra <strong class="req">*</strong></span>
        <input
          name="title"
          class="field-input"
          bind:value={title}
          oninput={() => {
            if (!data.work) slug = slugify(title);
          }}
          required
          maxlength="200"
          placeholder="Ex: Céu Distante"
        />
      </label>

      <!-- Slug -->
      <label class="field-wrap col-full">
        <span class="field-label">Endereço público (Slug) <strong class="req">*</strong></span>
        <input
          name="slug"
          class="field-input monospace-input"
          bind:value={slug}
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="ex: distante-ceu"
        />
        <small class="field-hint">Endereço permanente da obra: <code>/obra/{slug || 'slug-da-obra'}</code></small>
      </label>

      <!-- Aliases -->
      <label class="field-wrap col-full">
        <span class="field-label">Títulos Alternativos</span>
        <textarea
          name="aliases"
          class="field-textarea"
          rows="2"
          placeholder="Um nome por linha (ex: Distant Sky, Sookhee)"
        >{data.work?.aliases.join('\n') || ''}</textarea>
        <small class="field-hint">Usados para descoberta na busca da plataforma.</small>
      </label>

      <!-- Synopsis -->
      <label class="field-wrap col-full">
        <span class="field-label">Sinopse da Obra <strong class="req">*</strong></span>
        <textarea
          name="synopsis"
          class="field-textarea"
          rows="4"
          maxlength="5000"
          required
          placeholder="Apresentação inicial para os leitores..."
        >{data.work?.synopsis || ''}</textarea>
      </label>

      <!-- Additional Description -->
      <label class="field-wrap col-full">
        <span class="field-label">Descrição Adicional ou Notas</span>
        <textarea
          name="description"
          class="field-textarea"
          rows="3"
          maxlength="10000"
          placeholder="Créditos de tradução, informações contextuais ou avisos..."
        >{data.work?.description || ''}</textarea>
      </label>

      <!-- Author -->
      <label class="field-wrap">
        <span class="field-label">Roteiro / Autor</span>
        <input
          name="author"
          class="field-input"
          value={data.work?.author || ''}
          maxlength="200"
          placeholder="Ex: Inwan Youn"
        />
      </label>

      <!-- Artist -->
      <label class="field-wrap">
        <span class="field-label">Arte / Ilustrador</span>
        <input
          name="artist"
          class="field-input"
          value={data.work?.artist || ''}
          maxlength="200"
          placeholder="Ex: Sunhee Kim"
        />
      </label>

      <!-- Kind / Formato -->
      <label class="field-wrap">
        <span class="field-label">Formato Editorial</span>
        <select name="kind" class="field-select" value={data.work?.kind || 'MANHWA'}>
          {#each Object.entries(kindLabels) as [val, lbl] (val)}
            <option value={val}>{lbl}</option>
          {/each}
        </select>
      </label>

      <!-- Status -->
      <label class="field-wrap">
        <span class="field-label">Status da Publicação</span>
        <select name="status" class="field-select" value={data.work?.status || 'ONGOING'}>
          {#each ['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'] as val (val)}
            <option value={val}>{statusLabels[val]}</option>
          {/each}
        </select>
      </label>

      <!-- Year -->
      <label class="field-wrap">
        <span class="field-label">Ano de Lançamento</span>
        <input
          name="year"
          type="number"
          min="1900"
          max="2200"
          class="field-input"
          value={data.work?.year || ''}
          placeholder="Ex: 2024"
        />
      </label>

      <!-- Age Rating -->
      <label class="field-wrap">
        <span class="field-label">Classificação Indicativa</span>
        <select name="age_rating" class="field-select" value={data.work?.age_rating ?? 12}>
          {#each [0, 10, 12, 14, 16, 18] as val (val)}
            <option value={val}>{val === 0 ? 'Livre' : `${val} anos`}</option>
          {/each}
        </select>
      </label>
    </div>

    <!-- Tags & Gêneros Selector -->
    <fieldset class="tags-fieldset">
      <legend class="tags-legend">Gêneros e Categorias Associadas</legend>
      <div class="tag-chips-wrap">
        {#each data.tags as tag (tag?.id)}
          <label class="tag-chip-label" class:active={selected.includes(tag.id)}>
            <input type="checkbox" bind:group={selected} value={tag.id} class="tag-checkbox" />
            <span class="tag-prefix">{tag.kind === 'GENRE' ? '◈' : '#'}</span>
            <span class="tag-name">{tag.name}</span>
          </label>
        {/each}
      </div>
    </fieldset>

    <!-- Save & Action Footer -->
    <div class="form-actions-footer">
      <button type="submit" class="btn-submit-save" disabled={busy || uploading}>
        {#if saveState === 'saving'}
          <span>Salvando obra…</span>
        {:else if saveState === 'saved'}
          <CheckCircle2 size={16} />
          <span>Obra Salva!</span>
        {:else}
          <Save size={16} />
          <span>{data.work ? 'Salvar Alterações' : 'Cadastrar Obra'}</span>
        {/if}
      </button>

      {#if data.work?.published}
        <button
          type="button"
          class="btn-archive-work"
          onclick={archive}
          disabled={busy}
          title="Arquivar obra e ocultar do catálogo público"
        >
          <Archive size={15} />
          <span>Arquivar Obra</span>
        </button>
      {/if}
    </div>
  </form>

  <!-- Delete Safety Component (Admin Only) -->
  {#if data.role === 'ADMIN' && data.work}
    <div class="admin-danger-zone">
      <DeleteContent id={data.work.id} label={data.work.title} kind="work" destination="/admin/obras" />
    </div>
  {/if}

  <!-- Chapters Section -->
  {#if data.work}
    <section class="chapters-section">
      <div class="chapters-header">
        <div class="chapters-title-cluster">
          <div class="chapters-title-row">
            <h2 class="chapters-title">Capítulos</h2>
            <span class="chapters-count-pill">{data.chapters.length}</span>
          </div>
          <span class="chapters-subtitle">Acompanhe páginas, rascunhos e publicação da obra</span>
        </div>

        <a
          href="/admin/obras/{data.work.id}/capitulos/novo"
          class="btn-add-chapter"
        >
          <Plus size={15} />
          <span>Adicionar Capítulo</span>
        </a>
      </div>

      {#if data.chapters.length > 0}
        <div class="chapters-table-card">
          <table class="chapters-table">
            <thead>
              <tr>
                <th>Capítulo</th>
                <th>Status</th>
                <th>Data</th>
                <th class="th-action">Ação</th>
              </tr>
            </thead>
            <tbody>
              {#each data.chapters as ch (ch.id)}
                <tr class="chapter-row">
                  <td class="td-ch-title">
                    <strong class="ch-num">Capítulo {ch.number}</strong>
                    {#if ch.title}
                      <span class="ch-desc">— {ch.title}</span>
                    {/if}
                  </td>
                  <td class="td-ch-status">
                    {#if ch.published_at}
                      <span class="status-badge status-live">
                        <span class="status-dot-live"></span>
                        <span>Publicado</span>
                      </span>
                    {:else}
                      <span class="status-badge status-draft">
                        <span class="status-dot-draft"></span>
                        <span>Rascunho</span>
                      </span>
                    {/if}
                  </td>
                  <td class="td-ch-date">
                    <span class="date-text">
                      {ch.published_at ? 'Publicado' : 'Em preparo'}
                    </span>
                  </td>
                  <td class="td-ch-action">
                    <a
                      href="/admin/obras/{data.work.id}/capitulos/{ch.id}"
                      class="btn-open-editor"
                    >
                      <span>Abrir Editor</span>
                      <ArrowRight size={13} />
                    </a>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="empty-chapters-card">
          <BookOpen size={30} class="empty-ch-icon" />
          <h3>Nenhum capítulo cadastrado ainda</h3>
          <p>Adicione o primeiro capítulo para iniciar a leitura desta obra.</p>
          <a
            href="/admin/obras/{data.work.id}/capitulos/novo"
            class="btn-primary-add-first"
          >
            <Plus size={15} />
            <span>Cadastrar Capítulo 1</span>
          </a>
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .work-editor-shell {
    display: flex;
    flex-direction: column;
    gap: 22px;
    width: 100%;
    max-width: 1100px;
  }

  /* Breadcrumb */
  .breadcrumb-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
  }

  .breadcrumb-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #98a2b8;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.2s ease;
  }

  .breadcrumb-link:hover {
    color: #dfc28d;
  }

  .breadcrumb-sep {
    color: #4b5263;
  }

  .breadcrumb-current {
    color: #e2e7f2;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Page Header */
  .page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .eyebrow {
    font-size: 11px;
    font-weight: 750;
    color: #dfc28d;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .page-title {
    margin: 0;
    font-family: var(--font-heading, 'Manrope', sans-serif);
    font-size: clamp(1.6rem, 2.8vw, 2.1rem);
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
  }

  .slug-preview {
    font-size: 12px;
    color: #7b8396;
    font-family: monospace;
  }

  .btn-view-public {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d5d9e6;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-view-public:hover {
    background: rgba(223, 194, 141, 0.12);
    border-color: rgba(223, 194, 141, 0.35);
    color: #dfc28d;
  }

  /* Notice */
  .notice-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 9px;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: #7dd3fc;
    font-size: 13px;
  }

  .notice-banner.notice-success {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.35);
    color: #6ee7b7;
  }

  .notice-banner.notice-error {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  /* Form Container */
  .editor-panel-form {
    display: flex;
    flex-direction: column;
    gap: 28px;
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 26px;
    backdrop-filter: blur(14px);
  }

  /* Cover Studio */
  .cover-studio-row {
    display: flex;
    align-items: center;
    gap: 24px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .cover-preview-box {
    width: 140px;
    height: 198px;
    border-radius: 10px;
    overflow: hidden;
    background: #121420;
    border: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  }

  .cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .cover-empty-box {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #646b80;
    font-size: 11px;
    font-weight: 600;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 10px;
  }

  .cover-actions-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cover-heading {
    margin: 0;
    font-size: 15px;
    font-weight: 750;
    color: #ffffff;
  }

  .cover-hint {
    margin: 0;
    font-size: 12px;
    color: #7b8396;
    max-width: 480px;
    line-height: 1.5;
  }

  .btn-select-cover {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #ffffff;
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
    width: fit-content;
    margin-top: 4px;
    transition: all 0.2s ease;
  }

  .btn-select-cover:hover {
    background: rgba(223, 194, 141, 0.15);
    border-color: rgba(223, 194, 141, 0.35);
    color: #dfc28d;
  }

  .btn-select-cover.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  /* Fields Grid */
  .fields-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px 20px;
  }

  .col-full {
    grid-column: 1 / -1;
  }

  .field-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 650;
    color: #b5bdd0;
  }

  .req {
    color: #f43f5e;
  }

  .field-input,
  .field-select,
  .field-textarea {
    background: rgba(20, 24, 38, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 10px 14px;
    color: #ffffff;
    font-size: 13px;
    outline: none;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .field-input:focus,
  .field-select:focus,
  .field-textarea:focus {
    border-color: rgba(223, 194, 141, 0.45);
    box-shadow: 0 0 14px rgba(223, 194, 141, 0.15);
    background: rgba(24, 30, 48, 0.95);
  }

  .monospace-input {
    font-family: monospace;
    color: #cbb4ff;
  }

  .field-textarea {
    resize: vertical;
    line-height: 1.6;
  }

  .field-hint {
    font-size: 11px;
    color: #646b80;
  }

  .field-hint code {
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.08);
    padding: 1px 4px;
    border-radius: 4px;
  }

  /* Tags Fieldset */
  .tags-fieldset {
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 14px 18px 18px;
    background: rgba(18, 22, 34, 0.4);
  }

  .tags-legend {
    font-size: 11.5px;
    font-weight: 700;
    color: #8c93a8;
    padding: 0 8px;
    letter-spacing: 0.04em;
  }

  .tag-chips-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
  }

  .tag-chip-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 11.5px;
    color: #98a2b8;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tag-chip-label:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .tag-chip-label.active {
    background: rgba(181, 154, 245, 0.15);
    border-color: rgba(181, 154, 245, 0.4);
    color: #ffffff;
    font-weight: 600;
  }

  .tag-checkbox {
    accent-color: #b59af5;
  }

  .tag-prefix {
    color: #dfc28d;
    font-size: 10px;
  }

  /* Footer Actions */
  .form-actions-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .btn-submit-save {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    border-radius: 9px;
    background: linear-gradient(135deg, #dfc28d 0%, #c49c5e 100%);
    color: #0d0c14;
    font-size: 13px;
    font-weight: 750;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(223, 194, 141, 0.35);
    transition: all 0.2s ease;
  }

  .btn-submit-save:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(223, 194, 141, 0.5);
  }

  .btn-submit-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-archive-work {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 16px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #c5cbd8;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-archive-work:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .admin-danger-zone {
    margin-top: 4px;
  }

  /* Chapters Section */
  .chapters-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 12px;
  }

  .chapters-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 14px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .chapters-title-cluster {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .chapters-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chapters-title {
    margin: 0;
    font-family: var(--font-heading, 'Manrope', sans-serif);
    font-size: 18px;
    font-weight: 800;
    color: #ffffff;
  }

  .chapters-count-pill {
    font-size: 11px;
    font-weight: 750;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(181, 154, 245, 0.15);
    color: #cbb4ff;
    border: 1px solid rgba(181, 154, 245, 0.3);
  }

  .chapters-subtitle {
    font-size: 12px;
    color: #7b8396;
  }

  .btn-add-chapter {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(223, 194, 141, 0.12);
    border: 1px solid rgba(223, 194, 141, 0.3);
    color: #dfc28d;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-add-chapter:hover {
    background: rgba(223, 194, 141, 0.22);
    border-color: rgba(223, 194, 141, 0.5);
  }

  /* Chapters Table */
  .chapters-table-card {
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    overflow: hidden;
    backdrop-filter: blur(14px);
  }

  .chapters-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .chapters-table th {
    background: rgba(18, 22, 34, 0.6);
    padding: 11px 16px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: #7b8396;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .chapter-row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 0.15s ease;
  }

  .chapter-row:hover {
    background: rgba(22, 28, 44, 0.4);
  }

  .chapter-row:last-child {
    border-bottom: none;
  }

  .chapters-table td {
    padding: 12px 16px;
    vertical-align: middle;
  }

  .td-ch-title {
    color: #ffffff;
  }

  .ch-num {
    color: #ffffff;
    font-weight: 750;
  }

  .ch-desc {
    color: #8c93a8;
    margin-left: 4px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 650;
  }

  .status-live {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }

  .status-dot-live {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px #10b981;
  }

  .status-draft {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fbbf24;
  }

  .status-dot-draft {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f59e0b;
  }

  .date-text {
    font-size: 12px;
    color: #7b8396;
  }

  .th-action,
  .td-ch-action {
    text-align: right;
  }

  .btn-open-editor {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #d2d8e6;
    font-size: 11.5px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-open-editor:hover {
    background: rgba(223, 194, 141, 0.15);
    border-color: rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    transform: translateX(2px);
  }

  /* Empty Chapters Card */
  .empty-chapters-card {
    padding: 40px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    border-radius: 12px;
    background: rgba(13, 16, 26, 0.4);
    border: 1px dashed rgba(255, 255, 255, 0.08);
  }

  :global(.empty-ch-icon) {
    color: #dfc28d;
  }

  .empty-chapters-card h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 750;
    color: #ffffff;
  }

  .empty-chapters-card p {
    margin: 0;
    font-size: 12px;
    color: #7b8396;
  }

  .btn-primary-add-first {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    margin-top: 4px;
    transition: all 0.2s ease;
  }

  .btn-primary-add-first:hover {
    background: rgba(223, 194, 141, 0.25);
  }

  @media (max-width: 768px) {
    .cover-studio-row {
      flex-direction: column;
      align-items: flex-start;
    }

    .fields-grid {
      grid-template-columns: 1fr;
    }

    .page-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
  }
</style>
