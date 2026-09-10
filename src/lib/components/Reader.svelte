<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { SvelteSet } from 'svelte/reactivity';
  import { ArrowLeft, ArrowRight, Settings2, Maximize, ChevronUp, ChevronDown, Sparkles, Flag, List, X, BookOpen, Download } from '@lucide/svelte';
  import ReaderPage from '$lib/components/ReaderPage.svelte';
  import Comments from '$lib/components/Comments.svelte';
  import ReportModal from '$lib/components/ReportModal.svelte';
  import { action } from '$lib/actions';
  import { readPreference, savePreference } from '$lib/preferences';
  import { saveChapterOffline } from '$lib/offline-storage';
  import type { PageData } from '../../routes/ler/[id]/$types';
  let { data }: { data: PageData } = $props();
  let current = $state(1),
    settings = $state(false),
    width = $state(850),
    gap = $state(false),
    preloadMode = $state<'full' | 'off'>('full'),
    notice = $state(''),
    xpNotice = $state(''),
    fullscreen = $state(false),
    uiVisible = $state(true),
    showReportModal = $state(false),
    showChaptersDrawer = $state(false);
  const visible = new SvelteSet<number>();
  let sending = false;
  let maxSeenPage = $state(1);
  let chapterCompleted = $state(false);

  const REACTION_CONFIG = [
    { id: 'heart', emoji: '❤️', label: 'Amei' },
    { id: 'fire', emoji: '🔥', label: 'Épico' },
    { id: 'cry', emoji: '😭', label: 'Emocionante' },
    { id: 'shock', emoji: '😱', label: 'Chocado' },
    { id: 'laugh', emoji: '😂', label: 'Hilário' }
  ];

  let reactionCounts = $state<Record<string, number>>({});
  let userReactions = $state(new Set<string>());
  let reactionsLoading = $state(false);

  async function loadReactions(chapterId: string) {
    if (!chapterId || typeof window === 'undefined') return;
    try {
      const res = await fetch(`/api/chapter-reactions?chapterId=${encodeURIComponent(chapterId)}`);
      if (res.ok) {
        const d = await res.json();
        reactionCounts = d.counts || {};
        userReactions = new Set(d.userReactions || []);
      }
    } catch {
      // silent fallback
    }
  }

  async function toggleReaction(emoji: string) {
    if (!data.chapter?.id || reactionsLoading || typeof window === 'undefined') return;
    reactionsLoading = true;
    const had = userReactions.has(emoji);
    const newSet = new Set(userReactions);
    const newCounts = { ...reactionCounts };
    if (had) {
      newSet.delete(emoji);
      newCounts[emoji] = Math.max(0, (newCounts[emoji] || 1) - 1);
    } else {
      newSet.add(emoji);
      newCounts[emoji] = (newCounts[emoji] || 0) + 1;
    }
    userReactions = newSet;
    reactionCounts = newCounts;

    try {
      const res = await fetch('/api/chapter-reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId: data.chapter.id, emoji })
      });
      if (res.ok) {
        const d = await res.json();
        reactionCounts = d.counts || {};
        userReactions = new Set(d.userReactions || []);
      }
    } catch {
      // Keep optimistic state
    } finally {
      reactionsLoading = false;
    }
  }

  let downloadingOffline = $state(false);

  async function handleDownloadChapter() {
    if (downloadingOffline || !data.chapter || !data.pages?.length) return;
    downloadingOffline = true;
    notice = 'Baixando páginas para leitura offline...';
    try {
      await saveChapterOffline(
        data.chapter,
        data.chapter.works || { title: 'Obra', slug: '' },
        data.pages,
        (loaded, total) => {
          notice = `Baixando para offline: ${loaded}/${total} páginas...`;
        }
      );
      notice = '✦ Capítulo salvo com sucesso para leitura offline!';
      setTimeout(() => { notice = ''; }, 4000);
    } catch {
      notice = 'Falha ao salvar capítulo para leitura offline.';
    } finally {
      downloadingOffline = false;
    }
  }

  let xpAwardConfirmed = $state(false);
  let xpClaimInFlight = false;
  let previousChapterId = $state('');
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  const preloadedMedia = new Set<string>();
  const inFlightPreloads = new Set<string>();
  const MAX_CONCURRENT_PRELOADS = 3;

  function pumpPreload() {
    if (preloadMode !== 'full' || typeof window === 'undefined' || !data.pages?.length) return;
    if (inFlightPreloads.size >= MAX_CONCURRENT_PRELOADS) return;

    const startIdx = Math.max(0, current - 1);
    const ordered = [
      ...data.pages.slice(startIdx),
      ...data.pages.slice(0, startIdx)
    ];

    for (const page of ordered) {
      if (inFlightPreloads.size >= MAX_CONCURRENT_PRELOADS) break;
      const id = page.media_id;
      if (!id || preloadedMedia.has(id) || inFlightPreloads.has(id)) continue;

      inFlightPreloads.add(id);
      const img = new Image();
      const onDone = () => {
        inFlightPreloads.delete(id);
        preloadedMedia.add(id);
        pumpPreload();
      };
      img.onload = onDone;
      img.onerror = onDone;
      img.src = `/media/${id}`;
    }
  }

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
      preloadedMedia.clear();
      inFlightPreloads.clear();
      loadReactions(data.chapter.id);
      const saved = data.progress?.page || Number(readPreference(`nox-page:${data.chapter.id}`)) || 1;
      current = saved;
      maxSeenPage = saved;
      chapterCompleted = !!data.progress?.completed_at;
      xpAwardConfirmed = chapterCompleted;
      xpClaimInFlight = false;
      requestAnimationFrame(() => {
        jump(Math.min(data.pages.length, Math.max(1, saved)));
        pumpPreload();
      });
      if (!data.preview) {
        fetch(`/api/chapters/${data.chapter.id}/view`, { method: 'POST' }).catch(() => {});
      }
      resetHideTimer();
    }
  });

  async function claimXp(retries = 3) {
    if (xpAwardConfirmed || xpClaimInFlight || !data.profile || data.preview) return;
    xpClaimInFlight = true;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = (await action('member', 'claim_xp', {
          chapter_id: data.chapter.id
        })) as { awarded?: boolean; reason?: string } | null;
        if (res?.awarded) {
          xpAwardConfirmed = true;
          xpNotice = '✦ Capítulo Concluído! +25 XP';
          setTimeout(() => { xpNotice = ''; }, 5000);
          break;
        }
        // Server says not ready yet (e.g. reading_time_not_met) — retry after a delay.
        if (res?.reason === 'not_finished' || res?.reason === 'reading_time_not_met') {
          if (attempt < retries - 1) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        // Already awarded or other terminal reason — stop retrying.
        if (res?.reason === 'already_awarded') {
          xpAwardConfirmed = true;
          break;
        }
        break;
      } catch {
        if (attempt < retries - 1) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    xpClaimInFlight = false;
  }

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
        // Completion registered — now claim XP separately with retry.
        void claimXp();
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
    if (visible.size) {
      current = Math.min(...visible);
      pumpPreload();
    }
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
      preloadMode = prefs.preload === 'off' ? 'off' : 'full';
    } catch {
      /* Default preferences remain valid. */
    }
    const saved = data.progress?.page || Number(readPreference(`nox-page:${data.chapter.id}`)) || 1;
    maxSeenPage = saved;
    requestAnimationFrame(() => {
      jump(Math.min(data.pages.length, Math.max(1, saved)));
      pumpPreload();
    });
    if (!data.preview) {
      fetch(`/api/chapters/${data.chapter.id}/view`, { method: 'POST' }).catch(() => {});
    }
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
      savePreference('nox-reader', JSON.stringify({ width, gap, preload: preloadMode }));
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
      savePreference('nox-reader', JSON.stringify({ width, gap, preload: preloadMode }));
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
      preloadedMedia.clear();
      inFlightPreloads.clear();
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
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
      return;
    }
    if (e.key === 'Escape') {
      settings = false;
      showChaptersDrawer = false;
      showReportModal = false;
      resetHideTimer();
    } else if (e.key === 'ArrowUp' || e.key === 'Home') {
      if (!showChaptersDrawer && !showReportModal) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (e.key === 'ArrowDown' || e.key === 'End') {
      if (!showChaptersDrawer && !showReportModal) {
        e.preventDefault();
        document.getElementById('chapter-end')?.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (e.key === 'ArrowLeft') {
      if (!showChaptersDrawer && !showReportModal && data.previous?.id) {
        e.preventDefault();
        goto(`/ler/${data.previous.id}`);
      }
    } else if (e.key === 'ArrowRight') {
      if (!showChaptersDrawer && !showReportModal && data.next?.id) {
        e.preventDefault();
        goto(`/ler/${data.next.id}`);
      }
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
      {#if data.siblings && data.siblings.length > 1}
        <button
          class="icon-button"
          aria-label="Lista de capítulos"
          title="Ver todos os capítulos"
          onclick={() => {
            showChaptersDrawer = true;
            uiVisible = true;
          }}
        >
          <List size={19} />
        </button>
      {/if}
      <button
        class="icon-button"
        aria-label="Baixar capítulo para ler offline"
        title="Baixar capítulo para ler offline"
        onclick={handleDownloadChapter}
        disabled={downloadingOffline}
      >
        <Download size={18} />
      </button>
      <button
        class="icon-button"
        aria-label="Reportar problema"
        title="Reportar problema neste capítulo"
        onclick={() => {
          showReportModal = true;
          uiVisible = true;
        }}
      >
        <Flag size={18} />
      </button>
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
      <label class="field" style="margin-top:14px">
        Pré-carregamento
        <select
          value={preloadMode}
          onchange={(e) => {
            preloadMode = e.currentTarget.value as 'full' | 'off';
            savePreference('nox-reader', JSON.stringify({ width, gap, preload: preloadMode }));
            if (preloadMode === 'full') pumpPreload();
          }}
        >
          <option value="full">Capítulo inteiro (Padrão)</option>
          <option value="off">Desativado (Economia de dados/RAM)</option>
        </select>
      </label>
      <label class="field" style="margin-top:14px">
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

  <div class="reader-end" id="chapter-end">
    <div class="celebration-seal">
      <Sparkles size={15} />
      <span>CAPÍTULO CONCLUÍDO</span>
    </div>
    <h2 class="end-heading">Fim do Capítulo {data.chapter.number}</h2>
    <p class="end-sub">
      {data.chapter.works?.title} · {data.scans?.length ? data.scans.map((s) => s.name).join(' × ') : 'Project Nox'}
    </p>

    <div class="chapter-reactions-box">
      <span class="reactions-title">O que achou deste capítulo?</span>
      <div class="chapter-reactions-cluster">
        {#each REACTION_CONFIG as item}
          <button
            type="button"
            class="reaction-btn"
            class:active={userReactions.has(item.id)}
            onclick={() => toggleReaction(item.id)}
            title={item.label}
            aria-label={item.label}
          >
            <span class="reaction-emoji">{item.emoji}</span>
            <span class="reaction-label">{item.label}</span>
            {#if (reactionCounts[item.id] || 0) > 0}
              <span class="reaction-count">{reactionCounts[item.id]}</span>
            {/if}
          </button>
        {/each}
      </div>
    </div>

    <div class="end-nav-cluster">
      <div class="end-nav-primary">
        {#if data.previous}
          <a class="btn-nav-prev" href="/ler/{data.previous.id}">
            <ArrowLeft size={16} />
            <span>Capítulo Anterior</span>
          </a>
        {/if}
        {#if data.next}
          <a class="btn-nav-next hero-next" href="/ler/{data.next.id}">
            <span>Próximo Capítulo</span>
            <ArrowRight size={16} />
          </a>
        {/if}
      </div>

      <div class="end-nav-secondary">
        {#if data.siblings && data.siblings.length > 0}
          <button
            type="button"
            class="btn-nav-secondary-action btn-nav-drawer"
            onclick={() => (showChaptersDrawer = true)}
            aria-label="Ver todos os capítulos"
          >
            <List size={16} />
            <span>Ver Todos os Capítulos</span>
          </button>
        {/if}
        <a class="btn-nav-secondary-action btn-nav-work" href="/obra/{data.chapter.works?.slug}">
          <BookOpen size={16} />
          <span>Ver Página da Obra</span>
        </a>
      </div>
    </div>
    <div class="end-report-wrap">
      <button
        type="button"
        class="btn-report-subtle"
        onclick={() => (showReportModal = true)}
      >
        <Flag size={13} />
        <span>Reportar problema neste capítulo (páginas quebradas, ordem incorreta)</span>
      </button>
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
  <div class="scroll-nav-cluster" class:ui-hidden={!uiVisible && !settings}>
    <button
      class="scroll-nav-btn icon-button"
      aria-label="Voltar ao topo"
      title="Voltar ao topo (↑ ou Home)"
      onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ChevronUp size={20} />
    </button>
    <button
      class="scroll-nav-btn icon-button"
      aria-label="Ir ao fim do capítulo"
      title="Ir ao fim do capítulo (↓ ou End)"
      onclick={() => document.getElementById('chapter-end')?.scrollIntoView({ behavior: 'smooth' })}
    >
      <ChevronDown size={20} />
    </button>
  </div>
  <div class="reader-progress" style="width:{(current / Math.max(1, data.pages.length)) * 100}%"></div>

  {#if showReportModal}
    <ReportModal
      targetType="CHAPTER"
      chapterId={data.chapter.id}
      targetTitle={`${data.chapter.works?.title || 'Obra'} — Cap. ${data.chapter.number}`}
      pageNumber={current}
      onclose={() => (showReportModal = false)}
      onsuccess={() => {
        showReportModal = false;
        notice = 'Reporte enviado com sucesso para a moderação.';
      }}
    />
  {/if}

  {#if showChaptersDrawer}
    <div
      class="drawer-backdrop"
      onclick={() => (showChaptersDrawer = false)}
      onkeydown={(e) => { if (e.key === 'Escape') showChaptersDrawer = false; }}
      role="button"
      tabindex="0"
      aria-label="Fechar lista de capítulos"
    ></div>
    <aside class="drawer-panel" aria-label="Navegação de Capítulos">
      <div class="drawer-header">
        <div class="drawer-title-box">
          <BookOpen size={17} class="drawer-header-icon" />
          <span class="drawer-title">Capítulos</span>
          <span class="drawer-count">{data.siblings?.length || 0}</span>
        </div>
        <button
          type="button"
          class="btn-drawer-close"
          onclick={() => (showChaptersDrawer = false)}
          aria-label="Fechar lista de capítulos"
        >
          <X size={18} />
        </button>
      </div>
      <div class="drawer-work-info">
        <span>Obra:</span>
        <strong>{data.chapter.works?.title}</strong>
      </div>
      <div class="drawer-list">
        {#each (data.siblings || []) as sibling}
          {@const isCurrent = sibling.id === data.chapter.id}
          <a
            href="/ler/{sibling.id}"
            class="drawer-item"
            class:current={isCurrent}
            onclick={() => (showChaptersDrawer = false)}
          >
            <span class="drawer-item-number">Capítulo {sibling.number}</span>
            {#if isCurrent}
              <span class="drawer-current-badge">Lendo agora</span>
            {/if}
          </a>
        {/each}
      </div>
    </aside>
  {/if}
</div>

<style>
  .end-report-wrap {
    margin-top: 20px;
    display: flex;
    justify-content: center;
  }

  .btn-report-subtle {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #8c899a;
    font-size: 12px;
    padding: 7px 16px;
    border-radius: 999px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-report-subtle:hover {
    color: #f87171;
    border-color: rgba(248, 113, 113, 0.3);
    background: rgba(239, 68, 68, 0.08);
  }
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

  .end-nav-cluster {
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: center;
    width: 100%;
    max-width: 620px;
  }

  .end-nav-primary {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    width: 100%;
  }

  .end-nav-secondary {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    width: 100%;
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

  .btn-nav-next.hero-next {
    background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
    box-shadow: 0 6px 24px rgba(124, 58, 237, 0.45);
    font-weight: 700;
  }

  .btn-nav-next.hero-next:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 10px 32px rgba(124, 58, 237, 0.65);
  }

  .btn-nav-secondary-action {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #b5b0cb;
    font-size: 13.5px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-nav-secondary-action:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(181, 154, 245, 0.35);
    color: #ffffff;
    transform: translateY(-1px);
  }

  /* Chapter Reactions */
  .chapter-reactions-box {
    margin: 8px 0 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 540px;
  }

  .reactions-title {
    font-size: 12px;
    font-weight: 700;
    color: #9d98b3;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .chapter-reactions-cluster {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
    width: 100%;
  }

  .reaction-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    color: #cfcbe2;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    user-select: none;
    touch-action: manipulation;
  }

  .reaction-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(181, 154, 245, 0.3);
    transform: translateY(-2px);
    color: #ffffff;
  }

  .reaction-btn:active {
    transform: scale(0.96);
  }

  .reaction-btn.active {
    background: rgba(139, 92, 246, 0.18);
    border-color: rgba(139, 92, 246, 0.5);
    color: #ffffff;
    box-shadow: 0 0 16px rgba(139, 92, 246, 0.25);
  }

  .reaction-emoji {
    font-size: 16px;
    line-height: 1;
  }

  .reaction-label {
    font-size: 12.5px;
  }

  .reaction-count {
    font-size: 11.5px;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
    padding: 1px 6px;
    border-radius: 999px;
    margin-left: 2px;
  }

  .reaction-btn.active .reaction-count {
    background: rgba(139, 92, 246, 0.5);
    color: #ffffff;
  }

  /* Chapter Drawer Component */
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(4, 5, 10, 0.75);
    backdrop-filter: blur(6px);
    z-index: 900;
    border: none;
    cursor: pointer;
  }

  .drawer-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(380px, 88vw);
    background: #0d0f18;
    border-left: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: -10px 0 40px rgba(0, 0, 0, 0.85);
    z-index: 901;
    display: flex;
    flex-direction: column;
    animation: drawerSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes drawerSlideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .drawer-title-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.drawer-header-icon) {
    color: #dfc28d;
  }

  .drawer-title {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
  }

  .drawer-count {
    font-size: 11px;
    font-weight: 700;
    color: #dfc28d;
    background: rgba(201, 170, 115, 0.12);
    border: 1px solid rgba(201, 170, 115, 0.3);
    padding: 2px 8px;
    border-radius: 999px;
  }

  .btn-drawer-close {
    background: transparent;
    border: none;
    color: #8c889f;
    padding: 6px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .btn-drawer-close:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .drawer-work-info {
    padding: 10px 20px;
    font-size: 12px;
    color: #8c889f;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .drawer-work-info strong {
    color: #d1cde0;
    margin-left: 4px;
  }

  .drawer-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .drawer-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid transparent;
    color: #cfcbe2;
    text-decoration: none;
    font-size: 13.5px;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .drawer-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .drawer-item.current {
    background: rgba(139, 92, 246, 0.14);
    border-color: rgba(139, 92, 246, 0.4);
    color: #dfc28d;
    font-weight: 700;
  }

  .drawer-current-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #dfc28d;
    background: rgba(201, 170, 115, 0.15);
    border: 1px solid rgba(201, 170, 115, 0.3);
    padding: 2px 7px;
    border-radius: 999px;
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

  .scroll-nav-cluster {
    position: fixed;
    bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    right: calc(20px + env(safe-area-inset-right, 0px));
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 40;
    transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .scroll-nav-cluster.ui-hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateY(16px);
  }

  .scroll-nav-btn {
    background: rgba(18, 22, 36, 0.88);
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
  }

  .scroll-nav-btn:hover {
    color: #ffffff;
    border-color: #b59af5;
    background: rgba(181, 154, 245, 0.2);
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
    .end-nav-cluster,
    .end-nav-primary,
    .end-nav-secondary {
      width: 100%;
      flex-direction: column;
      gap: 10px;
    }
    .btn-nav-prev,
    .btn-nav-next,
    .btn-nav-secondary-action {
      width: 100%;
      justify-content: center;
      padding: 13px 18px;
      box-sizing: border-box;
    }
    .chapter-reactions-cluster {
      gap: 6px;
    }
    .reaction-btn {
      padding: 8px 11px;
      font-size: 12px;
    }
    .drawer-panel {
      width: 100vw;
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
