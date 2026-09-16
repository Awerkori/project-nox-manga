<script lang="ts">
  import {
    BookOpen,
    Plus,
    Pin,
    Search,
    Edit3,
    Trash2,
    Calendar,
    User,
    X,
    FileText
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';

  let { wikiPages = [], isOwnerOrAdmin = false, scanId = '' } = $props();

  let search = $state('');
  let categoryFilter = $state('ALL');
  let selectedPage = $state<any>(null);
  let showEditorModal = $state(false);
  let editingPage = $state<any>(null);

  let pageTitle = $state('');
  let pageSlug = $state('');
  let pageCategory = $state('Geral');
  let pageContent = $state('');
  let pagePinned = $state(false);

  let categories = $derived([
    ...new Set(wikiPages.map((p: any) => p.category).filter(Boolean))
  ]);

  let filteredPages = $derived(
    wikiPages.filter((p: any) => {
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q);
      }
      return true;
    })
  );

  $effect(() => {
    if (!selectedPage && filteredPages.length > 0) {
      selectedPage = filteredPages[0];
    }
  });

  function openCreate() {
    editingPage = null;
    pageTitle = '';
    pageSlug = '';
    pageCategory = 'Geral';
    pageContent = '';
    pagePinned = false;
    showEditorModal = true;
  }

  function openEdit(page: any) {
    editingPage = page;
    pageTitle = page.title;
    pageSlug = page.slug;
    pageCategory = page.category || 'Geral';
    pageContent = page.content;
    pagePinned = Boolean(page.isPinned);
    showEditorModal = true;
  }
</script>

