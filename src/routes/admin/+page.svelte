<script>
  let { data } = $props();
</script>

<svelte:head><title>Painel editorial — Project Nox</title></svelte:head>
<div class="row between">
  <div>
    <span class="eyebrow">BEM-VINDO À EQUIPE</span>
    <h1 style="font-size:34px">Histórias prontas para ganhar o mundo.</h1>
  </div>
  <a class="button" href="/admin/obras/nova">Adicionar obra +</a>
</div>
<div class="stat-row">
  <div class="stat"><strong>{data.works}</strong><span>Obras cadastradas</span></div>
  <div class="stat"><strong>{data.chapters}</strong><span>Capítulos publicados</span></div>
</div>
<section class="panel">
  <div class="row between">
    <h2 style="font-size:23px">Na mesa de edição</h2>
    <a class="text-link" href="/admin/obras">Todas as obras →</a>
  </div>
  {#if data.drafts.length}<div class="stack">
      {#each data.drafts as draft (draft.id)}<a
          class="continue-card"
          href="/admin/obras/{draft.works.id}/capitulos/{draft.id}"
          ><div>
            <strong>{draft.works.title}</strong>
            <p>Capítulo {draft.number} · Rascunho</p>
          </div>
          <span style="margin-left:auto">Editar →</span></a
        >{/each}
    </div>{:else}<p class="small">Nenhum capítulo em rascunho. Adicione uma obra para começar.</p>{/if}
</section>
