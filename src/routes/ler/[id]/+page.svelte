<script lang="ts">
  import Reader from '$lib/components/Reader.svelte';
  let { data } = $props();
</script>

<!-- A new chapter must not inherit observers, timers or progress from the previous one. -->
{#key `${data.chapter.id}:${data.preview}`}
  <Reader {data} />
{/key}
