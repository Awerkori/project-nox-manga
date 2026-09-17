<script lang="ts">
  import {
    GraduationCap,
    BookOpen,
    Search,
    Plus,
    Tag,
    Edit3,
    Trash2,
    CheckCircle2,
    Lightbulb,
    HelpCircle,
    ExternalLink,
    ChevronRight,
    Sparkles,
    FileText,
    Layers,
    Download,
    X,
    Bold,
    Italic,
    Heading,
    List,
    CheckSquare,
    Link,
    Minus,
    UploadCloud,
    Paperclip,
    AlertTriangle,
    Eye,
    Archive
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  let {
    tutorials = [],
    attachments = [],
    positions = [],
    isOwnerOrAdmin = false,
    scanName = 'Project Nox',
    currentScanId = ''
  } = $props();

  let selectedCategory = $state<string>('ALL');
  let searchQuery = $state('');
  let activeTutorial = $state<any>(tutorials[0] || null);

  // Modals state
  let showCreateModal = $state(false);
  let deleteTutorialModal = $state<any>(null);
  let editTutorialId = $state<string | null>(null);
  let tutorialTitle = $state('');
  let tutorialCategory = $state('Traduo');
  let tutorialContent = $state('');
  let tutorialStatus = $state<'PUBLISHED' | 'DRAFT' | 'ARCHIVED'>('PUBLISHED');
  let tutorialPositionId = $state('');
  let editorTextarea = $state<HTMLTextAreaElement | null>(null);

  // Attachments upload state
  let isUploadingAttachment = $state(false);
  let isDraggingFile = $state(false);
  let uploadError = $state('');

  const CATEGORIES = [
    'Traduo',
    'Reviso',
    'Clean / Redraw',
    'Typeset',
    'QC',
    'Upload',
    'Ferramentas',
    'Regras'
  ];

  let filteredTutorials = $derived(
    tutorials.filter((t: any) => {
      if (selectedCategory !== 'ALL' && t.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.content.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
        );
      }
      return true;
    })
  );

  let activeAttachments = $derived(
    attachments.filter((a: any) => a.contextType === 'TUTORIAL' && a.contextId === activeTutorial?.id)
  );

  function openCreate() {
    editTutorialId = null;
    tutorialTitle = '';
    tutorialCategory = 'Traduo';
    tutorialContent = '';
    tutorialStatus = 'PUBLISHED';
    tutorialPositionId = '';
    showCreateModal = true;
  }

  function openEdit(tut: any) {
    editTutorialId = tut.id;
    tutorialTitle = tut.title;
    tutorialCategory = tut.category;
    tutorialContent = tut.content;
    tutorialStatus = tut.status || (tut.isPublished === false ? 'DRAFT' : 'PUBLISHED');
    tutorialPositionId = tut.targetPositionId || '';
    showCreateModal = true;
  }

  function insertFormat(prefix: string, suffix: string = '', defaultText: string = 'texto') {
    if (!editorTextarea) {
      tutorialContent += `${prefix}${defaultText}${suffix}`;
      return;
    }
    const start = editorTextarea.selectionStart;
    const end = editorTextarea.selectionEnd;
    const selected = tutorialContent.substring(start, end) || defaultText;
    tutorialContent =
      tutorialContent.substring(0, start) +
      prefix +
      selected +
      suffix +
      tutorialContent.substring(end);
    setTimeout(() => {
      if (editorTextarea) {
        editorTextarea.focus();
        editorTextarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
      }
    }, 10);
  }

  async function handleTutorialFileUpload(file: File) {
    if (!activeTutorial?.id || !currentScanId) return;
    isUploadingAttachment = true;
    uploadError = '';
    try {
      const formData = new FormData();
      formData.append('scan_id', currentScanId);
      formData.append('context_type', 'TUTORIAL');
      formData.append('context_id', activeTutorial.id);
      formData.append('file', file);

      const res = await fetch('/api/scan/attachments/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Falha no envio do anexo');
      await invalidateAll();
    } catch (err: any) {
      uploadError = (err as any).message || 'Erro ao enviar anexo';
    } finally {
      isUploadingAttachment = false;
    }
  }

  function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      handleTutorialFileUpload(files[i]);
    }
    input.value = '';
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDraggingFile = true;
  }

  function handleDragLeave() {
    isDraggingFile = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDraggingFile = false;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      handleTutorialFileUpload(files[i]);
    }
  }

  function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function parseMarkdownBlocks(raw: string): Array<{ type: string; content: string; items?: string[] }> {
    if (!raw) return [];
    const normalized = raw
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n');
    const rawBlocks = normalized.split(/\n\s*\n/);
    const result: Array<{ type: string; content: string; items?: string[] }> = [];

    for (const block of rawBlocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('# ')) {
        result.push({ type: 'h1', content: trimmed.replace(/^#\s+/, '') });
      } else if (trimmed.startsWith('## ')) {
        result.push({ type: 'h2', content: trimmed.replace(/^##\s+/, '') });
      } else if (trimmed.startsWith('### ')) {
        result.push({ type: 'h3', content: trimmed.replace(/^###\s+/, '') });
      } else if (trimmed.startsWith('> ')) {
        result.push({ type: 'callout', content: trimmed.replace(/^>\s+/, '') });
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const lines = trimmed.split('\n');
        const items = lines
          .map(l => l.replace(/^[-*]\s+/, '').trim())
          .filter(Boolean);
        result.push({ type: 'ul', content: '', items });
      } else {
        result.push({ type: 'p', content: trimmed });
      }
    }
    return result;
  }

  function formatInline(text: string): string {
    if (!text) return '';
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="doc-link">$1</a>');
  }
</script>

<div class="academia-module-root">
  <!-- Header Bar -->
  <header class="academia-header-bar">
    <div class="header-titles">
      <div class="header-badge">
        <GraduationCap size={16} />
        <span>ACADEMIA & TUTORIAIS</span>
      </div>
      <h2 class="title">Treinamentos e Guias Oficiais da {scanName}</h2>
      <p class="subtitle">Manuais tcnicos, templates, fontes e padres de qualidade para os membros da equipe.</p>
    </div>

    {#if isOwnerOrAdmin}
      <div class="header-actions">
        <button type="button" class="btn-primary" onclick={openCreate}>
          <Plus size={15} />
          <span>Novo Tutorial</span>
        </button>
      </div>
    {/if}
  </header>

  <!-- Filter Pills Strip -->
  <div class="category-pills-bar">
    <button
      type="button"
      class="cat-pill"
      class:active={selectedCategory === 'ALL'}
      onclick={() => (selectedCategory = 'ALL')}
    >
      Todos ({tutorials.length})
    </button>
    {#each CATEGORIES as cat}
      <button
        type="button"
        class="cat-pill"
        class:active={selectedCategory === cat}
        onclick={() => (selectedCategory = cat)}
      >
        {cat}
      </button>
    {/each}
  </div>

  <!-- Main Grid: Left Guides List, Right Guide Content -->
  <div class="academia-content-grid">
    <!-- Left Sidebar: Tutorials Navigation -->
    <aside class="guides-nav-card">
      <div class="guides-search-wrap">
        <Search size={14} class="search-icon" />
        <input
          type="text"
          class="guides-search-input"
          placeholder="Buscar tutoriais..."
          bind:value={searchQuery}
        />
      </div>

      <div class="guides-list-scroll">
        {#if filteredTutorials.length === 0}
          <p class="empty-guides-txt">Nenhum tutorial encontrado para este filtro.</p>
        {:else}
          {#each filteredTutorials as tut (tut.id)}
            <button
              type="button"
              class="guide-nav-item"
              class:active={activeTutorial?.id === tut.id}
              onclick={() => (activeTutorial = tut)}
            >
              <div class="guide-item-meta">
                <span class="guide-cat-tag">{tut.category}</span>
                {#if tut.status === 'DRAFT'}
                  <span class="status-badge draft">Rascunho</span>
                {:else if tut.status === 'ARCHIVED'}
                  <span class="status-badge archived">Arquivado</span>
                {/if}

                {#if isOwnerOrAdmin}
                  <div class="guide-nav-actions" onclick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      class="btn-icon-tiny"
                      title="Editar tutorial"
                      onclick={() => openEdit(tut)}
                    >
                      <Edit3 size={11} />
                    </button>
                    <button
                      type="button"
                      class="btn-icon-tiny delete"
                      title="Excluir tutorial"
                      onclick={() => (deleteTutorialModal = tut)}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                {/if}
              </div>
              <h4 class="guide-item-title">{tut.title}</h4>
            </button>
          {/each}
        {/if}
      </div>
    </aside>

    <!-- Right: Guide Reader View -->
    <main class="guide-reader-view">
      {#if !activeTutorial}
        <div class="empty-reader-state">
          <BookOpen size={40} class="empty-icon" />
          <p class="empty-title">Selecione um guia na lista ao lado</p>
          <p class="empty-sub">Tutoriais detalhados ajudam a equipe a manter padres de excelncia na produo.</p>
        </div>
      {:else}
        <article class="guide-article-card">
          <header class="guide-article-header">
            <div class="guide-header-top">
              <div class="guide-tags-row">
                <span class="guide-badge-pill">{activeTutorial.category}</span>
                {#if activeTutorial.status === 'DRAFT'}
                  <span class="status-badge-lg draft">Rascunho</span>
                {:else if activeTutorial.status === 'ARCHIVED'}
                  <span class="status-badge-lg archived">Arquivado</span>
                {:else}
                  <span class="status-badge-lg published">Publicado</span>
                {/if}
              </div>

              <div class="guide-actions-right">
                <span class="guide-date">
                  Atualizado em {new Date(activeTutorial.updatedAt || activeTutorial.createdAt).toLocaleDateString('pt-BR')}
                </span>

                {#if isOwnerOrAdmin}
                  <div class="article-ctrl-buttons">
                    <button
                      type="button"
                      class="btn-secondary sm"
                      onclick={() => openEdit(activeTutorial)}
                    >
                      <Edit3 size={13} />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      class="btn-danger-xs"
                      onclick={() => (deleteTutorialModal = activeTutorial)}
                    >
                      <Trash2 size={13} />
                      <span>Excluir</span>
                    </button>
                  </div>
                {/if}
              </div>
            </div>
            <h1 class="guide-main-heading">{activeTutorial.title}</h1>
          </header>

          <div class="guide-markdown-body">
            {#each parseMarkdownBlocks(activeTutorial.content) as block}
              {#if block.type === 'h1' || block.type === 'h2'}
                <h2 class="md-h2">{@html formatInline(block.content)}</h2>
              {:else if block.type === 'h3'}
                <h3 class="md-h3">{@html formatInline(block.content)}</h3>
              {:else if block.type === 'ul'}
                <ul class="md-ul">
                  {#each block.items || [] as item}
                    <li class="md-li">{@html formatInline(item)}</li>
                  {/each}
                </ul>
              {:else if block.type === 'callout'}
                <blockquote class="md-callout">
                  <Lightbulb size={16} class="callout-icon" />
                  <div>{@html formatInline(block.content)}</div>
                </blockquote>
              {:else}
                <p class="md-p">{@html formatInline(block.content)}</p>
              {/if}
            {/each}
          </div>

          <!-- Technical Resources & Attachments Section -->
          <div class="tutorial-resources-section">
            <div class="resources-section-header">
              <div class="header-cluster">
                <Download size={16} class="text-indigo-400" />
                <h4 class="resources-section-title">Anexos & Arquivos Tcnicos do Treinamento</h4>
              </div>
              <span class="resources-badge">{activeAttachments.length} {activeAttachments.length === 1 ? 'Arquivo' : 'Arquivos'}</span>
            </div>
            <p class="resources-section-desc">Arquivos padro de produo vinculados a esta norma tcnica (PDF, GIF, ZIP, PSD, KRA, etc.) armazenados no pool privado da scan.</p>

            <!-- Attachments Dropzone (if leader/admin) -->
            {#if isOwnerOrAdmin}
              <div
                class="attachment-dropzone"
                class:dragging={isDraggingFile}
                ondragover={handleDragOver}
                ondragleave={handleDragLeave}
                ondrop={handleDrop}
              >
                <UploadCloud size={24} class="dropzone-icon" />
                <div class="dropzone-text">
                  <span class="dropzone-title">Arraste arquivos aqui ou clique para selecionar</span>
                  <span class="dropzone-sub">Suporta PDF, PNG, GIF, ZIP, PSD, KRA (mx 50MB)</span>
                </div>
                <label class="btn-secondary sm cursor-pointer" class:disabled={isUploadingAttachment}>
                  <Paperclip size={13} />
                  <span>{isUploadingAttachment ? 'Enviando...' : 'Selecionar Arquivo'}</span>
                  <input
                    type="file"
                    class="hidden-file-input"
                    multiple
                    onchange={handleFileInputChange}
                    disabled={isUploadingAttachment}
                  />
                </label>
              </div>

              {#if uploadError}
                <span class="upload-err-msg">{uploadError}</span>
              {/if}
            {/if}

            <!-- Real Attachments Grid -->
            <div class="resources-files-grid">
              {#if activeAttachments.length === 0}
                <div class="empty-attachments-box">
                  <FileText size={28} />
                  <p>Nenhum anexo adicionado a este tutorial.</p>
                </div>
              {:else}
                {#each activeAttachments as att (att.id)}
                  <div class="resource-file-card">
                    <div class="file-icon-box">
                      <FileText size={16} />
                    </div>
                    <div class="file-info truncate">
                      <span class="file-name truncate" title={att.originalFilename}>{att.originalFilename}</span>
                      <span class="file-size">{formatBytes(att.size)} • {att.mimeType?.split('/')[1]?.toUpperCase() || 'ARQUIVO'}</span>
                    </div>
                    <a
                      href="/api/scan/attachments/{att.id}?download=1"
                      class="btn-download-sm"
                      title="Baixar {att.originalFilename}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download size={12} />
                      <span>Baixar</span>
                    </a>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        </article>
      {/if}
    </main>
  </div>
</div>

<!-- Modal: Criar / Editar Tutorial -->
{#if showCreateModal}
  <div class="modal-backdrop" onclick={() => (showCreateModal = false)}>
    <div class="modal-card-lg" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3 class="modal-title">{editTutorialId ? 'Editar Tutorial' : 'Novo Guia de Treinamento'}</h3>
        <button type="button" class="btn-icon-xs" onclick={() => (showCreateModal = false)}>
          <X size={16} />
        </button>
      </div>

      <form
        method="POST"
        action="?/saveAcademyTutorial"
        use:enhance={() => {
          return async ({ update }) => {
            showCreateModal = false;
            await update();
          };
        }}
        class="modal-body-form"
      >
        <input type="hidden" name="scan_id" value={currentScanId} />
        {#if editTutorialId}
          <input type="hidden" name="tutorialId" value={editTutorialId} />
        {/if}

        <div class="form-row-3">
          <div class="form-group flex-2">
            <label for="tut-title" class="form-label">Ttulo do Guia *</label>
            <input
              id="tut-title"
              type="text"
              name="title"
              required
              class="form-input"
              placeholder="ex: Padro de Letreiramento de Bales"
              bind:value={tutorialTitle}
            />
          </div>

          <div class="form-group">
            <label for="tut-cat" class="form-label">Categoria *</label>
            <select id="tut-cat" name="category" class="form-select" bind:value={tutorialCategory}>
              {#each CATEGORIES as cat}
                <option value={cat}>{cat}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="tut-status" class="form-label">Status</label>
            <select id="tut-status" name="status" class="form-select" bind:value={tutorialStatus}>
              <option value="PUBLISHED">Publicado</option>
              <option value="DRAFT">Rascunho</option>
              <option value="ARCHIVED">Arquivado</option>
            </select>
          </div>
        </div>

        {#if positions.length > 0}
          <div class="form-group">
            <label for="tut-pos" class="form-label">Cargo Recomendado (Opcional)</label>
            <select id="tut-pos" name="target_position_id" class="form-select" bind:value={tutorialPositionId}>
              <option value="">Geral (Todos os membros)</option>
              {#each positions as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- Visual Editor Formatting Toolbar -->
        <div class="editor-toolbar-row">
          <button type="button" class="btn-tool-icon" title="Negrito (**texto**)" onclick={() => insertFormat('**', '**', 'negrito')}>
            <Bold size={14} />
          </button>
          <button type="button" class="btn-tool-icon" title="Itlico (*texto*)" onclick={() => insertFormat('*', '*', 'itlico')}>
            <Italic size={14} />
          </button>
          <button type="button" class="btn-tool-icon" title="Ttulo H2" onclick={() => insertFormat('\n## ', '\n', 'Ttulo da Seo')}>
            <Heading size={14} />
          </button>
          <button type="button" class="btn-tool-icon" title="Lista (- item)" onclick={() => insertFormat('\n- ', '\n', 'Item da lista')}>
            <List size={14} />
          </button>
          <button type="button" class="btn-tool-icon" title="Checklist (- [ ] item)" onclick={() => insertFormat('\n- [ ] ', '\n', 'Item de verificao')}>
            <CheckSquare size={14} />
          </button>
          <button type="button" class="btn-tool-icon" title="Aviso / Callout (> aviso)" onclick={() => insertFormat('\n> 💡 ', '\n', 'Dica importante')}>
            <Lightbulb size={14} />
          </button>
          <button type="button" class="btn-tool-icon" title="Link ([texto](url))" onclick={() => insertFormat('[', '](https://...)', 'Nome do link')}>
            <Link size={14} />
          </button>
          <button type="button" class="btn-tool-icon" title="Divisor (---)" onclick={() => insertFormat('\n---\n', '')}>
            <Minus size={14} />
          </button>
        </div>

        <div class="form-group">
          <label for="tut-content" class="form-label">Contedo do Guia (Markdown / Instrues) *</label>
          <textarea
            id="tut-content"
            bind:this={editorTextarea}
            name="content"
            rows="12"
            required
            class="form-textarea code-font"
            placeholder="# Introduo&#10;&#10;Instrues detalhadas passo a passo...&#10;&#10;### Checklist de Qualidade&#10;- [ ] Bales limpos&#10;- [ ] Tipografia alinhada"
            bind:value={tutorialContent}
          ></textarea>
        </div>

        <div class="modal-footer-actions">
          <button type="button" class="btn-secondary" onclick={() => (showCreateModal = false)}>
            Cancelar
          </button>
          <button type="submit" class="btn-primary" disabled={!tutorialTitle.trim() || !tutorialContent.trim()}>
            {editTutorialId ? 'Salvar Alteraes' : 'Publicar Guia'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal: Excluir Tutorial Confirmao -->
{#if deleteTutorialModal}
  <div class="modal-backdrop" onclick={() => (deleteTutorialModal = null)}>
    <div class="modal-card mini-reject-modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3 class="modal-title text-danger">Excluir Tutorial</h3>
        <button type="button" class="btn-close-modal" onclick={() => (deleteTutorialModal = null)}>
          <X size={16} />
        </button>
      </div>

      <form
        method="POST"
        action="?/deleteAcademyTutorial"
        use:enhance={() => {
          return async ({ update }) => {
            deleteTutorialModal = null;
            await update();
          };
        }}
        class="modal-form"
      >
        <input type="hidden" name="tutorial_id" value={deleteTutorialModal.id} />
        <input type="hidden" name="scan_id" value={currentScanId} />

        <div class="warning-alert-box">
          <AlertTriangle size={20} class="flex-shrink-0" />
          <p>Tem certeza de que deseja excluir o tutorial <strong>{deleteTutorialModal.title}</strong>? Todos os arquivos e anexos vinculados a este guia sero excludos permanentemente.</p>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick={() => (deleteTutorialModal = null)}>
            Cancelar
          </button>
          <button type="submit" class="btn-danger-confirm">
            Excluir Definitivamente
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .academia-module-root {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .academia-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.2rem 0.6rem;
    background: rgba(99, 102, 241, 0.12);
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 700;
    color: #818cf8;
    margin-bottom: 0.35rem;
  }

  .title {
    font-size: 1.35rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }

  .subtitle {
    font-size: 0.8125rem;
    color: #94a3b8;
    margin: 0.2rem 0 0 0;
  }

  /* Category pills */
  .category-pills-bar {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.35rem;
  }

  .cat-pill {
    padding: 0.35rem 0.85rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    color: #94a3b8;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .cat-pill:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f1f5f9;
  }

  .cat-pill.active {
    background: rgba(99, 102, 241, 0.15);
    border-color: #6366f1;
    color: #818cf8;
    font-weight: 600;
  }

  /* Content Grid */
  .academia-content-grid {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 1.25rem;
    align-items: start;
    min-width: 0;
  }

  @media (max-width: 900px) {
    .academia-content-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Left nav */
  .guides-nav-card {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.75rem;
    padding: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 750px;
    min-width: 0;
  }

  .guides-search-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    padding: 0.45rem 0.65rem;
  }

  .guides-search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #f1f5f9;
    font-size: 0.8125rem;
  }

  .guides-list-scroll {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    overflow-y: auto;
  }

  .guide-nav-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.65rem 0.75rem;
    border-radius: 0.5rem;
    background: transparent;
    border: 1px solid transparent;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .guide-nav-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .guide-nav-item.active {
    background: rgba(99, 102, 241, 0.1);
    border-color: rgba(99, 102, 241, 0.3);
  }

  .guide-item-meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .guide-cat-tag {
    font-size: 0.6875rem;
    font-weight: 600;
    color: #818cf8;
    text-transform: uppercase;
  }

  .guide-nav-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .guide-item-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
    line-height: 1.3;
  }

  /* Status badges */
  .status-badge {
    font-size: 0.625rem;
    font-weight: 700;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .status-badge.draft {
    background: rgba(245, 158, 11, 0.15);
    color: #fcd34d;
  }

  .status-badge.archived {
    background: rgba(148, 163, 184, 0.15);
    color: #94a3b8;
  }

  .status-badge-lg {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    text-transform: uppercase;
  }

  .status-badge-lg.published {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }

  .status-badge-lg.draft {
    background: rgba(245, 158, 11, 0.15);
    color: #fcd34d;
  }

  .status-badge-lg.archived {
    background: rgba(148, 163, 184, 0.15);
    color: #94a3b8;
  }

  /* Right Guide Reader */
  .guide-reader-view {
    min-width: 0;
  }

  .empty-reader-state {
    background: #0f172a;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 0.75rem;
    padding: 3rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
  }

  .empty-icon {
    color: #64748b;
  }

  .empty-title {
    font-size: 1rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
  }

  .empty-sub {
    font-size: 0.8125rem;
    color: #94a3b8;
    margin: 0;
    max-width: 420px;
  }

  .guide-article-card {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.75rem;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    min-width: 0;
  }

  .guide-article-header {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .guide-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .guide-tags-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .guide-badge-pill {
    padding: 0.2rem 0.5rem;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #818cf8;
  }

  .guide-actions-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .guide-date {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .article-ctrl-buttons {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .guide-main-heading {
    font-size: 1.5rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    line-height: 1.3;
  }

  /* Markdown body */
  .guide-markdown-body {
    font-size: 0.9375rem;
    line-height: 1.65;
    color: #cbd5e1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    word-break: break-word;
  }

  .md-h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0.5rem 0 0 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-bottom: 0.35rem;
  }

  .md-h3 {
    font-size: 1.05rem;
    font-weight: 600;
    color: #e2e8f0;
    margin: 0.25rem 0 0 0;
  }

  .md-p {
    margin: 0;
  }

  .md-ul {
    margin: 0;
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .md-callout {
    display: flex;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: rgba(99, 102, 241, 0.08);
    border-left: 3px solid #6366f1;
    border-radius: 0.375rem;
    color: #e2e8f0;
    margin: 0;
  }

  .callout-icon {
    color: #818cf8;
    flex-shrink: 0;
    margin-top: 0.2rem;
  }

  :global(.doc-link) {
    color: #818cf8;
    text-decoration: underline;
  }

  /* Resources & Attachments */
  .tutorial-resources-section {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.75rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .resources-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .header-cluster {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .resources-section-title {
    font-size: 0.9375rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }

  .resources-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 9999px;
    color: #cbd5e1;
  }

  .resources-section-desc {
    font-size: 0.8125rem;
    color: #94a3b8;
    margin: 0;
  }

  /* Dropzone */
  .attachment-dropzone {
    border: 2px dashed rgba(255, 255, 255, 0.15);
    border-radius: 0.5rem;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    background: rgba(255, 255, 255, 0.02);
    transition: all 0.2s;
    flex-wrap: wrap;
  }

  .attachment-dropzone.dragging {
    border-color: #6366f1;
    background: rgba(99, 102, 241, 0.08);
  }

  .dropzone-icon {
    color: #818cf8;
    flex-shrink: 0;
  }

  .dropzone-text {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
    min-width: 200px;
  }

  .dropzone-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .dropzone-sub {
    font-size: 0.6875rem;
    color: #94a3b8;
  }

  .resources-files-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    gap: 0.75rem;
  }

  .empty-attachments-box {
    grid-column: 1 / -1;
    padding: 1.5rem;
    text-align: center;
    color: #64748b;
    font-size: 0.8125rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }

  .resource-file-card {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.5rem;
    padding: 0.65rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
  }

  .file-icon-box {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: rgba(99, 102, 241, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #818cf8;
    flex-shrink: 0;
  }

  .file-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
    min-width: 0;
  }

  .file-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .file-size {
    font-size: 0.6875rem;
    color: #94a3b8;
  }

  .btn-download-sm {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.65rem;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 6px;
    color: #a5b4fc;
    font-size: 0.75rem;
    font-weight: 600;
    text-decoration: none;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .btn-download-sm:hover {
    background: #4f46e5;
    color: #ffffff;
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
    z-index: 1000;
    padding: 1rem;
  }

  .modal-card-lg {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.75rem;
    width: 100%;
    max-width: 720px;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .modal-body-form {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-row-3 {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 0.75rem;
  }

  @media (max-width: 640px) {
    .form-row-3 {
      grid-template-columns: 1fr;
    }
  }

  .editor-toolbar-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.35rem;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.375rem;
    flex-wrap: wrap;
  }

  .btn-tool-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-tool-icon:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .code-font {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.8125rem;
    line-height: 1.5;
  }

  .modal-footer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  /* Form elements */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #cbd5e1;
  }

  .form-input,
  .form-select,
  .form-textarea {
    width: 100%;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.5rem;
    padding: 0.6rem 0.75rem;
    color: #f1f5f9;
    font-size: 0.875rem;
    box-sizing: border-box;
    outline: none;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    border-color: #6366f1;
  }

  /* Buttons */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: #4f46e5;
    border: none;
    border-radius: 0.5rem;
    color: #ffffff;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-primary:hover:not(:disabled) {
    background: #4338ca;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.5rem;
    color: #f1f5f9;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-secondary.sm {
    padding: 0.35rem 0.75rem;
    font-size: 0.75rem;
  }

  .btn-icon-tiny {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-icon-tiny:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #f1f5f9;
  }

  .btn-icon-tiny.delete:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .btn-danger-xs {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.65rem;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 6px;
    color: #f87171;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-danger-xs:hover {
    background: rgba(239, 68, 68, 0.22);
  }

  .btn-danger-confirm {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: #dc2626;
    border: none;
    border-radius: 0.5rem;
    color: #ffffff;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-danger-confirm:hover {
    background: #b91c1c;
  }

  .warning-alert-box {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    padding: 1rem;
    border-radius: 0.5rem;
    color: #fca5a5;
    font-size: 0.8125rem;
    line-height: 1.4;
  }

  .mini-reject-modal {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.75rem;
    width: 100%;
    max-width: 480px;
  }

  .modal-form {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .text-danger {
    color: #ef4444;
  }

  .cursor-pointer {
    cursor: pointer;
  }

  .hidden-file-input {
    display: none;
  }

  .upload-err-msg {
    font-size: 0.75rem;
    color: #f87171;
  }

  .truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
