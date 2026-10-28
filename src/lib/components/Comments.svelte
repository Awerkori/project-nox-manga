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
    Sparkles,
    ArrowUpDown,
    Send,
    ChevronDown,
    ChevronUp
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
        // Also auto-expand parent if this comment is a reply
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

  onMount(() => {
    checkHashAndScroll();
    window.addEventListener('hashchange', checkHashAndScroll);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('hashchange', checkHashAndScroll);
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
    if (busy || !body.trim()) return;
    busy = true;
    notice = '';
    try {
      const mentionsData = mentionAutocompleteRef?.getTrackedMentions() || null;
      const res = (await action(
        'member',
        edit ? 'comment_edit' : 'comment',
        edit
          ? { id: edit, body, mentionsData }
          : { work_id: workId, chapter_id: chapterId, parent_id: reply, body, mentionsData }
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
        if (typeof (window as any).__noxTriggerXpReward === 'function') {
          (window as any).__noxTriggerXpReward(res.xp_award.amount, title);
        }
      }

      if (reply) {
        expandedReplies.add(reply);
      }

      body = '';
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
  <div class="comments-header-row">
    <div class="header-titles">
      <div class="eyebrow-seal">
        <MessageSquare size={13} class="text-purple-400" />
        <span>{chapterId ? 'DISCUSSÃO DO CAPÍTULO' : 'AVALIAÇÕES & DISCUSSÃO'}</span>
      </div>
      <h2>{chapterId ? 'Comentários deste Capítulo' : 'Comentários sobre a Obra'}</h2>
    </div>

    <div class="header-meta-controls">
      <div class="comments-count-badge">
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
  </div>

  {#if notice}
    <div class="notice-alert error" role="alert">
      <span>{notice}</span>
    </div>
  {/if}

  <!-- COMPOSER BOX -->
  {#if profile}
    <form use:bindSubmit class="composer-card">
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

      <div class="composer-field-wrapper">
        <textarea
          bind:value={body}
          bind:this={composer}
          rows="3"
          required
          maxlength="2000"
          oninput={(e) => mentionAutocompleteRef?.handleInput((e.target as HTMLTextAreaElement).value)}
          onkeydown={(e) => {
            if (mentionAutocompleteRef?.handleKeyDown(e)) return;
          }}
          placeholder={edit
            ? 'Edite seu comentário…'
            : reply
              ? `Sua resposta para @${replyComment?.members?.display_name || replyComment?.members?.username || 'leitor'}…`
              : chapterId
                ? 'O que você achou deste capítulo? Compartilhe suas impressões… (evite spoilers sem aviso)'
                : 'O que você achou desta obra? Fale sobre o enredo, arte e personagens…'
          }
          class="composer-textarea"
          aria-label={edit ? 'Editar comentário' : reply ? 'Sua resposta' : 'Seu comentário'}
        ></textarea>

        <MentionAutocomplete
          bind:this={mentionAutocompleteRef}
          bind:value={body}
          textareaEl={composer}
        />
      </div>

      <div class="composer-toolbar">
        <div class="toolbar-tools">
          <button
            type="button"
            class="btn-tool-spoiler"
            onclick={() => {
              body += (body.length ? ' ' : '') + '[spoiler]texto com spoiler[/spoiler]';
              composer?.focus();
            }}
            title="Inserir texto com spoiler oculto"
          >
            <EyeOff size={13} />
            <span>+ Spoiler</span>
          </button>
          <span class="char-count">{body.length} / 2000</span>
        </div>

        <div class="toolbar-actions">
          {#if reply || edit}
            <button
              type="button"
              class="btn-cancel-action"
              onclick={() => {
                reply = null;
                edit = null;
                body = '';
              }}
            >
              Cancelar
            </button>
          {/if}
          <button
            class="btn-submit-comment"
            disabled={busy || !body.trim()}
          >
            <Send size={14} />
            <span>{busy ? 'Enviando…' : edit ? 'Salvar' : reply ? 'Responder' : 'Publicar'}</span>
          </button>
        </div>
      </div>
    </form>
  {:else}
    <div class="guest-login-card">
      <MessageSquare size={20} class="text-purple-400" />
      <p>
        <a class="text-link" href="/entrar">Entre na sua conta</a> para participar da discussão e ganhar XP de leitura.
      </p>
    </div>
  {/if}

  <!-- COMMENTS FEED -->
  {#if threadedGroups.length === 0}
    <div class="empty-comments-card">
      <div class="empty-icon-box">
        <MessageSquare size={32} class="empty-icon text-purple-400" />
      </div>
      <h3>Nenhum comentário por enquanto</h3>
      <p>
        {chapterId
          ? 'Seja o primeiro a compartilhar o que achou deste capítulo!'
          : 'Seja o primeiro a compartilhar sua opinião sobre esta obra!'}
      </p>
    </div>
  {:else}
    <div class="comments-flow-list">
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
          class="comment-card root-comment"
          class:is-reply-target={reply === root.id}
          class:has-comment-banner={!!rootCommentBanner}
        >
          {#if rootCommentBanner}
            <div class="comment-banner-background" style="background: {rootCommentBanner};" aria-hidden="true"></div>
            <div class="comment-banner-overlay" aria-hidden="true"></div>
          {/if}

          <div class="comment-content-layer">
            <!-- Author Header -->
            <div class="comment-author-bar">
              <UserAvatar
                avatarId={root.members?.avatar_id}
                frameId={root.members?.avatar_frame_id}
                crop={root.members?.avatar_crop}
                displayName={root.members?.display_name || 'Leitor'}
                size={38}
              />
              <div class="author-meta-info">
                <div class="author-name-line">
                  <a
                    href="/u/{root.members?.username}"
                    class="author-display-name {rootAuthorColor.className}"
                    style={rootAuthorColor.style}
                  >
                    {root.members?.display_name || 'Leitor'}
                  </a>
                  <span class="author-handle">@{root.members?.username || 'leitor'}</span>
                  {#if isAuthor}
                    <span class="author-badge-self">Você</span>
                  {/if}
                </div>
                <time class="comment-timestamp" datetime={root.created_at}>{date(root.created_at)}</time>
              </div>
            </div>

            <!-- Comment Body with Spoilers & Mentions -->
            <div class="comment-body-content">
              {#each parseCommentBody(root.body) as chunk, idx (idx)}
                {#if chunk.type === 'spoiler'}
                  <button
                    type="button"
                    class="spoiler-block"
                    class:revealed={revealedSpoilers.has(root.id + ':' + idx)}
                    onclick={() => toggleSpoiler(root.id + ':' + idx)}
                    title={revealedSpoilers.has(root.id + ':' + idx) ? 'Clique para ocultar spoiler' : 'Spoiler: clique para revelar'}
                  >
                    {#if revealedSpoilers.has(root.id + ':' + idx)}
                      <span class="spoiler-revealed-text">{chunk.content}</span>
                    {:else}
                      <span class="spoiler-hidden-mask">{chunk.content}</span>
                      <span class="spoiler-tag-pill"><EyeOff size={11} /> SPOILER</span>
                    {/if}
                  </button>
                {:else if chunk.type === 'mention'}
                  <a href={`/u/${chunk.username || chunk.content}`} class="mention-pill">@{chunk.content}</a>
                {:else}
                  <span>{chunk.content}</span>
                {/if}
              {/each}
            </div>

            <!-- Action Bar -->
            <div class="comment-actions-bar">
              <!-- Like Button -->
              <button
                type="button"
                class="btn-action-like"
                class:liked={hasLiked}
                onclick={() => mutate('comment_like', root.id)}
                disabled={!profile || busy}
                title={hasLiked ? 'Descurtir' : 'Curtir comentário'}
              >
                <Heart size={14} class={hasLiked ? 'fill-rose-500 text-rose-500' : ''} />
                <span>{root.comment_likes?.length || 0}</span>
              </button>

              <!-- Reply Button -->
              {#if profile}
                <button
                  type="button"
                  class="btn-action-reply"
                  onclick={() => compose(root)}
                >
                  <CornerDownRight size={13} />
                  <span>Responder</span>
                </button>
              {/if}

              <!-- Author actions (Edit / Delete) -->
              {#if isAuthor}
                <button
                  type="button"
                  class="btn-action-util"
                  onclick={() => compose(root, true)}
                  title="Editar comentário"
                >
                  <Edit3 size={12} />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  class="btn-action-util btn-action-delete"
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
                  class="btn-action-util btn-action-report"
                  onclick={() => (reportingComment = root)}
                  title="Denunciar este comentário"
                >
                  <Flag size={12} />
                  <span>Denunciar</span>
                </button>
              {/if}
            </div>

            <!-- COLLAPSIBLE REPLIES THREAD -->
            {#if group.replies.length > 0}
              <div class="replies-wrapper">
                <button
                  type="button"
                  class="btn-toggle-replies"
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
                  <div class="nested-replies-list">
                    {#each group.replies as replyItem (replyItem.id)}
                      {@const repAuthorColor = getNameColorInfo(replyItem.members?.name_color)}
                      {@const repBannerKey = replyItem.members?.equipped_comment_banner_id || replyItem.members?.equipped_banner_id}
                      {@const repCommentBanner = repBannerKey ? (CURATED_BANNER_BACKGROUNDS[repBannerKey] || repBannerKey) : null}
                      {@const repHasLiked = profile && replyItem.comment_likes?.some((l) => l.user_id === profile.id)}
                      {@const repIsAuthor = profile && profile.id === replyItem.user_id}

                      <article
                        id={'comment-' + replyItem.id}
                        data-parent-id={root.id}
                        class="comment-card reply-comment"
                        class:is-reply-target={reply === replyItem.id}
                        class:has-comment-banner={!!repCommentBanner}
                      >
                        {#if repCommentBanner}
                          <div class="comment-banner-background" style="background: {repCommentBanner};" aria-hidden="true"></div>
                          <div class="comment-banner-overlay" aria-hidden="true"></div>
                        {/if}

                        <div class="comment-content-layer">
                          <div class="comment-author-bar">
                            <UserAvatar
                              avatarId={replyItem.members?.avatar_id}
                              frameId={replyItem.members?.avatar_frame_id}
                              crop={replyItem.members?.avatar_crop}
                              displayName={replyItem.members?.display_name || 'Leitor'}
                              size={32}
                            />
                            <div class="author-meta-info">
                              <div class="author-name-line">
                                <a
                                  href="/u/{replyItem.members?.username}"
                                  class="author-display-name {repAuthorColor.className}"
                                  style={repAuthorColor.style}
                                >
                                  {replyItem.members?.display_name || 'Leitor'}
                                </a>
                                <span class="author-handle">@{replyItem.members?.username || 'leitor'}</span>
                                {#if repIsAuthor}
                                  <span class="author-badge-self">Você</span>
                                {/if}
                              </div>
                              <time class="comment-timestamp" datetime={replyItem.created_at}>{date(replyItem.created_at)}</time>
                            </div>
                          </div>

                          <div class="comment-body-content">
                            {#each parseCommentBody(replyItem.body) as chunk, idx (idx)}
                              {#if chunk.type === 'spoiler'}
                                <button
                                  type="button"
                                  class="spoiler-block"
                                  class:revealed={revealedSpoilers.has(replyItem.id + ':' + idx)}
                                  onclick={() => toggleSpoiler(replyItem.id + ':' + idx)}
                                  title={revealedSpoilers.has(replyItem.id + ':' + idx) ? 'Clique para ocultar spoiler' : 'Spoiler: clique para revelar'}
                                >
                                  {#if revealedSpoilers.has(replyItem.id + ':' + idx)}
                                    <span class="spoiler-revealed-text">{chunk.content}</span>
                                  {:else}
                                    <span class="spoiler-hidden-mask">{chunk.content}</span>
                                    <span class="spoiler-tag-pill"><EyeOff size={11} /> SPOILER</span>
                                  {/if}
                                </button>
                              {:else if chunk.type === 'mention'}
                                <a href={`/u/${chunk.username || chunk.content}`} class="mention-pill">@{chunk.content}</a>
                              {:else}
                                <span>{chunk.content}</span>
                              {/if}
                            {/each}
                          </div>

                          <div class="comment-actions-bar">
                            <button
                              type="button"
                              class="btn-action-like"
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
                                class="btn-action-reply"
                                onclick={() => compose(root)}
                              >
                                <CornerDownRight size={12} />
                                <span>Responder</span>
                              </button>
                            {/if}

                            {#if repIsAuthor}
                              <button
                                type="button"
                                class="btn-action-util"
                                onclick={() => compose(replyItem, true)}
                                title="Editar resposta"
                              >
                                <Edit3 size={11} />
                                <span>Editar</span>
                              </button>
                              <button
                                type="button"
                                class="btn-action-util btn-action-delete"
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
                                class="btn-action-util btn-action-report"
                                onclick={() => (reportingComment = replyItem)}
                                title="Denunciar esta resposta"
                              >
                                <Flag size={11} />
                                <span>Denunciar</span>
                              </button>
                            {/if}
                          </div>
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

  <!-- REPORT MODAL -->
  {#if reportingComment}
    <ReportModal
      targetType="COMMENT"
      commentId={reportingComment.id}
      targetTitle={`Comentário de @${reportingComment.members?.username || 'leitor'}`}
      onclose={() => (reportingComment = null)}
      onsuccess={() => {
        reportingComment = null;
        notice = '✓ Denúncia sobre o comentário enviada à moderação com sucesso.';
        setTimeout(() => { notice = ''; }, 4000);
      }}
    />
  {/if}
</section>

<style>
  /* ----------------------------------------------------
     BASE CONTAINER & HEADER
  ---------------------------------------------------- */
  .comments-section-root {
    width: 100%;
    margin: 40px auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .comments-header-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .eyebrow-seal {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 800;
    color: #c084fc;
    letter-spacing: 0.06em;
  }

  .comments-header-row h2 {
    font-size: 22px;
    font-weight: 800;
    color: #f2f0f7;
    margin: 0;
    line-height: 1.25;
  }

  .header-meta-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .comments-count-badge {
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    font-size: 12px;
    color: #9d9aa9;
    font-weight: 600;
  }

  .comments-count-badge span {
    color: #e9d5ff;
    font-weight: 800;
  }

  .sort-selector-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .sort-icon {
    position: absolute;
    left: 10px;
    color: #8c899a;
    pointer-events: none;
  }

  .sort-dropdown {
    background: rgba(16, 18, 30, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e2dfec;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px 6px 28px;
    border-radius: 8px;
    outline: none;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .sort-dropdown:focus {
    border-color: #a855f7;
  }

  .notice-alert {
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
  }

  .notice-alert.error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  /* ----------------------------------------------------
     COMPOSER CARD
  ---------------------------------------------------- */
  .composer-card {
    background: rgba(11, 13, 23, 0.75);
    border: 1px solid rgba(181, 154, 245, 0.25);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    transition: border-color 0.2s;
  }

  .composer-card:focus-within {
    border-color: rgba(168, 85, 247, 0.5);
  }

  .replying-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    background: rgba(124, 58, 237, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 10px;
  }

  .replying-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    min-width: 0;
  }

  .replying-tag {
    color: #a7a3b6;
  }

  .replying-author {
    color: #e9d5ff;
  }

  .replying-preview {
    color: #7d7a8d;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-style: italic;
  }

  .btn-cancel-reply {
    background: transparent;
    border: none;
    color: #9d9aa9;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 6px;
    transition: color 0.2s;
  }

  .btn-cancel-reply:hover {
    color: #fff;
  }

  .composer-field-wrapper {
    position: relative;
    width: 100%;
  }

  .composer-textarea {
    width: 100%;
    min-height: 85px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 12px 14px;
    color: #f2f0f7;
    font-family: inherit;
    font-size: 13.5px;
    line-height: 1.5;
    outline: none;
    resize: vertical;
    transition: border-color 0.2s, background 0.2s;
  }

  .composer-textarea:focus {
    border-color: #9333ea;
    background: rgba(0, 0, 0, 0.5);
  }

  .composer-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }

  .toolbar-tools {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-tool-spoiler {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #c4c1d3;
    font-size: 11px;
    font-weight: 700;
    padding: 5px 10px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-tool-spoiler:hover {
    background: rgba(168, 85, 247, 0.18);
    border-color: rgba(192, 132, 252, 0.4);
    color: #fff;
  }

  .char-count {
    font-size: 11px;
    color: #6b6878;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-cancel-action {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #d1cddc;
    font-size: 12px;
    font-weight: 650;
    padding: 7px 14px;
    border-radius: 9px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel-action:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .btn-submit-comment {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #7c3aed, #9333ea);
    border: none;
    color: #fff;
    font-size: 13px;
    font-weight: 750;
    padding: 8px 18px;
    border-radius: 9px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);
    transition: all 0.2s;
  }

  .btn-submit-comment:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(124, 58, 237, 0.6);
  }

  .btn-submit-comment:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .guest-login-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: rgba(16, 18, 30, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    color: #d1cddc;
    font-size: 13px;
  }

  .guest-login-card a {
    color: #c084fc;
    font-weight: 700;
    text-decoration: underline;
  }

  /* ----------------------------------------------------
     EMPTY STATE
  ---------------------------------------------------- */
  .empty-comments-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    background: rgba(11, 13, 23, 0.5);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    text-align: center;
    gap: 8px;
  }

  .empty-icon-box {
    width: 60px;
    height: 60px;
    border-radius: 16px;
    background: rgba(124, 58, 237, 0.1);
    border: 1px solid rgba(168, 85, 247, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 6px;
  }

  .empty-comments-card h3 {
    font-size: 16px;
    font-weight: 750;
    color: #f2f0f7;
    margin: 0;
  }

  .empty-comments-card p {
    font-size: 13px;
    color: #8c899a;
    margin: 0;
    max-width: 380px;
  }

  /* ----------------------------------------------------
     COMMENTS FLOW LIST & CARDS
  ---------------------------------------------------- */
  .comments-flow-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .comment-card {
    position: relative;
    background: rgba(11, 13, 23, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    padding: 16px 18px;
    overflow: hidden;
    transition: border-color 0.2s, background 0.2s;
  }

  .comment-card:hover {
    border-color: rgba(181, 154, 245, 0.25);
  }

  .comment-card.is-reply-target {
    border-color: #9333ea;
    box-shadow: 0 0 16px rgba(147, 51, 234, 0.3);
  }

  /* Cosmetic comment banner overlay */
  .comment-banner-background {
    position: absolute;
    inset: 0;
    z-index: 1;
    opacity: 0.85;
  }

  .comment-banner-overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    background: linear-gradient(180deg, rgba(8, 10, 18, 0.7) 0%, rgba(8, 10, 18, 0.92) 100%);
  }

  .comment-content-layer {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Author Bar */
  .comment-author-bar {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .author-meta-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .author-name-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .author-display-name {
    font-size: 13.5px;
    font-weight: 750;
    color: #f2f0f7;
    text-decoration: none;
    line-height: 1.25;
    transition: color 0.2s;
  }

  .author-display-name:hover {
    color: #c084fc;
  }

  .author-handle {
    font-size: 11px;
    color: #716e7e;
  }

  .author-badge-self {
    font-size: 10px;
    font-weight: 750;
    color: #dfc28d;
    background: rgba(201, 170, 115, 0.15);
    border: 1px solid rgba(201, 170, 115, 0.3);
    padding: 0 6px;
    border-radius: 999px;
  }

  .comment-timestamp {
    font-size: 11px;
    color: #716e7e;
  }

  /* Comment Body */
  .comment-body-content {
    font-size: 13.5px;
    color: #e2dfec;
    line-height: 1.6;
    word-break: break-word;
    white-space: pre-wrap;
  }

  /* Spoilers & Mentions */
  .spoiler-block {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 2px 8px;
    color: inherit;
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    vertical-align: baseline;
    transition: all 0.2s;
  }

  .spoiler-block.revealed {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(192, 132, 252, 0.4);
    color: #e9d5ff;
  }

  .spoiler-hidden-mask {
    filter: blur(5px);
    user-select: none;
  }

  .spoiler-tag-pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 800;
    color: #fde047;
    background: rgba(234, 179, 8, 0.2);
    padding: 1px 5px;
    border-radius: 4px;
    letter-spacing: 0.04em;
  }

  .mention-pill {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 6px;
    background: rgba(124, 58, 237, 0.18);
    color: #c084fc;
    font-weight: 650;
    text-decoration: none;
    transition: background 0.2s, color 0.2s;
  }

  .mention-pill:hover {
    background: rgba(124, 58, 237, 0.35);
    color: #fff;
  }

  /* Actions Bar */
  .comment-actions-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .btn-action-like,
  .btn-action-reply,
  .btn-action-util {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: none;
    color: #8c899a;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: color 0.2s, background 0.2s;
  }

  .btn-action-like:hover,
  .btn-action-reply:hover,
  .btn-action-util:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.06);
  }

  .btn-action-like.liked {
    color: #fb7185;
  }

  .btn-action-delete:hover {
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.12);
  }

  .btn-action-report:hover {
    color: #fde047;
  }

  /* ----------------------------------------------------
     NESTED REPLIES
  ---------------------------------------------------- */
  .replies-wrapper {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .btn-toggle-replies {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: #c084fc;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    align-self: flex-start;
    transition: background 0.2s;
  }

  .btn-toggle-replies:hover {
    background: rgba(168, 85, 247, 0.15);
  }

  .nested-replies-list {
    margin-left: 20px;
    padding-left: 14px;
    border-left: 2px solid rgba(168, 85, 247, 0.3);
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .reply-comment {
    background: rgba(16, 18, 30, 0.65);
    border-radius: 14px;
    padding: 12px 14px;
  }

  /* Highlight target pulse */
  :global(.highlight-pulse) {
    animation: commentPulse 2.5s ease-out;
  }

  @keyframes commentPulse {
    0% { border-color: #a855f7; box-shadow: 0 0 20px rgba(168, 85, 247, 0.6); }
    100% { border-color: rgba(255, 255, 255, 0.07); box-shadow: none; }
  }

  @media (max-width: 640px) {
    .nested-replies-list {
      margin-left: 10px;
      padding-left: 10px;
    }

    .comment-card {
      padding: 14px;
    }

    .comments-header-row h2 {
      font-size: 18px;
    }
  }
</style>
