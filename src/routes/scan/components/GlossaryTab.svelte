<script lang="ts">
  import {
    BookA,
    Plus,
    Search,
    Edit3,
    Trash2,
    Filter,
    X,
    BookOpen,
    Tag,
    Info
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';

  let { glossary = [], works = [], scanId = '', isOwnerOrAdmin = false, isUploader = false } = $props();

  let selectedWorkId = $state<string>('ALL');
  let categoryFilter = $state<string>('ALL');
  let searchQuery = $state('');

  let showModal = $state(false);
  let editingEntry = $state<any>(null);

  let formWorkId = $state('');
  let formSourceTerm = $state('');
  let formPreferredTranslation = $state('');
  let formCategory = $state('Personagem');
  let formNotes = $state('');

  const CATEGORIES = ['Personagem', 'Local', 'Habilidade', 'Título', 'Geral', 'Outro'];

  let canEdit = $derived(isOwnerOrAdmin || isUploader);

  let filteredEntries = $derived(
    glossary.filter((item: any) => {
      if (selectedWorkId !== 'ALL' && item.work_id !== selectedWorkId) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.source_term.toLowerCase().includes(q) ||
          item.preferred_translation.toLowerCase().includes(q) ||
          (item.notes && item.notes.toLowerCase().includes(q))
        );
      }
      return true;
    })
  );

  function openCreateModal() {
    editingEntry = null;
    formWorkId = selectedWorkId !== 'ALL' ? selectedWorkId : (works[0]?.id || '');
    formSourceTerm = '';
    formPreferredTranslation = '';
    formCategory = 'Personagem';
    formNotes = '';
    showModal = true;
  }

  function openEditModal(entry: any) {
    editingEntry = entry;
    formWorkId = entry.work_id;
    formSourceTerm = entry.source_term;
    formPreferredTranslation = entry.preferred_translation;
    formCategory = entry.category || 'Personagem';
    formNotes = entry.notes || '';
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingEntry = null;
  }
</script>

