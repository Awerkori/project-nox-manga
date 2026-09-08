<script lang="ts">
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import WorkCard from '$lib/components/WorkCard.svelte';
  import Empty from '$lib/components/Empty.svelte';
  import { kindLabels, statusLabels } from '$lib/types';
  import { Search, Sparkles } from '@lucide/svelte';

  let { data } = $props();

  const pageUrl = (n: number) => {
    const params = new SvelteURLSearchParams();
    if (data.q) params.set('q', data.q);
    if (data.tag) params.set('tag', data.tag);
    if (data.kind) params.set('tipo', data.kind);
    if (data.status) params.set('status', data.status);
    if (data.sort && data.sort !== 'recentes') params.set('ordem', data.sort);
    if (n > 1) params.set('pagina', String(n));
    const qs = params.toString();
    return qs ? `?${qs}` : '/catalogo';
  };
</script>

<svelte:head>
  <title>Explorar mangás, manhwas e webtoons — Project Nox</title>
</svelte:head>

<div class="container catalog-page spacer-bottom">
  <div class="page-top">
    <div class="badge-tag">
      <Sparkles size={12} />
      <span>ACERVO OFICIAL</span>
    </div>
    <h1 class="catalog-title">Explorar Leituras</h1>
    <p class="catalog-subtitle">Descubra mangás, manhwas e webtoons organizados por formato, gênero e status.</p>
  </div>

  <form class="filters-glass-form" role="search">
    <div class="search-input-wrap">
      <Search size={18} class="search-icon" />
      <input
        class="search-text-input"
        name="q"
        value={data.q}
        placeholder="Buscar por título ou autor…"
        aria-label="Título da obra"
      />
    </div>

    <div class="filters-selects-group">
      <select name="tag" value={data.tag} aria-label="Gênero ou tag" class="filter-select">
        <option value="">Todos os gêneros</option>
        {#each data.tags as tag (tag?.id)}
          <option value={tag.slug}>{tag.name}</option>
        {/each}
      </select>

      <select name="tipo" value={data.kind} aria-label="Tipo de obra" class="filter-select">
        <option value="">Todos os formatos</option>
        {#each Object.entries(kindLabels) as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>

      <select name="status" value={data.status} aria-label="Status da obra" class="filter-select">
        <option value="">Todos os status</option>
        {#each ['ONGOING', 'COMPLETED', 'HIATUS'] as value (value)}
          <option {value}>{statusLabels[value]}</option>
        {/each}
      </select>

      <select name="ordem" value={data.sort} aria-label="Ordenação" class="filter-select">
        <option value="recentes">Atualizados recentemente</option>
        <option value="titulo">Título A–Z</option>
      </select>

      <button class="btn-filter-submit" aria-label="Buscar">Buscar</button>
    </div>
  </form>

  <div class="results-meta-bar">
    <span class="count-pill">
      {data.count} {data.count === 1 ? 'obra encontrada' : 'obras encontradas'}
    </span>
  </div>

  {#if data.works.length}
    <div class="catalog-grid">
      {#each data.works as work, index (work.id)}
        <WorkCard {work} {index} />
      {/each}
    </div>
  {:else}
    <Empty
      title={data.q || data.tag || data.kind
        ? 'Nenhuma história com esses filtros.'
        : 'O catálogo está sendo preparado.'}
      text={data.q || data.tag || data.kind
        ? 'Experimente outro título, gênero ou formato.'
        : 'Os capítulos aparecem aqui assim que a equipe concluir a revisão e publicação.'}
      href={data.q || data.tag || data.kind ? '/catalogo' : '/'}
      label={data.q || data.tag || data.kind ? 'Limpar filtros' : 'Voltar ao início'}
    />
  {/if}

  {#if data.count > 20}
    <div class="pagination-bar">
      {#if data.page > 1}
        <a class="button secondary" href={pageUrl(data.page - 1)}>Anterior</a>
      {/if}
      <span class="page-num">Página {data.page}</span>
      {#if data.page * 20 < data.count}
        <a class="button secondary" href={pageUrl(data.page + 1)}>Próxima</a>
      {/if}
    </div>
  {/if}
</div>

<style>
  .catalog-page {
    position: relative;
    z-index: 1;
  }

  .badge-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #c9aa73;
    margin-bottom: 8px;
  }

  .catalog-title {
    font-size: clamp(32px, 4.5vw, 48px);
    font-weight: 800;
    margin: 0 0 10px;
    color: #ffffff;
  }

  .catalog-subtitle {
    font-size: 15px;
    color: #9d99ab;
    margin: 0 0 32px;
    max-width: 600px;
  }

  .filters-glass-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px;
    border-radius: 18px;
    background: rgba(13, 16, 26, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(16px);
    margin-bottom: 24px;
  }

  .search-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  :global(.search-icon) {
    position: absolute;
    left: 16px;
    color: #8c899a;
    pointer-events: none;
  }

  .search-text-input {
    width: 100%;
    padding: 14px 18px 14px 46px;
    border-radius: 12px;
    background: rgba(8, 10, 18, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #ffffff;
    font-size: 14px;
    transition: border-color 0.2s ease;
  }

  .search-text-input:focus {
    outline: none;
    border-color: #b59af5;
  }

  .filters-selects-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .filter-select {
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(18, 22, 36, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #d1cde0;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }

  .filter-select:focus {
    outline: none;
    border-color: #b59af5;
  }

  .btn-filter-submit {
    padding: 10px 20px;
    border-radius: 10px;
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-filter-submit:hover {
    background: linear-gradient(135deg, #9333ea, #7c3aed);
    transform: translateY(-1px);
  }

  .results-meta-bar {
    margin-bottom: 24px;
  }

  .count-pill {
    font-size: 12px;
    font-weight: 600;
    color: #8c899a;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    padding: 4px 12px;
    border-radius: 999px;
  }

  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 24px;
  }

  .pagination-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 48px;
  }

  .page-num {
    font-size: 14px;
    color: #a6a3b8;
  }

  @media (max-width: 640px) {
    .filters-selects-group {
      flex-direction: column;
      align-items: stretch;
    }

    .filter-select {
      width: 100%;
    }

    .btn-filter-submit {
      width: 100%;
    }

    .catalog-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }
  }
</style>
