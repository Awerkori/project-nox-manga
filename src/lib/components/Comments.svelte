<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { action } from '$lib/actions';
  import { date } from '$lib/types';
  import { tick } from 'svelte';
  import { threadComments } from '$lib/comments';
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
    busy = $state(false);
  let composer = $state<HTMLTextAreaElement>();
  let threaded = $derived(threadComments(comments));
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
      <span class="eyebrow">DEPOIS DA ÚLTIMA PÁGINA</span>
      <h2>Vamos conversar.</h2>
    </div>
    <span class="small muted">{comments.length} comentários</span>
  </div>
  {#if notice}<div class="notice error" role="alert">{notice}</div>{/if}
  {#if profile}<form
      onsubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label class="field"
        >{edit ? 'Editar comentário' : reply ? 'Responder ao comentário' : 'Seu comentário'}<textarea
          bind:value={body}
          bind:this={composer}
          rows="3"
          required
          maxlength="2000"
          placeholder="O que achou da história? Evite spoilers sem aviso."></textarea></label
      >
      <div class="row">
        <button class="button compact" disabled={busy}
          >{busy ? 'Enviando…' : edit ? 'Salvar alteração' : 'Comentar'}</button
        >{#if reply || edit}<button
            type="button"
            class="button secondary compact"
            onclick={() => {
              reply = null;
              edit = null;
              body = '';
            }}>Cancelar</button
          >{/if}<span class="small muted">{body.length}/2000 · Respeito faz parte da comunidade.</span>
      </div>
    </form>{:else}<div class="panel">
      <p><a class="text-link" href="/entrar">Entre na sua conta</a> para participar da conversa.</p>
    </div>{/if}
  <div class="comment-list">
    {#each threaded as comment (comment.id)}<article class:reply={comment.parent_id !== null}>
        <div class="comment-author">
          <span class="avatar"
            >{#if comment.members?.avatar_id}<img
                src="/media/{comment.members.avatar_id}"
                alt=""
                width="38"
                height="38"
                style="border-radius:50%"
                loading="lazy"
              />{:else}{comment.members?.display_name[0] || 'N'}{/if}</span
          >
          <div>
            <a href="/u/{comment.members?.username}">{comment.members?.display_name || 'Leitor Nox'}</a><time
              datetime={comment.created_at}>{date(comment.created_at)}</time
            >
          </div>
        </div>
        <p class="comment-body">{comment.body}</p>
        <div class="row small">
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
              >{/if}{/if}
        </div>
      </article>{/each}
  </div>
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
</style>
