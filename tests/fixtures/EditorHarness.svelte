<script lang="ts">
  import Editor from '../../src/routes/admin/obras/[id]/capitulos/[chapter]/+page.svelte';
  const data: any = {
    work: { id: 'qa-work', title: 'Editor local de teste' },
    chapter: null,
    pages: [],
    role: 'EDITOR'
  };
</script>

<main style="max-width:1000px;margin:auto;padding:24px"><Editor {data} /></main>
