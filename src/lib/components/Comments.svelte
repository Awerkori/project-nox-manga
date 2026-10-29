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
    Eye,
    EyeOff,
    ImageOff,
    Shield,
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
    Plus,
    Maximize2,
    LayoutList,
    Layers
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
    parentAuthor?: {
      id: string;
      username: string;
      displayName: string;
    } | null;
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
    profile = null,
    role = null
  }: {
    comments: Comment[];
    workId: string;
    chapterId?: string | null;
    chapterNumber?: string | number | null;
    chapterTitle?: string | null;
    displayNumber?: string | null;
    workSlug?: string | null;
    workTitle?: string | null;
    profile?: { id: string; role?: string } | null;
    role?: string | null;
  } = $props();

  const canModerate = $derived(
    Boolean(
      role === 'ADMIN' ||
      role === 'STAFF_SITE' ||
      role === 'EDITOR' ||
      (profile as any)?.role === 'ADMIN' ||
      (profile as any)?.role === 'STAFF_SITE' ||
      (profile as any)?.role === 'EDITOR' ||
      (profile?.id && (profile.id === '732fbe87-5040-41fb-9983-0aedb2af44c8' || profile.id === '8400eba9-5b92-486f-a6cb-9e69958cf5cb'))
    )
  );

  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================

  // Top-Level Main Composer
  let mainBody = $state('');
  let showMainPreview = $state(false);
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
  let reportingTarget = $state<{
    commentId: string;
    mediaUrl?: string;
    mediaUrls?: string[];
    authorName?: string;
  } | null>(null);
  let lightboxMedia = $state<{ url: string; alt?: string } | null>(null);
  let lightboxLoading = $state(false);
  let lightboxError = $state(false);
  let sortBy = $state<'recent' | 'likes'>('recent');

  // V15: Natural thread composition comparison (Alternativa A: Reddit Minimalista vs Alternativa B: Agrupada)
  let threadStyle = $state<'a' | 'b'>('a');

  function setThreadStyle(style: 'a' | 'b') {
    threadStyle = style;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nox_thread_style', style);
        const url = new URL(window.location.href);
        url.searchParams.set('thread_style', style);
        window.history.replaceState({}, '', url.toString());
      } catch {}
    }
  }

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
      let parentAuthor: { id: string; username: string; displayName: string } | null = null;
      if (livingParent && livingParent.members) {
        parentAuthor = {
          id: livingParent.user_id,
          username: livingParent.members.username || 'usuario',
          displayName: livingParent.members.display_name || livingParent.members.username || 'Usuário'
        };
      }
      nodeMap.set(c.id, {
        comment: c,
        children: [],
        depth: 0,
        parentAuthor
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
    lightboxLoading = true;
    lightboxError = false;
    lightboxMedia = { url, alt: alt || 'Mídia em tamanho real' };
  }

  function closeLightbox() {
    lightboxMedia = null;
    lightboxLoading = false;
    lightboxError = false;
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

  function resolveMediaUrl(rawUrl: string): { directUrl: string; isGif: boolean } | null {
    try {
      const u = new URL(rawUrl.trim());
      const lower = u.href.toLowerCase();

      // 1. GIPHY Links (direct media & share pages)
      if (u.hostname.includes('giphy.com')) {
        if (lower.includes('/media/')) {
          const isGif = lower.includes('.gif') || lower.includes('.webp');
          return { directUrl: u.href, isGif };
        }
        const giphyMatch = u.pathname.match(/\/gifs\/(?:.*-)?([a-zA-Z0-9]+)$/);
        if (giphyMatch && giphyMatch[1]) {
          return { directUrl: `https://media.giphy.com/media/${giphyMatch[1]}/giphy.gif`, isGif: true };
        }
      }

      // 2. Tenor Links (direct & share pages)
      if (u.hostname.includes('tenor.com')) {
        if (lower.endsWith('.gif') || lower.endsWith('.webp') || lower.includes('/media/')) {
          return { directUrl: u.href, isGif: true };
        }
        const tenorMatch = u.pathname.match(/-gif-([0-9]+)$/);
        if (tenorMatch && tenorMatch[1]) {
          return { directUrl: `https://c.tenor.com/${tenorMatch[1]}/tenor.gif`, isGif: true };
        }
      }

      // 3. Imgur (direct & gifv)
      if (u.hostname.includes('imgur.com')) {
        if (lower.endsWith('.gifv')) {
          return { directUrl: u.href.replace(/\.gifv$/i, '.gif'), isGif: true };
        }
        if (lower.match(/\.(gif|png|jpe?g|webp)$/i)) {
          return { directUrl: u.href, isGif: lower.endsWith('.gif') };
        }
      }

      // 4. Standard Direct Image Extensions
      const extMatch = u.pathname.match(/\.(gif|png|jpe?g|webp|avif)$/i);
      if (extMatch) {
        const isGif = extMatch[1].toLowerCase() === 'gif';
        return { directUrl: u.href, isGif };
      }

      // 5. Common image CDN hostnames
      if (u.hostname.includes('images.unsplash.com') || u.hostname.includes('wp.com')) {
        return { directUrl: u.href, isGif: false };
      }

      return null;
    } catch {
      return null;
    }
  }

  function verifyMediaImage(
    url: string,
    timeoutMs = 7000
  ): Promise<{ ok: boolean; width: number; height: number; isGif: boolean; url: string }> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve({ ok: true, width: 200, height: 200, isGif: url.toLowerCase().includes('.gif'), url });
        return;
      }
      const img = new Image();
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          img.src = '';
          resolve({ ok: false, width: 0, height: 0, isGif: false, url });
        }
      }, timeoutMs);

      img.onload = () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          const isGif =
            url.toLowerCase().includes('.gif') ||
            url.toLowerCase().includes('giphy') ||
            url.toLowerCase().includes('tenor');
          resolve({
            ok: true,
            width: img.naturalWidth || 200,
            height: img.naturalHeight || 200,
            isGif,
            url
          });
        }
      };

      img.onerror = () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve({ ok: false, width: 0, height: 0, isGif: false, url });
        }
      };

      img.src = url;
    });
  }

  function insertTextAtCursor(textToInsert: string, isInline: boolean) {
    const textarea = isInline ? inlineReplyComposerEl : mainComposerEl;
    if (!textarea) return;
    const current = isInline ? replyBody : mainBody;
    const start = textarea.selectionStart || current.length;
    const end = textarea.selectionEnd || current.length;
    const updated = current.slice(0, start) + textToInsert + current.slice(end);
    if (isInline) replyBody = updated;
    else mainBody = updated;
    tick().then(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    });
  }

  async function handlePaste(e: ClipboardEvent, isInline: boolean) {
    if (e.clipboardData?.files?.length) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        void handleFileUpload(file, isInline);
        return;
      }
    }

    const pastedText = e.clipboardData?.getData('text') || '';
    if (!pastedText) return;

    const currentMedia = isInline ? replyMedia : mainMedia;
    const urlRegex = /https?:\/\/[^\s<>"')]+/gi;
    const matches = pastedText.match(urlRegex);

    if (matches && matches.length > 0 && !currentMedia) {
      for (const rawUrl of matches) {
        const resolved = resolveMediaUrl(rawUrl);
        if (resolved) {
          e.preventDefault();

          const remainingText = pastedText.replace(rawUrl, '').trim();
          if (remainingText) {
            insertTextAtCursor(remainingText, isInline);
          }

          const tempMedia = {
            url: resolved.directUrl,
            previewUrl: resolved.directUrl,
            isSpoiler: false,
            isGif: resolved.isGif,
            alt: 'Mídia incorporada',
            uploading: true
          };
          if (isInline) replyMedia = tempMedia;
          else mainMedia = tempMedia;

          const verified = await verifyMediaImage(resolved.directUrl);
          if (verified.ok) {
            const finalMedia = {
              url: resolved.directUrl,
              previewUrl: resolved.directUrl,
              isSpoiler: false,
              isGif: verified.isGif,
              alt: 'Mídia incorporada',
              uploading: false
            };
            if (isInline) replyMedia = finalMedia;
            else mainMedia = finalMedia;
          } else {
            if (isInline) replyMedia = null;
            else mainMedia = null;
            notice = 'Não foi possível carregar a imagem ou GIF do link informado. Link mantido no texto.';
            insertTextAtCursor(rawUrl, isInline);
          }
          return;
        }
      }
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
        showMainPreview = false;
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

  let selectedMediaIdx = $state(0);
  let moderateBusy = $state(false);

  async function handleModerateMedia(mode: 'remove' | 'spoiler') {
    if (!commentToDelete || moderateBusy || deleteBusy) return;
    const target = commentToDelete;
    const mediaList = getCommentMediaUrls(target);
    const targetUrl = mediaList[selectedMediaIdx] || mediaList[0];
    if (!targetUrl) {
      await confirmDelete();
      return;
    }

    moderateBusy = true;
    notice = '';
    try {
      const res = (await action('member', 'comment_moderate_media', {
        comment_id: target.id,
        media_url: targetUrl,
        mode
      })) as any;

      if (res?.action === 'removed_and_deleted') {
        deletedCommentIds.add(target.id);
      }

      commentToDelete = null;
      await invalidateAll();
    } catch (e: any) {
      notice = e?.message || 'Erro ao moderar mídia.';
    } finally {
      moderateBusy = false;
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
    if (typeof window !== 'undefined') {
      try {
        const param = new URL(window.location.href).searchParams.get('thread_style');
        if (param === 'a' || param === 'b') {
          threadStyle = param;
        } else {
          const saved = localStorage.getItem('nox_thread_style');
          if (saved === 'a' || saved === 'b') {
            threadStyle = saved;
          }
        }
      } catch {}
    }
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

  function getCommentMediaUrls(comment: Comment): string[] {
    const chunks = parseCommentBody(comment.body);
    return chunks
      .filter((c) => c.type === 'media' && c.mediaUrl)
      .map((c) => c.mediaUrl as string);
  }
</script>

<section class="comments-section-root" data-thread-style={threadStyle}>
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
      <!-- V15: Interactive Thread Style Comparison Switcher -->
      <div class="thread-style-selector" role="group" aria-label="Estilo de visualização das conversas">
        <button
          type="button"
          class="btn-style-pill"
          class:is-active={threadStyle === 'a'}
          onclick={() => setThreadStyle('a')}
          title="Alternativa A: Reddit Minimalista (linhas verticais discretas e fluxo contínuo)"
        >
          <LayoutList size={12} />
          <span>Estilo A (Reddit)</span>
        </button>
        <button
          type="button"
          class="btn-style-pill"
          class:is-active={threadStyle === 'b'}
          onclick={() => setThreadStyle('b')}
          title="Alternativa B: Conversa Agrupada (bloco unificado e agrupamento visual)"
        >
          <Layers size={12} />
          <span>Estilo B (Agrupado)</span>
        </button>
      </div>

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

        <!-- Sizable Pre-Upload Attachment Card (Adaptive 180-240px, Click-to-Enlarge) -->
        {#if mainMedia}
          <div class="pre-upload-attachment-card" role="region" aria-label="Mídia anexada">
            <div class="pre-upload-preview-viewport">
              <button
                type="button"
                class="pre-upload-zoom-trigger"
                onclick={() => openLightbox(mainMedia?.previewUrl, mainMedia?.alt)}
                title="Clique para ampliar e verificar a mídia antes de publicar"
              >
                <img
                  src={mainMedia.previewUrl}
                  alt={mainMedia.alt || 'Prévia'}
                  class="pre-upload-img"
                  class:is-spoiler-blurred={mainMedia.isSpoiler}
                />
                <div class="pre-upload-hover-lens">
                  <Maximize2 size={15} />
                  <span>Ampliar prévia</span>
                </div>
                {#if mainMedia.isGif}
                  <span class="pre-upload-type-badge">GIF ANIMADO</span>
                {/if}
                {#if mainMedia.isSpoiler}
                  <div class="pre-upload-spoiler-flag">
                    <EyeOff size={12} />
                    <span>SPOILER OCULTO</span>
                  </div>
                {/if}
              </button>
            </div>

            <div class="pre-upload-meta-bar">
              <div class="pre-upload-info">
                <span class="pre-upload-name" title={mainMedia.alt || 'Mídia'}>{mainMedia.alt || 'Imagem anexada'}</span>
                <span class="pre-upload-status">
                  {#if mainMedia.uploading}
                    <span class="text-amber-400 inline-flex items-center gap-1"><Loader2 size={11} class="spin-anim" /> Enviando imagem…</span>
                  {:else if mainMedia.error}
                    <span class="text-rose-400">{mainMedia.error}</span>
                  {:else}
                    <span class="text-emerald-400 inline-flex items-center gap-1"><Check size={11} /> Pronto para publicar</span>
                  {/if}
                </span>
              </div>

              <div class="pre-upload-actions">
                <label class="spoiler-check-toggle" class:is-active={mainMedia.isSpoiler} title="Ocultar como spoiler">
                  <input
                    type="checkbox"
                    bind:checked={mainMedia.isSpoiler}
                    class="spoiler-checkbox"
                  />
                  <EyeOff size={13} />
                  <span>Ocultar spoiler</span>
                </label>

                <button
                  type="button"
                  class="btn-remove-pre-upload"
                  onclick={() => (mainMedia = null)}
                  title="Remover mídia anexada"
                  aria-label="Remover anexo"
                >
                  <X size={13} />
                  <span>Remover</span>
                </button>
              </div>
            </div>
          </div>
        {/if}

        <!-- LIVE FULL COMMENT PREVIEW BOX (SIMULATION BEFORE PUBLISHING) -->
        {#if showMainPreview}
          <div class="composer-live-preview-box">
            <div class="preview-box-badge">
              <Sparkles size={13} class="text-purple-400" />
              <span>PRÉ-VISUALIZAÇÃO DO COMENTÁRIO</span>
              <span class="preview-subtext">(como aparecerá na discussão)</span>
            </div>
            {#if !mainBody.trim() && !mainMedia?.previewUrl}
              <p class="preview-empty-hint">Escreva um comentário ou anexe uma imagem/GIF para ver a pré-visualização completa.</p>
            {:else}
              {@const previewRawText = (() => {
                let text = mainBody.trim();
                if (mainMedia?.previewUrl) {
                  const mediaTag = mainMedia.isSpoiler
                    ? `||![${mainMedia.alt || 'Mídia'}](${mainMedia.previewUrl})||`
                    : `![${mainMedia.alt || 'Mídia'}](${mainMedia.previewUrl})`;
                  text = text ? `${text}\n\n${mediaTag}` : mediaTag;
                }
                return text;
              })()}
              <div class="preview-rendered-card">
                <header class="comment-author-row">
                  <UserAvatar
                    avatarId={profile?.avatar_id}
                    frameId={profile?.avatar_frame_id}
                    crop={profile?.avatar_crop}
                    displayName={profile?.display_name || profile?.username || 'Você'}
                    size={30}
                  />
                  <div class="author-details">
                    <div class="author-headline">
                      <span class="author-name">{profile?.display_name || 'Você'}</span>
                      <span class="author-tag">@{profile?.username || 'voce'}</span>
                      <span class="badge-self">Você (Prévia)</span>
                      <time class="comment-time">Agora mesmo</time>
                    </div>
                  </div>
                </header>

                <div class="comment-text-body">
                  {#each parseCommentBody(previewRawText) as chunk, idx (idx)}
                    {#if chunk.type === 'spoiler'}
                      <button
                        type="button"
                        class="discord-spoiler"
                        class:is-revealed={revealedSpoilers.has('preview:' + idx)}
                        onclick={() => toggleSpoiler('preview:' + idx)}
                        title={revealedSpoilers.has('preview:' + idx) ? 'Clique para ocultar spoiler' : 'Spoiler oculto: clique para testar'}
                      >{chunk.content}</button>
                    {:else if chunk.type === 'media'}
                      <div class="comment-media-card">
                        {#if chunk.isSpoiler && !revealedSpoilers.has('preview:media:' + idx)}
                          <button
                            type="button"
                            class="media-spoiler-card"
                            onclick={() => toggleSpoiler('preview:media:' + idx)}
                            title="Spoiler: Toque para ver"
                          >
                            <img src={chunk.mediaUrl} alt={chunk.mediaAlt || 'Mídia'} class="comment-rendered-img" />
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
                              <img src={chunk.mediaUrl} alt={chunk.mediaAlt || 'Mídia'} class="comment-rendered-img" />
                              {#if chunk.isGif || mainMedia?.isGif}
                                <span class="media-type-badge">GIF</span>
                              {/if}
                            </button>
                            {#if chunk.isSpoiler}
                              <button
                                type="button"
                                class="media-rehide-btn"
                                onclick={(e) => {
                                  e.stopPropagation();
                                  toggleSpoiler('preview:media:' + idx);
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
                      <span class="mention-chip">@{chunk.content}</span>
                    {:else}
                      <span>{chunk.content}</span>
                    {/if}
                  {/each}
                </div>
              </div>
            {/if}
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
            class:is-active={showMainPreview}
            onclick={() => (showMainPreview = !showMainPreview)}
            title="Pré-visualizar como seu comentário ficará após publicado"
          >
            {#if showMainPreview}
              <EyeOff size={13} />
              <span>Voltar a Editar</span>
            {:else}
              <Eye size={13} />
              <span>Pré-visualizar</span>
            {/if}
          </button>
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
    {@const canDelete = isAuthor || canModerate}
    {@const canEdit = isAuthor}
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
          {#if node.parentAuthor}
            <span class="collapsed-parent-tag">↳ @{node.parentAuthor.username}</span>
          {/if}
          <time class="collapsed-time">{date(comment.created_at)}</time>
          {#if descCount > 0}
            <span class="collapsed-badge">+{descCount} {descCount === 1 ? 'resposta' : 'respostas'}</span>
          {/if}
          <span class="collapsed-hint">Clique para expandir</span>
        </div>
      {:else}
        <!-- ACTIVE COMMENT CARD (V9 REDESIGNED 3-LEVEL HIERARCHY) -->
        <article
          id={'comment-' + comment.id}
          class="comment-card-modern"
          class:is-reply-target={activeReplyId === comment.id}
          class:has-comment-banner={!!commentBanner}
          class:is-root-card={node.depth === 0}
          class:is-nested-card={node.depth > 0}
          class:is-level-1={node.depth === 1}
          class:is-level-deep={node.depth >= 2}
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
                size={node.depth === 0 ? 36 : 28}
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
                  {#if node.parentAuthor}
                    <span class="reply-target-tag">
                      <span class="reply-target-arrow" aria-hidden="true">↳</span>
                      <span class="reply-target-label">em resposta a</span>
                      <a
                        href={`/u/${node.parentAuthor.username}`}
                        class="reply-target-link"
                        title={`Ver perfil de @${node.parentAuthor.username}`}
                        onclick={(e) => e.stopPropagation()}
                      >
                        @{node.parentAuthor.username}
                      </a>
                    </span>
                  {/if}
                  <span class="meta-separator" aria-hidden="true">·</span>
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

                          <!-- Clean media rendering: no overlaid buttons over the image/GIF -->
                          {#if chunk.isSpoiler}
                            <button
                              type="button"
                              class="media-action-pill btn-media-rehide"
                              onclick={(e) => {
                                e.stopPropagation();
                                toggleSpoiler(comment.id + ':media:' + idx);
                              }}
                              title="Ocultar spoiler novamente"
                            >
                              <EyeOff size={11} />
                              <span>Ocultar spoiler</span>
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

              <!-- Footer Action Row (V13: Ergonômico, Curtir e Responder alinhados à esquerda) -->
              <div class="comment-footer-actions">
                <div class="footer-primary-actions">
                  <button
                    type="button"
                    class="btn-footer-like"
                    class:liked={hasLiked}
                    onclick={() => mutateLike(comment.id)}
                    disabled={!profile || busy}
                    title={hasLiked ? 'Descurtir comentário' : 'Curtir comentário'}
                  >
                    <Heart size={15} class={hasLiked ? 'fill-rose-500 text-rose-500' : ''} />
                    <span class="like-counter">{comment.comment_likes?.length || 0}</span>
                  </button>

                  {#if profile}
                    <button
                      type="button"
                      class="btn-footer-reply"
                      onclick={() => openInlineReply(comment)}
                      title="Responder diretamente a este comentário"
                    >
                      <CornerDownRight size={15} />
                      <span>Responder</span>
                    </button>
                  {/if}
                </div>

                <div class="footer-secondary-actions">
                  {#if isAuthor}
                    <button
                      type="button"
                      class="btn-footer-secondary"
                      onclick={() => startInlineEdit(comment)}
                      title="Editar seu comentário"
                    >
                      <Edit3 size={13} />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      class="btn-footer-secondary text-danger"
                      disabled={busy || deleteBusy}
                      onclick={() => {
                        selectedMediaIdx = 0;
                        commentToDelete = comment;
                      }}
                      title="Excluir seu comentário"
                    >
                      <Trash2 size={13} />
                      <span>Apagar</span>
                    </button>
                  {:else}
                    {#if canModerate}
                      <button
                        type="button"
                        class="btn-footer-secondary text-danger btn-admin-delete"
                        disabled={busy || deleteBusy}
                        onclick={() => {
                          selectedMediaIdx = 0;
                          commentToDelete = comment;
                        }}
                        title="Moderação: Apagar comentário de outro usuário"
                      >
                        <Trash2 size={13} />
                        <span>Apagar</span>
                      </button>
                    {/if}
                    {#if profile}
                      <button
                        type="button"
                        class="btn-footer-secondary btn-footer-report text-muted-flag"
                        onclick={() => {
                          reportingTarget = {
                            commentId: comment.id,
                            authorName: comment.members?.display_name || comment.members?.username,
                            mediaUrls: getCommentMediaUrls(comment)
                          };
                        }}
                        title="Denunciar este comentário para a moderação"
                      >
                        <Flag size={13} />
                        <span>Denunciar</span>
                      </button>
                    {/if}
                  {/if}
                </div>
              </div>
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

              <!-- Attached Media Card (Sizable with Zoom Trigger in Inline Composer) -->
              {#if replyMedia}
                <div class="pre-upload-attachment-card is-inline-mode" role="region" aria-label="Mídia anexada à resposta">
                  <div class="pre-upload-preview-viewport">
                    <button
                      type="button"
                      class="pre-upload-zoom-trigger"
                      onclick={() => openLightbox(replyMedia?.previewUrl, replyMedia?.alt)}
                      title="Clique para ampliar prévia em tela cheia"
                    >
                      <img
                        src={replyMedia.previewUrl}
                        alt={replyMedia.alt || 'Prévia'}
                        class="pre-upload-img"
                        class:is-spoiler-blurred={replyMedia.isSpoiler}
                      />
                      <div class="pre-upload-hover-lens">
                        <Maximize2 size={14} />
                        <span>Ampliar</span>
                      </div>
                      {#if replyMedia.isGif}
                        <span class="pre-upload-type-badge">GIF</span>
                      {/if}
                      {#if replyMedia.isSpoiler}
                        <div class="pre-upload-spoiler-flag">
                          <EyeOff size={11} />
                          <span>SPOILER</span>
                        </div>
                      {/if}
                    </button>
                  </div>

                  <div class="pre-upload-meta-bar">
                    <div class="pre-upload-info">
                      <span class="pre-upload-name">{replyMedia.alt || 'Mídia anexada'}</span>
                      <span class="pre-upload-status">
                        {#if replyMedia.uploading}
                          <span class="text-amber-400 inline-flex items-center gap-1"><Loader2 size={11} class="spin-anim" /> Enviando…</span>
                        {:else if replyMedia.error}
                          <span class="text-rose-400">{replyMedia.error}</span>
                        {:else}
                          <span class="text-emerald-400 inline-flex items-center gap-1"><Check size={11} /> Pronto</span>
                        {/if}
                      </span>
                    </div>

                    <div class="pre-upload-actions">
                      <label class="spoiler-check-toggle" class:is-active={replyMedia.isSpoiler}>
                        <input type="checkbox" bind:checked={replyMedia.isSpoiler} class="spoiler-checkbox" />
                        <EyeOff size={12} />
                        <span>Spoiler</span>
                      </label>
                      <button type="button" class="btn-remove-pre-upload" onclick={() => (replyMedia = null)} title="Remover mídia">
                        <X size={12} />
                      </button>
                    </div>
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
          <div
            class="thread-replies-nest"
            class:is-root-replies={node.depth === 0}
            class:max-indent={node.depth >= 2}
          >
            <!-- Clickable Thread Guide Rail -->
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
                <div class="thread-child-node">
                  {@render renderCommentNode(child)}
                </div>
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
        <div class="conversation-root-block">
          {@render renderCommentNode(rootNode)}
        </div>
      {/each}
    </div>
  {/if}

  <!-- REPORT MODAL (INTEGRATED FOR COMMENTS & MULTIMEDIA) -->
  {#if reportingTarget}
    <ReportModal
      targetType="COMMENT"
      workId={workId}
      chapterId={chapterId}
      commentId={reportingTarget.commentId}
      mediaUrls={reportingTarget.mediaUrls || (reportingTarget.mediaUrl ? [reportingTarget.mediaUrl] : [])}
      reportedMediaUrl={reportingTarget.mediaUrl || (reportingTarget.mediaUrls && reportingTarget.mediaUrls.length === 1 ? reportingTarget.mediaUrls[0] : undefined)}
      targetTitle={reportingTarget.mediaUrl
        ? `Mídia em comentário de @${reportingTarget.authorName || 'leitor'}`
        : `Comentário de @${reportingTarget.authorName || 'leitor'}`}
      onclose={() => (reportingTarget = null)}
      onsuccess={() => {
        notice = 'Denúncia recebida. Nossa equipe de moderação analisará o caso.';
      }}
    />
  {/if}

  <!-- CONFIRM DELETE & GRANULAR MEDIA MODERATION MODAL -->
  {#if commentToDelete}
    {@const targetMedia = getCommentMediaUrls(commentToDelete)}
    {@const hasMedia = targetMedia.length > 0}
    {@const activeMediaUrl = targetMedia[selectedMediaIdx] || targetMedia[0]}
    {@const isAlreadySpoiler = hasMedia && parseCommentBody(commentToDelete.body).some((c) => c.type === 'media' && c.mediaUrl === activeMediaUrl && c.isSpoiler)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="confirm-modal-backdrop"
      onclick={() => !deleteBusy && !moderateBusy && (commentToDelete = null)}
      role="presentation"
    >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="confirm-modal-box"
        class:is-granular={hasMedia}
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="del-modal-title"
      >
        <div class="confirm-modal-icon">
          {#if hasMedia}
            <Shield size={24} class="text-purple-400" />
          {:else}
            <Trash2 size={24} class="text-rose-400" />
          {/if}
        </div>

        <h3 id="del-modal-title" class="confirm-modal-title">
          {hasMedia ? 'Moderação de Mídia e Comentário' : 'Apagar Comentário'}
        </h3>

        {#if hasMedia}
          <p class="confirm-modal-desc">
            Este comentário contém mídia anexada. Escolha a ação desejada:
          </p>

          <!-- Media selector if multiple media -->
          {#if targetMedia.length > 1}
            <div class="modal-media-selector">
              <span class="media-selector-label">Mídia selecionada ({selectedMediaIdx + 1}/{targetMedia.length}):</span>
              <div class="media-selector-strip">
                {#each targetMedia as url, idx}
                  <button
                    type="button"
                    class="media-selector-item"
                    class:active={selectedMediaIdx === idx}
                    onclick={() => (selectedMediaIdx = idx)}
                  >
                    <img src={url} alt={`Mídia ${idx + 1}`} class="media-selector-thumb" />
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Media preview thumbnail -->
          <div class="modal-media-preview-card">
            <img src={activeMediaUrl} alt="Mídia anexada" class="modal-media-thumb" />
            <div class="modal-media-info">
              <span class="modal-media-tag">
                {activeMediaUrl.toLowerCase().includes('.gif') ? 'GIF ANIMADO' : 'IMAGEM'}
              </span>
              <span class="modal-media-author">
                Comentário de <strong>@{commentToDelete.members?.username || 'autor'}</strong>
              </span>
            </div>
          </div>

          <div class="granular-moderation-options">
            <!-- Opção A: Remover somente a imagem/GIF -->
            <button
              type="button"
              class="granular-option-card option-remove-media"
              disabled={deleteBusy || moderateBusy}
              onclick={() => handleModerateMedia('remove')}
            >
              <div class="option-icon-box text-rose-400">
                <ImageOff size={18} />
              </div>
              <div class="option-text-box">
                <span class="option-title">Opção A — Remover imagem/GIF</span>
                <span class="option-desc">
                  Remove somente a mídia. O texto, curtidas e respostas do comentário são 100% preservados.
                </span>
              </div>
            </button>

            <!-- Opção B: Ocultar mídia como spoiler -->
            <button
              type="button"
              class="granular-option-card option-spoiler-media"
              disabled={deleteBusy || moderateBusy || isAlreadySpoiler}
              onclick={() => handleModerateMedia('spoiler')}
            >
              <div class="option-icon-box text-amber-400">
                <EyeOff size={18} />
              </div>
              <div class="option-text-box">
                <span class="option-title">
                  {isAlreadySpoiler ? 'Opção B — Já está oculto como spoiler' : 'Opção B — Ocultar como spoiler'}
                </span>
                <span class="option-desc">
                  {isAlreadySpoiler
                    ? 'Esta mídia já está devidamente protegida com a tag de spoiler.'
                    : 'Aplica proteção de spoiler na mídia para que a comunidade precise clicar para visualizar.'}
                </span>
              </div>
            </button>

            <!-- Opção C: Excluir comentário completo -->
            <button
              type="button"
              class="granular-option-card option-delete-all"
              disabled={deleteBusy || moderateBusy}
              onclick={confirmDelete}
            >
              <div class="option-icon-box text-rose-500">
                <Trash2 size={18} />
              </div>
              <div class="option-text-box">
                <span class="option-title">Opção C — Excluir comentário inteiro</span>
                <span class="option-desc">
                  Apaga o comentário por completo junto com seus anexos. Respostas existentes são preservadas.
                </span>
              </div>
            </button>
          </div>

          <div class="confirm-modal-actions">
            <button
              type="button"
              class="btn-modal-cancel"
              disabled={deleteBusy || moderateBusy}
              onclick={() => (commentToDelete = null)}
            >
              Cancelar
            </button>
          </div>
        {:else}
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
        {/if}
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

        {#if lightboxLoading}
          <div class="lightbox-loading-box">
            <Loader2 size={36} class="spin-anim text-purple-400" />
            <span class="lightbox-loading-text">Carregando imagem em alta resolução...</span>
          </div>
        {/if}

        {#if lightboxError}
          <div class="lightbox-error-card">
            <AlertTriangle size={32} class="text-rose-400" />
            <h4 class="lightbox-error-title">Não foi possível carregar a mídia ampliada</h4>
            <p class="lightbox-error-desc">O arquivo ou link externo pode estar temporariamente inacessível.</p>
            <a
              href={lightboxMedia.url}
              target="_blank"
              rel="noopener noreferrer"
              class="btn-lightbox-external"
            >
              Abrir link da imagem
            </a>
          </div>
        {:else}
          <img
            src={lightboxMedia.url}
            alt={lightboxMedia.alt || 'Imagem ampliada'}
            class="lightbox-img"
            class:is-loading={lightboxLoading}
            onload={() => { lightboxLoading = false; }}
            onerror={() => { lightboxLoading = false; lightboxError = true; }}
          />
        {/if}
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

  /* V15: Interactive Thread Style Switcher */
  .thread-style-selector {
    display: inline-flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    padding: 2px;
    gap: 2px;
  }

  .btn-style-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
  }

  .btn-style-pill:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.06);
  }

  .btn-style-pill.is-active {
    color: #f5f3ff;
    background: rgba(168, 85, 247, 0.22);
    border-color: rgba(168, 85, 247, 0.45);
    box-shadow: 0 1px 4px rgba(168, 85, 247, 0.2);
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
    gap: 0;
  }

  /* =========================================================================
     PROJECT NOX V12: REFINED CONVERSATION BLOCKS & CONTINUOUS GUIDE RAILS
     ========================================================================= */

  .conversation-root-block {
    margin-bottom: 24px;
    width: 100%;
    background: #0d0f18;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 14px;
    padding: 16px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .conversation-root-block:hover {
    border-color: rgba(168, 85, 247, 0.16);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }

  .conversation-root-block:last-child {
    margin-bottom: 0;
  }

  .thread-node-wrapper {
    position: relative;
    width: 100%;
  }

  /* =========================================================================
     PROJECT NOX V15: NATURAL THREAD ARCHITECTURE
     Alternativa A (Reddit Minimalista) & Alternativa B (Conversa Agrupada)
     ========================================================================= */

  /* Alternativa A (Padrão / Reddit Minimalista):
     - Linhas verticais discretas de conexão
     - Respostas leves e abertas sem caixas pesadas
     - Separação natural sem divisórias decorativas */
  .thread-replies-nest {
    position: relative;
    margin-top: 14px;
    margin-left: 10px;
    padding-left: 12px;
  }

  .thread-replies-nest.max-indent {
    margin-left: 4px;
    padding-left: 8px;
  }

  .thread-vertical-rail {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 0;
    width: 12px;
    cursor: pointer;
    z-index: 5;
    user-select: none;
    -webkit-user-select: none;
  }

  .rail-line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 2px;
    width: 1.5px;
    background: rgba(255, 255, 255, 0.08); /* Cinza neutro muito sutil e discreto */
    border-radius: 9999px;
    transition: background-color 0.18s ease, width 0.18s ease, box-shadow 0.18s ease;
  }

  .thread-vertical-rail:hover .rail-line {
    background: rgba(168, 85, 247, 0.65); /* Roxo suave no hover interativo */
    width: 2px;
    box-shadow: 0 0 6px rgba(168, 85, 247, 0.35);
  }

  .thread-children-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .thread-child-node {
    position: relative;
  }

  /* V15: Alternativa B — Conversa Agrupada
     - Agrupa visualmente o bloco de respostas da raiz em uma área unificada
     - Borda lateral esquerda elegante em roxo translúcido
     - Superfície sutil em cada resposta sem excesso de linhas */
  .comments-section-root[data-thread-style="b"] .thread-replies-nest.is-root-replies {
    background: rgba(255, 255, 255, 0.012);
    border-left: 2.5px solid rgba(168, 85, 247, 0.38);
    border-radius: 0 12px 12px 0;
    padding: 14px 14px 14px 16px;
    margin-top: 14px;
    margin-left: 2px;
  }

  .comments-section-root[data-thread-style="b"] .thread-replies-nest.is-root-replies > .thread-vertical-rail {
    display: none;
  }

  .comments-section-root[data-thread-style="b"] .comment-card-modern.is-nested-card {
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid rgba(255, 255, 255, 0.035);
    border-radius: 10px;
    padding: 10px 12px;
  }

  .comments-section-root[data-thread-style="b"] .comment-card-modern.is-nested-card:hover {
    background: rgba(255, 255, 255, 0.028);
    border-color: rgba(168, 85, 247, 0.18);
  }

  .comments-section-root[data-thread-style="b"] .thread-children-list {
    gap: 12px;
  }

  .comments-section-root[data-thread-style="b"] .thread-replies-nest:not(.is-root-replies) {
    margin-top: 10px;
    margin-left: 6px;
    padding-left: 10px;
    border-left: 1.5px solid rgba(255, 255, 255, 0.08);
  }

  .comments-section-root[data-thread-style="b"] .thread-replies-nest:not(.is-root-replies) > .thread-vertical-rail {
    display: none;
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
     COMPACT NATURAL COMMENT CARDS (3-LEVEL HIERARCHY WITH VISUAL DEPTH)
     ========================================================================= */

  /* =========================================================================
     PROJECT NOX V11: CLEAN COMMENT ENTRIES (SEM CAIXAS EMPILHADAS)
     ========================================================================= */

  .comment-card-modern {
    position: relative;
    background: transparent;
    border: none;
    border-radius: 0;
    overflow: visible;
    transition: background-color 0.15s ease;
  }

  /* Root Comment: Open presentation at top of conversation block */
  .comment-card-modern.is-root-card {
    background: transparent;
    border: none;
    box-shadow: none;
    padding-bottom: 4px;
  }

  /* Nested Replies: Clean entries with transparent background, subtle hover */
  .comment-card-modern.is-nested-card {
    background: transparent;
    border: none;
    border-radius: 10px;
    padding: 4px 0;
  }

  .comment-card-modern.is-nested-card:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  /* Active reply target indicator */
  .comment-card-modern.is-reply-target {
    background: rgba(168, 85, 247, 0.06);
    border-radius: 10px;
    box-shadow: 0 0 14px rgba(168, 85, 247, 0.25);
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
    padding: 0;
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

  .reply-target-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.28);
    border-radius: 9999px;
    padding: 2px 8px;
    font-size: 11.5px;
    line-height: 1.25;
    vertical-align: middle;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .reply-target-tag:hover {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.45);
  }

  .reply-target-arrow {
    color: #c084fc;
    font-weight: 800;
    font-size: 11.5px;
  }

  .reply-target-label {
    color: #cbd5e1;
    font-size: 10.5px;
    font-weight: 500;
  }

  .reply-target-link {
    color: #f1f5f9;
    text-decoration: none;
    font-weight: 700;
    transition: color 0.15s ease;
  }

  .reply-target-link:hover {
    color: #ffffff;
    text-decoration: underline;
  }

  .meta-separator {
    color: #52525b;
    font-size: 11px;
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
    margin-bottom: 0;
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

  /* =========================================================================
     FOOTER ACTION ROW (V13: ZERO UNWANTED INDENTS, FLUSH LEFT, NATURAL BREATHING)
     ========================================================================= */

  .comment-footer-actions {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 10px;
    margin-top: 14px;
    margin-left: 0;
    margin-right: 0;
    margin-bottom: 0;
    padding: 0;
    border: none;
    max-width: none;
    width: 100%;
    flex-wrap: wrap;
  }

  .footer-primary-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-footer-like {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.18s ease;
    user-select: none;
  }

  .btn-footer-like:hover:not(:disabled) {
    background: rgba(244, 63, 94, 0.12);
    border-color: rgba(244, 63, 94, 0.35);
    color: #f43f5e;
  }

  .btn-footer-like.liked {
    background: rgba(244, 63, 94, 0.18);
    border-color: rgba(244, 63, 94, 0.45);
    color: #f43f5e;
  }

  .like-counter {
    font-variant-numeric: tabular-nums;
  }

  .btn-footer-reply {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    background: rgba(168, 85, 247, 0.08);
    border: 1px solid rgba(168, 85, 247, 0.22);
    border-radius: 9999px;
    color: #d8b4fe;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.18s ease;
    user-select: none;
  }

  .btn-footer-reply:hover {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.45);
    color: #ffffff;
  }

  .footer-secondary-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .btn-admin-delete {
    color: #fb7185;
    background: rgba(244, 63, 94, 0.08);
    border: 1px solid rgba(244, 63, 94, 0.22);
    border-radius: 6px;
    padding: 0 8px;
  }

  .btn-admin-delete:hover:not(:disabled) {
    background: rgba(244, 63, 94, 0.22);
    border-color: rgba(244, 63, 94, 0.5);
    color: #ffffff;
  }

  .btn-footer-secondary {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: #94a3b8;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-footer-secondary:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #f1f5f9;
  }

  .btn-footer-secondary.text-danger:hover {
    background: rgba(244, 63, 94, 0.12);
    color: #f43f5e;
  }

  .btn-footer-secondary.text-muted-flag:hover {
    background: rgba(234, 179, 8, 0.12);
    color: #facc15;
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

  /* =========================================================================
     SIZABLE PRE-UPLOAD ATTACHMENT CARD (180-240PX ADAPTIVE WITH ZOOM TRIGGER)
     ========================================================================= */

  .pre-upload-attachment-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
    padding: 10px;
    background: rgba(14, 11, 23, 0.9);
    border: 1px solid rgba(168, 85, 247, 0.28);
    border-radius: 10px;
    box-sizing: border-box;
  }

  .pre-upload-attachment-card.is-inline-mode {
    margin-top: 6px;
    padding: 8px;
    background: rgba(10, 8, 18, 0.9);
  }

  .pre-upload-preview-viewport {
    position: relative;
    width: fit-content;
    min-width: 180px;
    min-height: 140px;
    max-width: min(100%, 360px);
    max-height: 240px;
    border-radius: 8px;
    overflow: hidden;
    background: #08060f;
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pre-upload-zoom-trigger {
    position: relative;
    display: block;
    width: fit-content;
    max-width: 100%;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }

  .pre-upload-img {
    display: block;
    max-width: min(100%, 360px);
    max-height: 240px;
    min-width: 140px;
    min-height: 100px;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 8px;
    transition: filter 0.18s ease;
  }

  .pre-upload-img.is-spoiler-blurred {
    filter: blur(14px) brightness(0.5);
  }

  .pre-upload-hover-lens {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: rgba(0, 0, 0, 0.55);
    color: #ffffff;
    font-size: 11px;
    font-weight: 700;
    opacity: 0;
    transition: opacity 0.18s ease;
    border-radius: 8px;
  }

  .pre-upload-zoom-trigger:hover .pre-upload-hover-lens {
    opacity: 1;
  }

  .pre-upload-type-badge {
    position: absolute;
    bottom: 6px;
    left: 6px;
    padding: 1px 5px;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    font-size: 9px;
    font-weight: 800;
    color: #38bdf8;
    letter-spacing: 0.05em;
  }

  .pre-upload-spoiler-flag {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: rgba(14, 11, 23, 0.85);
    color: #c084fc;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.05em;
  }

  .pre-upload-meta-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .pre-upload-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: hidden;
  }

  .pre-upload-name {
    font-size: 11.5px;
    font-weight: 600;
    color: #f1f5f9;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 220px;
  }

  .pre-upload-status {
    font-size: 11px;
    color: #94a3b8;
  }

  .pre-upload-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .spoiler-check-toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
  }

  .spoiler-check-toggle.is-active {
    color: #c084fc;
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.35);
  }

  .spoiler-checkbox {
    accent-color: #a855f7;
    width: 13px;
    height: 13px;
    cursor: pointer;
  }

  .btn-remove-pre-upload {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid rgba(244, 63, 94, 0.28);
    color: #fb7185;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-remove-pre-upload:hover {
    background: rgba(244, 63, 94, 0.22);
    border-color: rgba(244, 63, 94, 0.45);
  }

  /* =========================================================================
     LIVE FULL COMMENT PREVIEW BOX (SIMULATION BEFORE PUBLISHING)
     ========================================================================= */

  .composer-live-preview-box {
    margin-top: 10px;
    padding: 12px;
    background: rgba(168, 85, 247, 0.04);
    border: 1px dashed rgba(168, 85, 247, 0.3);
    border-radius: 10px;
    box-sizing: border-box;
  }

  .preview-box-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10.5px;
    font-weight: 800;
    color: #c084fc;
    margin-bottom: 8px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .preview-subtext {
    font-size: 10.5px;
    font-weight: 500;
    color: #94a3b8;
    text-transform: none;
  }

  .preview-empty-hint {
    font-size: 12px;
    color: #64748b;
    font-style: italic;
    margin: 6px 0;
  }

  .preview-rendered-card {
    background: #0c0e18;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 10px 12px;
  }

  /* =========================================================================
     COMMENT MEDIA IN FEED (DISCORD STYLE NATURAL ENQUADRAMENTO + DIRECT REPORT)
     ========================================================================= */

  .comment-media-card {
    display: block;
    width: fit-content;
    max-width: min(100%, 460px);
    margin-top: 8px;
    margin-bottom: 0;
    border-radius: 10px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    white-space: normal;
  }

  .comment-media-card:not(:last-child) {
    margin-bottom: 8px;
  }

  .media-view-wrapper {
    position: relative;
    display: block;
    width: fit-content;
    max-width: 100%;
  }

  .media-overlay-actions {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
    z-index: 5;
  }

  .media-action-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: rgba(14, 11, 23, 0.88);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: #cbd5e1;
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-media-report:hover {
    background: rgba(244, 63, 94, 0.25);
    border-color: rgba(244, 63, 94, 0.6);
    color: #f43f5e;
  }

  .btn-media-rehide:hover {
    background: rgba(168, 85, 247, 0.25);
    border-color: rgba(168, 85, 247, 0.6);
    color: #d8b4fe;
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

  .confirm-modal-box.is-granular {
    max-width: 480px;
    width: 92%;
    text-align: left;
    align-items: stretch;
    border-color: rgba(168, 85, 247, 0.35);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65), 0 0 24px rgba(168, 85, 247, 0.15);
  }

  .confirm-modal-box.is-granular .confirm-modal-icon {
    align-self: center;
  }

  .confirm-modal-box.is-granular .confirm-modal-title {
    text-align: center;
  }

  .confirm-modal-box.is-granular .confirm-modal-desc {
    text-align: center;
    margin-bottom: 12px;
  }

  .modal-media-selector {
    margin-bottom: 10px;
  }

  .media-selector-label {
    display: block;
    font-size: 11px;
    color: #a1a1aa;
    margin-bottom: 4px;
  }

  .media-selector-strip {
    display: flex;
    gap: 6px;
    overflow-x: auto;
  }

  .media-selector-item {
    border: 2px solid transparent;
    border-radius: 6px;
    padding: 0;
    background: transparent;
    cursor: pointer;
  }

  .media-selector-item.active {
    border-color: #a855f7;
  }

  .media-selector-thumb {
    width: 38px;
    height: 38px;
    border-radius: 4px;
    object-fit: cover;
  }

  .modal-media-preview-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 14px;
  }

  .modal-media-thumb {
    width: 52px;
    height: 52px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modal-media-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    overflow: hidden;
  }

  .modal-media-tag {
    display: inline-block;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: #a855f7;
    background: rgba(168, 85, 247, 0.15);
    padding: 1px 6px;
    border-radius: 4px;
    align-self: flex-start;
  }

  .modal-media-author {
    font-size: 12px;
    color: #a1a1aa;
  }

  .granular-moderation-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 14px;
  }

  .granular-option-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 11px 14px;
    text-align: left;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .granular-option-card:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .option-remove-media:hover {
    border-color: rgba(244, 63, 94, 0.45);
  }

  .option-spoiler-media:hover {
    border-color: rgba(245, 158, 11, 0.45);
  }

  .option-delete-all:hover {
    border-color: rgba(239, 68, 68, 0.5);
  }

  .option-icon-box {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .option-text-box {
    display: flex;
    flex-direction: column;
  }

  .option-title {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 2px;
  }

  .option-desc {
    font-size: 11.5px;
    color: #94a3b8;
    line-height: 1.4;
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
    min-width: 260px;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.85);
    transition: opacity 0.2s ease;
  }

  .lightbox-img.is-loading {
    opacity: 0;
    position: absolute;
  }

  .lightbox-loading-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 24px;
    color: #cbd5e1;
  }

  .lightbox-loading-text {
    font-size: 13px;
    color: #94a3b8;
  }

  .lightbox-error-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 32px 24px;
    background: #14101e;
    border: 1px solid rgba(244, 63, 94, 0.35);
    border-radius: 12px;
    max-width: 360px;
  }

  .lightbox-error-title {
    margin: 0;
    font-size: 15px;
    font-weight: 750;
    color: #f1f5f9;
  }

  .lightbox-error-desc {
    margin: 0;
    font-size: 12.5px;
    color: #94a3b8;
    line-height: 1.4;
  }

  .btn-lightbox-external {
    display: inline-flex;
    align-items: center;
    margin-top: 6px;
    padding: 6px 14px;
    border-radius: 6px;
    background: rgba(168, 85, 247, 0.15);
    border: 1px solid rgba(168, 85, 247, 0.35);
    color: #c084fc;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .btn-lightbox-external:hover {
    background: rgba(168, 85, 247, 0.25);
    color: #ffffff;
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
      flex-wrap: wrap;
      gap: 8px;
    }

    .btn-style-pill {
      padding: 3px 8px;
      font-size: 10px;
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
      padding: 0;
    }

    .is-nested-card .comment-content-wrap {
      padding: 0;
    }

    .thread-children-list {
      gap: 14px;
    }

    .comment-footer-actions {
      margin-top: 12px;
      gap: 8px;
      padding: 0;
      border: none;
    }

    /* Mobile Indentation Capping: Keep columns readable */
    .thread-replies-nest {
      margin-top: 12px;
      margin-left: 6px;
      padding-left: 8px;
    }

    .thread-replies-nest.max-indent {
      margin-left: 2px;
      padding-left: 6px;
    }

    /* Style B mobile adjustments */
    .comments-section-root[data-thread-style="b"] .thread-replies-nest.is-root-replies {
      padding: 10px 8px 10px 10px;
      margin-left: 0;
      margin-top: 12px;
    }

    .comments-section-root[data-thread-style="b"] .comment-card-modern.is-nested-card {
      padding: 8px 10px;
    }

    .comments-section-root[data-thread-style="b"] .thread-replies-nest:not(.is-root-replies) {
      margin-left: 4px;
      padding-left: 6px;
    }

    .thread-vertical-rail {
      width: 8px;
    }

    .rail-line {
      left: 1px;
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

    /* Mobile Touch Comfort for Actions (38-40px Target) */
    .btn-footer-like,
    .btn-footer-reply {
      min-height: 38px;
      padding: 0 14px;
      font-size: 12.5px;
    }

    .btn-footer-secondary {
      min-height: 36px;
      padding: 0 10px;
      font-size: 12px;
    }

    .footer-primary-actions {
      gap: 6px;
    }

    .footer-secondary-actions {
      gap: 4px;
    }

    .pre-upload-preview-viewport {
      max-width: 100%;
    }

    .pre-upload-img {
      max-width: 100%;
    }
  }

  @media (max-width: 540px) {
    .conversation-root-block {
      padding: 12px 10px;
      border-radius: 12px;
      margin-bottom: 14px;
    }

    /* Limit indentation on compact mobile screens to keep thread readable */
    .thread-replies-nest {
      margin-left: 4px;
      padding-left: 7px;
    }

    .thread-replies-nest.max-indent {
      margin-left: 0;
      padding-left: 5px;
    }

    .thread-vertical-rail {
      width: 7px;
    }

    .rail-line {
      left: 1px;
    }

    .reply-target-tag {
      font-size: 10.5px;
      padding: 1px 5px;
      gap: 3px;
    }

    /* Keep compact on mobile by showing ↳ @username */
    .reply-target-label {
      display: none;
    }
  }
</style>