<script lang="ts">
  import {
    Link2,
    ExternalLink,
    Plus,
    Trash2,
    FileText,
    FolderKanban,
    Search,
    BookOpen,
    X,
    Layers
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';

  let { references = [], works = [], scanId = '', isOwnerOrAdmin = false, isUploader = false } = $props();

  let selectedWorkId = $state<string>('ALL');
  let searchQuery = $state('');

  let showModal = $state(false);
  let formWorkId = $state('');
  let formTitle = $state('');
  let formRefType = $state<'LINK' | 'TEXT' | 'NOTE'>('LINK');
  let formContent = $state('');

  let canEdit = $derived(isOwnerOrAdmin || isUploader);

  let filteredReferences = $derived(
    references.filter((ref: any) => {
      if (selectedWorkId !== 'ALL' && ref.workId !== selectedWorkId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          ref.title.toLowerCase().includes(q) ||
          ref.content.toLowerCase().includes(q)
        );
      }
      return true;
    })
  );

  function openCreateModal() {
    formWorkId = selectedWorkId !== 'ALL' ? selectedWorkId : (works[0]?.id || '');
    formTitle = '';
    formRefType = 'LINK';
    formContent = '';
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }
</script>

<div class="references-tab">
  <!-- Header / Controls -->
  <div class="tab-header">
    <div>
      <h2 class="title">Referências & Recursos por Obra</h2>
      <p class="subtitle">Armazene links de raws oficiais, diretórios de fontes, guias visuais e notas de edição.</p>
    </div>
    {#if canEdit}
      <button class="btn-primary" onclick={openCreateModal}>
        <Plus size={16} />
        Nova Referência
      </button>
    {/if}
  </div>

  <!-- Filters Bar -->
  <div class="filter-bar">
    <div class="search-box">
      <Search size={16} class="search-icon" />
      <input
        type="text"
        placeholder="Buscar referências ou links..."
        bind:value={searchQuery}
        class="search-input"
      />
      {#if searchQuery}
        <button class="clear-search" onclick={() => searchQuery = ''}>
          <X size={14} />
        </button>
      {/if}
    </div>

    <!-- Work Filter -->
    <select bind:value={selectedWorkId} class="filter-select">
      <option value="ALL">Todas as Obras ({works.length})</option>
      {#each works as work}
        <option value={work.id}>{work.title}</option>
      {/each}
    </select>
  </div>

  <!-- References List -->
  {#if filteredReferences.length === 0}
    <div class="empty-state">
      <Link2 size={48} class="empty-icon" />
      <h3>Nenhuma referência vinculada</h3>
      <p>Cadastre links de raws (Naver, Kakao, Piccoma), pastas de drive com fontes ou diretrizes de edição da obra.</p>
      {#if canEdit}
        <button class="btn-secondary" onclick={openCreateModal}>
          <Plus size={16} /> Adicionar primeira referência
        </button>
      {/if}
    </div>
  {:else}
    <div class="refs-grid">
      {#each filteredReferences as ref}
        {@const work = works.find((w: any) => w.id === ref.workId)}
        <div class="ref-card">
          <div class="ref-header">
            <div class="badge-row">
              <span class="type-badge {ref.refType.toLowerCase()}">
                {ref.refType === 'LINK' ? 'Link Externo' : ref.refType === 'TEXT' ? 'Texto / Guia' : 'Nota de Edição'}
              </span>
              {#if work}
                <span class="work-badge">{work.title}</span>
              {/if}
            </div>

            {#if canEdit}
              <form
                method="POST"
                action="?/deleteReference"
                use:enhance={() => {
                  return async ({ update }) => {
                    await update();
                  };
                }}
                onsubmit={(e) => {
                  if (!confirm('Excluir esta referência?')) e.preventDefault();
                }}
              >
                <input type="hidden" name="ref_id" value={ref.id} />
                <button type="submit" class="btn-icon danger" title="Excluir">
                  <Trash2 size={14} />
                </button>
              </form>
            {/if}
          </div>

          <h4 class="ref-title">{ref.title}</h4>

          <div class="ref-body">
            {#if ref.refType === 'LINK'}
              <a href={ref.content} target="_blank" rel="noopener noreferrer" class="link-target">
                <ExternalLink size={14} />
                <span class="link-url">{ref.content}</span>
              </a>
            {:else}
              <div class="text-content">
                {ref.content}
              </div>
            {/if}
          </div>

          <div class="ref-footer">
            <span class="date">{new Date(ref.createdAt).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Create Modal -->
  {#if showModal}
    <div class="modal-backdrop" onclick={closeModal} role="presentation">
      <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>Adicionar Referência / Recurso</h3>
          <button class="btn-close" onclick={closeModal}><X size={18} /></button>
        </div>

        <form
          method="POST"
          action="?/saveReference"
          use:enhance={() => {
            return async ({ update, result }) => {
              await update();
              if (result.type === 'success') {
                closeModal();
              }
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="scan_id" value={scanId} />

          <div class="form-group">
            <label for="ref-work">Obra Relacionada *</label>
            <select id="ref-work" name="work_id" bind:value={formWorkId} required class="input">
              {#each works as w}
                <option value={w.id}>{w.title}</option>
              {/each}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label for="ref-title">Título do Recurso *</label>
              <input
                id="ref-title"
                type="text"
                name="title"
                bind:value={formTitle}
                placeholder="Ex: Raw Oficial Naver Series"
                required
                class="input"
              />
            </div>
            <div class="form-group">
              <label for="ref-type">Tipo</label>
              <select id="ref-type" name="ref_type" bind:value={formRefType} class="input">
                <option value="LINK">Link Externo</option>
                <option value="TEXT">Texto / Guia</option>
                <option value="NOTE">Nota Rápida</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="ref-content">
              {formRefType === 'LINK' ? 'URL (https://...) *' : 'Conteúdo / Informações *'}
            </label>
            {#if formRefType === 'LINK'}
              <input
                id="ref-content"
                type="url"
                name="content"
                bind:value={formContent}
                placeholder="https://series.naver.com/..."
                required
                class="input"
              />
            {:else}
              <textarea
                id="ref-content"
                name="content"
                bind:value={formContent}
                rows="4"
                placeholder="Insira diretrizes de lettering, convenções de balões..."
                required
                class="input textarea"
              ></textarea>
            {/if}
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={closeModal}>Cancelar</button>
            <button type="submit" class="btn-primary">Salvar Recurso</button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .references-tab {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .tab-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .subtitle {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 0.25rem 0 0;
  }

  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.75rem;
    padding: 0.75rem;
  }

  .search-box {
    display: flex;
    align-items: center;
    position: relative;
    flex: 1;
    min-width: 220px;
  }

  :global(.search-icon) {
    position: absolute;
    left: 0.75rem;
    color: #64748b;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.5rem 2rem 0.5rem 2.25rem;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    color: #f1f5f9;
    font-size: 0.875rem;
    outline: none;
  }

  .search-input:focus {
    border-color: #6366f1;
  }

  .clear-search {
    position: absolute;
    right: 0.5rem;
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .filter-select {
    padding: 0.5rem 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    color: #cbd5e1;
    font-size: 0.875rem;
    outline: none;
  }

  .refs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
  }

  .ref-card {
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.75rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition: all 0.2s;
  }

  .ref-card:hover {
    border-color: rgba(99, 102, 241, 0.3);
    background: rgba(15, 23, 42, 0.7);
  }

  .ref-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .badge-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .type-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.45rem;
    border-radius: 0.25rem;
    text-transform: uppercase;
  }

  .type-badge.link {
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }

  .type-badge.text {
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .type-badge.note {
    background: rgba(234, 179, 8, 0.15);
    color: #facc15;
    border: 1px solid rgba(234, 179, 8, 0.3);
  }

  .work-badge {
    font-size: 0.75rem;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.05);
    padding: 0.15rem 0.45rem;
    border-radius: 0.25rem;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-icon {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    border-radius: 0.375rem;
    padding: 0.35rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-icon.danger:hover {
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.1);
  }

  .ref-title {
    font-size: 1rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
  }

  .ref-body {
    flex: 1;
  }

  .link-target {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.08);
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    text-decoration: none;
    font-size: 0.8125rem;
    word-break: break-all;
    max-width: 100%;
    transition: background 0.15s;
  }

  .link-target:hover {
    background: rgba(56, 189, 248, 0.15);
    text-decoration: underline;
  }

  .link-url {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .text-content {
    font-size: 0.8125rem;
    color: #cbd5e1;
    background: rgba(0, 0, 0, 0.25);
    padding: 0.6rem 0.75rem;
    border-radius: 0.5rem;
    white-space: pre-wrap;
    line-height: 1.4;
  }

  .ref-footer {
    display: flex;
    justify-content: flex-end;
    font-size: 0.75rem;
    color: #64748b;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 1rem;
    background: rgba(15, 23, 42, 0.3);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  :global(.empty-icon) {
    color: #475569;
  }

  .empty-state h3 {
    font-size: 1.125rem;
    color: #f1f5f9;
    margin: 0;
  }

  .empty-state p {
    font-size: 0.875rem;
    color: #94a3b8;
    max-width: 420px;
    margin: 0;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: #6366f1;
    color: #fff;
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    padding: 1rem;
  }

  .modal-card {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 1rem;
    width: 100%;
    max-width: 500px;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-header h3 {
    font-size: 1.125rem;
    color: #f8fafc;
    margin: 0;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
  }

  .modal-form {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .flex-1 {
    flex: 1;
  }

  .form-group label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #cbd5e1;
  }

  .input {
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.5rem;
    color: #f1f5f9;
    font-size: 0.875rem;
    outline: none;
    box-sizing: border-box;
  }

  .input:focus {
    border-color: #6366f1;
  }

  .textarea {
    resize: vertical;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }
</style>
