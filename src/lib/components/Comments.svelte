<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { action } from '$lib/actions';
  import { date } from '$lib/types';
  import { tick, onMount, onDestroy } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { parseCommentBody } from '$lib/comments';
  import {
    MessageSquare,
    Flag,
    X,
    Heart,
    CornerDownRight,
    Edit3,
    Trash2,
    EyeOff,
    Sparkles,
    ArrowUpDown,
    Send,
    ChevronDown,
    ChevronUp,
    ShieldAlert,
    AtSign,
    Image as ImageIcon,
    Loader2,
    Maximize2
  } from '@lucide/svelte';
  import ReportModal from '$lib/components/ReportModal.svelte';
  import MentionAutocomplete from '$lib/components/MentionAutocomplete.svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import { getNameColorInfo } from '$lib/name-colors';
  import { CURATED_BANNER_BACKGROUNDS } from '$lib/cosmetic-banners';

  export type Comment = {
    id: string;
    user_id: string;
    body: string;
    created_at: string;
    parent_id: string | null;
    members: {
      username: string;
      display_name: string;
      avatar_id?: string | null;
      avatar_crop?: unknown;
      name_color?: string | null;
      avatar_frame_id?: string | null;
      equipped_comment_banner_id?: string | null;
      equipped_banner_id?: string | null;
      equipped_title_id?: string | null;
    } | null;
    comment_likes: { user_id: string }[];
  };

  let {
    comments,
    workId,
    chapterId = null,
    profile = null
  }: {
    comments: Comment[];
    workId: string;
    chapterId?: string | null;
    profile?: { id: string } | null;
  } = $props();

  // State
  let body = $state('');
  let reply = $state<string | null>(null);
  let edit = $state<string | null>(null);
  let notice = $state('');
  let busy = $state(false);
  let reportingComment = $state<Comment | null>(null);
  let sortBy = $state<'recent' | 'likes'>('recent');
  let mentionAutocompleteRef = $state<any>();
  let composer = $state<HTMLTextAreaElement>();

  // Multimedia Comment Attachments (Images, GIFs, Auto-preview)
  let attachedMedia = $state<{
    url: string;
    alt?: string;
    isSpoiler: boolean;
    isGif: boolean;
    previewUrl: string;
    uploading?: boolean;
    error?: string;
  } | null>(null);

  let fileInputRef: HTMLInputElement | undefined = $state();
  let lightboxMedia = $state<{ url: string; alt?: string } | null>(null);

  function openLightbox(url?: string, alt?: string) {
    if (!url) return;
    lightboxMedia = { url, alt: alt || 'Mídia em tamanho real' };
  }

  function closeLightbox() {
    lightboxMedia = null;
  }

  async function handleFileUpload(file: File) {
    if (!file) return;
    const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
    const maxSize = isGif ? 8 * 1024 * 1024 : 5 * 1024 * 1024;

    if (file.size > maxSize) {
      notice = isGif ? 'O arquivo GIF não pode ultrapassar 8 MB.' : 'A imagem não pode ultrapassar 5 MB.';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    attachedMedia = {
      url: '',
      previewUrl: objectUrl,
      isSpoiler: false,
      isGif,
      alt: file.name.replace(/\.[^/.]+$/, ''),
      uploading: true
    };

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/comments/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Falha ao enviar imagem.');
      }
      const data = await res.json();
      if (attachedMedia && attachedMedia.previewUrl === objectUrl) {
        attachedMedia.url = data.url;
        attachedMedia.isGif = Boolean(data.isAnimated || isGif);
        attachedMedia.uploading = false;
      }
    } catch (e: any) {
      if (attachedMedia && attachedMedia.previewUrl === objectUrl) {
        attachedMedia.error = e.message || 'Erro no envio';
        attachedMedia.uploading = false;
      }
      notice = e.message || 'Erro ao carregar mídia.';
    }
  }

  function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      void handleFileUpload(input.files[0]);
      input.value = '';
    }
  }

  function handlePaste(e: ClipboardEvent) {
    // 1. Detect pasted image file from clipboard
    if (e.clipboardData?.files?.length) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        void handleFileUpload(file);
        return;
      }
    }

    // 2. Detect direct image/GIF links (HTTPS) pasted as text
    const pastedText = e.clipboardData?.getData('text') || '';
    const imgUrlMatch = pastedText.match(/https?:\/\/[^\s]+\.(?:gif|png|jpe?g|webp|avif)(?:\?[^\s]*)?/i);
    const tenorOrGiphyMatch = !imgUrlMatch && pastedText.match(/https?:\/\/(?:media\d*\.giphy\.com\/media\/[^\s]+|c\.tenor\.com\/[^\s]+|i\.imgur\.com\/[^\s]+)/i);
    const detectedUrl = imgUrlMatch ? imgUrlMatch[0] : tenorOrGiphyMatch ? tenorOrGiphyMatch[0] : null;

    if (detectedUrl && !attachedMedia) {
      const isGif = detectedUrl.toLowerCase().includes('.gif') || detectedUrl.includes('giphy') || detectedUrl.includes('tenor');
      attachedMedia = {
        url: detectedUrl,
        previewUrl: detectedUrl,
        isSpoiler: false,
        isGif,
        alt: 'Mídia incorporada',
        uploading: false
      };
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        void handleFileUpload(file);
      }
    }
  }

  function removeAttachedMedia() {
    if (attachedMedia?.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(attachedMedia.previewUrl);
    }
    attachedMedia = null;
  }

  // Spoilers and collapsed reply threads
  const revealedSpoilers = new SvelteSet<string>();
  const expandedReplies = new SvelteSet<string>();

  function toggleSpoiler(key: string) {
    if (revealedSpoilers.has(key)) revealedSpoilers.delete(key);
    else revealedSpoilers.add(key);
  }

  function toggleThreadReplies(commentId: string) {
    if (expandedReplies.has(commentId)) expandedReplies.delete(commentId);
    else expandedReplies.add(commentId);
  }

  function insertSpoilerTag() {
    if (!composer) return;
    const start = composer.selectionStart || 0;
    const end = composer.selectionEnd || 0;
    const selected = body.slice(start, end);
    const replacement = selected ? `||${selected}||` : `||texto com spoiler||`;
    body = body.slice(0, start) + replacement + body.slice(end);
    tick().then(() => {
      composer?.focus();
      if (selected) {
        composer?.setSelectionRange(start, start + replacement.length);
      } else {
        composer?.setSelectionRange(start + 2, start + replacement.length - 2);
      }
    });
  }

  function insertMentionTag() {
    if (!composer) return;
    const start = composer.selectionStart || 0;
    body = body.slice(0, start) + '@' + body.slice(start);
    tick().then(() => {
      composer?.focus();
      composer?.setSelectionRange(start + 1, start + 1);
      mentionAutocompleteRef?.handleInput(body);
    });
  }

  // Hierarchical Comment Threading
  type ThreadedGroup = {
    root: Comment;
    replies: Comment[];
  };

  let threadedGroups = $derived.by<ThreadedGroup[]>(() => {
    if (!comments?.length) return [];

    const rootList: Comment[] = [];
    const repliesMap = new Map<string, Comment[]>();

    for (const c of comments) {
      if (!c.parent_id) {
        rootList.push(c);
      } else {
        const list = repliesMap.get(c.parent_id) || [];
        list.push(c);
        repliesMap.set(c.parent_id, list);
      }
    }

    // Sort roots
    if (sortBy === 'likes') {
      rootList.sort((a, b) => (b.comment_likes?.length || 0) - (a.comment_likes?.length || 0));
    } else {
      rootList.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    return rootList.map((root) => {
      const reps = repliesMap.get(root.id) || [];
      reps.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return { root, replies: reps };
    });
  });

  let replyComment = $derived(reply ? comments.find((c) => c.id === reply) : null);

  function checkHashAndScroll() {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash && hash.startsWith('#comment-')) {
      const id = hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        const parentId = el.getAttribute('data-parent-id');
        if (parentId) expandedReplies.add(parentId);

        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight-pulse');
          setTimeout(() => el.classList.remove('highlight-pulse'), 3000);
        }, 300);
      }
    }
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && lightboxMedia) {
      closeLightbox();
    }
  }

  onMount(() => {
    checkHashAndScroll();
    window.addEventListener('hashchange', checkHashAndScroll);
    window.addEventListener('keydown', handleGlobalKeydown);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('hashchange', checkHashAndScroll);
      window.removeEventListener('keydown', handleGlobalKeydown);
    }
  });

  async function compose(comment: Comment, editing = false) {
    edit = editing ? comment.id : null;
    reply = editing ? null : comment.id;
    body = editing ? comment.body : '';
    await tick();
    composer?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    composer?.focus({ preventScroll: true });
  }

  async function send() {
    const hasText = Boolean(body.trim());
    const hasMedia = Boolean(attachedMedia?.url);
    if (busy || (!hasText && !hasMedia) || attachedMedia?.uploading) return;
    busy = true;
    notice = '';
    try {
      let finalBody = body.trim();
      if (attachedMedia?.url) {
        const mediaTag = attachedMedia.isSpoiler
          ? `||![${attachedMedia.alt || 'Mídia'}](${attachedMedia.url})||`
          : `![${attachedMedia.alt || 'Mídia'}](${attachedMedia.url})`;
        finalBody = finalBody ? `${finalBody}\n\n${mediaTag}` : mediaTag;
      }

      const mentionsData = mentionAutocompleteRef?.getTrackedMentions() || null;
      const res = (await action(
        'member',
        edit ? 'comment_edit' : 'comment',
        edit
          ? { id: edit, body: finalBody, mentionsData }
          : { work_id: workId, chapter_id: chapterId, parent_id: reply, body: finalBody, mentionsData }
      )) as any;

      if (res?.xp_award?.awarded && typeof window !== 'undefined') {
        const title = reply ? 'Resposta publicada' : 'Comentário publicado';
        window.dispatchEvent(
          new CustomEvent('nox-xp-awarded', {
            detail: {
              amount: res.xp_award.amount,
              total_xp: res.xp_award.total_xp,
              title,
              kind: reply ? 'REPLY' : 'COMMENT'
            }
          })
        );
      }

      if (reply) {
        expandedReplies.add(reply);
      }

      body = '';
      removeAttachedMedia();
      reply = null;
      edit = null;
      mentionAutocompleteRef?.clearTrackedMentions();
      await invalidateAll();
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function mutate(name: string, id: string) {
    if (busy) return;
    busy = true;
    notice = '';
    try {
      const res = (await action('member', name, { id, comment_id: id })) as any;
      if (name === 'comment_like' && res?.xp_award?.awarded && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('nox-xp-awarded', {
            detail: {
              amount: res.xp_award.amount,
              title: 'Curtida registrada',
              kind: 'COMMENT_LIKE'
            }
          })
        );
      }
      await invalidateAll();
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  function bindSubmit(node: HTMLFormElement) {
    const handleSubmit = (e: Event) => {
      e.preventDefault();
      void send();
    };
    node.addEventListener('submit', handleSubmit);
    return {
      destroy() {
        node.removeEventListener('submit', handleSubmit);
      }
    };
  }
</script>

<section class="comments-section-root">
  <!-- SECTION HEADER -->
  <header class="comments-hero-header">
    <div class="header-titles">
      <div class="eyebrow-badge">
        <MessageSquare size={14} class="text-purple-400" />
        <span>{chapterId ? 'DISCUSSÃO DO CAPÍTULO' : 'AVALIAÇÕES & DISCUSSÃO'}</span>
      </div>
      <h2 class="section-title">
        {chapterId ? 'Comentários deste Capítulo' : 'Comentários sobre a Obra'}
      </h2>
    </div>

    <div class="header-controls">
      <div class="comments-count-pill">
        <span>{comments.length}</span> {comments.length === 1 ? 'comentário' : 'comentários'}
      </div>

      {#if comments.length > 1}
        <div class="sort-selector-wrap">
          <ArrowUpDown size={13} class="sort-icon" />
          <select
            value={sortBy}
            onchange={(e) => (sortBy = e.currentTarget.value as 'recent' | 'likes')}
            class="sort-dropdown"
            aria-label="Ordenar comentários"
          >
            <option value="recent">Mais Recentes</option>
            <option value="likes">Mais Curtidos</option>
          </select>
        </div>
      {/if}
    </div>
  </header>

  {#if notice}
    <div class="notice-alert error" role="alert">
      <span>{notice}</span>
    </div>
  {/if}

  <!-- COMPOSER CARD -->
  {#if profile}
    <form use:bindSubmit class="composer-card-premium">
      {#if replyComment}
        <div class="replying-banner">
          <div class="replying-info">
            <CornerDownRight size={14} class="text-purple-400" />
            <span class="replying-tag">Respondendo a</span>
            <strong class="replying-author">@{replyComment.members?.display_name || replyComment.members?.username || 'leitor'}</strong>
            <span class="replying-preview">"{replyComment.body.slice(0, 48)}{replyComment.body.length > 48 ? '…' : ''}"</span>
          </div>
          <button
            type="button"
            class="btn-cancel-reply"
            onclick={() => { reply = null; }}
            title="Cancelar resposta"
            aria-label="Cancelar resposta"
          >
            <X size={14} />
          </button>
        </div>
      {/if}

      <!-- Hidden File Input for Image/GIF Upload -->
      <input
        type="file"
        bind:this={fileInputRef}
        onchange={handleFileInputChange}
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        style="display: none;"
        aria-hidden="true"
      />

      <div class="composer-input-area">
        <textarea
          bind:value={body}
          bind:this={composer}
          rows="3"
          maxlength="2000"
          oninput={(e) => mentionAutocompleteRef?.handleInput((e.target as HTMLTextAreaElement).value)}
          onkeydown={(e) => {
            if (mentionAutocompleteRef?.handleKeyDown(e)) return;
          }}
          onpaste={handlePaste}
          ondrop={handleDrop}
          ondragover={(e) => e.preventDefault()}
          placeholder={edit
            ? 'Edite seu comentário…'
            : reply
              ? `Sua resposta para @${replyComment?.members?.display_name || replyComment?.members?.username || 'leitor'}…`
              : chapterId
                ? 'O que você achou deste capítulo? Compartilhe suas impressões… (use ||spoiler|| para esconder revelações)'
                : 'O que você achou desta obra? Fale sobre o enredo, arte e personagens…'
          }
          class="composer-textarea"
          aria-label={edit ? 'Editar comentário' : reply ? 'Sua resposta' : 'Seu comentário'}
        ></textarea>

        <!-- Attached Media Preview Chip -->
        {#if attachedMedia}
          <div class="attached-media-chip" role="region" aria-label="Mídia anexada">
            <div class="attached-media-left">
              <div class="attached-thumb-wrap">
                <img src={attachedMedia.previewUrl} alt={attachedMedia.alt || 'Prévia'} class="attached-thumb-img" />
                <span class="attached-thumb-badge">{attachedMedia.isGif ? 'GIF' : 'IMG'}</span>
              </div>
              <div class="attached-media-meta">
                <span class="attached-filename" title={attachedMedia.alt || 'Mídia'}>{attachedMedia.alt || 'Mídia anexada'}</span>
                <span class="attached-status">
                  {#if attachedMedia.uploading}
                    <span class="uploading-state"><Loader2 size={11} class="spin-anim inline mr-1" /> Enviando…</span>
                  {:else if attachedMedia.error}
                    <span class="error-state text-rose-400">{attachedMedia.error}</span>
                  {:else}
                    <span class="ready-state text-emerald-400">Pronto para publicar</span>
                  {/if}
                </span>
              </div>
            </div>

            <div class="attached-media-controls">
              <label class="spoiler-check-label" title="Ocultar esta imagem como spoiler até que o usuário clique para ver">
                <input
                  type="checkbox"
                  bind:checked={attachedMedia.isSpoiler}
                  class="spoiler-check-input"
                />
                <span>Spoiler</span>
              </label>

              <button
                type="button"
                class="btn-remove-attachment"
                onclick={removeAttachedMedia}
                title="Remover mídia anexada"
                aria-label="Remover anexo"
              >
                <X size={13} />
                <span>Remover</span>
              </button>
            </div>
          </div>
        {/if}

        <MentionAutocomplete
          bind:this={mentionAutocompleteRef}
          bind:value={body}
          textareaEl={composer}
        />
      </div>

      <!-- Composer Toolbar -->
      <div class="composer-action-bar">
        <div class="toolbar-helpers">
          <button
            type="button"
            class="helper-btn"
            onclick={insertSpoilerTag}
            title="Inserir tag de spoiler oculta (||spoiler||)"
          >
            <EyeOff size={13} />
            <span>+ Spoiler (||)</span>
          </button>
          <button
            type="button"
            class="helper-btn"
            onclick={() => fileInputRef?.click()}
            title="Anexar imagem ou GIF da galeria/computador"
          >
            <ImageIcon size={13} />
            <span>+ Imagem/GIF</span>
          </button>
          <button
            type="button"
            class="helper-btn"
            onclick={insertMentionTag}
            title="Mencionar outro leitor (@)"
          >
            <AtSign size={13} />
            <span>Mencionar</span>
          </button>
          <span class="char-counter">{body.length} / 2000</span>
        </div>

        <div class="toolbar-submit-group">
          {#if reply || edit}
            <button
              type="button"
              class="btn-cancel-composer"
              onclick={() => {
                reply = null;
                edit = null;
                body = '';
                removeAttachedMedia();
              }}
            >
              Cancelar
            </button>
          {/if}
          <button
            class="btn-submit-premium"
            disabled={busy || (!body.trim() && !attachedMedia?.url) || attachedMedia?.uploading}
          >
            <Send size={14} />
            <span>{busy ? 'Enviando…' : edit ? 'Salvar' : reply ? 'Responder' : 'Publicar'}</span>
          </button>
        </div>
      </div>
    </form>
  {:else}
    <div class="guest-auth-card">
      <MessageSquare size={22} class="text-purple-400" />
      <div>
        <h4>Participe da conversa</h4>
        <p>
          <a class="text-link" href="/entrar">Entre na sua conta</a> para comentar, interagir e ganhar XP de comunidade.
        </p>
      </div>
    </div>
  {/if}

  <!-- COMMENTS FEED -->
  {#if threadedGroups.length === 0}
    <div class="empty-discussion-card">
      <div class="empty-icon-ring">
        <MessageSquare size={32} class="text-purple-400" />
      </div>
      <h3>Nenhum comentário por enquanto</h3>
      <p>
        {chapterId
          ? 'Seja o primeiro a compartilhar o que achou deste capítulo!'
          : 'Seja o primeiro a compartilhar sua opinião sobre esta obra!'}
      </p>
    </div>
  {:else}
    <div class="comments-thread-container">
      {#each threadedGroups as group (group.root.id)}
        {@const root = group.root}
        {@const rootAuthorColor = getNameColorInfo(root.members?.name_color)}
        {@const rootBannerKey = root.members?.equipped_comment_banner_id || root.members?.equipped_banner_id}
        {@const rootCommentBanner = rootBannerKey ? (CURATED_BANNER_BACKGROUNDS[rootBannerKey] || rootBannerKey) : null}
        {@const hasLiked = profile && root.comment_likes?.some((l) => l.user_id === profile.id)}
        {@const isAuthor = profile && profile.id === root.user_id}
        {@const repliesOpen = expandedReplies.has(root.id)}

        <!-- ROOT COMMENT CARD -->
        <article
          id={'comment-' + root.id}
          class="comment-card-modern root-card"
          class:is-reply-target={reply === root.id}
          class:has-comment-banner={!!rootCommentBanner}
        >
          {#if rootCommentBanner}
            <div class="comment-banner-bg" style="background: {rootCommentBanner};" aria-hidden="true"></div>
            <div class="comment-banner-mask" aria-hidden="true"></div>
          {/if}

          <div class="comment-content-wrap">
            <!-- Author Row -->
            <header class="comment-author-row">
              <UserAvatar
                avatarId={root.members?.avatar_id}
                frameId={root.members?.avatar_frame_id}
                crop={root.members?.avatar_crop}
                displayName={root.members?.display_name || 'Leitor'}
                size={38}
              />
              <div class="author-details">
                <div class="author-headline">
                  <a
                    href="/u/{root.members?.username}"
                    class="author-name {rootAuthorColor.className}"
                    style={rootAuthorColor.style}
                  >
                    {root.members?.display_name || 'Leitor'}
                  </a>
                  <span class="author-tag">@{root.members?.username || 'leitor'}</span>
                  {#if isAuthor}
                    <span class="badge-self">Você</span>
                  {/if}
                </div>
                <time class="comment-time" datetime={root.created_at}>{date(root.created_at)}</time>
              </div>
            </header>

            <!-- Body with Spoilers & Mentions -->
            <div class="comment-text-body">
              {#each parseCommentBody(root.body) as chunk, idx (idx)}
                {#if chunk.type === 'spoiler'}
                  <button
                    type="button"
                    class="spoiler-tag-box"
                    class:revealed={revealedSpoilers.has(root.id + ':' + idx)}
                    onclick={() => toggleSpoiler(root.id + ':' + idx)}
                    title={revealedSpoilers.has(root.id + ':' + idx) ? 'Clique para ocultar spoiler' : 'Spoiler oculto: clique para ler'}
                  >
                    {#if revealedSpoilers.has(root.id + ':' + idx)}
                      <span class="spoiler-text-revealed">{chunk.content}</span>
                    {:else}
                      <span class="spoiler-text-hidden">{chunk.content}</span>
                      <span class="spoiler-pill-label"><EyeOff size={11} /> SPOILER (CLIQUE)</span>
                    {/if}
                  </button>
                {:else if chunk.type === 'media'}
                  <div class="comment-media-card">
                    {#if chunk.isSpoiler && !revealedSpoilers.has(root.id + ':media:' + idx)}
                      <button
                        type="button"
                        class="media-spoiler-card"
                        onclick={() => toggleSpoiler(root.id + ':media:' + idx)}
                        title="Spoiler: Toque para ver a imagem"
                      >
                        <img
                          src={chunk.mediaUrl}
                          alt={chunk.mediaAlt || 'Mídia com spoiler'}
                          class="comment-rendered-img"
                          loading="lazy"
                          referrerpolicy="no-referrer"
                        />
                        <div class="media-spoiler-overlay">
                          <EyeOff size={16} />
                          <span>SPOILER — TOQUE PARA VER</span>
                        </div>
                      </button>
                    {:else}
                      <button
                        type="button"
                        class="media-view-btn"
                        onclick={() => openLightbox(chunk.mediaUrl, chunk.mediaAlt)}
                        title="Clique para ampliar em tela cheia"
                      >
                        <img
                          src={chunk.mediaUrl}
                          alt={chunk.mediaAlt || 'Mídia do comentário'}
                          class="comment-rendered-img"
                          loading="lazy"
                          referrerpolicy="no-referrer"
                        />
                        {#if chunk.isGif}
                          <span class="media-type-badge">GIF</span>
                        {/if}
                      </button>
                    {/if}
                  </div>
                {:else if chunk.type === 'mention'}
                  <a href={`/u/${chunk.username || chunk.content}`} class="mention-chip">@{chunk.content}</a>
                {:else}
                  <span>{chunk.content}</span>
                {/if}
              {/each}
            </div>

            <!-- Comment Action Bar -->
            <footer class="comment-footer-actions">
              <button
                type="button"
                class="btn-footer-like"
                class:liked={hasLiked}
                onclick={() => mutate('comment_like', root.id)}
                disabled={!profile || busy}
                title={hasLiked ? 'Descurtir' : 'Curtir comentário'}
              >
                <Heart size={14} class={hasLiked ? 'fill-rose-500 text-rose-500' : ''} />
                <span>{root.comment_likes?.length || 0}</span>
              </button>

              {#if profile}
                <button
                  type="button"
                  class="btn-footer-action"
                  onclick={() => compose(root)}
                >
                  <CornerDownRight size={13} />
                  <span>Responder</span>
                </button>
              {/if}

              {#if isAuthor}
                <button
                  type="button"
                  class="btn-footer-action"
                  onclick={() => compose(root, true)}
                  title="Editar comentário"
                >
                  <Edit3 size={12} />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  class="btn-footer-action text-danger"
                  disabled={busy}
                  onclick={() => mutate('comment_delete', root.id)}
                  title="Excluir comentário"
                >
                  <Trash2 size={12} />
                  <span>Apagar</span>
                </button>
              {:else if profile}
                <button
                  type="button"
                  class="btn-footer-action"
                  onclick={() => (reportingComment = root)}
                  title="Denunciar este comentário"
                >
                  <Flag size={12} />
                  <span>Denunciar</span>
                </button>
              {/if}
            </footer>

            <!-- NESTED REPLIES TREE -->
            {#if group.replies.length > 0}
              <div class="replies-tree-section">
                <button
                  type="button"
                  class="btn-replies-toggle"
                  onclick={() => toggleThreadReplies(root.id)}
                  aria-expanded={repliesOpen}
                >
                  {#if repliesOpen}
                    <ChevronUp size={14} />
                    <span>Ocultar {group.replies.length === 1 ? '1 resposta' : `${group.replies.length} respostas`}</span>
                  {:else}
                    <ChevronDown size={14} />
                    <span>Ver {group.replies.length === 1 ? '1 resposta' : `${group.replies.length} respostas`}</span>
                  {/if}
                </button>

                {#if repliesOpen}
                  <div class="replies-branch-list">
                    {#each group.replies as replyItem (replyItem.id)}
                      {@const repAuthorColor = getNameColorInfo(replyItem.members?.name_color)}
                      {@const repBannerKey = replyItem.members?.equipped_comment_banner_id || replyItem.members?.equipped_banner_id}
                      {@const repCommentBanner = repBannerKey ? (CURATED_BANNER_BACKGROUNDS[repBannerKey] || repBannerKey) : null}
                      {@const repHasLiked = profile && replyItem.comment_likes?.some((l) => l.user_id === profile.id)}
                      {@const repIsAuthor = profile && profile.id === replyItem.user_id}

                      <article
                        id={'comment-' + replyItem.id}
                        data-parent-id={root.id}
                        class="comment-card-modern reply-card"
                        class:is-reply-target={reply === replyItem.id}
                        class:has-comment-banner={!!repCommentBanner}
                      >
                        {#if repCommentBanner}
                          <div class="comment-banner-bg" style="background: {repCommentBanner};" aria-hidden="true"></div>
                          <div class="comment-banner-mask" aria-hidden="true"></div>
                        {/if}

                        <div class="comment-content-wrap">
                          <header class="comment-author-row">
                            <UserAvatar
                              avatarId={replyItem.members?.avatar_id}
                              frameId={replyItem.members?.avatar_frame_id}
                              crop={replyItem.members?.avatar_crop}
                              displayName={replyItem.members?.display_name || 'Leitor'}
                              size={32}
                            />
                            <div class="author-details">
                              <div class="author-headline">
                                <a
                                  href="/u/{replyItem.members?.username}"
                                  class="author-name {repAuthorColor.className}"
                                  style={repAuthorColor.style}
                                >
                                  {replyItem.members?.display_name || 'Leitor'}
                                </a>
                                <span class="author-tag">@{replyItem.members?.username || 'leitor'}</span>
                                {#if repIsAuthor}
                                  <span class="badge-self">Você</span>
                                {/if}
                              </div>
                              <time class="comment-time" datetime={replyItem.created_at}>{date(replyItem.created_at)}</time>
                            </div>
                          </header>

                          <div class="comment-text-body">
                            {#each parseCommentBody(replyItem.body) as chunk, idx (idx)}
                              {#if chunk.type === 'spoiler'}
                                <button
                                  type="button"
                                  class="spoiler-tag-box"
                                  class:revealed={revealedSpoilers.has(replyItem.id + ':' + idx)}
                                  onclick={() => toggleSpoiler(replyItem.id + ':' + idx)}
                                  title={revealedSpoilers.has(replyItem.id + ':' + idx) ? 'Clique para ocultar spoiler' : 'Spoiler oculto: clique para ler'}
                                >
                                  {#if revealedSpoilers.has(replyItem.id + ':' + idx)}
                                    <span class="spoiler-text-revealed">{chunk.content}</span>
                                  {:else}
                                    <span class="spoiler-text-hidden">{chunk.content}</span>
                                    <span class="spoiler-pill-label"><EyeOff size={11} /> SPOILER (CLIQUE)</span>
                                  {/if}
                                </button>
                              {:else if chunk.type === 'media'}
                                <div class="comment-media-card">
                                  {#if chunk.isSpoiler && !revealedSpoilers.has(replyItem.id + ':media:' + idx)}
                                    <button
                                      type="button"
                                      class="media-spoiler-card"
                                      onclick={() => toggleSpoiler(replyItem.id + ':media:' + idx)}
                                      title="Spoiler: Toque para ver a imagem"
                                    >
                                      <img
                                        src={chunk.mediaUrl}
                                        alt={chunk.mediaAlt || 'Mídia com spoiler'}
                                        class="comment-rendered-img"
                                        loading="lazy"
                                        referrerpolicy="no-referrer"
                                      />
                                      <div class="media-spoiler-overlay">
                                        <EyeOff size={16} />
                                        <span>SPOILER — TOQUE PARA VER</span>
                                      </div>
                                    </button>
                                  {:else}
                                    <button
                                      type="button"
                                      class="media-view-btn"
                                      onclick={() => openLightbox(chunk.mediaUrl, chunk.mediaAlt)}
                                      title="Clique para ampliar em tela cheia"
                                    >
                                      <img
                                        src={chunk.mediaUrl}
                                        alt={chunk.mediaAlt || 'Mídia do comentário'}
                                        class="comment-rendered-img"
                                        loading="lazy"
                                        referrerpolicy="no-referrer"
                                      />
                                      {#if chunk.isGif}
                                        <span class="media-type-badge">GIF</span>
                                      {/if}
                                    </button>
                                  {/if}
                                </div>
                              {:else if chunk.type === 'mention'}
                                <a href={`/u/${chunk.username || chunk.content}`} class="mention-chip">@{chunk.content}</a>
                              {:else}
                                <span>{chunk.content}</span>
                              {/if}
                            {/each}
                          </div>

                          <footer class="comment-footer-actions">
                            <button
                              type="button"
                              class="btn-footer-like"
                              class:liked={repHasLiked}
                              onclick={() => mutate('comment_like', replyItem.id)}
                              disabled={!profile || busy}
                              title={repHasLiked ? 'Descurtir' : 'Curtir resposta'}
                            >
                              <Heart size={13} class={repHasLiked ? 'fill-rose-500 text-rose-500' : ''} />
                              <span>{replyItem.comment_likes?.length || 0}</span>
                            </button>

                            {#if profile}
                              <button
                                type="button"
                                class="btn-footer-action"
                                onclick={() => compose(root)}
                              >
                                <CornerDownRight size={12} />
                                <span>Responder</span>
                              </button>
                            {/if}

                            {#if repIsAuthor}
                              <button
                                type="button"
                                class="btn-footer-action"
                                onclick={() => compose(replyItem, true)}
                                title="Editar resposta"
                              >
                                <Edit3 size={11} />
                                <span>Editar</span>
                              </button>
                              <button
                                type="button"
                                class="btn-footer-action text-danger"
                                disabled={busy}
                                onclick={() => mutate('comment_delete', replyItem.id)}
                                title="Excluir resposta"
                              >
                                <Trash2 size={11} />
                                <span>Apagar</span>
                              </button>
                            {:else if profile}
                              <button
                                type="button"
                                class="btn-footer-action"
                                onclick={() => (reportingComment = replyItem)}
                                title="Denunciar esta resposta"
                              >
                                <Flag size={11} />
                                <span>Denunciar</span>
                              </button>
                            {/if}
                          </footer>
                        </div>
                      </article>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </article>
      {/each}
    </div>
  {/if}

  {#if reportingComment}
    <ReportModal
      workId={workId}
      chapterId={chapterId}
      commentId={reportingComment.id}
      onclose={() => (reportingComment = null)}
    />
  {/if}

  <!-- LIGHTBOX MODAL FOR EXPANDED MEDIA -->
  {#if lightboxMedia}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="lightbox-backdrop"
      onclick={closeLightbox}
      role="button"
      tabindex="0"
      aria-label="Fechar visualização de imagem"
    >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="lightbox-content" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button
          type="button"
          class="btn-close-lightbox"
          onclick={closeLightbox}
          aria-label="Fechar"
        >
          <X size={16} />
          <span>Fechar</span>
        </button>
        <img
          src={lightboxMedia.url}
          alt={lightboxMedia.alt || 'Imagem ampliada'}
          class="lightbox-img"
        />
      </div>
    </div>
  {/if}
</section>

<style>
  /* Root Container */
  .comments-section-root {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    padding: 24px 0 48px 0;
    box-sizing: border-box;
    color: #e2e8f0;
  }

  /* Hero Header */
  .comments-hero-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .eyebrow-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 800;
    color: #c084fc;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .section-title {
    font-size: 20px;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .comments-count-pill {
    font-size: 12px;
    font-weight: 700;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 6px 12px;
    border-radius: 9999px;
  }

  .comments-count-pill span {
    color: #c084fc;
  }

  .sort-selector-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    padding: 4px 10px;
  }

  .sort-icon {
    color: #a855f7;
  }

  .sort-dropdown {
    background: transparent;
    border: none;
    color: #e2e8f0;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    outline: none;
  }

  .sort-dropdown option {
    background: #0f121d;
    color: #e2e8f0;
  }

  /* Composer Card */
  .composer-card-premium {
    background: #0b0d17;
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 16px;
    padding: 18px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 20px rgba(168, 85, 247, 0.03);
    margin-bottom: 32px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .composer-card-premium:focus-within {
    border-color: rgba(168, 85, 247, 0.5);
    box-shadow: 0 4px 28px rgba(0, 0, 0, 0.6), 0 0 0 2px rgba(168, 85, 247, 0.2);
  }

  .replying-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(168, 85, 247, 0.1);
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 8px;
    padding: 8px 12px;
    margin-bottom: 12px;
    font-size: 12px;
  }

  .replying-info {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
  }

  .replying-author {
    color: #c084fc;
  }

  .replying-preview {
    color: #94a3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-cancel-reply {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
  }

  .composer-input-area {
    position: relative;
  }

  .composer-textarea {
    width: 100%;
    background: transparent;
    border: none;
    color: #f8fafc;
    font-size: 14px;
    line-height: 1.5;
    outline: none;
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
  }

  .composer-textarea::placeholder {
    color: #64748b;
  }

  .composer-action-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .toolbar-helpers {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .helper-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 5px 10px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .helper-btn:hover {
    background: rgba(168, 85, 247, 0.15);
    color: #d8b4fe;
    border-color: rgba(168, 85, 247, 0.3);
  }

  .char-counter {
    font-size: 11px;
    color: #64748b;
  }

  .toolbar-submit-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-cancel-composer {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 6px 12px;
  }

  .btn-cancel-composer:hover {
    color: #ffffff;
  }

  .btn-submit-premium {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(168, 85, 247, 0.4);
    transition: all 0.2s ease;
  }

  .btn-submit-premium:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(168, 85, 247, 0.6);
  }

  .btn-submit-premium:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Guest Auth Card */
  .guest-auth-card {
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(168, 85, 247, 0.06);
    border: 1px solid rgba(168, 85, 247, 0.2);
    border-radius: 14px;
    padding: 16px 20px;
    margin-bottom: 32px;
  }

  .guest-auth-card h4 {
    margin: 0 0 2px 0;
    font-size: 14px;
    color: #ffffff;
  }

  .guest-auth-card p {
    margin: 0;
    font-size: 12px;
    color: #94a3b8;
  }

  .text-link {
    color: #c084fc;
    font-weight: 700;
    text-decoration: underline;
  }

  /* Empty Discussion */
  .empty-discussion-card {
    text-align: center;
    padding: 48px 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 16px;
  }

  .empty-icon-ring {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(168, 85, 247, 0.1);
    border: 1px solid rgba(168, 85, 247, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px auto;
  }

  .empty-discussion-card h3 {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 4px 0;
  }

  .empty-discussion-card p {
    font-size: 13px;
    color: #94a3b8;
    margin: 0;
  }

  /* Comments List */
  .comments-thread-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Modern Card */
  .comment-card-modern {
    position: relative;
    background: #0b0d17;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .comment-card-modern:hover {
    border-color: rgba(255, 255, 255, 0.14);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .comment-card-modern.is-reply-target {
    border-color: #a855f7;
    box-shadow: 0 0 16px rgba(168, 85, 247, 0.35);
  }

  .comment-banner-bg {
    position: absolute;
    inset: 0;
    background-size: cover !important;
    background-position: center !important;
    opacity: 0.15;
    z-index: 0;
    pointer-events: none;
  }

  .comment-banner-mask {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(11, 13, 23, 0.4) 0%, rgba(11, 13, 23, 0.95) 100%);
    z-index: 0;
    pointer-events: none;
  }

  .comment-content-wrap {
    position: relative;
    z-index: 1;
    padding: 16px;
  }

  /* Author Row */
  .comment-author-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .author-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .author-headline {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .author-name {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    text-decoration: none;
  }

  .author-name:hover {
    text-decoration: underline;
  }

  .author-tag {
    font-size: 11px;
    color: #64748b;
  }

  .badge-self {
    font-size: 9px;
    font-weight: 800;
    color: #a855f7;
    background: rgba(168, 85, 247, 0.2);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .comment-time {
    font-size: 11px;
    color: #64748b;
  }

  /* Comment Text */
  .comment-text-body {
    font-size: 14px;
    line-height: 1.6;
    color: #e2e8f0;
    margin-bottom: 12px;
    word-break: break-word;
  }

  /* Spoilers */
  .spoiler-tag-box {
    display: inline-block;
    position: relative;
    padding: 2px 8px;
    border-radius: 6px;
    background: #1e1b2e;
    border: 1px dashed rgba(168, 85, 247, 0.4);
    cursor: pointer;
    vertical-align: middle;
    margin: 2px 0;
    transition: all 0.2s ease;
  }

  .spoiler-tag-box:hover {
    background: #27233d;
    border-color: #a855f7;
  }

  .spoiler-text-hidden {
    filter: blur(8px);
    opacity: 0.15;
    user-select: none;
  }

  .spoiler-pill-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 800;
    color: #c084fc;
    letter-spacing: 0.05em;
  }

  .spoiler-text-revealed {
    color: #f1f5f9;
  }

  .mention-chip {
    color: #a855f7;
    font-weight: 700;
    text-decoration: none;
    background: rgba(168, 85, 247, 0.1);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .mention-chip:hover {
    text-decoration: underline;
    background: rgba(168, 85, 247, 0.2);
  }

  /* Footer Actions */
  .comment-footer-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-footer-like {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-footer-like:hover:not(:disabled) {
    background: rgba(244, 63, 94, 0.1);
    border-color: rgba(244, 63, 94, 0.3);
    color: #f43f5e;
  }

  .btn-footer-like.liked {
    background: rgba(244, 63, 94, 0.15);
    border-color: rgba(244, 63, 94, 0.4);
    color: #f43f5e;
  }

  .btn-footer-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .btn-footer-action:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.05);
  }

  .btn-footer-action.text-danger:hover {
    color: #f43f5e;
    background: rgba(244, 63, 94, 0.1);
  }

  /* Replies Branch Section */
  .replies-tree-section {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .btn-replies-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: #a855f7;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    padding: 4px 0;
  }

  .btn-replies-toggle:hover {
    text-decoration: underline;
  }

  .replies-branch-list {
    margin-top: 12px;
    margin-left: 14px;
    padding-left: 14px;
    border-left: 2px solid rgba(168, 85, 247, 0.3);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .reply-card {
    background: rgba(18, 20, 32, 0.7);
    border-radius: 12px;
  }

  .reply-card .comment-content-wrap {
    padding: 12px;
  }

  .notice-alert {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 12px;
    margin-bottom: 16px;
  }

  .notice-alert.error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  @media (max-width: 640px) {
    .comments-hero-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }

    .header-controls {
      width: 100%;
      justify-content: space-between;
    }

    .composer-card-premium {
      padding: 14px 12px;
      margin-bottom: 20px;
      border-radius: 12px;
    }

    .composer-action-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }

    .toolbar-helpers {
      justify-content: space-between;
    }

    .toolbar-submit-group {
      width: 100%;
    }

    .btn-submit-premium {
      width: 100%;
      justify-content: center;
    }

    .comment-card-modern {
      border-radius: 12px;
    }

    .comment-content-wrap {
      padding: 12px 14px;
    }

    .replies-branch-list {
      margin-left: 6px;
      padding-left: 8px;
    }
  }

  /* Attached Media Preview Bar in Composer */
  .attached-media-chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 10px;
    padding: 8px 12px;
    background: rgba(168, 85, 247, 0.08);
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 10px;
    animation: fadeIn 0.2s ease;
  }

  .attached-media-left {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
  }

  .attached-thumb-wrap {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 8px;
    overflow: hidden;
    background: #000000;
    flex-shrink: 0;
  }

  .attached-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .attached-thumb-badge {
    position: absolute;
    bottom: 2px;
    right: 2px;
    font-size: 8px;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.8);
    color: #38bdf8;
    text-transform: uppercase;
  }

  .attached-media-meta {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .attached-filename {
    font-size: 12px;
    font-weight: 600;
    color: #f1f5f9;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
  }

  .attached-status {
    font-size: 11px;
    color: #94a3b8;
  }

  .attached-media-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .spoiler-check-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    color: #cbd5e1;
    cursor: pointer;
    user-select: none;
  }

  .spoiler-check-input {
    accent-color: #a855f7;
    width: 14px;
    height: 14px;
    cursor: pointer;
  }

  .btn-remove-attachment {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid rgba(244, 63, 94, 0.25);
    border-radius: 6px;
    color: #fb7185;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .btn-remove-attachment:hover {
    background: rgba(244, 63, 94, 0.22);
  }

  /* Comment Media Card in Feed */
  .comment-media-card {
    display: block;
    max-width: 100%;
    margin-top: 10px;
    margin-bottom: 6px;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .media-view-btn {
    position: relative;
    display: block;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    text-align: left;
    max-width: 100%;
  }

  .comment-rendered-img {
    display: block;
    max-width: 100%;
    max-height: 380px;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 11px;
    transition: transform 0.2s ease, filter 0.2s ease;
  }

  .comment-rendered-img:hover {
    filter: brightness(1.05);
  }

  .media-type-badge {
    position: absolute;
    bottom: 8px;
    left: 8px;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    font-size: 10px;
    font-weight: 800;
    color: #38bdf8;
    letter-spacing: 0.05em;
  }

  .media-spoiler-card {
    position: relative;
    overflow: hidden;
    border-radius: 12px;
    cursor: pointer;
    border: none;
    background: #0b0d14;
    padding: 0;
    display: block;
    max-width: 100%;
  }

  .media-spoiler-card .comment-rendered-img {
    filter: blur(24px) brightness(0.5);
    transform: scale(1.08);
    pointer-events: none;
  }

  .media-spoiler-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: rgba(10, 10, 16, 0.65);
    backdrop-filter: blur(6px);
    color: #f1f5f9;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 16px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
  }

  /* Lightbox Modal */
  .lightbox-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.92);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.2s ease;
  }

  .lightbox-content {
    position: relative;
    max-width: 92vw;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .lightbox-img {
    max-width: 90vw;
    max-height: 85vh;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
  }

  .btn-close-lightbox {
    position: absolute;
    top: -44px;
    right: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 9999px;
    color: #ffffff;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-close-lightbox:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
