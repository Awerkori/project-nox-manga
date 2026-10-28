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
    AtSign,
    Image as ImageIcon,
    Loader2,
    Check,
    Minus,
    Plus
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
    is_tombstone?: boolean;
    removed?: boolean;
    deleted?: boolean;
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

  export type CommentNode = {
    comment: Comment;
    children: CommentNode[];
    depth: number;
    parentAuthorName?: string;
  };

  let {
    comments,
    workId,
    chapterId = null,
    chapterNumber = null,
    chapterTitle = null,
    displayNumber = null,
    workSlug = null,
    workTitle = null,
    profile = null
  }: {
    comments: Comment[];
    workId: string;
    chapterId?: string | null;
    chapterNumber?: string | number | null;
    chapterTitle?: string | null;
    displayNumber?: string | null;
    workSlug?: string | null;
    workTitle?: string | null;
    profile?: { id: string } | null;
  } = $props();

  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================

  // Top-Level Main Composer
  let mainBody = $state('');
  let mainMedia = $state<{
    url: string;
    previewUrl: string;
    isSpoiler: boolean;
    isGif: boolean;
    alt?: string;
    uploading?: boolean;
    error?: string;
  } | null>(null);
  let mainFileInputRef: HTMLInputElement | undefined = $state();
  let mainComposerEl = $state<HTMLTextAreaElement>();
  let mainMentionAutocompleteRef = $state<any>();

  // Reddit-Style Inline Reply Composer (Directly under target comment)
  let activeReplyId = $state<string | null>(null);
  let replyBody = $state('');
  let replyMedia = $state<{
    url: string;
    previewUrl: string;
    isSpoiler: boolean;
    isGif: boolean;
    alt?: string;
    uploading?: boolean;
    error?: string;
  } | null>(null);
  let replyFileInputRef: HTMLInputElement | undefined = $state();
  let inlineReplyComposerEl = $state<HTMLTextAreaElement>();

  // In-Place Inline Edit
  let editingCommentId = $state<string | null>(null);
  let editBody = $state('');

  // General discussion state
  let notice = $state('');
  let busy = $state(false);
  let deleteBusy = $state(false);
  let commentToDelete = $state<Comment | null>(null);
  let reportingComment = $state<Comment | null>(null);
  let lightboxMedia = $state<{ url: string; alt?: string } | null>(null);
  let sortBy = $state<'recent' | 'likes'>('recent');

  // Reactivity sets
  const deletedCommentIds = new SvelteSet<string>();
  const collapsedThreads = new SvelteSet<string>();
  const revealedSpoilers = new SvelteSet<string>();

  // =========================================================================
  // TREE CONSTRUCTION & SURVIVING REPLIES (ZERO TOMBSTONES)
  // =========================================================================

  let visibleCount = $derived(
    comments?.filter(
      (c) =>
        !deletedCommentIds.has(c.id) &&
        !c.removed &&
        !c.deleted &&
        !c.is_tombstone
    ).length || 0
  );

  function countDescendants(node: CommentNode): number {
    let count = node.children.length;
    for (const child of node.children) {
      count += countDescendants(child);
    }
    return count;
  }

  let commentTree = $derived.by<CommentNode[]>(() => {
    if (!comments?.length) return [];

    const allMap = new Map<string, Comment>();
    for (const c of comments) {
      allMap.set(c.id, c);
    }

    const isDeleted = (id: string | null | undefined): boolean => {
      if (!id) return true;
      if (deletedCommentIds.has(id)) return true;
      const c = allMap.get(id);
      return !c || Boolean(c.removed) || Boolean(c.deleted) || Boolean(c.is_tombstone);
    };

    // Find nearest living ancestor for any reply
    function getLivingAncestor(c: Comment): Comment | null {
      let curr = c.parent_id;
      while (curr) {
        if (!isDeleted(curr)) {
          return allMap.get(curr) || null;
        }
        const parent = allMap.get(curr);
        curr = parent?.parent_id || null;
      }
      return null;
    }

    // Keep only active living comments (NO tombstones ever returned)
    const living = comments.filter((c) => !isDeleted(c.id));

    const nodeMap = new Map<string, CommentNode>();
    for (const c of living) {
      const livingParent = getLivingAncestor(c);
      const parentAuthorName =
        livingParent?.members?.display_name || livingParent?.members?.username || undefined;
      nodeMap.set(c.id, {
        comment: c,
        children: [],
        depth: 0,
        parentAuthorName
      });
    }

    const roots: CommentNode[] = [];
    for (const c of living) {
      const node = nodeMap.get(c.id)!;
      const livingParent = getLivingAncestor(c);
      if (livingParent && nodeMap.has(livingParent.id)) {
        nodeMap.get(livingParent.id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    function finalize(nodes: CommentNode[], depth: number) {
      for (const n of nodes) {
        n.depth = depth;
        n.children.sort((a, b) => a.comment.created_at.localeCompare(b.comment.created_at));
        finalize(n.children, depth + 1);
      }
    }

    if (sortBy === 'likes') {
      roots.sort((a, b) => (b.comment.comment_likes?.length || 0) - (a.comment.comment_likes?.length || 0));
    } else {
      roots.sort((a, b) => b.comment.created_at.localeCompare(a.comment.created_at));
    }

    finalize(roots, 0);
    return roots;
  });

  // =========================================================================
  // MULTIMEDIA UPLOAD & ATTACHMENT HANDLERS
  // =========================================================================

  function openLightbox(url?: string, alt?: string) {
    if (!url) return;
    lightboxMedia = { url, alt: alt || 'Mídia em tamanho real' };
  }

  function closeLightbox() {
    lightboxMedia = null;
  }

  async function handleFileUpload(file: File, isInline: boolean) {
    if (!file) return;
    const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
    const maxSize = isGif ? 8 * 1024 * 1024 : 5 * 1024 * 1024;

    if (file.size > maxSize) {
      notice = isGif ? 'O arquivo GIF não pode ultrapassar 8 MB.' : 'A imagem não pode ultrapassar 5 MB.';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const mediaObj = {
      url: '',
      previewUrl: objectUrl,
      isSpoiler: false,
      isGif,
      alt: file.name.replace(/\.[^/.]+$/, ''),
      uploading: true
    };

    if (isInline) replyMedia = mediaObj;
    else mainMedia = mediaObj;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/comments/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        let userMsg = err.error || err.message;
        if (!userMsg || typeof userMsg !== 'string' || userMsg.includes('constraint') || userMsg.includes('SQL')) {
          userMsg = 'Não foi possível enviar a mídia. Verifique o formato ou tente novamente.';
        }
        throw new Error(userMsg);
      }
      const data = await res.json();
      const current = isInline ? replyMedia : mainMedia;
      if (current && current.previewUrl === objectUrl) {
        current.url = data.url;
        current.isGif = Boolean(data.isAnimated || isGif);
        current.uploading = false;
      }
    } catch (e: any) {
      const current = isInline ? replyMedia : mainMedia;
      if (current && current.previewUrl === objectUrl) {
        current.error = e.message || 'Erro no envio';
        current.uploading = false;
      }
      notice = e.message || 'Erro ao carregar mídia.';
    }
  }

  function handleFileInputChange(e: Event, isInline: boolean) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      void handleFileUpload(input.files[0], isInline);
      input.value = '';
    }
  }

  function handlePaste(e: ClipboardEvent, isInline: boolean) {
    if (e.clipboardData?.files?.length) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        void handleFileUpload(file, isInline);
        return;
      }
    }

    const pastedText = e.clipboardData?.getData('text') || '';
    const imgUrlMatch = pastedText.match(/https?:\/\/[^\s]+\.(?:gif|png|jpe?g|webp|avif)(?:\?[^\s]*)?/i);
    const hostMatch =
      !imgUrlMatch &&
      pastedText.match(
        /https?:\/\/(?:images\.unsplash\.com\/[^\s)]+|media\d*\.giphy\.com\/media\/[^\s)]+|c\.tenor\.com\/[^\s)]+|media\.tenor\.com\/[^\s)]+|i\.imgur\.com\/[^\s)]+)/i
      );
    const detectedUrl = imgUrlMatch ? imgUrlMatch[0] : hostMatch ? hostMatch[0] : null;

    const currentMedia = isInline ? replyMedia : mainMedia;
    if (detectedUrl && !currentMedia) {
      const isGif = detectedUrl.toLowerCase().includes('.gif') || detectedUrl.includes('giphy') || detectedUrl.includes('tenor');
      const attached = {
        url: detectedUrl,
        previewUrl: detectedUrl,
        isSpoiler: false,
        isGif,
        alt: 'Mídia incorporada',
        uploading: false
      };
      if (isInline) replyMedia = attached;
      else mainMedia = attached;
    }
  }

  function handleDrop(e: DragEvent, isInline: boolean) {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        void handleFileUpload(file, isInline);
      }
    }
  }

  function insertSpoilerTag(isInline: boolean) {
    const textarea = isInline ? inlineReplyComposerEl : mainComposerEl;
    if (!textarea) return;
    const currentVal = isInline ? replyBody : mainBody;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const selected = currentVal.slice(start, end);
    const replacement = selected ? `||${selected}||` : `||texto com spoiler||`;
    const newVal = currentVal.slice(0, start) + replacement + currentVal.slice(end);

    if (isInline) replyBody = newVal;
    else mainBody = newVal;

    tick().then(() => {
      textarea.focus();
      if (selected) {
        textarea.setSelectionRange(start, start + replacement.length);
      } else {
        textarea.setSelectionRange(start + 2, start + replacement.length - 2);
      }
    });
  }

  function insertMentionTag(isInline: boolean) {
    const textarea = isInline ? inlineReplyComposerEl : mainComposerEl;
    if (!textarea) return;
    const currentVal = isInline ? replyBody : mainBody;
    const start = textarea.selectionStart || 0;
    const newVal = currentVal.slice(0, start) + '@' + currentVal.slice(start);

    if (isInline) replyBody = newVal;
    else mainBody = newVal;

    tick().then(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 1, start + 1);
      if (!isInline) mainMentionAutocompleteRef?.handleInput(newVal);
    });
  }

  // =========================================================================
  // ACTIONS: REPLY, EDIT, DELETE, LIKE, COLLAPSE, SPOILERS
  // =========================================================================

  function toggleCollapse(commentId: string) {
    if (collapsedThreads.has(commentId)) {
      collapsedThreads.delete(commentId);
    } else {
      collapsedThreads.add(commentId);
    }
  }

  function toggleSpoiler(key: string) {
    if (revealedSpoilers.has(key)) revealedSpoilers.delete(key);
    else revealedSpoilers.add(key);
  }

  async function openInlineReply(targetComment: Comment) {
    if (!profile) return;
    if (activeReplyId === targetComment.id) {
      activeReplyId = null;
      return;
    }
    activeReplyId = targetComment.id;
    replyBody = '';
    replyMedia = null;
    await tick();
    inlineReplyComposerEl?.focus();
  }

  function cancelInlineReply() {
    activeReplyId = null;
    replyBody = '';
    replyMedia = null;
  }

  function startInlineEdit(comment: Comment) {
    editingCommentId = comment.id;
    editBody = comment.body;
  }

  function cancelInlineEdit() {
    editingCommentId = null;
    editBody = '';
  }

  async function saveInlineEdit(commentId: string) {
    if (busy || !editBody.trim()) return;
    busy = true;
    notice = '';
    try {
      await action('member', 'comment_edit', {
        id: commentId,
        body: editBody.trim()
      });
      editingCommentId = null;
      editBody = '';
      await invalidateAll();
    } catch (e: any) {
      notice = e?.message || 'Não foi possível salvar a edição.';
    } finally {
      busy = false;
    }
  }

  async function sendComment(parentId: string | null = null) {
    const isInline = Boolean(parentId);
    const text = isInline ? replyBody.trim() : mainBody.trim();
    const media = isInline ? replyMedia : mainMedia;

    if (busy || (!text && !media?.url) || media?.uploading) return;
    busy = true;
    notice = '';

    try {
      let finalBody = text;
      if (media?.url) {
        const mediaTag = media.isSpoiler
          ? `||![${media.alt || 'Mídia'}](${media.url})||`
          : `![${media.alt || 'Mídia'}](${media.url})`;
        finalBody = finalBody ? `${finalBody}\n\n${mediaTag}` : mediaTag;
      }

      const autocomplete = isInline ? null : mainMentionAutocompleteRef;
      const mentionsData = autocomplete?.getTrackedMentions() || null;

      const res = (await action('member', 'comment', {
        work_id: workId,
        chapter_id: chapterId,
        work_slug: workSlug,
        work_title: workTitle,
        chapter_number: chapterNumber,
        chapter_title: chapterTitle,
        display_number: displayNumber,
        parent_id: parentId,
        body: finalBody,
        mentionsData
      })) as any;

      if (res?.xp_award?.awarded && typeof window !== 'undefined') {
        const title = parentId ? 'Resposta publicada' : 'Comentário publicado';
        window.dispatchEvent(
          new CustomEvent('nox-xp-awarded', {
            detail: {
              amount: res.xp_award.amount,
              total_xp: res.xp_award.total_xp,
              title,
              kind: parentId ? 'REPLY' : 'COMMENT'
            }
          })
        );
      }

      if (isInline) {
        activeReplyId = null;
        replyBody = '';
        replyMedia = null;
        if (parentId) collapsedThreads.delete(parentId);
      } else {
        mainBody = '';
        mainMedia = null;
        autocomplete?.clearTrackedMentions();
      }

      await invalidateAll();
    } catch (e: any) {
      const raw = e?.message || '';
      if (raw.includes('violates') || raw.includes('constraint') || raw.includes('SQL')) {
        notice = 'Não foi possível salvar o comentário. Tente novamente em instantes.';
      } else {
        notice = raw || 'Não foi possível publicar seu comentário.';
      }
    } finally {
      busy = false;
    }
  }

  async function mutateLike(id: string) {
    if (busy || !profile) return;
    busy = true;
    notice = '';
    try {
      const res = (await action('member', 'comment_like', {
        id,
        comment_id: id,
        work_id: workId,
        chapter_id: chapterId
      })) as any;
      if (res?.xp_award?.awarded && typeof window !== 'undefined') {
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
    } catch (e: any) {
      notice = e?.message || 'Erro ao curtir.';
    } finally {
      busy = false;
    }
  }

  async function confirmDelete() {
    if (!commentToDelete || deleteBusy) return;
    const target = commentToDelete;
    deleteBusy = true;
    notice = '';
    try {
      // Mark locally deleted immediately so it vanishes without any tombstone!
      deletedCommentIds.add(target.id);
      await action('member', 'comment_delete', {
        id: target.id,
        comment_id: target.id,
        work_id: workId,
        chapter_id: chapterId
      });
      commentToDelete = null;
      await invalidateAll();
    } catch (e: any) {
      deletedCommentIds.delete(target.id);
      notice = e?.message || 'Não foi possível apagar o comentário.';
    } finally {
      deleteBusy = false;
      commentToDelete = null;
    }
  }

  function checkHashAndScroll() {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash && hash.startsWith('#comment-')) {
      const id = hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight-pulse');
          setTimeout(() => el.classList.remove('highlight-pulse'), 3000);
        }, 300);
      }
    }
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (lightboxMedia) closeLightbox();
      else if (commentToDelete) commentToDelete = null;
      else if (activeReplyId) cancelInlineReply();
      else if (editingCommentId) cancelInlineEdit();
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
        <span>{visibleCount}</span> {visibleCount === 1 ? 'comentário' : 'comentários'}
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

  <!-- TOP-LEVEL COMPOSER (START NEW DISCUSSION) -->
  {#if profile}
    <form
      onsubmit={(e) => { e.preventDefault(); void sendComment(); }}
      class="composer-card-premium"
    >
      <!-- Hidden File Input for Main Image/GIF Upload -->
      <input
        type="file"
        bind:this={mainFileInputRef}
        onchange={(e) => handleFileInputChange(e, false)}
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        style="display: none;"
        aria-hidden="true"
      />

      <div class="composer-input-area">
        <textarea
          bind:value={mainBody}
          bind:this={mainComposerEl}
          rows="3"
          maxlength="2000"
          oninput={(e) => mainMentionAutocompleteRef?.handleInput((e.target as HTMLTextAreaElement).value)}
          onkeydown={(e) => {
            if (mainMentionAutocompleteRef?.handleKeyDown(e)) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void sendComment();
          }}
          onpaste={(e) => handlePaste(e, false)}
          ondrop={(e) => handleDrop(e, false)}
          ondragover={(e) => e.preventDefault()}
          placeholder={chapterId
            ? 'O que você achou deste capítulo? Compartilhe suas impressões… (use ||spoiler|| para revelações)'
            : 'O que você achou desta obra? Fale sobre o enredo, arte e personagens…'
          }
          class="composer-textarea"
          aria-label="Seu comentário"
        ></textarea>

        <!-- Attached Media Preview Chip -->
        {#if mainMedia}
          <div class="attached-media-chip" role="region" aria-label="Mídia anexada">
            <div class="attached-media-left">
              <div class="attached-thumb-wrap" class:is-spoiler={mainMedia.isSpoiler}>
                <img src={mainMedia.previewUrl} alt="Prévia" class="attached-thumb-img" />
                {#if mainMedia.isSpoiler}
                  <div class="attached-spoiler-overlay">
                    <EyeOff size={11} />
                    <span>SPOILER</span>
                  </div>
                {:else}
                  <span class="attached-thumb-badge">{mainMedia.isGif ? 'GIF' : 'IMG'}</span>
                {/if}
              </div>
              <div class="attached-media-meta">
                <span class="attached-filename" title={mainMedia.alt || 'Mídia'}>{mainMedia.alt || 'Mídia anexada'}</span>
                <span class="attached-status">
                  {#if mainMedia.uploading}
                    <span class="uploading-state"><Loader2 size={11} class="spin-anim inline mr-1" /> Enviando…</span>
                  {:else if mainMedia.error}
                    <span class="error-state text-rose-400">{mainMedia.error}</span>
                  {:else}
                    <span class="ready-state text-emerald-400">Pronto para publicar</span>
                  {/if}
                </span>
              </div>
            </div>

            <div class="attached-media-controls">
              <label class="spoiler-check-label" class:is-active={mainMedia.isSpoiler} title="Ocultar como spoiler">
                <input
                  type="checkbox"
                  bind:checked={mainMedia.isSpoiler}
                  class="spoiler-check-input"
                />
                <EyeOff size={13} />
                <span>Ocultar como spoiler</span>
              </label>

              <button
                type="button"
                class="btn-remove-attachment"
                onclick={() => (mainMedia = null)}
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
          bind:this={mainMentionAutocompleteRef}
          bind:value={mainBody}
          textareaEl={mainComposerEl}
        />
      </div>

      <!-- Composer Toolbar -->
      <div class="composer-action-bar">
        <div class="toolbar-helpers">
          <button
            type="button"
            class="helper-btn"
            onclick={() => insertSpoilerTag(false)}
            title="Inserir tag de spoiler oculta (||spoiler||)"
          >
            <EyeOff size={13} />
            <span>+ Spoiler (||)</span>
          </button>
          <button
            type="button"
            class="helper-btn"
            onclick={() => mainFileInputRef?.click()}
            title="Anexar imagem ou GIF do computador/celular"
          >
            <ImageIcon size={13} />
            <span>+ Imagem/GIF</span>
          </button>
          <button
            type="button"
            class="helper-btn"
            onclick={() => insertMentionTag(false)}
            title="Mencionar outro leitor (@)"
          >
            <AtSign size={13} />
            <span>Mencionar</span>
          </button>
          <span class="char-counter">{mainBody.length} / 2000</span>
        </div>

        <div class="toolbar-submit-group">
          <button
            class="btn-submit-premium"
            disabled={busy || (!mainBody.trim() && !mainMedia?.url) || mainMedia?.uploading}
          >
            <Send size={14} />
            <span>{busy ? 'Enviando…' : 'Publicar'}</span>
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

  <!-- ======================================================================= -->
  <!-- RECURSIVE REDDIT-STYLE COMMENT NODE SNIPPET                             -->
  <!-- ======================================================================= -->
  {#snippet renderCommentNode(node: CommentNode)}
    {@const comment = node.comment}
    {@const isCollapsed = collapsedThreads.has(comment.id)}
    {@const authorColor = getNameColorInfo(comment.members?.name_color)}
    {@const bannerKey = comment.members?.equipped_comment_banner_id || comment.members?.equipped_banner_id}
    {@const commentBanner = bannerKey ? (CURATED_BANNER_BACKGROUNDS[bannerKey] || bannerKey) : null}
    {@const hasLiked = profile && comment.comment_likes?.some((l) => l.user_id === profile.id)}
    {@const isAuthor = profile && profile.id === comment.user_id}
    {@const isEditing = editingCommentId === comment.id}
    {@const descCount = countDescendants(node)}

    <div
      class="thread-node-wrapper"
      class:is-nested={node.depth > 0}
      class:is-deep={node.depth >= 3}
      data-depth={node.depth}
    >
      {#if isCollapsed}
        <!-- COLLAPSED BAR (REDDIT STYLE) -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="thread-collapsed-bar"
          onclick={() => toggleCollapse(comment.id)}
          role="button"
          tabindex="0"
          title="Clique para expandir conversa"
        >
          <span class="collapsed-toggle-btn"><Plus size={11} /></span>
          <strong class="collapsed-author {authorColor.className}" style={authorColor.style}>
            {comment.members?.display_name || 'Leitor'}
          </strong>
          <span class="collapsed-handle">@{comment.members?.username || 'leitor'}</span>
          <time class="collapsed-time">{date(comment.created_at)}</time>
          {#if descCount > 0}
            <span class="collapsed-badge">+{descCount} {descCount === 1 ? 'resposta' : 'respostas'}</span>
          {/if}
          <span class="collapsed-hint">Clique para expandir</span>
        </div>
      {:else}
        <!-- ACTIVE COMMENT CARD -->
        <article
          id={'comment-' + comment.id}
          class="comment-card-modern"
          class:is-reply-target={activeReplyId === comment.id}
          class:has-comment-banner={!!commentBanner}
          class:is-nested-card={node.depth > 0}
        >
          {#if commentBanner}
            <div class="comment-banner-bg" style="background: {commentBanner};" aria-hidden="true"></div>
            <div class="comment-banner-mask" aria-hidden="true"></div>
          {/if}

          <div class="comment-content-wrap">
            <!-- Compact Author Row -->
            <header class="comment-author-row">
              <UserAvatar
                avatarId={comment.members?.avatar_id}
                frameId={comment.members?.avatar_frame_id}
                crop={comment.members?.avatar_crop}
                displayName={comment.members?.display_name || 'Leitor'}
                size={node.depth > 0 ? 26 : 30}
              />
              <div class="author-details">
                <div class="author-headline">
                  <a
                    href="/u/{comment.members?.username}"
                    class="author-name {authorColor.className}"
                    style={authorColor.style}
                  >
                    {comment.members?.display_name || 'Leitor'}
                  </a>
                  <span class="author-tag">@{comment.members?.username || 'leitor'}</span>
                  {#if isAuthor}
                    <span class="badge-self">Você</span>
                  {/if}
                  {#if node.depth >= 3 && node.parentAuthorName}
                    <span class="parent-mention-tag" title="Em resposta a @{node.parentAuthorName}">
                      ↳ @{node.parentAuthorName}
                    </span>
                  {/if}
                  <time class="comment-time" datetime={comment.created_at}>{date(comment.created_at)}</time>
                </div>
              </div>

              <!-- Thread Collapse Button -->
              <button
                type="button"
                class="btn-thread-collapse"
                onclick={() => toggleCollapse(comment.id)}
                title="Recolher esta conversa"
                aria-label="Recolher conversa"
              >
                <Minus size={12} />
              </button>
            </header>

            <!-- Body or Inline Edit Mode -->
            {#if isEditing}
              <div class="inline-edit-box">
                <textarea
                  bind:value={editBody}
                  rows="2"
                  maxlength="2000"
                  class="inline-edit-textarea"
                  aria-label="Editar comentário"
                ></textarea>
                <div class="inline-edit-actions">
                  <button
                    type="button"
                    class="btn-inline-cancel"
                    onclick={cancelInlineEdit}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    class="btn-inline-save"
                    onclick={() => saveInlineEdit(comment.id)}
                    disabled={busy || !editBody.trim()}
                  >
                    {busy ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </div>
            {:else}
              <!-- Comment Text with Spoilers & Media -->
              <div class="comment-text-body">
                {#each parseCommentBody(comment.body) as chunk, idx (idx)}
                  {#if chunk.type === 'spoiler'}
                    <button
                      type="button"
                      class="discord-spoiler"
                      class:is-revealed={revealedSpoilers.has(comment.id + ':' + idx)}
                      onclick={() => toggleSpoiler(comment.id + ':' + idx)}
                      aria-expanded={revealedSpoilers.has(comment.id + ':' + idx)}
                      title={revealedSpoilers.has(comment.id + ':' + idx) ? 'Clique para ocultar spoiler' : 'Spoiler oculto: clique para ler'}
                    >{chunk.content}</button>
                  {:else if chunk.type === 'media'}
                    <div class="comment-media-card">
                      {#if chunk.isSpoiler && !revealedSpoilers.has(comment.id + ':media:' + idx)}
                        <button
                          type="button"
                          class="media-spoiler-card"
                          onclick={() => toggleSpoiler(comment.id + ':media:' + idx)}
                          title="Spoiler: Toque para ver a imagem"
                        >
                          <img
                            src={chunk.mediaUrl}
                            alt={chunk.mediaAlt || 'Mídia com spoiler'}
                            class="comment-rendered-img"
                            loading="lazy"
                            referrerpolicy="no-referrer"
                            onerror={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div class="media-spoiler-overlay">
                            <EyeOff size={16} />
                            <span>SPOILER — TOQUE PARA VER</span>
                          </div>
                        </button>
                      {:else}
                        <div class="media-view-wrapper">
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
                              onerror={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                            {#if chunk.isGif}
                              <span class="media-type-badge">GIF</span>
                            {/if}
                          </button>
                          {#if chunk.isSpoiler}
                            <button
                              type="button"
                              class="media-rehide-btn"
                              onclick={(e) => {
                                e.stopPropagation();
                                toggleSpoiler(comment.id + ':media:' + idx);
                              }}
                              title="Ocultar spoiler novamente"
                            >
                              <EyeOff size={11} />
                              <span>Ocultar</span>
                            </button>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {:else if chunk.type === 'mention'}
                    <a href={`/u/${chunk.username || chunk.content}`} class="mention-chip">@{chunk.content}</a>
                  {:else}
                    <span>{chunk.content}</span>
                  {/if}
                {/each}
              </div>

              <!-- Footer Action Row -->
              <footer class="comment-footer-actions">
                <button
                  type="button"
                  class="btn-footer-like"
                  class:liked={hasLiked}
                  onclick={() => mutateLike(comment.id)}
                  disabled={!profile || busy}
                  title={hasLiked ? 'Descurtir' : 'Curtir comentário'}
                >
                  <Heart size={13} class={hasLiked ? 'fill-rose-500 text-rose-500' : ''} />
                  <span>{comment.comment_likes?.length || 0}</span>
                </button>

                {#if profile}
                  <button
                    type="button"
                    class="btn-footer-action"
                    onclick={() => openInlineReply(comment)}
                    title="Responder a este comentário"
                  >
                    <CornerDownRight size={12} />
                    <span>Responder</span>
                  </button>
                {/if}

                {#if isAuthor}
                  <button
                    type="button"
                    class="btn-footer-action"
                    onclick={() => startInlineEdit(comment)}
                    title="Editar comentário"
                  >
                    <Edit3 size={11} />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    class="btn-footer-action text-danger"
                    disabled={busy || deleteBusy}
                    onclick={() => (commentToDelete = comment)}
                    title="Excluir comentário"
                  >
                    <Trash2 size={11} />
                    <span>Apagar</span>
                  </button>
                {:else if profile}
                  <button
                    type="button"
                    class="btn-footer-action"
                    onclick={() => (reportingComment = comment)}
                    title="Denunciar comentário"
                  >
                    <Flag size={11} />
                    <span>Denunciar</span>
                  </button>
                {/if}
              </footer>
            {/if}
          </div>
        </article>

        <!-- INLINE COMPOSER DIRECTLY UNDER TARGET COMMENT -->
        {#if activeReplyId === comment.id}
          <div class="inline-reply-container">
            <div class="inline-composer-card">
              <div class="inline-reply-header">
                <CornerDownRight size={13} class="text-purple-400" />
                <span>Respondendo a</span>
                <strong class="text-purple-300">@{comment.members?.display_name || comment.members?.username || 'leitor'}</strong>
                <button
                  type="button"
                  class="btn-close-inline"
                  onclick={cancelInlineReply}
                  title="Fechar resposta"
                  aria-label="Cancelar resposta"
                >
                  <X size={13} />
                </button>
              </div>

              <!-- Hidden File Input for Inline Upload -->
              <input
                type="file"
                bind:this={replyFileInputRef}
                onchange={(e) => handleFileInputChange(e, true)}
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                style="display: none;"
                aria-hidden="true"
              />

              <textarea
                bind:value={replyBody}
                bind:this={inlineReplyComposerEl}
                rows="2"
                maxlength="2000"
                placeholder={`Escreva sua resposta para @${comment.members?.display_name || comment.members?.username || 'leitor'}…`}
                class="inline-reply-textarea"
                onpaste={(e) => handlePaste(e, true)}
                ondrop={(e) => handleDrop(e, true)}
                ondragover={(e) => e.preventDefault()}
                onkeydown={(e) => {
                  if (e.key === 'Escape') cancelInlineReply();
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void sendComment(comment.id);
                }}
              ></textarea>

              <!-- Attached Media Chip -->
              {#if replyMedia}
                <div class="attached-media-chip inline-chip">
                  <div class="attached-media-left">
                    <div class="attached-thumb-wrap" class:is-spoiler={replyMedia.isSpoiler}>
                      <img src={replyMedia.previewUrl} alt="Prévia" class="attached-thumb-img" />
                      {#if replyMedia.isSpoiler}
                        <div class="attached-spoiler-overlay"><EyeOff size={10} /><span>SPOILER</span></div>
                      {:else}
                        <span class="attached-thumb-badge">{replyMedia.isGif ? 'GIF' : 'IMG'}</span>
                      {/if}
                    </div>
                    <div class="attached-media-meta">
                      <span class="attached-filename">{replyMedia.alt || 'Mídia anexada'}</span>
                      <span class="attached-status">
                        {#if replyMedia.uploading}
                          <span class="uploading-state"><Loader2 size={11} class="spin-anim inline mr-1" /> Enviando…</span>
                        {:else if replyMedia.error}
                          <span class="text-rose-400">{replyMedia.error}</span>
                        {:else}
                          <span class="text-emerald-400">Pronto</span>
                        {/if}
                      </span>
                    </div>
                  </div>
                  <div class="attached-media-controls">
                    <label class="spoiler-check-label" class:is-active={replyMedia.isSpoiler}>
                      <input type="checkbox" bind:checked={replyMedia.isSpoiler} class="spoiler-check-input" />
                      <EyeOff size={12} />
                      <span>Spoiler</span>
                    </label>
                    <button type="button" class="btn-remove-attachment" onclick={() => (replyMedia = null)}>
                      <X size={12} />
                    </button>
                  </div>
                </div>
              {/if}

              <div class="inline-composer-footer">
                <div class="inline-helpers">
                  <button
                    type="button"
                    class="helper-btn-sm"
                    onclick={() => insertSpoilerTag(true)}
                    title="Inserir tag de spoiler oculta (||texto||)"
                  >
                    <EyeOff size={12} />
                    <span>Spoiler</span>
                  </button>
                  <button
                    type="button"
                    class="helper-btn-sm"
                    onclick={() => replyFileInputRef?.click()}
                    title="Anexar imagem ou GIF"
                  >
                    <ImageIcon size={12} />
                    <span>Mídia</span>
                  </button>
                  <button
                    type="button"
                    class="helper-btn-sm"
                    onclick={() => insertMentionTag(true)}
                    title="Mencionar (@)"
                  >
                    <AtSign size={12} />
                    <span>@</span>
                  </button>
                </div>

                <div class="inline-submit-group">
                  <button
                    type="button"
                    class="btn-inline-cancel"
                    onclick={cancelInlineReply}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    class="btn-inline-submit"
                    onclick={() => sendComment(comment.id)}
                    disabled={busy || (!replyBody.trim() && !replyMedia?.url) || replyMedia?.uploading}
                  >
                    <Send size={12} />
                    <span>{busy ? 'Enviando…' : 'Responder'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- NESTED CHILDREN REPLIES (RECURSIVE BRANCH) -->
        {#if node.children.length > 0}
          <div class="thread-replies-nest" class:max-indent={node.depth >= 2}>
            <!-- Clickable Reddit-Style Vertical Thread Line -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              class="thread-vertical-rail"
              onclick={() => toggleCollapse(comment.id)}
              role="button"
              tabindex="0"
              title="Clique na linha para recolher esta conversa"
            >
              <div class="rail-line"></div>
            </div>

            <div class="thread-children-list">
              {#each node.children as child (child.comment.id)}
                {@render renderCommentNode(child)}
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/snippet}

  <!-- ======================================================================= -->
  <!-- ROOT COMMENTS FEED                                                      -->
  <!-- ======================================================================= -->
  {#if commentTree.length === 0}
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
      {#each commentTree as rootNode (rootNode.comment.id)}
        {@render renderCommentNode(rootNode)}
      {/each}
    </div>
  {/if}

  <!-- REPORT MODAL -->
  {#if reportingComment}
    <ReportModal
      workId={workId}
      chapterId={chapterId}
      commentId={reportingComment.id}
      onclose={() => (reportingComment = null)}
    />
  {/if}

  <!-- CONFIRM DELETE COMMENT MODAL -->
  {#if commentToDelete}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="confirm-modal-backdrop"
      onclick={() => !deleteBusy && (commentToDelete = null)}
      role="presentation"
    >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="confirm-modal-box"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="del-modal-title"
      >
        <div class="confirm-modal-icon">
          <Trash2 size={22} class="text-rose-400" />
        </div>
        <h3 id="del-modal-title" class="confirm-modal-title">Apagar Comentário</h3>
        <p class="confirm-modal-desc">
          Tem certeza que deseja apagar este comentário? Esta ação não pode ser desfeita.
        </p>
        <div class="confirm-modal-actions">
          <button
            type="button"
            class="btn-modal-cancel"
            disabled={deleteBusy}
            onclick={() => (commentToDelete = null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn-modal-delete"
            disabled={deleteBusy}
            onclick={confirmDelete}
          >
            {#if deleteBusy}
              <Loader2 size={14} class="animate-spin" />
              <span>Apagando...</span>
            {:else}
              <Trash2 size={14} />
              <span>Sim, Apagar</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
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
    padding: 20px 0 40px 0;
    box-sizing: border-box;
    color: #e2e8f0;
  }

  /* Hero Header */
  .comments-hero-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
    padding-bottom: 14px;
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
    font-size: 18px;
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
    padding: 5px 12px;
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
    padding: 3px 10px;
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

  /* Main Top-Level Composer Card */
  .composer-card-premium {
    background: #0c0e18;
    border: 1px solid rgba(168, 85, 247, 0.22);
    border-radius: 14px;
    padding: 14px 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
    margin-bottom: 24px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .composer-card-premium:focus-within {
    border-color: rgba(168, 85, 247, 0.5);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(168, 85, 247, 0.15);
  }

  .composer-input-area {
    position: relative;
  }

  .composer-textarea {
    width: 100%;
    background: transparent;
    border: none;
    color: #f8fafc;
    font-size: 13.5px;
    line-height: 1.5;
    outline: none;
    resize: vertical;
    min-height: 68px;
    font-family: inherit;
  }

  .composer-textarea::placeholder {
    color: #64748b;
  }

  .composer-action-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 10px;
    padding-top: 10px;
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
    padding: 4px 9px;
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

  .btn-submit-premium {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    border: none;
    border-radius: 8px;
    padding: 7px 14px;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(168, 85, 247, 0.35);
    transition: all 0.2s ease;
  }

  .btn-submit-premium:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(168, 85, 247, 0.5);
  }

  .btn-submit-premium:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Guest Auth Card */
  .guest-auth-card {
    display: flex;
    align-items: center;
    gap: 14px;
    background: rgba(168, 85, 247, 0.06);
    border: 1px solid rgba(168, 85, 247, 0.2);
    border-radius: 12px;
    padding: 14px 18px;
    margin-bottom: 24px;
  }

  .guest-auth-card h4 {
    margin: 0 0 2px 0;
    font-size: 13.5px;
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
    padding: 40px 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 14px;
  }

  .empty-icon-ring {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(168, 85, 247, 0.1);
    border: 1px solid rgba(168, 85, 247, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 14px auto;
  }

  .empty-discussion-card h3 {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 4px 0;
  }

  .empty-discussion-card p {
    font-size: 12.5px;
    color: #94a3b8;
    margin: 0;
  }

  /* =========================================================================
     REDDIT-STYLE HIERARCHICAL THREADS & VERTICAL CONNECTING GUIDE LINES
     ========================================================================= */

  .comments-thread-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .thread-node-wrapper {
    position: relative;
    width: 100%;
  }

  .thread-children-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Vertical Guide Rail (Reddit Style) */
  .thread-replies-nest {
    position: relative;
    margin-top: 8px;
    margin-left: 12px;
    padding-left: 14px;
  }

  .thread-vertical-rail {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 14px;
    cursor: pointer;
    z-index: 5;
    user-select: none;
    -webkit-user-select: none;
  }

  .rail-line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 3px;
    width: 2px;
    background: rgba(168, 85, 247, 0.22);
    border-radius: 9999px;
    transition: background-color 0.18s ease, width 0.18s ease, box-shadow 0.18s ease;
  }

  .thread-vertical-rail:hover .rail-line {
    background: #a855f7;
    width: 3px;
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.6);
  }

  /* Collapsed Thread Bar */
  .thread-collapsed-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    font-size: 12px;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
    -webkit-user-select: none;
  }

  .thread-collapsed-bar:hover {
    background: rgba(168, 85, 247, 0.08);
    border-color: rgba(168, 85, 247, 0.3);
    color: #e2e8f0;
  }

  .collapsed-toggle-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: rgba(168, 85, 247, 0.18);
    color: #c084fc;
    font-weight: 800;
  }

  .collapsed-author {
    color: #f1f5f9;
    font-weight: 700;
  }

  .collapsed-handle {
    font-size: 11px;
    color: #64748b;
  }

  .collapsed-time {
    font-size: 11px;
    color: #64748b;
  }

  .collapsed-badge {
    font-size: 10px;
    font-weight: 800;
    color: #c084fc;
    background: rgba(168, 85, 247, 0.15);
    padding: 1px 6px;
    border-radius: 9999px;
  }

  .collapsed-hint {
    margin-left: auto;
    font-size: 10px;
    color: #64748b;
  }

  /* =========================================================================
     COMPACT NATURAL COMMENT CARDS (ELIMINATING GIANT EMPTY SPACES)
     ========================================================================= */

  .comment-card-modern {
    position: relative;
    background: #0c0e18;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
  }

  .comment-card-modern.is-nested-card {
    background: rgba(15, 13, 25, 0.7);
    border-color: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }

  .comment-card-modern:hover {
    border-color: rgba(255, 255, 255, 0.13);
  }

  .comment-card-modern.is-reply-target {
    border-color: #a855f7;
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.35);
  }

  .comment-banner-bg {
    position: absolute;
    inset: 0;
    background-size: cover !important;
    background-position: center !important;
    opacity: 0.14;
    z-index: 0;
    pointer-events: none;
  }

  .comment-banner-mask {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(12, 14, 24, 0.4) 0%, rgba(12, 14, 24, 0.95) 100%);
    z-index: 0;
    pointer-events: none;
  }

  .comment-content-wrap {
    position: relative;
    z-index: 1;
    padding: 10px 14px;
  }

  .is-nested-card .comment-content-wrap {
    padding: 8px 12px;
  }

  /* Author Row */
  .comment-author-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }

  .author-details {
    display: flex;
    align-items: center;
    flex-grow: 1;
    overflow: hidden;
  }

  .author-headline {
    display: flex;
    align-items: center;
    gap: 6px;
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
    padding: 1px 5px;
    border-radius: 4px;
  }

  .parent-mention-tag {
    font-size: 10.5px;
    font-weight: 700;
    color: #c084fc;
    background: rgba(168, 85, 247, 0.12);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .comment-time {
    font-size: 11px;
    color: #64748b;
  }

  .btn-thread-collapse {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: transparent;
    border: 1px solid transparent;
    color: #64748b;
    cursor: pointer;
    margin-left: auto;
    transition: all 0.15s ease;
  }

  .btn-thread-collapse:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #e2e8f0;
    border-color: rgba(255, 255, 255, 0.1);
  }

  /* Comment Text */
  .comment-text-body {
    font-size: 13.5px;
    line-height: 1.5;
    color: #e2e8f0;
    margin-bottom: 6px;
    word-break: break-word;
    white-space: pre-wrap;
  }

  /* Discord-style Inline Spoilers */
  .discord-spoiler {
    display: inline;
    padding: 1px 5px;
    border-radius: 4px;
    background-color: #2b2342;
    border: 1px solid rgba(168, 85, 247, 0.25);
    color: transparent;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    vertical-align: baseline;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    font-size: inherit;
    font-family: inherit;
    line-height: inherit;
    text-align: left;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .discord-spoiler:hover:not(.is-revealed) {
    background-color: #382d54;
    border-color: rgba(168, 85, 247, 0.45);
  }

  .discord-spoiler.is-revealed {
    background-color: rgba(168, 85, 247, 0.14);
    border-color: rgba(168, 85, 247, 0.28);
    color: #f1f5f9;
    user-select: text;
    -webkit-user-select: text;
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

  /* Footer Action Row */
  .comment-footer-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 2px;
  }

  .btn-footer-like {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 6px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
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
    padding: 3px 5px;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .btn-footer-action:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.05);
  }

  .btn-footer-action.text-danger:hover {
    color: #f43f5e;
    background: rgba(244, 63, 94, 0.1);
  }

  /* In-Place Inline Edit Box */
  .inline-edit-box {
    margin-top: 6px;
    margin-bottom: 6px;
  }

  .inline-edit-textarea {
    width: 100%;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 8px;
    padding: 8px 10px;
    color: #f8fafc;
    font-size: 13.5px;
    line-height: 1.45;
    outline: none;
    resize: vertical;
    font-family: inherit;
    box-sizing: border-box;
  }

  .inline-edit-textarea:focus {
    border-color: #a855f7;
  }

  .inline-edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
  }

  .btn-inline-cancel {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 8px;
  }

  .btn-inline-cancel:hover {
    color: #ffffff;
  }

  .btn-inline-save {
    background: #7c3aed;
    border: none;
    border-radius: 6px;
    color: #ffffff;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    padding: 4px 12px;
  }

  .btn-inline-save:hover:not(:disabled) {
    background: #9333ea;
  }

  /* =========================================================================
     INLINE COMPOSER DIRECTLY UNDER TARGET COMMENT
     ========================================================================= */

  .inline-reply-container {
    margin-top: 8px;
    margin-bottom: 8px;
  }

  .inline-composer-card {
    background: #110e20;
    border: 1px solid rgba(168, 85, 247, 0.35);
    border-radius: 10px;
    padding: 10px 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  }

  .inline-reply-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 8px;
  }

  .btn-close-inline {
    margin-left: auto;
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 2px;
  }

  .btn-close-inline:hover {
    color: #ffffff;
  }

  .inline-reply-textarea {
    width: 100%;
    background: transparent;
    border: none;
    color: #f8fafc;
    font-size: 13px;
    line-height: 1.45;
    outline: none;
    resize: vertical;
    min-height: 48px;
    font-family: inherit;
    box-sizing: border-box;
  }

  .inline-reply-textarea::placeholder {
    color: #64748b;
  }

  .inline-composer-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .inline-helpers {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .helper-btn-sm {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 5px;
    padding: 3px 7px;
    color: #94a3b8;
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .helper-btn-sm:hover {
    background: rgba(168, 85, 247, 0.15);
    color: #d8b4fe;
    border-color: rgba(168, 85, 247, 0.3);
  }

  .inline-submit-group {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  .btn-inline-submit {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    border: none;
    border-radius: 6px;
    padding: 5px 12px;
    color: #ffffff;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(168, 85, 247, 0.3);
    transition: all 0.15s ease;
  }

  .btn-inline-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 3px 10px rgba(168, 85, 247, 0.5);
  }

  .btn-inline-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Attached Media Preview Bar in Composer */
  .attached-media-chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 8px;
    padding: 6px 10px;
    background: rgba(168, 85, 247, 0.08);
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 8px;
  }

  .attached-media-chip.inline-chip {
    margin-top: 4px;
    padding: 4px 8px;
  }

  .attached-media-left {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
  }

  .attached-thumb-wrap {
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 6px;
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
    padding: 1px 3px;
    border-radius: 2px;
    background: rgba(0, 0, 0, 0.8);
    color: #38bdf8;
    text-transform: uppercase;
  }

  .attached-thumb-wrap.is-spoiler .attached-thumb-img {
    filter: blur(4px) brightness(0.6);
  }

  .attached-spoiler-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    background: rgba(14, 11, 23, 0.85);
    color: #c084fc;
    font-size: 7.5px;
    font-weight: 800;
  }

  .attached-media-meta {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .attached-filename {
    font-size: 11.5px;
    font-weight: 600;
    color: #f1f5f9;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
  }

  .attached-status {
    font-size: 10.5px;
    color: #94a3b8;
  }

  .attached-media-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .spoiler-check-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #cbd5e1;
    cursor: pointer;
    user-select: none;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .spoiler-check-label.is-active {
    color: #c084fc;
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.3);
  }

  .spoiler-check-input {
    accent-color: #a855f7;
    width: 13px;
    height: 13px;
    cursor: pointer;
  }

  .btn-remove-attachment {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px 6px;
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid rgba(244, 63, 94, 0.25);
    border-radius: 6px;
    color: #fb7185;
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-remove-attachment:hover {
    background: rgba(244, 63, 94, 0.22);
  }

  /* =========================================================================
     COMMENT MEDIA IN FEED (DISCORD STYLE NATURAL ENQUADRAMENTO)
     ========================================================================= */

  .comment-media-card {
    display: block;
    width: fit-content;
    max-width: min(100%, 460px);
    margin-top: 6px;
    margin-bottom: 6px;
    border-radius: 10px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    white-space: normal;
  }

  .media-view-wrapper {
    position: relative;
    display: block;
    width: fit-content;
    max-width: 100%;
  }

  .media-rehide-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    background: rgba(14, 11, 23, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(168, 85, 247, 0.35);
    border-radius: 6px;
    color: #c084fc;
    font-size: 10.5px;
    font-weight: 700;
    cursor: pointer;
    z-index: 5;
    transition: all 0.15s ease;
  }

  .media-rehide-btn:hover {
    background: rgba(168, 85, 247, 0.25);
    border-color: rgba(168, 85, 247, 0.6);
    color: #f1f5f9;
  }

  .media-view-btn {
    position: relative;
    display: block;
    width: fit-content;
    max-width: 100%;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    text-align: left;
    border-radius: 9px;
    overflow: hidden;
  }

  .comment-rendered-img {
    display: block;
    max-width: min(100%, 460px);
    max-height: 380px;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 9px;
    transition: filter 0.18s ease;
  }

  .comment-rendered-img:hover {
    filter: brightness(1.05);
  }

  .media-type-badge {
    position: absolute;
    bottom: 6px;
    left: 6px;
    padding: 1px 5px;
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    font-size: 9px;
    font-weight: 800;
    color: #38bdf8;
    letter-spacing: 0.05em;
  }

  .media-spoiler-card {
    position: relative;
    display: block;
    width: fit-content;
    max-width: 100%;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    border-radius: 9px;
    overflow: hidden;
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
    background: rgba(14, 11, 23, 0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #c084fc;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 10px;
    text-align: center;
    transition: background-color 0.15s ease;
  }

  .media-spoiler-card:hover .media-spoiler-overlay {
    background: rgba(22, 17, 36, 0.95);
  }

  /* Notice Alert */
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

  /* Modals */
  .confirm-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 220;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .confirm-modal-box {
    position: relative;
    width: 100%;
    max-width: 380px;
    background: #13101e;
    border: 1px solid rgba(244, 63, 94, 0.35);
    border-radius: 14px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65), 0 0 24px rgba(244, 63, 94, 0.12);
  }

  .confirm-modal-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid rgba(244, 63, 94, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }

  .confirm-modal-title {
    font-size: 16px;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0 0 6px 0;
  }

  .confirm-modal-desc {
    font-size: 12.5px;
    color: #94a3b8;
    line-height: 1.45;
    margin: 0 0 18px 0;
  }

  .confirm-modal-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  .btn-modal-cancel {
    flex: 1;
    padding: 9px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #cbd5e1;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .btn-modal-cancel:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .btn-modal-delete {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 12px;
    background: #e11d48;
    border: 1px solid #f43f5e;
    border-radius: 8px;
    color: #ffffff;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .btn-modal-delete:hover:not(:disabled) {
    background: #be123c;
    box-shadow: 0 0 12px rgba(244, 63, 94, 0.4);
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
    padding: 16px;
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
    top: -40px;
    right: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 9999px;
    color: #ffffff;
    padding: 5px 12px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-close-lightbox:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* =========================================================================
     RESPONSIVE BREAKPOINTS (DESKTOP & MOBILE ANDROID OPTIMIZATIONS)
     ========================================================================= */

  @media (max-width: 640px) {
    .comments-hero-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .header-controls {
      width: 100%;
      justify-content: space-between;
    }

    .composer-card-premium {
      padding: 12px 10px;
      margin-bottom: 18px;
      border-radius: 10px;
    }

    .composer-action-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
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

    .comment-content-wrap {
      padding: 8px 10px;
    }

    .is-nested-card .comment-content-wrap {
      padding: 6px 8px;
    }

    /* Mobile Indentation Capping: Keep columns readable */
    .thread-replies-nest {
      margin-left: 6px;
      padding-left: 10px;
    }

    .thread-replies-nest.max-indent {
      margin-left: 2px;
      padding-left: 6px;
    }

    .thread-vertical-rail {
      width: 10px;
    }

    .rail-line {
      left: 2px;
    }

    .author-name {
      font-size: 12px;
    }

    .author-tag {
      font-size: 10px;
    }

    .comment-time {
      font-size: 10px;
    }

    .comment-text-body {
      font-size: 12.5px;
      line-height: 1.45;
    }

    .comment-rendered-img {
      max-width: 100%;
      max-height: 300px;
    }
  }
</style>