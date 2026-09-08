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
    fullscreen = $state(false);
  const visible = new SvelteSet<number>();
  let sending = false;
  let maxSeenPage = $state(1);
  let chapterCompleted = $state(!!data.progress?.completed_at);
  let previousChapterId = data.chapter.id;

  $effect(() => {
    if (data.chapter.id !== previousChapterId) {
      previousChapterId = data.chapter.id;
      visible.clear();
      const saved = data.progress?.page || Number(readPreference(`nox-page:${data.chapter.id}`)) || 1;
      current = saved;
      maxSeenPage = saved;
      chapterCompleted = !!data.progress?.completed_at;
      requestAnimationFrame(() => jump(Math.min(data.pages.length, Math.max(1, saved))));
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
      clearInterval(timer);
      endObserver?.disconnect();
      window.removeEventListener('pagehide', saveOnExit);
      saveOnExit();
    };
  });
</script>

<svelte:head
  ><title>{data.chapter.works?.title} — Capítulo {data.chapter.number} | Project Nox</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>
<div class="reader-shell">
  <header class="reader-bar">
    <a
      href={data.preview ? `/admin/obras/${data.chapter.work_id}` : `/obra/${data.chapter.works?.slug}`}
      aria-label="Voltar para obra"><ArrowLeft size={20} /></a
    >
    <div>
      <strong>{data.chapter.works?.title}</strong><span
        >Capítulo {data.chapter.number}{data.preview ? ' · Prévia editorial' : ''}</span
      >
    </div>
    <div class="reader-tools">
      <span>{current}/{data.pages.length}</span><button
        class="icon-button"
        aria-label="Ajustes de leitura"
        onclick={() => (settings = !settings)}><Settings2 size={20} /></button
      >{#if fullscreen}<button class="icon-button" aria-label="Alternar tela cheia" onclick={full}
          ><Maximize size={19} /></button
        >{/if}
    </div>
  </header>
  {#if settings}<aside class="reader-settings">
      <label class="field"
        >Largura de leitura<input type="range" min="400" max="1200" step="50" bind:value={width} /></label
      ><label class="small"><input type="checkbox" bind:checked={gap} /> Separar páginas tradicionais</label
      ><label class="field" style="margin-top:20px"
        >Ir para página<select value={current} onchange={(e) => jump(Number(e.currentTarget.value))}
          >{#each data.pages as page (page.position)}<option value={page.position}>{page.position}</option
            >{/each}</select
        ></label
      ><button class="button secondary compact" onclick={() => (settings = false)}>Fechar ajustes</button>
    </aside>{/if}
  {#if notice}<div class="notice reading-width" role="status">{notice}</div>{/if}
  {#if xpNotice}
    <div class="xp-toast" role="status">
      <Sparkles size={16} />
      <span>{xpNotice}</span>
    </div>
  {/if}
  <div class="page-stack" style="max-width:{width}px;gap:{gap ? '20px' : '0'}">
    {#each data.pages as page (page.position)}<ReaderPage {page} onSeen={seen} />{/each}
  </div>
  <div class="reader-end">
    <span class="eyebrow">ATÉ A PRÓXIMA PÁGINA</span>
    <h2>Fim do capítulo {data.chapter.number}.</h2>
    <div class="row">
      {#if data.previous}<a class="button secondary" href="/ler/{data.previous.id}"
          ><ArrowLeft size={17} /> Anterior</a
        >{/if}{#if data.next}<a class="button" href="/ler/{data.next.id}"
          >Próximo capítulo <ArrowRight size={17} /></a
        >{:else}<a class="button" href="/obra/{data.chapter.works?.slug}">Voltar para a obra</a>{/if}
    </div>
    <p class="small muted">Edição Project Nox · Obrigado por ler com a gente.</p>
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
  }
  .reader-bar {
    height: 64px;
    position: sticky;
    top: 0;
    z-index: 20;
    background: rgba(8, 10, 18, 0.88);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 0 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }
  .reader-bar > div:nth-child(2) {
    min-width: 0;
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
  .reader-tools > span {
    font-size: 12px;
    font-weight: 600;
    color: #c9aa73;
    margin: 0;
  }
  .page-stack {
    margin: auto;
    display: flex;
    flex-direction: column;
  }
  .reader-settings {
    position: fixed;
    top: 72px;
    right: 18px;
    z-index: 30;
    width: 290px;
    background: rgba(13, 16, 26, 0.95);
    border: 1px solid rgba(181, 154, 245, 0.3);
    backdrop-filter: blur(20px);
    padding: 24px;
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
  }
  .reader-end {
    padding: 72px 20px 48px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .reader-end h2 {
    font-size: 28px;
    color: #ffffff;
    margin: 0;
  }
  .reader-comments {
    max-width: 850px;
    margin: auto;
    padding: 0 22px 30px;
  }
  .reader-progress {
    height: 3px;
    position: fixed;
    bottom: 0;
    left: 0;
    background: linear-gradient(90deg, #8b5cf6, #c9aa73);
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.6);
    z-index: 50;
    transition: width 0.3s ease;
  }
  .back-top {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: rgba(18, 22, 36, 0.8);
    border: 1px solid rgba(181, 154, 245, 0.3);
    border-radius: 50%;
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  }
  .reader-bar > a {
    padding: 8px;
  }
  .reader-bar .icon-button {
    padding: 8px;
  }
  @media (max-width: 600px) {
    .reader-bar {
      padding: 0 12px;
      gap: 10px;
      height: 58px;
    }
    .reader-tools {
      gap: 6px;
    }
    .reader-bar strong {
      max-width: 38vw;
      font-size: 12px;
    }
    .reader-bar span {
      font-size: 10px;
    }
    .reader-end h2 {
      font-size: 22px;
    }
  }

  .xp-toast {
    position: fixed;
    top: 70px;
    right: 20px;
    z-index: 100;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 999px;
    background: rgba(20, 16, 32, 0.95);
    border: 1px solid rgba(201, 170, 115, 0.5);
    color: #c9aa73;
    font-size: 13px;
    font-weight: 700;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(201, 170, 115, 0.25);
    backdrop-filter: blur(12px);
  }
</style>