<div class="wiki-tab-root">
  <div class="wiki-header-bar">
    <div class="header-titles">
      <h2 class="tab-title">Wiki & Guias Internos da Equipe</h2>
      <p class="tab-desc">Centralize regras, convenções ortográficas, guias de edição e tutoriais exclusivos da scan.</p>
    </div>

    {#if isOwnerOrAdmin}
      <button type="button" class="btn-primary-sm" onclick={openCreate}>
        <Plus size={14} />
        <span>Novo Artigo</span>
      </button>
    {/if}
  </div>

  <div class="wiki-layout-grid">
    <!-- Left Navigation Sidebar -->
    <div class="wiki-sidebar">
      <div class="wiki-search-box">
        <Search size={14} class="search-icon" />
        <input
          type="text"
          placeholder="Buscar artigo..."
          bind:value={search}
          class="wiki-search-in"
        />
      </div>

      <div class="wiki-cat-pills">
        <button
          type="button"
          class="cat-chip"
          class:active={categoryFilter === 'ALL'}
          onclick={() => (categoryFilter = 'ALL')}
        >
          Todos ({wikiPages.length})
        </button>
        {#each categories as cat}
          <button
            type="button"
            class="cat-chip"
            class:active={categoryFilter === cat}
            onclick={() => (categoryFilter = cat)}
          >
            {cat}
          </button>
        {/each}
      </div>

      <div class="wiki-pages-list">
        {#each filteredPages as page}
          <button
            type="button"
            class="wiki-page-nav-item"
            class:active={selectedPage?.id === page.id}
            onclick={() => (selectedPage = page)}
          >
            {#if page.isPinned}
              <Pin size={12} class="pin-icon" />
            {:else}
              <FileText size={12} />
            {/if}
            <span class="truncate nav-title">{page.title}</span>
            <span class="cat-tag">{page.category || 'Geral'}</span>
          </button>
        {/each}

        {#if filteredPages.length === 0}
          <div class="empty-nav">Nenhum artigo encontrado.</div>
        {/if}
      </div>
    </div>

    <!-- Right Reader Content Area -->
    <div class="wiki-content-card">
      {#if selectedPage}
        <div class="article-header">
          <div class="article-title-cluster">
            <span class="article-cat-badge">{selectedPage.category || 'Geral'}</span>
            <h1 class="article-title">{selectedPage.title}</h1>
            <div class="article-meta-row">
              {#if selectedPage.author}
                <span>Por @{selectedPage.author.username}</span>
              {/if}
              <span>Atualizado em {new Date(selectedPage.updatedAt || selectedPage.createdAt).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          {#if isOwnerOrAdmin}
            <div class="article-actions">
              <button type="button" class="btn-tool" onclick={() => openEdit(selectedPage)} title="Editar artigo">
                <Edit3 size={15} />
                <span>Editar</span>
              </button>
              <form method="POST" action="?/deleteWikiPage" use:enhance>
                <input type="hidden" name="page_id" value={selectedPage.id} />
                <button type="submit" class="btn-tool delete" title="Remover artigo" onclick={(e) => { if (!confirm('Remover este artigo permanentemente?')) e.preventDefault(); }}>
                  <Trash2 size={15} />
                </button>
              </form>
            </div>
          {/if}
        </div>

        <div class="article-body">
          <pre class="article-markdown-pre">{selectedPage.content}</pre>
        </div>
      {:else}
        <div class="empty-article">
          <BookOpen size={48} class="empty-icon" />
          <p>Selecione um artigo na lateral para ler.</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Editor Modal -->
{#if showEditorModal}
  <div class="modal-backdrop" onclick={() => (showEditorModal = false)}>
    <div class="modal-card modal-large" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3 class="modal-title">{editingPage ? 'Editar Artigo da Wiki' : 'Novo Artigo da Wiki'}</h3>
        <button type="button" class="btn-close-modal" onclick={() => (showEditorModal = false)}>
          <X size={16} />
        </button>
      </div>

      <form method="POST" action={editingPage ? '?/updateWikiPage' : '?/createWikiPage'} use:enhance={() => { showEditorModal = false; }} class="modal-form">
        {#if editingPage}
          <input type="hidden" name="page_id" value={editingPage.id} />
        {/if}

        <div class="form-row-2">
          <div class="form-group">
            <label for="wiki-title-in" class="form-label">Título do Artigo *</label>
            <input id="wiki-title-in" name="title" type="text" required bind:value={pageTitle} placeholder="Ex: Padrão de Letreiramento & Onomatopeias" class="form-input" />
          </div>

          <div class="form-group">
            <label for="wiki-cat-in" class="form-label">Categoria</label>
            <input id="wiki-cat-in" name="category" type="text" bind:value={pageCategory} placeholder="Ex: Guias, Tradução, Edição..." class="form-input" />
          </div>
        </div>

        <div class="form-group">
          <label for="wiki-content-in" class="form-label">Conteúdo do Artigo (Markdown) *</label>
          <textarea id="wiki-content-in" name="content" rows={12} required bind:value={pageContent} placeholder="Escreva as diretrizes, regras, links de fontes..." class="form-textarea font-mono"></textarea>
        </div>

        <div class="form-check-group">
          <label class="check-label">
            <input type="checkbox" name="is_pinned" value="true" bind:checked={pagePinned} />
            <span>Fixar no topo da Wiki para leitura prioritária</span>
          </label>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-cancel" onclick={() => (showEditorModal = false)}>Cancelar</button>
          <button type="submit" class="btn-submit">{editingPage ? 'Salvar Alterações' : 'Publicar Artigo'}</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .wiki-tab-root {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .wiki-header-bar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
  }

  .tab-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0 0 4px;
  }

  .tab-desc {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0;
  }

  .btn-primary-sm {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #8b5cf6;
    color: #ffffff;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
  }

  .wiki-layout-grid {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 16px;
    align-items: flex-start;
  }

  @media (max-width: 860px) {
    .wiki-layout-grid {
      grid-template-columns: 1fr;
    }
  }

  .wiki-sidebar {
    background: rgba(19, 18, 31, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .wiki-search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 6px 10px;
    color: #94a3b8;
  }

  .wiki-search-in {
    background: transparent;
    border: none;
    outline: none;
    color: #f8fafc;
    font-size: 0.8rem;
    width: 100%;
  }

  .wiki-cat-pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .cat-chip {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 12px;
    cursor: pointer;
  }
  .cat-chip.active {
    background: rgba(139, 92, 246, 0.2);
    border-color: #8b5cf6;
    color: #c4b5fd;
  }

  .wiki-pages-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .wiki-page-nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 8px 10px;
    color: #94a3b8;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .wiki-page-nav-item:hover {
    background: rgba(255, 255, 255, 0.04);
    color: #f1f5f9;
  }
  .wiki-page-nav-item.active {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.3);
    color: #c4b5fd;
    font-weight: 600;
  }

  .nav-title {
    flex: 1;
  }

  .pin-icon {
    color: #f59e0b;
  }

  .cat-tag {
    font-size: 0.65rem;
    color: #64748b;
  }

  .wiki-content-card {
    background: rgba(19, 18, 31, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 24px;
    min-height: 400px;
  }

  .article-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding-bottom: 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 20px;
  }

  .article-cat-badge {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #a78bfa;
    margin-bottom: 6px;
    display: inline-block;
  }

  .article-title {
    font-size: 1.4rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0 0 8px;
  }

  .article-meta-row {
    display: flex;
    gap: 14px;
    font-size: 0.75rem;
    color: #64748b;
  }

  .article-actions {
    display: flex;
    gap: 8px;
  }

  .btn-tool {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 0.75rem;
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
  }
  .btn-tool.delete {
    color: #f87171;
  }

  .article-markdown-pre {
    color: #cbd5e1;
    font-size: 0.9rem;
    line-height: 1.6;
    white-space: pre-wrap;
    font-family: inherit;
    margin: 0;
  }

  .empty-article {
    text-align: center;
    padding: 80px 20px;
    color: #64748b;
  }

  /* Modals */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    padding: 16px;
  }
  .modal-card {
    background: #181628;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    width: 100%;
    max-width: 680px;
    padding: 24px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .modal-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }
  .btn-close-modal {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }
  .form-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .form-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
  }
  .form-input, .form-textarea {
    background: #11101d;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f8fafc;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.85rem;
  }
  .font-mono { font-family: monospace; }
  .form-check-group {
    margin-top: 8px;
  }
  .check-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: #cbd5e1;
    cursor: pointer;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 18px;
  }
  .btn-cancel {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
  }
  .btn-submit {
    background: #8b5cf6;
    border: none;
    color: #ffffff;
    font-weight: 600;
    padding: 8px 18px;
    border-radius: 8px;
    cursor: pointer;
  }
</style>
