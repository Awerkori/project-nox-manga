<script lang="ts">
  import { action } from '$lib/actions';
  import { invalidateAll } from '$app/navigation';
  import { slugify } from '$lib/types';
  import {
    Tags,
    Bookmark,
    Search,
    Plus,
    Hash,
    Check,
    X,
    Pencil,
    Sparkles,
    SlidersHorizontal
  } from '@lucide/svelte';

  let { data } = $props();

  let id = $state(''),
    name = $state(''),
    kind = $state<'GENRE' | 'TAG'>('TAG'),
    notice = $state(''),
    busy = $state(false),
    searchQuery = $state('');

  let generatedSlug = $derived(slugify(name));

  let filteredTags = $derived(
    (data.tags || []).filter((t: { name: string; slug: string }) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  let genres = $derived(filteredTags.filter((t: { kind: string }) => t.kind === 'GENRE'));
  let thematicTags = $derived(filteredTags.filter((t: { kind: string }) => t.kind !== 'GENRE'));

  function selectForEdit(tag: { id: string; name: string; kind: string }) {
    id = tag.id;
    name = tag.name;
    kind = tag.kind === 'GENRE' ? 'GENRE' : 'TAG';
    notice = '';
    // Scroll editor into view on mobile if needed
    if (typeof window !== 'undefined' && window.innerWidth < 860) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function cancelEdit() {
    id = '';
    name = '';
    kind = 'TAG';
  }

  async function save() {
    if (!name.trim()) return;
    busy = true;
    notice = '';
    try {
      await action('editor', 'tag', { id, name: name.trim(), slug: slugify(name), kind });
      const wasEdit = !!id;
      id = '';
      name = '';
      notice = wasEdit ? 'Alteração salva com sucesso.' : 'Nova tag adicionada ao catálogo.';
      await invalidateAll();
      setTimeout(() => {
        if (notice.startsWith('Alteração') || notice.startsWith('Nova')) {
          notice = '';
        }
      }, 4000);
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Gêneros e Tags — Nox Editorial</title>
</svelte:head>

<div class="tags-view">
  <header class="page-header">
    <span class="eyebrow">ORGANIZAÇÃO DO CATÁLOGO</span>
    <h1>Gêneros e Tags</h1>
    <p class="subtitle">
      Defina a taxonomia e os marcadores temáticos para classificação precisa das obras e filtros de busca.
    </p>
  </header>

  {#if notice}
    <div class="notice-banner" role="status">
      <span>{notice}</span>
      <button type="button" class="close-notice" onclick={() => (notice = '')}>
        <X size={14} />
      </button>
    </div>
  {/if}

  <div class="tags-layout">
    <!-- Form Sidebar (Sticky) -->
    <div class="form-column">
      <form
        class="panel editor-form"
        onsubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div class="form-heading">
          {#if id}
            <div class="heading-badge edit-badge">
              <Pencil size={13} />
              <span>Modo Edição</span>
            </div>
            <h2>Editar Termo</h2>
          {:else}
            <div class="heading-badge create-badge">
              <Plus size={13} />
              <span>Novo Registro</span>
            </div>
            <h2>Adicionar Termo</h2>
          {/if}
        </div>

        <!-- Kind Selector -->
        <div class="field">
          <span class="field-label">Tipo de Classificação</span>
          <div class="segmented-control">
            <button
              type="button"
              class="segment-btn"
              class:active={kind === 'GENRE'}
              onclick={() => (kind = 'GENRE')}
            >
              <span>◈</span>
              <strong>Gênero</strong>
            </button>
            <button
              type="button"
              class="segment-btn"
              class:active={kind === 'TAG'}
              onclick={() => (kind = 'TAG')}
            >
              <span>#</span>
              <strong>Tag</strong>
            </button>
          </div>
          <p class="field-help">
            {kind === 'GENRE'
              ? 'Gêneros representam categorias centrais da história (ex: Romance, Fantasia, Ação).'
              : 'Tags representam tropos, temas e especificidades (ex: Reencarnação, Dungeon, Protagonista OP).'}
          </p>
        </div>

        <!-- Name Input -->
        <label class="field">
          <span class="field-label">Nome *</span>
          <input
            bind:value={name}
            required
            maxlength="40"
            placeholder={kind === 'GENRE' ? 'Ex: Fantasia Sombria' : 'Ex: Sistema de Níveis'}
            class="control"
          />
        </label>

        <!-- Dynamic Slug Preview -->
        <div class="slug-preview-box">
          <span class="slug-label">Slug de busca:</span>
          <code class="slug-code">{generatedSlug || 'aguardando-nome'}</code>
        </div>

        <div class="form-buttons">
          <button class="button primary" disabled={busy || !name.trim()}>
            {id ? 'Salvar Alteração' : 'Criar no Catálogo'}
          </button>

          {#if id}
            <button type="button" class="button secondary" onclick={cancelEdit} disabled={busy}>
              Cancelar
            </button>
          {/if}
        </div>
      </form>
    </div>

    <!-- Tags List Column -->
    <div class="list-column">
      <!-- Search Filter Bar -->
      <div class="search-bar-wrap">
        <Search size={16} class="search-icon" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Filtrar gêneros e tags cadastradas…"
          class="search-input"
          aria-label="Filtrar termos"
        />
        {#if searchQuery}
          <button type="button" class="clear-search" onclick={() => (searchQuery = '')}>
            <X size={14} />
          </button>
        {/if}
      </div>

      <!-- Genres Section -->
      <section class="panel taxonomy-section">
        <div class="section-top">
          <div class="section-title">
            <span class="symbol-icon">◈</span>
            <h3>Gêneros Principais</h3>
          </div>
          <span class="count-badge">{genres.length} cadastrados</span>
        </div>

        {#if genres.length === 0}
          <p class="empty-text">Nenhum gênero encontrado{searchQuery ? ' para esta busca' : ''}.</p>
        {:else}
          <div class="chips-cloud">
            {#each genres as tag (tag.id)}
              <button
                type="button"
                class="tax-chip genre-chip"
                class:selected={id === tag.id}
                onclick={() => selectForEdit(tag)}
                title="Clique para editar este gênero"
              >
                <span class="chip-symbol">◈</span>
                <span class="chip-name">{tag.name}</span>
                <Pencil size={11} class="chip-edit-icon" />
              </button>
            {/each}
          </div>
        {/if}
      </section>

      <!-- Tags Section -->
      <section class="panel taxonomy-section">
        <div class="section-top">
          <div class="section-title">
            <span class="symbol-icon">#</span>
            <h3>Tags Temáticas & Tropos</h3>
          </div>
          <span class="count-badge">{thematicTags.length} cadastradas</span>
        </div>

        {#if thematicTags.length === 0}
          <p class="empty-text">Nenhuma tag temática encontrada{searchQuery ? ' para esta busca' : ''}.</p>
        {:else}
          <div class="chips-cloud">
            {#each thematicTags as tag (tag.id)}
              <button
                type="button"
                class="tax-chip tag-chip"
                class:selected={id === tag.id}
                onclick={() => selectForEdit(tag)}
                title="Clique para editar esta tag"
              >
                <span class="chip-symbol">#</span>
                <span class="chip-name">{tag.name}</span>
                <Pencil size={11} class="chip-edit-icon" />
              </button>
            {/each}
          </div>
        {/if}
      </section>
    </div>
  </div>
</div>

<style>
  .tags-view {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .page-header {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .page-header h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0;
    color: #f8fafc;
    letter-spacing: -0.02em;
  }

  .subtitle {
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }

  .notice-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 18px;
    border-radius: 10px;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.28);
    color: #e2e8f0;
    font-size: 13px;
  }

  .close-notice {
    background: transparent;
    border: 0;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 2px;
  }

  .close-notice:hover {
    color: #f1f5f9;
  }

  .tags-layout {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 24px;
    align-items: start;
  }

  @media (max-width: 860px) {
    .tags-layout {
      grid-template-columns: 1fr;
    }
  }

  .panel {
    background: #110d1a;
    border: 1px solid #231b31;
    border-radius: 14px;
    padding: 22px;
  }

  /* Form column */
  .editor-form {
    position: sticky;
    top: 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .form-heading {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .heading-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    align-self: flex-start;
  }

  .heading-badge.create-badge {
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .heading-badge.edit-badge {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .form-heading h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: #f8fafc;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .field-help {
    font-size: 11px;
    color: var(--muted);
    margin: 2px 0 0;
    line-height: 1.4;
  }

  .segmented-control {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: #090610;
    border: 1px solid #281e36;
    border-radius: 8px;
    padding: 4px;
    gap: 4px;
  }

  .segment-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    border-radius: 6px;
    border: 0;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s ease;
  }

  .segment-btn:hover {
    color: #f1f5f9;
  }

  .segment-btn.active {
    background: #251a37;
    color: #f1f5f9;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  }

  .control {
    background: #090610;
    border: 1px solid #281e36;
    color: #f1f5f9;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 14px;
    width: 100%;
    box-sizing: border-box;
  }

  .control:focus {
    outline: none;
    border-color: #9333ea;
  }

  .slug-preview-box {
    background: #090610;
    border: 1px solid #1c1426;
    padding: 8px 12px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
  }

  .slug-label {
    color: var(--muted);
  }

  .slug-code {
    color: #c084fc;
    font-family: monospace;
    font-size: 11px;
  }

  .form-buttons {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }

  /* List column */
  .list-column {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .search-bar-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: 14px;
    color: #64748b;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    background: #110d1a;
    border: 1px solid #231b31;
    border-radius: 10px;
    padding: 11px 40px 11px 40px;
    color: #f8fafc;
    font-size: 13px;
    box-sizing: border-box;
    transition: border-color 0.15s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #9333ea;
  }

  .clear-search {
    position: absolute;
    right: 12px;
    background: transparent;
    border: 0;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 2px;
  }

  .clear-search:hover {
    color: #f8fafc;
  }

  .taxonomy-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #1c1527;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .symbol-icon {
    color: #a855f7;
    font-weight: 700;
    font-size: 15px;
  }

  .section-title h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: #f1f5f9;
  }

  .count-badge {
    font-size: 11px;
    color: var(--muted);
    background: #181224;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid #2b1d3d;
  }

  .empty-text {
    font-size: 13px;
    color: var(--muted);
    margin: 8px 0;
  }

  .chips-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .tax-chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    background: #150f21;
    border: 1px solid #2b1f3c;
    color: #e2e8f0;
    transition: all 0.15s ease;
  }

  .tax-chip:hover {
    background: #1f1632;
    border-color: #634388;
    color: #ffffff;
    transform: translateY(-1px);
  }

  .tax-chip.selected {
    background: #2a1846;
    border-color: #a855f7;
    color: #f3e8ff;
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.35);
  }

  .genre-chip .chip-symbol {
    color: var(--gold, #eab308);
  }

  .tag-chip .chip-symbol {
    color: #c084fc;
  }

  :global(.chip-edit-icon) {
    opacity: 0.4;
    transition: opacity 0.15s ease;
  }

  .tax-chip:hover :global(.chip-edit-icon) {
    opacity: 1;
    color: #a855f7;
  }
</style>
