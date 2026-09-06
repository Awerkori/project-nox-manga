<script lang="ts">
  import { onMount } from 'svelte';
  import ReaderRoute from '../../src/routes/ler/[id]/+page.svelte';
  // Isolated browser fixtures: never stored or published, no account or backend mutations.
  function chapter(id: string, number: number, count: number) {
    return {
      chapter: {
        id,
        number,
        work_id: 'qa-work',
        works: { title: 'Leitura local de teste', slug: 'qa', kind: 'MANGA' }
      },
      pages: Array.from({ length: count }, (_, index) => ({
        position: index + 1,
        media_id: `${id}-${index + 1}`,
        width: 600,
        height: 800
      })),
      comments: [],
      profile: null,
      preview: false,
      progress: null,
      previous: null,
      next: null
    };
  }
  let data = $state<any>(chapter('qa-first', 1, 3));
  onMount(() => {
    (window as any).readerHarness = {
      next: () => {
        data = chapter('qa-second', 2, 2);
      }
    };
    return () => {
      delete (window as any).readerHarness;
    };
  });
</script>

<ReaderRoute {data} />
