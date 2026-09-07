<script lang="ts">
  import Editor from '../../src/routes/admin/obras/[id]/capitulos/[chapter]/+page.svelte';
  import AdminLayout from '../../src/routes/admin/+layout.svelte';
  const data: any = {
    work: { id: 'qa-work', title: 'Editor local de teste' },
    chapter: null,
    pages: [],
    role: 'ADMIN'
  };
</script>

<main><AdminLayout {data}><Editor {data} /></AdminLayout></main>
