<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { action } from '$lib/actions';
  import Empty from '$lib/components/Empty.svelte';
  import WorkCard from '$lib/components/WorkCard.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import { pageLink } from '$lib/pagination';
  import { date, statusLabels } from '$lib/types';
  let { data } = $props();
  let notice = $state('');
  let busy = $state(false);
  const pageHref = (page: number) =>
    pageLink(`/${data.area}`, page, { status: data.tab, filtro: data.filter });
  async function avatar(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    busy = true;
    try {
      if (file.size > 5_000_000) throw new Error('Selecione uma imagem de até 5 MB.');
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível processar a imagem.');
      const size = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(
        bitmap,
        (bitmap.width - size) / 2,
        (bitmap.height - size) / 2,
        size,
        size,
        0,
        0,
        256,
        256
      );
      bitmap.close();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Imagem inválida.'))), 'image/webp', 0.85)
      );
      const response = await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': blob.type },
        body: blob
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      notice = 'Avatar atualizado.';
      await invalidateAll();
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  let title = $derived(
    {
      biblioteca: 'Sua biblioteca.',
      favoritos: 'Suas histórias favoritas.',
      historico: 'Seu caminho até aqui.',
      notificacoes: 'O que há de novo.',
      perfil: 'Seu espaço na Nox.'
    }[data.area]
  );
  async function save(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    notice = '';
    try {
      await action(
        'member',
        'profile',
        Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement))
      );
      notice = 'Perfil atualizado.';
      await invalidateAll();
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function read() {
    if (busy) return;
    busy = true;
    try {
      await action('member', 'notifications', {});
      await invalidateAll();
      notice = 'Notificações marcadas como lidas.';
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{title} — Project Nox</title><meta name="robots" content="noindex" /></svelte:head>
<div class="container spacer-bottom">
  <div class="page-top">
    <span class="eyebrow">MEU UNIVERSO</span>
    <h1>{title}</h1>
  </div>
  <div class="tabs">
    {#each [['biblioteca', 'Biblioteca'], ['favoritos', 'Favoritos'], ['historico', 'Histórico'], ['notificacoes', 'Notificações'], ['perfil', 'Perfil']] as [path, label] (path)}<a
        class:selected={path === data.area}
        href="/{path}">{label}</a
      >{/each}
  </div>
  {#if notice}<div class="notice" role="status">{notice}</div>{/if}
  {#if data.area === 'perfil' && data.profile}<div class="two-columns">
      <section class="panel">
        {#if data.profile.avatar_id}<img
            src="/media/{data.profile.avatar_id}"
            alt="Seu avatar"
            width="70"
            height="70"
            style="border-radius:50%;object-fit:cover"
          />{:else}<span class="avatar" style="width:70px;height:70px;font-size:28px"
            >{data.profile.display_name[0]}</span
          >{/if}
        <label class="text-link" style="margin-top:15px;cursor:pointer"
          >{busy ? 'Enviando…' : 'Alterar avatar'}<input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onchange={avatar}
            style="display:none"
          /></label
        >
        <h2>{data.profile.display_name}</h2>
        <p>@{data.profile.username} · Na Nox desde {date(data.profile.created_at)}</p>
        <a class="text-link" href="/u/{data.profile.username}">Ver perfil público ↗</a>
        <div class="stat-row">
          <div class="stat"><strong>{Math.floor(data.profile.xp / 250) + 1}</strong><span>Nível</span></div>
          <div class="stat"><strong>{data.profile.xp}</strong><span>XP conquistado</span></div>
          <div class="stat"><strong>{data.completed}</strong><span>Capítulos lidos</span></div>
          <div class="stat"><strong>{data.libraryTotal}</strong><span>Obras na biblioteca</span></div>
          <div class="stat"><strong>{data.completedWorks}</strong><span>Obras concluídas</span></div>
        </div>
        <div class="progress"><span style="width:{((data.profile.xp % 250) / 250) * 100}%"></span></div>
        <p class="small">{250 - (data.profile.xp % 250)} XP para o próximo nível</p>
        {#if data.completed > 0}<span class="chip">✦ Primeiro capítulo</span>{/if}
        <form method="POST" action="/auth/sair" style="margin-top:35px">
          <button class="button secondary">Sair da conta</button>
        </form>
      </section>
      <form class="panel" onsubmit={save}>
        <h2 style="font-size:22px">Editar perfil</h2>
        <label class="field"
          >Nome de exibição<input
            name="display_name"
            value={data.profile.display_name}
            required
            maxlength="60"
          /></label
        ><label class="field"
          >Username<input
            name="username"
            value={data.profile.username}
            required
            minlength="3"
            maxlength="30"
            pattern="[a-z0-9_]+"
          /><small>Letras minúsculas, números e sublinhado.</small></label
        ><label class="field"
          >Sobre você<textarea name="bio" rows="4" maxlength="500">{data.profile.bio}</textarea></label
        ><button class="button" disabled={busy}>{busy ? 'Salvando…' : 'Salvar perfil'}</button>
      </form>
    </div>
  {:else if data.area === 'notificacoes'}
    <div class="chips" style="margin-bottom:24px">
      <a class="chip" aria-current={!data.filter ? 'page' : undefined} href="/notificacoes">Todas</a>
      <a class="chip" aria-current={data.filter ? 'page' : undefined} href="/notificacoes?filtro=nao-lidas"
        >Não lidas{data.unread ? ` (${data.unread})` : ''}</a
      >
    </div>
    {#if data.notifications.length}<div class="row between" style="margin-bottom:20px">
        <p class="small">{data.total} {data.total === 1 ? 'notificação' : 'notificações'}</p>
        <button class="button secondary compact" onclick={read} disabled={busy || !data.unread}
          >{busy ? 'Marcando…' : 'Marcar todas como lidas'}</button
        >
      </div>
      <div class="stack">
        {#each data.notifications as item (item.id)}<a
            class="panel"
            style="border-color:{item.read_at ? 'var(--line)' : '#58416e'}"
            href={item.href}
            ><span class="eyebrow">{date(item.created_at)}</span>
            <p style="color:#ddd7e5;margin-bottom:0">{item.body}</p></a
          >{/each}
      </div>{:else}<Empty
        title="Tudo em dia por aqui."
        text="Novos capítulos das obras acompanhadas, respostas e conquistas aparecerão aqui."
        href={data.filter ? '/notificacoes' : undefined}
        label={data.filter ? 'Ver todas as notificações' : undefined}
      />{/if}
  {:else if data.area === 'historico'}{#if data.history.length}
      <p class="small muted">
        {data.total}
        {data.total === 1 ? 'capítulo no histórico' : 'capítulos no histórico'}
      </p>
      <div class="continue-grid">
        {#each data.history as item (item.chapter_id)}{#if item.chapters}<a
              class="continue-card"
              href="/ler/{item.chapter_id}"
              ><div>
                <strong>{item.chapters.works?.title || 'Obra indisponível'}</strong>
                <p>
                  Capítulo {item.chapters.number} · Página {item.page}
                  {item.completed_at ? '· Concluído' : ''}
                </p>
                <p>{date(item.updated_at)}</p>
              </div>
              <span style="margin-left:auto">→</span></a
            >{/if}{/each}
      </div>{:else}<Empty
        title="Sua jornada começa com uma página."
        text="Ao abrir um capítulo, seu progresso fica salvo aqui."
        href="/catalogo"
        label="Explorar histórias"
      />{/if}
  {:else}{#if data.area === 'biblioteca'}<div class="chips" style="margin-bottom:28px">
        {#each [['', 'Todas'], ['READING', 'Lendo'], ['PLANNED', 'Quero ler'], ['COMPLETED', 'Concluído']] as [value, label] (value)}<a
            class="chip"
            aria-current={data.tab === value ? 'page' : undefined}
            style="opacity:{data.tab === value ? 1 : 0.6}"
            href="/biblioteca?status={value}">{label}</a
          >{/each}
      </div>{/if}{#if data.library.length}
      <p class="small muted">
        {data.total}
        {data.total === 1 ? 'obra' : 'obras'}{data.tab ? ` · ${statusLabels[data.tab]}` : ''}
      </p>
      <div class="work-grid">
        {#each data.library as item (item.work_id)}{#if item.works}<div>
              <WorkCard work={item.works} />
              <p class="small muted" style="margin-top:10px">
                {statusLabels[item.status]}{item.favorite ? ' · Favorito' : ''}
              </p>
            </div>{/if}{/each}
      </div>{:else}<Empty
        title={data.tab
          ? 'Nenhuma obra nesta lista.'
          : data.area === 'favoritos'
            ? 'Guarde as histórias que marcaram você.'
            : 'Uma biblioteca com a sua cara.'}
        text={data.tab
          ? 'Veja as outras listas ou organize uma obra pela página dela.'
          : 'Abra uma obra e adicione à sua biblioteca para acompanhar a leitura.'}
        href={data.tab ? '/biblioteca' : '/catalogo'}
        label={data.tab ? 'Ver toda a biblioteca' : 'Explorar o catálogo'}
      />{/if}{/if}
  {#if data.area !== 'perfil'}<Pagination
      page={data.page}
      total={data.total}
      pageSize={data.pageSize}
      href={pageHref}
    />{/if}
</div>
