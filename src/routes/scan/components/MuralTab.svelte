<script lang="ts">
  import {
    Pin,
    Plus,
    X,
    FileText,
    Image,
    Download,
    Eye,
    Upload,
    MessageCircle,
    ThumbsUp,
    Heart,
    Flame,
    Sparkles,
    Trash2,
    Send,
    CornerDownRight,
    AlertCircle,
    CheckCircle2
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import { relativeTime } from '$lib/types';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let {
    scanId,
    userProfile,
    userRole = 'MEMBER',
    muralPosts = [],
    positions = [],
    team = []
  } = $props();

  let filterType = $state<'ALL' | 'AVISO' | 'IMPORTANTE' | 'PRODUCAO' | 'ATUALIZACAO' | 'GERAL'>('ALL');
  let filteredPosts = $derived(
    filterType === 'ALL'
      ? muralPosts
      : muralPosts.filter((p: any) => (p.post_type || 'GERAL') === filterType)
  );

  // New Post Modal State
  let showCreateModal = $state(false);
  let postTitle = $state('');
  let postContent = $state('');
  let postType = $state<'GERAL' | 'AVISO' | 'IMPORTANTE' | 'PRODUCAO' | 'ATUALIZACAO'>('GERAL');
  let postPinned = $state(false);
  let isSubmitting = $state(false);

  // File Upload State in Modal
  let uploadedFiles = $state<Array<{ name: string; size: number; type: string; file: File; progress: number; status: 'ready' | 'uploading' | 'done' | 'error' }>>([]);
  let isDragging = $state(false);

  // Active Comment Input per Post
  let activeReplyPostId = $state<string | null>(null);
  let replyContent = $state('');
  let isSubmittingReply = $state(false);

  // Image Lightbox Preview
  let lightboxUrl = $state<string | null>(null);

  // Autocomplete popup
  let showMentionMenu = $state(false);
  let mentionQuery = $state('');
  let mentionTargetField = $state<'post' | 'comment'>('post');

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      addFiles(Array.from(target.files));
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
    if (event.dataTransfer?.files) {
      addFiles(Array.from(event.dataTransfer.files));
    }
  }

  function addFiles(files: File[]) {
    const BLOCKED_EXTENSIONS = ['.exe', '.apk', '.bat', '.cmd', '.sh', '.bin', '.dll', '.msi'];
    for (const f of files) {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        alert(`Arquivo "${f.name}" bloqueado: executáveis não são permitidos por segurança.`);
        continue;
      }
      uploadedFiles.push({
        name: f.name,
        size: f.size,
        type: f.type,
        file: f,
        progress: 100,
        status: 'ready'
      });
    }
  }

  function removeFile(index: number) {
    uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Quick mention insertion
  function insertMention(token: string) {
    if (mentionTargetField === 'post') {
      postContent += ` @${token} `;
    } else {
      replyContent += ` @${token} `;
    }
    showMentionMenu = false;
  }
</script>

<div class="mural-container">
  <!-- Top Bar: Title, Filters & New Post Action -->
  <header class="mural-header">
    <div class="header-left">
      <div class="title-cluster">
        <Pin size={20} class="text-rose-400" />
        <h1>Mural de Avisos & Produção</h1>
      </div>
      <p class="subtitle">Comunicação assíncrona, diretrizes oficiais, atualizações e modelos com arquivos anexos.</p>
    </div>

    <div class="header-right">
      <button type="button" class="btn-create-post" onclick={() => (showCreateModal = true)}>
        <Plus size={16} />
        <span>Novo Post no Mural</span>
      </button>
    </div>
  </header>

  <!-- Filter Pills Bar -->
  <div class="mural-filters-bar">
    <button
      type="button"
      class="filter-pill"
      class:active={filterType === 'ALL'}
      onclick={() => (filterType = 'ALL')}
    >
      Todos ({muralPosts.length})
    </button>
    <button
      type="button"
      class="filter-pill"
      class:active={filterType === 'IMPORTANTE'}
      onclick={() => (filterType = 'IMPORTANTE')}
    >
      🚨 Importante
    </button>
    <button
      type="button"
      class="filter-pill"
      class:active={filterType === 'AVISO'}
      onclick={() => (filterType = 'AVISO')}
    >
      📢 Avisos
    </button>
    <button
      type="button"
      class="filter-pill"
      class:active={filterType === 'PRODUCAO'}
      onclick={() => (filterType = 'PRODUCAO')}
    >
      ⚙️ Produção
    </button>
    <button
      type="button"
      class="filter-pill"
      class:active={filterType === 'ATUALIZACAO'}
      onclick={() => (filterType = 'ATUALIZACAO')}
    >
      ✨ Atualizações
    </button>
    <button
      type="button"
      class="filter-pill"
      class:active={filterType === 'GERAL'}
      onclick={() => (filterType = 'GERAL')}
    >
      💬 Geral
    </button>
  </div>

  <!-- Posts Feed List -->
  <div class="posts-feed">
    {#if filteredPosts.length > 0}
      {#each filteredPosts as post (post.id)}
        <article class="mural-post-card" class:is-pinned={post.is_pinned}>
          <!-- Post Card Header -->
          <header class="post-card-header">
            <div class="author-lockup">
              <UserAvatar
                avatarId={post.author?.avatar_id}
                displayName={post.author?.display_name}
                size={36}
              />
              <div class="author-meta">
                <span class="author-name">{post.author?.display_name || 'Membro da Staff'}</span>
                <span class="post-timestamp">{relativeTime(post.created_at)}</span>
              </div>
            </div>

            <div class="post-badge-group">
              {#if post.is_pinned}
                <span class="pinned-indicator-pill">
                  <Pin size={11} />
                  <span>FIXADO</span>
                </span>
              {/if}
              <span class="type-pill {post.post_type?.toLowerCase() || 'geral'}">
                {post.post_type || 'GERAL'}
              </span>

              {#if ['OWNER', 'ADMIN'].includes(userRole)}
                <form method="POST" action="?/togglePinMuralPost" use:enhance>
                  <input type="hidden" name="post_id" value={post.id} />
                  <input type="hidden" name="scan_id" value={scanId} />
                  <button
                    type="submit"
                    class="btn-icon-action"
                    title={post.is_pinned ? 'Desafixar post' : 'Fixar no topo'}
                  >
                    <Pin size={14} class={post.is_pinned ? 'text-amber-400' : ''} />
                  </button>
                </form>
              {/if}

              {#if post.author_id === userProfile?.id || ['OWNER', 'ADMIN'].includes(userRole)}
                <form method="POST" action="?/deleteMuralPost" use:enhance>
                  <input type="hidden" name="post_id" value={post.id} />
                  <input type="hidden" name="scan_id" value={scanId} />
                  <button
                    type="submit"
                    class="btn-icon-action danger"
                    title="Excluir post"
                    onclick={(e) => {
                      if (!confirm('Deseja realmente excluir este post do mural?')) e.preventDefault();
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </form>
              {/if}
            </div>
          </header>

          <!-- Post Content -->
          <div class="post-body">
            <h2 class="post-title">{post.title}</h2>
            <div class="post-text-content">
              {post.content}
            </div>
          </div>

          <!-- Attachments Section (Images & Documents) -->
          {#if post.scan_attachments && post.scan_attachments.length > 0}
            <div class="post-attachments-cluster">
              <div class="attachments-label">
                <span>ARQUIVOS ANEXADOS ({post.scan_attachments.length})</span>
              </div>

              <div class="attachments-grid">
                {#each post.scan_attachments as att}
                  {#if att.mime_type.startsWith('image/')}
                    <!-- Inline Image Attachment Preview -->
                    <div class="attachment-image-card">
                      <button
                        type="button"
                        class="img-preview-btn"
                        onclick={() => (lightboxUrl = `/api/scan/attachments/${att.id}`)}
                      >
                        <img
                          src="/media/{att.storage_reference || 'sample'}"
                          alt={att.original_filename}
                          class="preview-thumbnail"
                          onerror={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div class="img-overlay">
                          <Eye size={16} />
                          <span>Ampliar</span>
                        </div>
                      </button>
                      <div class="file-name-bar">
                        <span class="truncate">{att.original_filename}</span>
                        <span class="file-size">{formatBytes(att.size)}</span>
                      </div>
                    </div>
                  {:else}
                    <!-- File / Document / PDF Card -->
                    <div class="attachment-file-card">
                      <div class="file-icon-box">
                        <FileText size={20} class="text-purple-400" />
                      </div>
                      <div class="file-meta">
                        <span class="filename" title={att.original_filename}>{att.original_filename}</span>
                        <span class="filesize">{formatBytes(att.size)}</span>
                      </div>
                      <div class="file-actions">
                        <a
                          href="/api/scan/attachments/{att.id}?download=1"
                          class="btn-file-action"
                          download={att.original_filename}
                          title="Baixar arquivo"
                        >
                          <Download size={14} />
                          <span>Baixar</span>
                        </a>
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

          <!-- Post Footer: Reactions & Comments Bar -->
          <footer class="post-footer">
            <div class="reactions-cluster">
              <form method="POST" action="?/reactMuralPost" use:enhance class="reactions-form">
                <input type="hidden" name="post_id" value={post.id} />
                <input type="hidden" name="scan_id" value={scanId} />

                {#each ['👍', '❤️', '🎉', '🔥', '👀'] as emoji}
                  {@const rxCount = (post.scan_mural_reactions || []).filter((r: any) => r.emoji === emoji).length}
                  {@const userReacted = (post.scan_mural_reactions || []).some((r: any) => r.emoji === emoji && r.user_id === userProfile?.id)}
                  <button
                    type="submit"
                    name="emoji"
                    value={emoji}
                    class="btn-reaction"
                    class:active={userReacted}
                  >
                    <span>{emoji}</span>
                    {#if rxCount > 0}
                      <span class="rx-num">{rxCount}</span>
                    {/if}
                  </button>
                {/each}
              </form>
            </div>

            <button
              type="button"
              class="btn-toggle-comments"
              onclick={() => (activeReplyPostId = activeReplyPostId === post.id ? null : post.id)}
            >
              <MessageCircle size={15} />
              <span>{(post.scan_mural_comments || []).length} comentários</span>
            </button>
          </footer>

          <!-- Comments Feed & Input -->
          {#if activeReplyPostId === post.id || (post.scan_mural_comments && post.scan_mural_comments.length > 0)}
            <div class="comments-section">
              {#if post.scan_mural_comments && post.scan_mural_comments.length > 0}
                <div class="comments-list">
                  {#each post.scan_mural_comments as c}
                    <div class="comment-bubble">
                      <UserAvatar
                        avatarId={c.author?.avatar_id}
                        displayName={c.author?.display_name}
                        size={24}
                      />
                      <div class="comment-content-box">
                        <div class="comment-top">
                          <span class="comment-author">{c.author?.display_name || 'Membro'}</span>
                          <span class="comment-time">{relativeTime(c.created_at)}</span>
                        </div>
                        <p class="comment-text">{c.content}</p>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Comment Input Box -->
              <form method="POST" action="?/commentMuralPost" use:enhance class="comment-input-row">
                <input type="hidden" name="post_id" value={post.id} />
                <input type="hidden" name="scan_id" value={scanId} />
                <input
                  type="text"
                  name="content"
                  placeholder="Escreva um comentário ou mencione @..."
                  class="comment-input"
                  required
                />
                <button type="submit" class="btn-send-comment">
                  <Send size={14} />
                  <span>Comentar</span>
                </button>
              </form>
            </div>
          {/if}
        </article>
      {/each}
    {:else}
      <div class="empty-mural-state">
        <Pin size={36} class="text-rose-400" />
        <h3>Nenhum aviso encontrado no Mural</h3>
        <p>Utilize o botão acima para publicar diretrizes, comunicados oficiais ou padrões de produção com arquivos anexos.</p>
      </div>
    {/if}
  </div>
</div>

<!-- Lightbox Modal for Image Preview -->
{#if lightboxUrl}
  <div class="lightbox-overlay" onclick={() => (lightboxUrl = null)}>
    <div class="lightbox-content" onclick={(e) => e.stopPropagation()}>
      <button type="button" class="btn-close-lightbox" onclick={() => (lightboxUrl = null)}>
        <X size={20} />
      </button>
      <img src={lightboxUrl} alt="Preview" class="lightbox-img" />
    </div>
  </div>
{/if}

<!-- Create Mural Post Modal -->
{#if showCreateModal}
  <div class="modal-backdrop" onclick={() => (showCreateModal = false)}>
    <div class="modal-window" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <div class="modal-title-box">
          <Pin size={18} class="text-rose-400" />
          <h2>Novo Post no Mural</h2>
        </div>
        <button type="button" class="btn-close-modal" onclick={() => (showCreateModal = false)}>
          <X size={18} />
        </button>
      </header>

      <form method="POST" action="?/createMuralPost" use:enhance class="modal-form">
        <input type="hidden" name="scan_id" value={scanId} />

        <div class="form-group">
          <label for="post-title">Título do Aviso / Post *</label>
          <input
            id="post-title"
            type="text"
            name="title"
            bind:value={postTitle}
            placeholder="Ex: 📌 Novo Padrão de Revisão & Fontes para Cap. 85"
            class="form-input"
            required
          />
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label for="post-type">Categoria do Post</label>
            <select id="post-type" name="post_type" bind:value={postType} class="form-select">
              <option value="GERAL">💬 Geral</option>
              <option value="AVISO">📢 Aviso Oficial</option>
              <option value="IMPORTANTE">🚨 Importante & Prioritário</option>
              <option value="PRODUCAO">⚙️ Produção & Diretrizes</option>
              <option value="ATUALIZACAO">✨ Atualização de Projeto</option>
            </select>
          </div>

          {#if ['OWNER', 'ADMIN'].includes(userRole)}
            <div class="form-group pin-toggle-group">
              <label for="post-pinned" class="checkbox-label">
                <input id="post-pinned" type="checkbox" name="is_pinned" bind:checked={postPinned} value="true" />
                <span>Fixar este post no topo do Mural</span>
              </label>
            </div>
          {/if}
        </div>

        <div class="form-group">
          <label for="post-content">Conteúdo (Suporta Markdown e @Menções) *</label>
          <textarea
            id="post-content"
            name="content"
            bind:value={postContent}
            rows={5}
            placeholder="Descreva as instruções, orientações e mencione @Revisores ou membros da equipe..."
            class="form-textarea"
            required
          ></textarea>
        </div>

        <!-- File Upload Drag & Drop Area -->
        <div class="form-group">
          <label>Anexos (PDFs, Imagens, GIFs, ZIPs, Docs)</label>
          <div
            class="drag-drop-zone"
            class:is-dragging={isDragging}
            ondragover={(e) => { e.preventDefault(); isDragging = true; }}
            ondragleave={() => (isDragging = false)}
            ondrop={handleDrop}
          >
            <Upload size={24} class="text-purple-400" />
            <div class="drag-text">
              <span>Arraste e solte arquivos aqui, ou</span>
              <label class="btn-browse-files">
                <span>Selecionar arquivos</span>
                <input type="file" multiple onchange={handleFileSelect} class="hidden-file-input" />
              </label>
            </div>
            <span class="format-hints">Imagens, GIFs, PDFs, TXTs, ZIPs, PSDs (máx 50MB)</span>
          </div>

          <!-- Uploaded files list preview in modal -->
          {#if uploadedFiles.length > 0}
            <div class="files-preview-list">
              {#each uploadedFiles as f, i}
                <div class="file-chip">
                  <span class="file-name truncate">{f.name}</span>
                  <span class="file-bytes">({formatBytes(f.size)})</span>
                  <button type="button" class="btn-remove-chip" onclick={() => removeFile(i)}>
                    <X size={12} />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <footer class="modal-footer">
          <button type="button" class="btn-cancel" onclick={() => (showCreateModal = false)}>
            Cancelar
          </button>
          <button type="submit" class="btn-submit" disabled={isSubmitting || !postTitle.trim() || !postContent.trim()}>
            <span>Publicar no Mural</span>
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<style>
  .mural-container {
    padding: 24px;
    max-width: 1080px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Header */
  .mural-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .title-cluster {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .title-cluster h1 {
    font-size: 20px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .subtitle {
    font-size: 13px;
    color: #94a3b8;
    margin: 4px 0 0;
  }

  .btn-create-post {
    all: unset;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 16px;
    background: #8b5cf6;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25);
  }

  .btn-create-post:hover {
    background: #7c3aed;
  }

  /* Filters Bar */
  .mural-filters-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .filter-pill {
    all: unset;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    transition: all 0.12s;
    white-space: nowrap;
  }

  .filter-pill:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #f1f5f9;
  }

  .filter-pill.active {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
  }

  /* Post Card */
  .posts-feed {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .mural-post-card {
    background: #0d0a18;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    transition: border-color 0.15s;
  }

  .mural-post-card.is-pinned {
    border-color: rgba(223, 194, 141, 0.35);
    background: linear-gradient(180deg, rgba(223, 194, 141, 0.04) 0%, #0d0a18 100%);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .post-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .author-lockup {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .author-meta {
    display: flex;
    flex-direction: column;
  }

  .author-name {
    font-size: 13.5px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .post-timestamp {
    font-size: 11px;
    color: #64748b;
  }

  .post-badge-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pinned-indicator-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 800;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.3);
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }

  .type-pill {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .type-pill.geral { background: rgba(255, 255, 255, 0.06); color: #94a3b8; }
  .type-pill.aviso { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
  .type-pill.importante { background: rgba(239, 68, 68, 0.15); color: #f87171; font-weight: 800; }
  .type-pill.producao { background: rgba(139, 92, 246, 0.15); color: #c4b5fd; }
  .type-pill.atualizacao { background: rgba(16, 185, 129, 0.15); color: #34d399; }

  .btn-icon-action {
    all: unset;
    cursor: pointer;
    color: #64748b;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.12s;
  }

  .btn-icon-action:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.06);
  }

  .btn-icon-action.danger:hover {
    color: #f87171;
    background: rgba(239, 68, 68, 0.1);
  }

  /* Body */
  .post-title {
    font-size: 16px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0 0 8px;
    letter-spacing: -0.01em;
  }

  .post-text-content {
    font-size: 13.5px;
    color: #cbd5e1;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  /* Attachments */
  .post-attachments-cluster {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .attachments-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #64748b;
  }

  .attachments-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
  }

  .attachment-image-card {
    background: #090712;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    overflow: hidden;
  }

  .img-preview-btn {
    all: unset;
    cursor: pointer;
    position: relative;
    display: block;
    width: 100%;
    height: 120px;
    background: #040308;
  }

  .preview-thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .img-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    transition: opacity 0.15s;
  }

  .img-preview-btn:hover .img-overlay {
    opacity: 1;
  }

  .file-name-bar {
    padding: 6px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: #94a3b8;
  }

  .attachment-file-card {
    background: #090712;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .file-icon-box {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: rgba(139, 92, 246, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .file-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .filename {
    font-size: 12px;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .filesize {
    font-size: 10.5px;
    color: #64748b;
  }

  .btn-file-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.06);
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    text-decoration: none;
    transition: all 0.12s;
  }

  .btn-file-action:hover {
    background: #8b5cf6;
    color: #fff;
  }

  /* Footer */
  .post-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    padding-top: 12px;
  }

  .reactions-cluster {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .reactions-form {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-reaction {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 12px;
    color: #94a3b8;
    transition: all 0.12s;
  }

  .btn-reaction:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .btn-reaction.active {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
  }

  .rx-num {
    font-size: 11px;
    font-weight: 700;
  }

  .btn-toggle-comments {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: all 0.12s;
  }

  .btn-toggle-comments:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.04);
  }

  /* Comments */
  .comments-section {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .comments-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .comment-bubble {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .comment-content-box {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    padding: 8px 12px;
    flex: 1;
  }

  .comment-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2px;
  }

  .comment-author {
    font-size: 12px;
    font-weight: 700;
    color: #e2e8f0;
  }

  .comment-time {
    font-size: 10px;
    color: #64748b;
  }

  .comment-text {
    font-size: 12.5px;
    color: #cbd5e1;
    margin: 0;
    line-height: 1.4;
  }

  .comment-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .comment-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 8px 12px;
    color: #f8fafc;
    font-size: 12.5px;
    outline: none;
  }

  .comment-input:focus {
    border-color: #8b5cf6;
  }

  .btn-send-comment {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 8px 14px;
    background: #8b5cf6;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
  }

  /* Empty State */
  .empty-mural-state {
    text-align: center;
    padding: 48px 24px;
    background: #0d0a18;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .empty-mural-state h3 {
    font-size: 16px;
    color: #f1f5f9;
    margin: 0;
  }

  .empty-mural-state p {
    font-size: 13px;
    color: #94a3b8;
    max-width: 480px;
    margin: 0;
    line-height: 1.5;
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
    z-index: 70;
    padding: 16px;
  }

  .modal-window {
    background: #0e0b1c;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    width: 100%;
    max-width: 640px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .modal-title-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .modal-title-box h2 {
    font-size: 16px;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .btn-close-modal {
    all: unset;
    cursor: pointer;
    color: #94a3b8;
    padding: 4px;
  }

  .btn-close-modal:hover { color: #fff; }

  .modal-form {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 12px;
    font-weight: 600;
    color: #cbd5e1;
  }

  .form-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .flex-1 { flex: 1; }

  .pin-toggle-group {
    padding-top: 18px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 12px;
    color: #cbd5e1;
  }

  .form-input, .form-select, .form-textarea {
    background: #090712;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 9px 12px;
    color: #f8fafc;
    font-size: 13px;
    outline: none;
    font-family: inherit;
  }

  .form-input:focus, .form-select:focus, .form-textarea:focus {
    border-color: #8b5cf6;
  }

  .drag-drop-zone {
    border: 1.5px dashed rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.01);
    transition: all 0.15s;
  }

  .drag-drop-zone.is-dragging {
    border-color: #8b5cf6;
    background: rgba(139, 92, 246, 0.05);
  }

  .drag-text {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: #cbd5e1;
  }

  .btn-browse-files {
    color: #a78bfa;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
  }

  .hidden-file-input { display: none; }

  .format-hints {
    font-size: 11px;
    color: #64748b;
  }

  .files-preview-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .file-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 4px;
    font-size: 11.5px;
    color: #e2e8f0;
  }

  .btn-remove-chip {
    all: unset;
    cursor: pointer;
    color: #94a3b8;
  }

  .btn-remove-chip:hover { color: #f87171; }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 10px;
  }

  .btn-cancel {
    all: unset;
    padding: 8px 14px;
    font-size: 12.5px;
    color: #94a3b8;
    cursor: pointer;
  }

  .btn-cancel:hover { color: #f1f5f9; }

  .btn-submit {
    all: unset;
    padding: 8px 18px;
    background: #8b5cf6;
    color: #fff;
    font-size: 12.5px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-submit:hover:not(:disabled) {
    background: #7c3aed;
  }

  .btn-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Lightbox */
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 90;
    padding: 24px;
  }

  .lightbox-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
  }

  .lightbox-img {
    max-width: 100%;
    max-height: 85vh;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
  }

  .btn-close-lightbox {
    position: absolute;
    top: -36px;
    right: 0;
    all: unset;
    cursor: pointer;
    color: #fff;
    padding: 6px;
  }
</style>
