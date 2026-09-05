<script lang="ts">
  import WorkCard from '$lib/components/WorkCard.svelte';
  import Empty from '$lib/components/Empty.svelte';
  import { kindLabels } from '$lib/types';
  let { data } = $props();
  const pageUrl = (n: number) =>
    `?${new URLSearchParams({ q: data.q, tag: data.tag, tipo: data.kind, ordem: data.sort, pagina: String(n) })}`;
</script>

<svelte:head><title>Explorar mangás, manhwas e webtoons — Project Nox</title></svelte:head>
<div class="container spacer-bottom">
  <div class="page-top">
    <span class="eyebrow">ENCONTRE SEU PRÓXIMO UNIVERSO</span>
    <h1>Explore o catálogo.</h1>
    <p>Uma boa história pode começar com uma busca. Encontre a sua.</p>
  </div>
  <form class="filters" role="search">
    <input
      class="search-input"
      name="q"
      value={data.q}
      placeholder="Buscar por título ou outros nomes…"
      aria-label="Título da obra"
    /><select name="tag" value={data.tag} aria-label="Gênero ou tag"
      ><option value="">Gêneros e tags</option>{#each data.tags as tag (tag?.id)}<option
          value={tag.slug}>{tag.name}</option
        >{/each}</select
    ><select name="tipo" value={data.kind} aria-label="Tipo de obra"
      ><option value="">Formato</option
      >{#each Object.entries(kindLabels) as [value, label] (value)}<option {value}>{label}</option
        >{/each}</select
    ><select name="ordem" value={data.sort} aria-label="Ordenação"
      ><option value="recentes">Atualizados recentemente</option><option value="titulo">Título A–Z</option
      ></select
    ><button class="button">Buscar</button>
  </form>
  <p class="small muted">{data.count} {data.count === 1 ? 'obra encontrada' : 'obras encontradas'}</p>
  {#if data.works.length}<div class="work-grid">
      {#each data.works as work, index (work.id)}<WorkCard {work} {index} />{/each}
    </div>{:else}<Empty
      title={data.q || data.tag || data.kind
        ? 'Nenhuma história com esses filtros.'
        : 'O catálogo está sendo preparado.'}
      text={data.q || data.tag || data.kind
        ? 'Experimente outro título, gênero ou formato.'
        : 'Os capítulos aparecem aqui assim que a equipe concluir a revisão e publicação.'}
      href={data.q || data.tag || data.kind ? '/catalogo' : '/'}
      label={data.q || data.tag || data.kind ? 'Limpar filtros' : 'Voltar ao início'}
    />{/if}
  {#if data.count > 20}<div class="pagination">
      {#if data.page > 1}<a class="button secondary" href={pageUrl(data.page - 1)}>Anterior</a>{/if}<span
        >Página {data.page}</span
      >{#if data.page * 20 < data.count}<a class="button secondary" href={pageUrl(data.page + 1)}>Próxima</a
        >{/if}
    </div>{/if}
</div>
