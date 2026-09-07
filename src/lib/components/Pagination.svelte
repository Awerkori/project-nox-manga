<script lang="ts">
  let { page, total, pageSize, href } = $props<{
    page: number;
    total: number;
    pageSize: number;
    href: (page: number) => string;
  }>();
  const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
</script>

{#if pages > 1}
  <nav class="pagination" aria-label="Paginação">
    {#if page > 1}<a class="button secondary" rel="prev" href={href(page - 1)}>Anterior</a>{/if}
    <span aria-live="polite">Página {page} de {pages}</span>
    {#if page < pages}<a class="button secondary" rel="next" href={href(page + 1)}>Próxima</a>{/if}
  </nav>
{/if}

<style>
  .pagination {
    flex-wrap: wrap;
  }
  span {
    color: var(--muted);
    font-size: 12px;
  }
</style>
