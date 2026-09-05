<script lang="ts">
  import { action } from '$lib/actions';
  import { invalidateAll } from '$app/navigation';
  let { data } = $props();
  let notice = $state(''),
    busy = $state(false),
    search = $state('');
  let members = $derived(
    data.members.filter((m) =>
      (m.username + ' ' + m.display_name).toLowerCase().includes(search.toLowerCase())
    )
  );
  async function update(name: string, details: Record<string, unknown>) {
    busy = true;
    try {
      await action('owner', name, details);
      notice = 'Alteração registrada.';
      await invalidateAll();
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function invite(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    try {
      const f = new FormData(event.currentTarget as HTMLFormElement);
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: f.get('email') })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      notice = result.message;
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Usuários e moderação — Nox Admin</title></svelte:head><span class="eyebrow"
  >ADMINISTRAÇÃO</span
>
<h1 style="font-size:34px">Pessoas e comunidade</h1>
<p class="small">Administradores controlam todo o site. Editores cuidam de obras, capítulos e publicação.</p>
<form class="panel" onsubmit={invite} style="margin:24px 0">
  <h2 style="font-size:21px">Autorizar um editor</h2>
  <p class="small">
    A pessoa recebe a permissão ao entrar com este e-mail confirmado. O convite não concede acesso à
    administração de usuários.
  </p>
  <div class="row">
    <input
      class="control"
      type="email"
      name="email"
      placeholder="E-mail do editor"
      aria-label="E-mail do editor"
      required
      maxlength="254"
      style="flex:1;min-width:220px"
    /><button class="button secondary" disabled={busy}>Registrar convite</button>
  </div>
</form>
{#if notice}<div class="notice" role="status">{notice}</div>{/if}<input
  class="control"
  bind:value={search}
  aria-label="Buscar usuário"
  placeholder="Buscar por nome ou username…"
  style="margin-bottom:22px"
/>
<section class="panel table-wrap">
  <table>
    <thead><tr><th>Usuário</th><th>Cargo</th><th>Situação</th><th></th></tr></thead><tbody
      >{#each members as m (m.id)}<tr
          ><td
            ><strong>{m.display_name}</strong>
            <p class="small" style="margin:4px 0">@{m.username}</p></td
          ><td
            ><select
              class="control"
              value={m.access_roles?.role || 'USER'}
              aria-label="Cargo de {m.display_name}"
              disabled={busy}
              onchange={(e) => update('role', { id: m.id, role: e.currentTarget.value })}
              ><option value="USER">Leitor</option><option value="EDITOR">Editor</option><option value="ADMIN"
                >Administrador</option
              ></select
            ></td
          ><td>{m.access_roles?.suspended ? 'Suspenso' : 'Ativo'}</td><td
            ><button
              class="button secondary compact"
              disabled={busy}
              onclick={() => update('suspend', { id: m.id, suspended: !m.access_roles?.suspended })}
              >{m.access_roles?.suspended ? 'Reativar' : 'Suspender'}</button
            ></td
          ></tr
        >{/each}</tbody
    >
  </table>
</section>
<h2 style="font-size:25px;margin-top:40px">Comentários recentes</h2>
<div class="stack">
  {#each data.comments as comment (comment.id)}<article class="panel">
      <div class="row between">
        <span class="small">{comment.members?.display_name} · {comment.works?.title}</span><span class="chip"
          >{comment.removed ? 'Removido' : 'Visível'}</span
        >
      </div>
      <p style="white-space:pre-wrap;overflow-wrap:anywhere">{comment.body}</p>
      <button
        class="button secondary compact"
        disabled={busy}
        onclick={() => update('moderate', { id: comment.id, removed: !comment.removed })}
        >{comment.removed ? 'Restaurar' : 'Remover comentário'}</button
      >
    </article>{/each}
</div>
