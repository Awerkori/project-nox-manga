<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { action } from '$lib/actions';
  import { date } from '$lib/types';
  import { tick } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { threadComments, parseCommentBody } from '$lib/comments';
  import { MessageSquare, Flag, X } from '@lucide/svelte';
  import ReportModal from '$lib/components/ReportModal.svelte';
  type Comment = {
    id: string;
    user_id: string;
    body: string;
    created_at: string;
    parent_id: string | null;
    members: { username: string; display_name: string; avatar_id?: string | null } | null;
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
  let body = $state(''),
    reply = $state<string | null>(null),
    edit = $state<string | null>(null),
    notice = $state(''),
    busy = $state(false),
    reportingComment = $state<Comment | null>(null);
  const revealedSpoilers = new SvelteSet<string>();

  function toggleSpoiler(key: string) {
    if (revealedSpoilers.has(key)) {
      revealedSpoilers.delete(key);
    } else {
      revealedSpoilers.add(key);
    }
  }
  let composer = $state<HTMLTextAreaElement>();
  let threaded = $derived(threadComments(comments));
  let replyComment = $derived(reply ? comments.find((c) => c.id === reply) : null);
  async function compose(comment: Comment, editing = false) {
    edit = editing ? comment.id : null;
    reply = editing ? null : comment.id;
    body = editing ? comment.body : '';
    await tick();
    composer?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    composer?.focus({ preventScroll: true });
  }
  async function send() {
    busy = true;
    notice = '';
    try {
      await action(
        'member',
        edit ? 'comment_edit' : 'comment',
        edit ? { id: edit, body } : { work_id: workId, chapter_id: chapterId, parent_id: reply, body }
      );
      body = '';
      reply = null;
      edit = null;
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
      await action('member', name, { id });
      await invalidateAll();
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<section class="comments">
  <div class="section-heading">
    <div>
      <span class="eyebrow">{chapterId ? 'DEPOIS DA ÚLTIMA PÁGINA' : 'AVALIAÇÕES & DISCUSSÃO'}</span>
      <h2>{chapterId ? 'O que você achou deste capítulo?' : 'O que você achou desta obra?'}</h2>
    </div>
    <span class="small muted">{comments.length} comentário{comments.length === 1 ? '' : 's'}</span>
  </div>
  {#if notice}<div class="notice error" role="alert">{notice}</div>{/if}
  {#if profile}<form
      onsubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      {#if replyComment}
        <div class="replying-banner">
          <div class="replying-info">
            <span class="replying-tag">Respondendo a</span>
            <strong class="replying-author">@{replyComment.members?.display_name || replyComment.members?.username || 'leitor'}</strong>
            <span class="replying-preview">"{replyComment.body.slice(0, 50)}{replyComment.body.length > 50 ? '…' : ''}"</span>
          </div>
          <button
            type="button"
            class="btn-cancel-reply"
            onclick={() => { reply = null; }}
            title="Cancelar resposta"
          >
            <X size={14} />
            <span>Cancelar</span>
          </button>
        </div>
      {/if}

      <label class="field"
        >{edit ? 'Editar comentário' : reply ? 'Sua resposta' : 'Seu comentário'}<textarea
          bind:value={body}
          bind:this={composer}
          rows="3"
          required
          maxlength="2000"
          placeholder={edit
            ? 'Edite seu comentário…'
            : reply
              ? `Respondendo a @${replyComment?.members?.display_name || replyComment?.members?.username || 'leitor'}…`
              : chapterId
                ? 'O que achou deste capítulo? Compartilhe suas impressões… Evite spoilers sem aviso.'
                : 'O que achou desta obra? Compartilhe suas impressões sobre a história, personagens e arte…'
          }></textarea></label
      >
      <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">
        <button class="button compact" disabled={busy || !body.trim()}>
          {busy ? 'Enviando…' : edit ? 'Salvar alteração' : reply ? 'Responder' : 'Comentar'}
        </button>
        <button
          type="button"
          class="btn-insert-spoiler"
          onclick={() => {
            body += (body.length ? ' ' : '') + '[spoiler]texto[/spoiler]';
          }}
          title="Inserir tag de spoiler oculta"
        >
          + Spoiler
        </button>
        {#if reply || edit}
          <button
            type="button"
            class="button secondary compact"
            onclick={() => {
              reply = null;
              edit = null;
              body = '';
            }}
          >
            Cancelar
          </button>
        {/if}
        <span class="small muted">{body.length}/2000 · Use [spoiler]texto[/spoiler] para ocultar revelações.</span>
      </div>
    </form>{:else}<div class="panel">
      <p><a class="text-link" href="/entrar">Entre na sua conta</a> para participar da conversa.</p>
    </div>{/if}

  {#if threaded.length === 0}
    <div class="empty-comments-state">
      <MessageSquare size={32} class="empty-comments-icon" />
      <p class="empty-comments-title">Nenhum comentário por enquanto</p>
      <span class="empty-comments-subtitle">
        {chapterId
          ? 'Seja o primeiro a compartilhar o que achou deste capítulo!'
          : 'Seja o primeiro a compartilhar sua opinião sobre esta obra!'}
      </span>
    </div>
  {:else}
    <div class="comment-list">
      {#each threaded as comment (comment.id)}<article class:reply={comment.parent_id !== null} class:is-reply-target={reply === comment.id}>
        <div class="comment-author">
          <span class="avatar"
            >{#if comment.members?.avatar_id}<img
                src="/media/{comment.members.avatar_id}"
                alt=""
                width="38"
                height="38"
                style="border-radius:50%"
                loading="lazy"
              />{:else}{(comment.members?.display_name[0] || 'N').toUpperCase()}{/if}</span
          >
          <div>
            <a href="/u/{comment.members?.username}">{comment.members?.display_name || 'Leitor'}</a><time
              datetime={comment.created_at}>{date(comment.created_at)}</time
            >
          </div>
        </div>
        <p class="comment-body">
          {#each parseCommentBody(comment.body) as chunk, idx (idx)}
            {#if chunk.type === 'spoiler'}
              <button
                type="button"
                class="spoiler-text"
                class:revealed={revealedSpoilers.has(comment.id + ':' + idx)}
                onclick={() => toggleSpoiler(comment.id + ':' + idx)}
                title={revealedSpoilers.has(comment.id + ':' + idx) ? 'Clique para ocultar spoiler' : 'Spoiler: clique para revelar'}
              >
                {#if revealedSpoilers.has(comment.id + ':' + idx)}
                  {chunk.content}
                {:else}
                  <span class="spoiler-masked">{chunk.content}</span>
                  <span class="spoiler-badge">SPOILER</span>
                {/if}
              </button>
            {:else}
              {chunk.content}
            {/if}
          {/each}
        </p>
        <div class="row small comment-actions-row">
          <button
            class="comment-button"
            onclick={() => mutate('comment_like', comment.id)}
            disabled={!profile || busy}>♡ {comment.comment_likes.length}</button
          >{#if profile}{#if !comment.parent_id}<button
                class="comment-button"
                onclick={() => compose(comment)}>Responder</button
              >{/if}{#if profile.id === comment.user_id}<button
                class="comment-button"
                onclick={() => compose(comment, true)}>Editar</button
              ><button
                class="comment-button"
                disabled={busy}
                onclick={() => mutate('comment_delete', comment.id)}>Apagar</button
              >{:else}<button
                type="button"
                class="comment-button report-btn"
                onclick={() => (reportingComment = comment)}
                title="Denunciar este comentário para a moderação"
              >
                <Flag size={11} />
                <span>Denunciar</span>
              </button>{/if}{/if}
        </div>
      </article>{/each}
    </div>
  {/if}

  {#if reportingComment}
    <ReportModal
      targetType="COMMENT"
      commentId={reportingComment.id}
      targetTitle={`Comentário de @${reportingComment.members?.username || 'leitor'}`}
      onclose={() => (reportingComment = null)}
      onsuccess={() => {
        reportingComment = null;
        notice = 'Denúncia sobre o comentário enviada à moderação com sucesso.';
      }}
    />
  {/if}
</section>

<style>
  .comments {
    margin: 55px 0;
  }
  .comments h2 {
    font-size: 26px;
  }
  .comment-list {
    margin-top: 30px;
  }
  .comment-list article {
    padding: 25px 0;
    border-bottom: 1px solid var(--line);
  }
  .comment-list article.reply {
    margin-left: 30px;
    padding-left: 20px;
    border-left: 2px solid #33263e;
  }
  .comment-author {
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: 13px;
  }
  .comment-author time {
    display: block;
    font-size: 10px;
    color: var(--muted);
    margin-top: 5px;
  }
  .comment-body {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 14px;
    color: #d7d1e0;
  }
  .comment-button {
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 11px;
    padding: 7px;
  }
  .comment-button:hover {
    color: var(--purple);
  }

  .btn-insert-spoiler {
    border: 1px solid rgba(181, 154, 245, 0.3);
    background: rgba(181, 154, 245, 0.08);
    color: #b59af5;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-insert-spoiler:hover {
    background: rgba(181, 154, 245, 0.18);
    border-color: rgba(181, 154, 245, 0.5);
    color: #ffffff;
  }

  .spoiler-text {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 4px;
    padding: 1px 6px;
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
    cursor: pointer;
    font-size: inherit;
    text-align: left;
    transition: all 0.2s ease;
    vertical-align: baseline;
    font-family: inherit;
  }

  .spoiler-text:not(.revealed) .spoiler-masked {
    filter: blur(5px);
    user-select: none;
    opacity: 0.4;
  }

  .spoiler-badge {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
    background: #ef4444;
    color: #fff;
    padding: 1px 5px;
    border-radius: 3px;
    margin-left: 2px;
  }

  .spoiler-text.revealed {
    background: rgba(181, 154, 245, 0.12);
    border-color: rgba(181, 154, 245, 0.3);
  }

  .empty-comments-state {
    padding: 44px 20px;
    text-align: center;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    margin: 30px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  :global(.empty-comments-icon) {
    color: #8c889f;
    opacity: 0.6;
    margin-bottom: 6px;
  }

  .empty-comments-title {
    font-size: 15px;
    font-weight: 700;
    color: #d1cde0;
    margin: 0;
  }

  .empty-comments-subtitle {
    font-size: 13px;
    color: #8c889f;
  }

  .comment-actions-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .report-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #8c889f;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .report-btn:hover {
    color: #ef4444;
  }

  /* Replying Context Banner */
  .replying-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 14px;
    margin-bottom: 8px;
    border-radius: 8px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.35);
  }

  .replying-info {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
  }

  .replying-tag {
    font-size: 11px;
    color: #a78bfa;
    font-weight: 600;
    white-space: nowrap;
  }

  .replying-author {
    font-size: 12.5px;
    color: #ffffff;
    font-weight: 750;
    white-space: nowrap;
  }

  .replying-preview {
    font-size: 11.5px;
    color: #9ca3af;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-cancel-reply {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    color: #f87171;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .btn-cancel-reply:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
  }

  /* Target Comment Highlight */
  .comment-list article.is-reply-target {
    background: rgba(139, 92, 246, 0.08);
    border-radius: 12px;
    padding: 18px 16px;
    border: 1px solid rgba(139, 92, 246, 0.45);
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.2);
    transition: all 0.25s ease;
  }
</style>
