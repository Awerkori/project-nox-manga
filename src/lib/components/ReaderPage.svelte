<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  let {
    page,
    onSeen,
    eager = false
  }: {
    page: { position: number; media_id: string; width: number; height: number; blobUrl?: string };
    onSeen: (page: number, visible: boolean) => void;
    eager?: boolean;
  } = $props();
  let root: HTMLDivElement;
  let loaded = false,
    visibleNow = false;
  let near = $state(false),
    broken = $state(false),
    retry = $state(0);

  let preloadObserver: IntersectionObserver | null = null;
  let visibleObserver: IntersectionObserver | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    preloadObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            near = true;
            preloadObserver?.disconnect();
          }
      },
      { rootMargin: '900px' }
    );
    preloadObserver.observe(root);
    visibleObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visibleNow = e.isIntersecting;
          onSeen(page.position, visibleNow && loaded);
        }
      },
      { rootMargin: '-30% 0px -30% 0px' }
    );
    visibleObserver.observe(root);
  });

  onDestroy(() => {
    if (retryTimer) clearTimeout(retryTimer);
    preloadObserver?.disconnect();
    visibleObserver?.disconnect();
  });

  function setupPageImg(node: HTMLImageElement) {
    const handleLoad = () => {
      loaded = true;
      broken = false;
      onSeen(page.position, visibleNow);
    };
    const handleError = () => {
      if (retry < 2) {
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          retry++;
        }, 500 * (retry + 1));
      } else {
        loaded = false;
        broken = true;
        onSeen(page.position, false);
      }
    };

    node.addEventListener('load', handleLoad);
    node.addEventListener('error', handleError);
    if (node.complete && node.naturalWidth > 0) handleLoad();

    return {
      destroy() {
        node.removeEventListener('load', handleLoad);
        node.removeEventListener('error', handleError);
      }
    };
  }
</script>

<div
  bind:this={root}
  id="pagina-{page.position}"
  class="reader-page"
  style="aspect-ratio:{page.width && page.height ? `${page.width}/${page.height}` : '2/3'}; min-height: 350px;"
>
  {#if (eager || near) && !broken}<img
      use:setupPageImg
      src={page.blobUrl || `/media/${page.mediaId}${retry ? '?retry=' + retry + '&_t=' + Date.now() : ''}`}
      alt="Página {page.position}"
      width={page.width || 800}
      height={page.height || 1200}
      decoding="async"
      fetchpriority={eager ? 'high' : 'auto'}
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
    </div>{:else if !near && !eager}<span class="page-placeholder">{page.position}</span>{/if}
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
