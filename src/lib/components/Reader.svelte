<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { ArrowLeft, ArrowRight, Settings2, Maximize, ChevronUp, Sparkles } from '@lucide/svelte';
  import ReaderPage from '$lib/components/ReaderPage.svelte';
  import Comments from '$lib/components/Comments.svelte';
  import { action } from '$lib/actions';
  import { readPreference, savePreference } from '$lib/preferences';
  import type { PageData } from '../../routes/ler/[id]/$types';
  let { data }: { data: PageData } = $props();
  let current = $state(1),
    settings = $state(false),
    width = $state(850),
    gap = $state(false),
    notice = $state(''),
    xpNotice = $state(''),
    fullscreen = $state(false),
    uiVisible = $state(true);
  const visible = new SvelteSet<number>();
  let sending = false;
  let maxSeenPage = $state(1);
  let chapterCompleted = $state(false);
  let previousChapterId = $state('');
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function resetHideTimer() {
    uiVisible = true;
    if (hideTimer) clearTimeout(hideTimer);
    if (!settings) {
      hideTimer = setTimeout(() => {
        uiVisible = false;
      }, 2500);
    }
  }

  function toggleUi() {
    if (uiVisible) {
      uiVisible = false;
      if (hideTimer) clearTimeout(hideTimer);
    } else {
      resetHideTimer();
    }
  }

  $effect(() => {
    if (data.chapter?.id && data.chapter.id !== previousChapterId) {
      previousChapterId = data.chapter.id;
      visible.clear();
      const saved = data.progress?.page || Number(readPreference(`nox-page:${data.chapter.id}`)) || 1;
      current = saved;
      maxSeenPage = saved;
      chapterCompleted = !!data.progress?.completed_at;
      requestAnimationFrame(() => jump(Math.min(data.pages.length, Math.max(1, saved))));
      resetHideTimer();
    }
  });

  async function completeChapter() {
    if (chapterCompleted || sending || !data.profile || data.preview) return;
    chapterCompleted = true;
    try {
      const res = (await action('member', 'read_page', {
        work_id: data.chapter.work_id,
        chapter_id: data.chapter.id,
        page: data.pages.length,
        completed: true
      })) as { ok?: boolean; completed?: boolean } | null;
      if (res?.completed && !data.progress?.completed_at) {
        xpNotice = '✦ Capítulo Concluído! +25 XP';
        setTimeout(() => {
          xpNotice = '';
        }, 5000);
      }
    } catch {
      chapterCompleted = false;
    }
  }

  function seen(page: number, isVisible: boolean) {
    if (isVisible) {
      visible.add(page);
      if (page > maxSeenPage) maxSeenPage = page;
    } else {
      visible.delete(page);
    }
    if (visible.size) current = Math.min(...visible);
    if (maxSeenPage >= data.pages.length && !chapterCompleted) {
      void completeChapter();
    }
  }

  function jump(page: number) {
    document.getElementById(`pagina-${page}`)?.scrollIntoView({ behavior: 'instant' });
  }

  async function full() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notice = 'Tela cheia indisponível neste navegador.';
    }
  }

  onMount(() => {
    chapterCompleted = !!data.progress?.completed_at;
    previousChapterId = data.chapter.id;
    resetHideTimer();

    fullscreen = !!document.documentElement.requestFullscreen;
    try {
      const prefs = JSON.parse(readPreference('nox-reader') || '{}');
      width = Math.min(1200, Math.max(400, Number(prefs.width) || 850));
      gap = !!prefs.gap;
    } catch {
      /* Default preferences remain valid. */
    }
    const saved = data.progress?.page || Number(readPreference(`nox-page:${data.chapter.id}`)) || 1;
    maxSeenPage = saved;
    requestAnimationFrame(() => jump(Math.min(data.pages.length, Math.max(1, saved))));
    if (data.profile && !data.preview)
      action('member', 'read_start', { work_id: data.chapter.work_id, chapter_id: data.chapter.id }).catch(
        () => {
          notice = 'Sincronização indisponível. Tentaremos novamente durante a leitura.';
        }
      );

    const endEl = document.querySelector('.reader-end');
    let endObserver: IntersectionObserver | null = null;
    if (endEl && typeof IntersectionObserver !== 'undefined') {
      endObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            maxSeenPage = data.pages.length;
            current = data.pages.length;
            void completeChapter();
          }
        },
        { threshold: 0.1 }
      );
      endObserver.observe(endEl);
    }

    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible' || sending) return;
      const pageToSave = current;
      const locallySaved = savePreference(`nox-page:${data.chapter.id}`, String(pageToSave));
      savePreference('nox-reader', JSON.stringify({ width, gap }));
      if (data.profile && !data.preview) {
        sending = true;
        try {
          await action('member', 'read_page', {
            work_id: data.chapter.work_id,
            chapter_id: data.chapter.id,
            page: pageToSave,
            completed: chapterCompleted || maxSeenPage >= data.pages.length || pageToSave >= data.pages.length
          });
          notice = '';
        } catch {
          notice = locallySaved
            ? 'Sem conexão para sincronizar. O progresso está salvo neste dispositivo.'
            : 'Não foi possível salvar o progresso. Verifique sua conexão.';
        } finally {
          sending = false;
        }
      }
    }, 3500);

    const saveOnExit = () => {
      const pageToSave = current;
      savePreference(`nox-page:${data.chapter.id}`, String(pageToSave));
      savePreference('nox-reader', JSON.stringify({ width, gap }));
      if (data.profile && !data.preview)
        void fetch('/api/action', {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: 'member',
            action: 'read_page',
            data: {
              work_id: data.chapter.work_id,
              chapter_id: data.chapter.id,
              page: pageToSave,
              completed: chapterCompleted || maxSeenPage >= data.pages.length || pageToSave >= data.pages.length
            }
          })
        }).catch(() => {});
    };

    window.addEventListener('pagehide', saveOnExit);
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      clearInterval(timer);
      endObserver?.disconnect();
      window.removeEventListener('pagehide', saveOnExit);
      saveOnExit();
    };
  });