<div class="glossary-tab">
  <!-- Header / Controls -->
  <div class="tab-header">
    <div>
      <h2 class="title">Glossário & Terminologias</h2>
      <p class="subtitle">Padronize nomes próprios, técnicas e termos específicos de tradução por obra.</p>
    </div>
    {#if canEdit}
      <button class="btn-primary" onclick={openCreateModal}>
        <Plus size={16} />
        Novo Termo
      </button>
    {/if}
  </div>

  <!-- Filters Bar -->
  <div class="filter-bar">
    <div class="search-box">
      <Search size={16} class="search-icon" />
      <input
        type="text"
        placeholder="Buscar termo ou tradução..."
        bind:value={searchQuery}
        class="search-input"
      />
      {#if searchQuery}
        <button class="clear-search" onclick={() => searchQuery = ''}>
          <X size={14} />
        </button>
      {/if}
    </div>

    <div class="select-group">
      <!-- Work Filter -->
      <select bind:value={selectedWorkId} class="filter-select">
        <option value="ALL">Todas as Obras ({works.length})</option>
        {#each works as work}
          <option value={work.id}>{work.title}</option>
        {/each}
      </select>

      <!-- Category Filter -->
      <select bind:value={categoryFilter} class="filter-select">
        <option value="ALL">Todas as Categorias</option>
        {#each CATEGORIES as cat}
          <option value={cat}>{cat}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- Content List -->
  {#if filteredEntries.length === 0}
    <div class="empty-state">
      <BookA size={48} class="empty-icon" />
      <h3>Nenhum termo cadastrado</h3>
      <p>Crie termos no glossário para que a equipe mantenha a tradução coerente em todos os capítulos.</p>
      {#if canEdit}
        <button class="btn-secondary" onclick={openCreateModal}>
          <Plus size={16} /> Adicionar primeiro termo
        </button>
      {/if}
    </div>
  {:else}
    <div class="terms-grid">
      {#each filteredEntries as entry}
        {@const work = works.find((w: any) => w.id === entry.work_id)}
        <div class="term-card">
          <div class="card-top">
            <span class="badge-cat">{entry.category || 'Geral'}</span>
            {#if work}
              <span class="badge-work">{work.title}</span>
            {/if}
            {#if canEdit}
              <div class="actions">
                <button
                  class="btn-icon"
                  title="Editar Termo"
                  onclick={() => openEditModal(entry)}
                >
                  <Edit3 size={14} />
                </button>
                <form
                  method="POST"
                  action="?/deleteGlossaryEntry"
                  use:enhance={() => {
                    return async ({ update }) => {
                      await update();
                    };
                  }}
                  onsubmit={(e) => {
                    if (!confirm('Excluir este termo do glossário?')) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="entry_id" value={entry.id} />
                  <button type="submit" class="btn-icon danger" title="Excluir Termo">
                    <Trash2 size={14} />
                  </button>
                </form>
              </div>
            {/if}
          </div>

          <div class="card-terms">
            <div class="term-row">
              <span class="label">Original / Raw:</span>
              <span class="val raw">{entry.source_term}</span>
            </div>
            <div class="term-row">
              <span class="label">Tradução Padrão:</span>
              <span class="val trans">{entry.preferred_translation}</span>
            </div>
          </div>

          {#if entry.notes}
            <div class="card-notes">
              <Info size={13} class="notes-icon" />
              <p>{entry.notes}</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Create/Edit Modal -->
  {#if showModal}
    <div class="modal-backdrop" onclick={closeModal} role="presentation">
      <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>{editingEntry ? 'Editar Termo' : 'Novo Termo no Glossário'}</h3>
          <button class="btn-close" onclick={closeModal}><X size={18} /></button>
        </div>

        <form
          method="POST"
          action="?/saveGlossaryEntry"
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
          {#if editingEntry}
            <input type="hidden" name="entry_id" value={editingEntry.id} />
          {/if}

          <div class="form-group">
            <label for="g-work">Obra Relacionada *</label>
            <select id="g-work" name="work_id" bind:value={formWorkId} required class="input">
              {#each works as w}
                <option value={w.id}>{w.title}</option>
              {/each}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label for="g-raw">Termo Original (Raw / Coreano / Inglês) *</label>
              <input
                id="g-raw"
                type="text"
                name="source_term"
                bind:value={formSourceTerm}
                placeholder="Ex: Kang Dae-geun"
                required
                class="input"
              />
            </div>
            <div class="form-group flex-1">
              <label for="g-cat">Categoria</label>
              <select id="g-cat" name="category" bind:value={formCategory} class="input">
                {#each CATEGORIES as cat}
                  <option value={cat}>{cat}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="g-trans">Tradução Padronizada para PT-BR *</label>
            <input
              id="g-trans"
              type="text"
              name="preferred_translation"
              bind:value={formPreferredTranslation}
              placeholder="Ex: Kang Dae-geun"
              required
              class="input"
            />
          </div>

          <div class="form-group">
            <label for="g-notes">Observações e Contexto para a Equipe</label>
            <textarea
              id="g-notes"
              name="notes"
              bind:value={formNotes}
              rows="3"
              placeholder="Explique nuances de tradução, contexto de gênero ou regras de uso..."
              class="input textarea"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={closeModal}>Cancelar</button>
            <button type="submit" class="btn-primary">
              {editingEntry ? 'Salvar Alterações' : 'Cadastrar Termo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .glossary-tab {
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

  .select-group {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
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

  .terms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
  }

  .term-card {
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.75rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    transition: all 0.2s;
  }

  .term-card:hover {
    border-color: rgba(99, 102, 241, 0.3);
    background: rgba(15, 23, 42, 0.7);
  }

  .card-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .badge-cat {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 9999px;
    background: rgba(99, 102, 241, 0.15);
    color: #818cf8;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .badge-work {
    font-size: 0.75rem;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.05);
    padding: 0.2rem 0.5rem;
    border-radius: 0.375rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
  }

  .actions {
    margin-left: auto;
    display: flex;
    gap: 0.35rem;
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

  .btn-icon:hover {
    color: #f1f5f9;
    border-color: rgba(255, 255, 255, 0.25);
  }

  .btn-icon.danger:hover {
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.1);
  }

  .card-terms {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.25);
    padding: 0.75rem;
    border-radius: 0.5rem;
  }

  .term-row {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    font-weight: 600;
  }

  .val {
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .val.raw {
    color: #cbd5e1;
    font-family: monospace;
  }

  .val.trans {
    color: #38bdf8;
    font-weight: 600;
  }

  .card-notes {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.03);
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
  }

  :global(.notes-icon) {
    flex-shrink: 0;
    margin-top: 0.15rem;
    color: #6366f1;
  }

  .card-notes p {
    margin: 0;
    line-height: 1.4;
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
    transition: background 0.15s;
  }

  .btn-primary:hover {
    background: #4f46e5;
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
    transition: all 0.15s;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.15);
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
    max-width: 520px;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
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
    padding: 0.25rem;
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
