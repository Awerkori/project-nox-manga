<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { kindLabels } from '$lib/types';
  let { data } = $props();
  let search = $state(''),
    notice = $state(''),
    syncing = $state(false);
  let works = $derived(data.works.filter((w) => w.title.toLowerCase().includes(search.toLowerCase())));
  async function sync() {
    syncing = true;
    try {
      const response = await fetch('/api/staff', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      notice = result.message;
      await invalidateAll();
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      syncing = false;
    }
  }
</script>

<svelte:head><title>Obras — Nox Editorial</title></svelte:head>
<div class="row between">
  <div>
    <span class="eyebrow">CATÁLOGO EDITORIAL</span>
    <h1 style="font-size:34px">Obras</h1>
  </div>
  <a class="button" href="/admin/obras/nova">Adicionar obra +</a>
</div>
<p class="small">Cadastre a história, prepare os capítulos e publique quando tudo estiver revisado.</p>
<div class="filters">
  <input
    class="search-input"
    placeholder="Encontrar uma obra…"
    aria-label="Encontrar obra"
    bind:value={search}
  /><button class="button secondary" onclick={sync} disabled={syncing}
    >{syncing ? 'Importando…' : 'Importar obras da central'}</button
  >
</div>
{#if notice}<div class="notice" role="status">{notice}</div>{/if}
<div class="table-wrap panel">
  <table>
    <thead><tr><th>Obra</th><th>Formato</th><th>Situação</th><th></th></tr></thead><tbody
      >{#each works as work (work.id)}<tr
          ><td><strong>{work.title}</strong></td><td>{kindLabels[work.kind]}</td><td
            ><span class="chip">{work.published ? 'Publicada' : 'Rascunho'}</span></td
          ><td><a class="text-link" href="/admin/obras/{work.id}">Editar →</a></td></tr
        >{/each}</tbody
    >
  </table>
  {#if !works.length}<p>Nenhuma obra cadastrada com esse título.</p>{/if}
</div>
