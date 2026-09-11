<script lang="ts">
  import { onMount } from 'svelte';
  let {
    page,
    onSeen
  }: {
    page: { position: number; media_id: string; width: number; height: number; blobUrl?: string };
    onSeen: (page: number, visible: boolean) => void;
  } = $props();
  let root: HTMLDivElement;
  let loaded = false,
    visibleNow = false;
  let near = $state(false),
    broken = $state(false),
    retry = $state(0);
  onMount(() => {
    const preload = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            near = true;
            preload.disconnect();
          }
      },
      { rootMargin: '900px' }
    );
    preload.observe(root);
    const visible = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visibleNow = e.isIntersecting;
          onSeen(page.position, visibleNow && loaded);
        }
      },
      { rootMargin: '-30% 0px -30% 0px' }
    );
    visible.observe(root);
    return () => {
      preload.disconnect();
      visible.disconnect();
    };
  });
</script>

<div
  bind:this={root}
  id="pagina-{page.position}"
  class="reader-page"
  style="aspect-ratio:{page.width}/{page.height}"
>
  {#if near && !broken}<img
      src={page.blobUrl || `/media/${page.media_id}${retry ? '?retry=' + retry + '&_t=' + Date.now() : ''}`}
      alt="Página {page.position}"
      width={page.width}
      height={page.height}
      decoding="async"
      onload={() => {
        loaded = true;
        broken = false;
        onSeen(page.position, visibleNow);
      }}
      onerror={() => {
        loaded = false;
        broken = true;
        onSeen(page.position, false);
      }}
    />{/if}
  {#if broken}<div class="page-retry">
      <p>Não foi possível carregar a página {page.position}.</p>
      <button
        class="button secondary"
        onclick={() => {
          loaded = false;
          retry++;
          broken = false;
        }}>Tentar novamente</button
      >
    </div>{:else if !near}<span class="page-placeholder">{page.position}</span>{/if}
</div>

<style>
  .reader-page {
    width: 100%;
    position: relative;
    background: #121217;
  }
  .reader-page img {
    width: 100%;
    height: auto;
  }
  .page-placeholder {
    position: absolute;
    top: 40px;
    left: 50%;
    color: #68616f;
    font-size: 12px;
  }
  .page-retry {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 20px;
    text-align: center;
    font-size: 13px;
  }
</style>