</script>

<svelte:window
  onmousemove={(e) => {
    if (e.clientY <= 70) {
      resetHideTimer();
    }
  }}
  onclick={(e) => {
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('.reader-bar') ||
      target?.closest('.reader-settings') ||
      target?.closest('.reader-end') ||
      target?.closest('.reader-comments') ||
      target?.closest('button') ||
      target?.closest('a') ||
      target?.closest('input') ||
      target?.closest('select')
    ) {
      return;
    }
    toggleUi();
  }}
  onkeydown={(e) => {
    if (e.key === 'Escape') {
      settings = false;
      resetHideTimer();
    }
  }}
/>

<svelte:head>
  <title>{data.chapter.works?.title} — Capítulo {data.chapter.number} | Project Nox</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="reader-shell">
  <header
    class="reader-bar"
    class:ui-hidden={!uiVisible && !settings}
  >
    <a
      href={data.preview ? `/admin/obras/${data.chapter.work_id}` : `/obra/${data.chapter.works?.slug}`}
      aria-label="Voltar para obra"
    >
      <ArrowLeft size={20} />
    </a>
    <div class="reader-header-meta">
      <strong>{data.chapter.works?.title}</strong>
      <span>Capítulo {data.chapter.number}{data.preview ? ' · Prévia editorial' : ''}</span>
    </div>
    <div class="reader-tools">
      <span class="pages-count">{current}/{data.pages.length}</span>
      <button
        class="icon-button"
        aria-label="Ajustes de leitura"
        onclick={() => {
          settings = !settings;
          resetHideTimer();
        }}
      >
        <Settings2 size={20} />
      </button>
      {#if fullscreen}
        <button class="icon-button" aria-label="Alternar tela cheia" onclick={full}>
          <Maximize size={19} />
        </button>
      {/if}
    </div>
  </header>

  {#if settings}
    <aside class="reader-settings">
      <label class="field">
        Largura de leitura
        <input type="range" min="400" max="1200" step="50" bind:value={width} />
      </label>
      <label class="small">
        <input type="checkbox" bind:checked={gap} /> Separar páginas tradicionais
      </label>
      <label class="field" style="margin-top:20px">
        Ir para página
        <select value={current} onchange={(e) => jump(Number(e.currentTarget.value))}>
          {#each data.pages as page (page.position)}
            <option value={page.position}>{page.position}</option>
          {/each}
        </select>
      </label>
      <button class="button secondary compact" onclick={() => (settings = false)}>
        Fechar ajustes
      </button>
    </aside>
  {/if}

  {#if notice}
    <div class="notice reading-width" role="status">{notice}</div>
  {/if}
  {#if xpNotice}
    <div class="xp-toast" role="status">
      <Sparkles size={16} />
      <span>{xpNotice}</span>
    </div>
  {/if}

  <div class="page-stack" style="max-width:{width}px;gap:{gap ? '20px' : '0'}">
    {#each data.pages as page (page.position)}
      <ReaderPage {page} onSeen={seen} />
    {/each}
  </div>

  <div class="reader-end">
    <div class="celebration-seal">
      <Sparkles size={15} />
      <span>CAPÍTULO CONCLUÍDO</span>
    </div>
    <h2 class="end-heading">Fim do Capítulo {data.chapter.number}</h2>
    <p class="end-sub">
      {data.chapter.works?.title} · Edição Oficial Project Nox
    </p>
    <div class="end-nav-row">
      {#if data.previous}
        <a class="btn-nav-prev" href="/ler/{data.previous.id}">
          <ArrowLeft size={16} />
          <span>Cap. {data.previous.number}</span>
        </a>
      {/if}
      {#if data.next}
        <a class="btn-nav-next" href="/ler/{data.next.id}">
          <span>Próximo: Cap. {data.next.number}</span>
          <ArrowRight size={16} />
        </a>
      {:else}
        <a class="btn-nav-next" href="/obra/{data.chapter.works?.slug}">
          <span>Voltar para a obra</span>
          <ArrowRight size={16} />
        </a>
      {/if}
    </div>
  </div>
  <div class="reader-comments">
    {#if !data.preview}<Comments
        comments={data.comments}
        workId={data.chapter.work_id}
        chapterId={data.chapter.id}
        profile={data.profile}
      />{/if}
  </div>
  <button class="back-top icon-button" aria-label="Voltar ao topo" onclick={() => jump(1)}
    ><ChevronUp /></button
  >
  <div class="reader-progress" style="width:{(current / Math.max(1, data.pages.length)) * 100}%"></div>
</div>

<style>
  .reader-shell {
    background: #06070c;
    min-height: 100vh;
    position: relative;
  }

  .reader-bar {
    height: 64px;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    background: rgba(6, 7, 12, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(181, 154, 245, 0.16);
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 0 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.75);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
  }

  .reader-bar.ui-hidden {
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
  }

  .reader-header-meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .reader-bar strong {
    display: block;
    max-width: 45vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    color: #ffffff;
  }

  .reader-bar span {
    display: block;
    font-size: 11px;
    color: #8c899a;
    margin-top: 2px;
  }

  .reader-tools {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }

  .pages-count {
    font-size: 12px;
    font-weight: 700;
    color: #dfc28d;
    margin: 0;
    background: rgba(201, 170, 115, 0.12);
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid rgba(201, 170, 115, 0.25);
  }

  .page-stack {
    margin: auto;
    display: flex;
    flex-direction: column;
    padding-top: 64px;
  }

  .reader-settings {
    position: fixed;
    top: 76px;
    right: 20px;
    z-index: 60;
    width: 300px;
    background: rgba(11, 13, 24, 0.96);
    border: 1px solid rgba(181, 154, 245, 0.28);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    padding: 22px;
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85), 0 0 24px rgba(181, 154, 245, 0.1);
  }

  .reader-end {
    padding: 72px 20px 56px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    margin-top: 40px;
  }

  .celebration-seal {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.16em;
    color: #dfc28d;
    background: rgba(201, 170, 115, 0.12);
    border: 1px solid rgba(201, 170, 115, 0.35);
    padding: 5px 14px;
    border-radius: 999px;
    margin-bottom: 4px;
  }

  .end-heading {
    font-size: clamp(22px, 3.5vw, 32px);
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .end-sub {
    font-size: 13.5px;
    color: #8c889f;
    margin: 0 0 20px;
  }

  .end-nav-row {
    display: flex;
    gap: 14px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn-nav-prev {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 22px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d1cde0;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-nav-prev:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .btn-nav-next {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 26px;
    border-radius: 12px;
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #ffffff;
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
    box-shadow: 0 4px 20px rgba(109, 40, 217, 0.4);
    transition: all 0.2s ease;
  }

  .btn-nav-next:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(139, 92, 246, 0.55);
  }

  .reader-comments {
    max-width: 850px;
    margin: auto;
    padding: 0 22px 40px;
  }

  .reader-progress {
    height: 3px;
    position: fixed;
    bottom: 0;
    left: 0;
    background: linear-gradient(90deg, #8b5cf6, #dfc28d);
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.7);
    z-index: 50;
    transition: width 0.3s ease;
  }

  .back-top {
    position: fixed;
    bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    right: calc(24px + env(safe-area-inset-right, 0px));
    background: rgba(18, 22, 36, 0.85);
    border: 1px solid rgba(181, 154, 245, 0.3);
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    cursor: pointer;
    color: #d1cde0;
    transition: all 0.2s ease;
    z-index: 40;
  }

  .back-top:hover {
    color: #ffffff;
    border-color: #b59af5;
    transform: translateY(-2px);
  }

  .reader-bar > a {
    padding: 8px;
    color: #d1cde0;
    transition: color 0.2s ease;
  }

  .reader-bar > a:hover {
    color: #ffffff;
  }

  .reader-bar .icon-button {
    padding: 8px;
  }

  @media (max-width: 600px) {
    .reader-bar {
      padding: 0 14px;
      gap: 10px;
      height: 58px;
    }
    .page-stack {
      padding-top: 58px;
    }
    .reader-tools {
      gap: 6px;
    }
    .reader-bar strong {
      max-width: 36vw;
      font-size: 12px;
    }
    .reader-bar span {
      font-size: 10px;
    }
    .end-heading {
      font-size: 22px;
    }
  }

  .xp-toast {
    position: fixed;
    top: 76px;
    right: 20px;
    z-index: 100;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 999px;
    background: rgba(20, 16, 32, 0.95);
    border: 1px solid rgba(201, 170, 115, 0.5);
    color: #dfc28d;
    font-size: 13px;
    font-weight: 700;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(201, 170, 115, 0.25);
    backdrop-filter: blur(12px);
  }
</style>
